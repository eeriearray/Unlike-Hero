# Neon Casino — design

A private casino night for friends: one room, one shared economy, several tables. All money is virtual chips.
No real-money deposits, purchases or cash-outs exist anywhere in the code.

## Architecture

```
browser (games/casino/index.html, React 18 + htm, no build)        hub server (npm start)
  js/net.js  ── Socket.io /games/casino/socket.io ──────────────►   games/casino/server/index.mjs   sockets, seats, rate limits, persistence
                ◄── 'state' (this player's view only) ───────────     games/casino/server/room.mjs    CasinoRoom: players, host, settings, session, feed, chat
                                                                      games/casino/server/economy.mjs Economy: wallets, ledger, bets, rounds, audit
                                                                      games/casino/server/games/*.mjs one engine per table game (blackjack, roulette, poker, teenpatti; kit.mjs shared)
                                                                      games/casino/server/data/       room snapshots (gitignored, never served)
```

It reuses the hub's existing game-server contract (`"server"` in `game.json`, loaded by `server/relay.mjs`), the same
pattern Mafia uses. `server/` folders are never served over HTTP, so deck order, hole cards and the RNG stay on the server.
The casino has no offline mode on purpose: a browser cannot be trusted with its own balance.

**Authority.** Clients send intents (`{ type: 'bet', table, amount }`). The server validates every field, applies the
change, and pushes each player a view built for them (`room.viewFor(playerId)`). A client never sends a balance or a payout.

**Concurrency.** Node runs each command to completion before the next one starts, and every economy operation validates
everything before it mutates anything. Two simultaneous bets from two tabs are processed one after the other; the
second sees the reduced cash. Bets carry an id, so a retried request is recognised instead of charged twice.

**Randomness.** `node:crypto` `randomInt` (CSPRNG) for shuffles (Fisher–Yates) and the roulette wheel. Tests inject a seeded RNG.

## Wallet

Every amount is a whole number of chips (`Number.isSafeInteger`, never floats).

| Field | Meaning |
| --- | --- |
| `cash` | Spendable now. |
| `reserved` | Locked in open bets. Always equals the sum of this player's open bets. |
| `debt` | Casino loan principal outstanding. |
| `interest` | Casino interest accrued and unpaid. |
| `owes` | Total owed to other players (player-to-player loans). |
| `owed` | Total other players owe this player. |
| `netWorth` | `cash + reserved + owed − debt − interest − owes`. Borrowing never changes net worth; interest lowers it. |
| `won` / `lost` | Lifetime sum of positive / negative round results this session. |
| `startingCash`, `peakNetWorth`, `lowNetWorth` | For rankings, comebacks and achievements. |

No field may ever go negative. The ledger refuses any posting that would make one negative (a programming error, not a
user error — user errors are caught earlier with a readable message).

## Ledger

Append-only. Every change to any wallet field is one entry, and the wallet is exactly the sum of its entries
(`economy.audit()` replays the ledger and checks this, plus `reserved == Σ open bets`).

```js
{ seq, at, session, playerId, type, cash, reserved, debt, interest, owes, owed,   // signed deltas
  balance: { cash, reserved, debt, interest, owes, owed },                       // after the entry
  roundId?, game?, tableId?, staked?, payout?, net?, memo }
```

Types: `stake` (session starting cash), `bet` (cash → reserved), `refund` (reserved → cash, round voided),
`settle` (reserved −staked, cash +payout), `loan`, `repay`, `interest`, `p2p-lend`, `p2p-borrow`, `p2p-repay`, `p2p-repaid`.
The audit also checks that `debt`, `owes` and `owed` equal the open loans, and the house keeps count of every chip it
pays out or takes in, so Σ(cash + reserved) + house = Σ starting cash at all times.

## Bets and rounds (exactly-once settlement)

A table game opens a **round**, players **reserve** bets into it, and the game **settles** the round once.

- `reserve({ betId, playerId, roundId, amount })` — integer > 0, ≤ cash, round open, betting not locked, player not bankrupt.
  The same `betId` twice returns the first bet (`duplicate: true`) and charges nothing.
