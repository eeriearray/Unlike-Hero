# Neon Casino — design

A private casino night for friends: one room, one shared economy, several tables. All money is virtual chips.
No real-money deposits, purchases or cash-outs exist anywhere in the code.

## Architecture

```
browser (games/casino/index.html, React 18 + htm, no build)        hub server (npm start)
  js/net.js  ── Socket.io /games/casino/socket.io ──────────────►   games/casino/server/index.mjs   sockets, seats, rate limits, persistence
                ◄── 'state' (this player's view only) ───────────     games/casino/server/room.mjs    CasinoRoom: players, host, settings, session, feed, chat
                                                                      games/casino/server/economy.mjs Economy: wallets, ledger, bets, rounds, audit
                                                                      games/casino/server/games/*.mjs one engine per table game (blackjack.mjs today)
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
`settle` (reserved −staked, cash +payout), `loan`, `repay`, `interest`, `p2p-lend`, `p2p-borrow`, `p2p-repay`, `fee`.

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

## Loans and debt (Stage 3)

- **Casino loans:** borrow up to `creditLimit`, never past `maxDebt` (principal + interest). `loan` adds equal cash and
  debt. Interest accrues every `interestEveryMin` minutes of live play at `interestPct` on outstanding principal
  (simple interest, rounded up to a whole chip). Each loan has a due time `termMin` after it was taken.
  `repay` pays interest first, then principal, from cash only.
- **Player loans:** an offer (amount, interest %, term) is a proposal until both sides accept. Counter-offers replace
  it. On acceptance the lender's cash moves to the borrower and both get `owes` / `owed`. Repayment moves cash back.
- **Anti-exploit:** no self-loans; one open offer per pair; a lender needs the cash at acceptance; loans count toward
  `maxDebt`; borrowing is disabled while bankrupt; no plain gifts or transfers exist, so there's no loop to farm.

## Bankruptcy (Stage 3)

Evaluated after every settlement, loan, repayment and interest charge, never because of one lost hand alone:

A player is **bankrupt** when all hold:
1. no open bets (`reserved == 0`) — an unresolved hand might still pay out;
2. `cash` is below the lowest table minimum;
3. the casino credit they could still draw (`min(creditLimit − debt, maxDebt − debt − interest)`, 0 if loans are off)
   would not lift cash to the table minimum;
4. with `bankruptcy.mode: 'floor'` also when net worth falls to `−netWorthFloor` or below, regardless of 1–3.

Bankrupt players can't bet or borrow, stay in the room, spectate, chat and react. Their debt stays on the books and in
final rankings. Nothing is forgiven and no money is created. They play again only after the host restarts the session.

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
3. Loans, interest, repayments, debt limits, player loans, bankruptcy, spectator mode.
4. Texas Hold'em (side pots), Teen Patti (blind/seen), roulette.
5. Leaderboards polish, profiles, achievements, challenges, reactions, animations.
6. Edge-case and security testing, balancing, polish.