- `settleRound(roundId, payouts, { mode, maxMultiplier })` — validated as a whole before anything changes:
  - payouts only to players who staked in the round, integers ≥ 0;
  - `mode: 'house'` (blackjack, roulette): each payout ≤ staked × the game's maximum multiplier;
  - `mode: 'pool'` (poker, Teen Patti): Σ payouts = Σ stakes (chips only move between players).
  A settled round can't be settled again; a second call returns the first result.
- `voidRound(roundId)` — refunds every open bet. Used when a session ends or a table closes mid-round.

Disconnecting does not touch money: open bets stay reserved and the game resolves them (auto-stand / auto-fold on
timeout), so refreshing can't cancel a losing bet.

## Loans and debt

Implemented in `server/bank.mjs` (rules) on top of `server/economy.mjs` (money). Interest and deadlines run on
**live time** — minutes of unpaused play — so pausing the session or restarting the server never costs anyone interest.

- **Casino loans:** borrow up to `creditLimit`, and never past `maxDebt` counting casino debt, interest and player
  debts. A loan adds equal cash and debt (net worth unchanged). Every `interestEveryMin` minutes of play each borrower
  is charged `interestPct`% of their principal, rounded up to a whole chip (simple interest). Each loan is due
  `termMin` minutes of play after it was taken. Repayments clear interest first, then the oldest loan.
- **Player loans:** one side proposes (lend or borrow) with an amount, a one-time interest rate (≤ `p2pMaxPct`%) and a
  term. The other side accepts, declines or counters; each counter bumps a version, and accepting needs the current
  version, so nobody can accept terms that changed under them. On acceptance the lender's cash moves to the borrower,
  who owes amount + interest; the lender is owed the same. Chips only move between the two.
- **Deadlines:** at a loan's deadline the lender (or the casino) takes what the borrower's cash covers, and keeps
  sweeping new cash (winnings, new loans) every few seconds until it is paid. Overdue debt never disappears.
- **Anti-exploit:** no self-loans; one open offer per pair, six per player; a lender needs the cash at acceptance;
  anyone who owes the casino can't lend (so casino credit can't be passed around); you can't lend to someone you
  still owe (no loops); player debts count toward the borrower's `maxDebt`; bankrupt players can't borrow or lend;
  there are no gifts or plain transfers.

## Bankruptcy

Checked after every settled round, loan, repayment, interest charge and collection — never because of one lost hand:

1. A player is **insolvent** when nothing of theirs is on a table (`reserved == 0`), their cash is below the lowest
   table minimum, and the casino credit they could still draw wouldn't lift them to it.
2. Insolvency starts a **60-second bailout clock** (frozen while paused). Everyone sees "Broke" on their row. A player
   loan, or anything else that makes them solvent, stops the clock.
3. If the clock runs out they are **bankrupt**. With `bankruptcy.mode: 'floor'` a player is also bankrupt at once when
   net worth reaches −`netWorthFloor`.

Bankrupt players stand up from their table, can't bet, borrow or lend, stay in the room, watch any table, chat and
react. Their wallet, debts and receivables stay on the books and in the final standings, which list every unpaid debt.
Nothing is forgiven and no chips are created. A host restart gives everyone a fresh, equal wallet.

## Table games

Every engine implements the same interface (`create, sit, leave, command, view, pause, resume, close, disconnected,
snapshot, restore`), keeps its state as plain JSON saved with the room, and moves money only through the economy.

| Game | Settles as | Key rules | Session ends mid-round |
| --- | --- | --- | --- |
| Blackjack | house, ≤ 2.5× stake | 6 decks, dealer peeks, stands on all 17s, 3:2, double, split to 4 hands | dealt hands play out and pay |
| Roulette | house, ≤ 36× stake | European single zero; straight, split, street, trio, corner, six line, dozens, columns, even money; zero sinks outside bets | a spinning ball lands and pays; unspun chips come back |
| Texas Hold'em | pool | blinds ½ min / min; up to the table maximum per hand; full-raise rule; side pots; uncalled bets returned | chips in the pot go back |
| Teen Patti | pool | boot = table min; blind pays the stake, seen pays double; raise doubles the stake; show with two left; pot limit 128 boots; all-in → show with side pots; no side shows | chips in the pot go back |

Disconnected players get a 6-second turn clock instead of 25; standing up folds or packs. Hidden cards (hole cards,
Teen Patti hands, the deck, the dealer's hole card) are only in the views of the players allowed to see them.

## Social layer

`server/social.mjs`. Nothing here can create money; everything is derived from settled results.

- **Achievements** (17, per session): awarded from settled rounds (first win, jackpot ≥ ½ starting cash, five wins in a
  row, table-maximum stake, high-roller win, all four games played, comeback from below half), from tags games put on a
  round before settling it (blackjack natural, straight-up roulette hit, four of a kind or better, a Teen Patti trail),
  from bank events (bailed out, casino paid off, a player loan repaid with interest), from challenges, and at session
  end (champion; survivor = finished solvent after dropping below a quarter of the stake). Each is awarded once.
- **Challenges:** high card, dice or a coin flip against one player, stake between the table minimum and maximum,
  60 s to accept. Both stakes are reserved only on acceptance (re-checked then), the server resolves with the CSPRNG
  and settles once as a pool, so the house takes nothing. One open challenge per pair.
- **Watching and hot tables:** opening a table view sends `watch`; tables report watchers and a `hot` label when the
  chips in play reach max($2,000, 20% of the stake) or someone is all in. Reactions carry the table they were sent from.
- **Profiles and history** are fetched on demand (`stats`, `session-history`) and don't trigger a state push. Net-worth
  trails are rebuilt from the ledger's per-entry balances, thinned to at most 60–80 points.

## Multiplayer state

```
CasinoRoom
  code, hostId, settings, createdAt
  session: { no, phase: lobby | live | paused | ended, startedAt, endsAt, remainingMs, rounds, summary }
  players: Map id → { id, name, avatar, joinedAt, connected, lastSeen, ready, tableId, status: active | spectator | bankrupt }
  credentials (server only): sha256(token), sha256(deviceKey) per player
  economy: Economy
  tables: [{ id, game, name, minBet, maxBet, highRoller, engine (Stage 2+) }]
  feed: notable events (joins, starts, resets, loans, big wins, bankruptcies)
  chat
```

- **Phases.** `lobby` (players join, set ready; host configures) → host starts when everyone connected is ready →
  `live` (betting open) ⇄ `paused` (betting locked, timers frozen) → `ended` (betting closed, open rounds voided or
  resolved, summary computed). `restart` (host, explicit confirmation) archives the session, resets every wallet to the
  same starting cash and tells every player; nothing else resets money.
- **Late joiners** get the starting stake if `lateJoin` is on, otherwise they spectate. The feed announces both.
- **Reconnection.** A seat is held by a random token (sessionStorage) and a device key (localStorage). Reconnecting,
  refreshing or rejoining the same room from the same device returns the same seat and wallet, so leaving and rejoining
  can't mint a fresh stake.
- **Host.** If the host leaves or stays offline for 90 s, the longest-seated connected player becomes host.
- **Persistence.** Rooms are snapshotted to `server/data/rooms.json` (debounced) and restored on start, so a server
  restart keeps every wallet and ledger. Idle rooms close after 24 hours.

## Stages

1. Rooms, profiles, shared wallet + ledger, lobby, host settings, session lifecycle, reconnection, persistence. ✅
2. Blackjack, fully playable, on the shared wallet: curved table scene, seated character silhouettes, dealer peek, S17, 3:2, double, split to four hands, turn timers. ✅
3. Loans, interest, repayments, debt limits, player loans, bankruptcy, spectator mode. ✅
4. Texas Hold'em (side pots), Teen Patti (blind/seen), roulette. ✅
5. Leaderboards polish, profiles, achievements, challenges, reactions, animations. ✅
6. Edge-case and security testing, balancing, polish.
