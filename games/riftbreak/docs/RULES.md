# RIFTBREAK — rulebook

Empty your hand while the rules of reality keep changing and a shared meter, the **Meltdown**, climbs toward collapse.
2–8 players (best with 5–8). One round is one match, about 10–15 minutes with a full table.

The rules below are implemented in `engine/riftbreak-engine.js`; the in-game help is generated from the same tables.

## 1. The deck (118 cards)

Four suits: **Cyan, Crimson, Gold, Violet**. Opposite pairs (used by the Mirror rule): Cyan ↔ Crimson, Gold ↔ Violet.

| Card | Per suit | Total | Effect |
| --- | --- | --- | --- |
| 0 | 1 | 4 | Number. **Coolant:** playing a 0 lowers Meltdown by 1. |
| 1–9 | 2 each | 72 | Number. |
| Skip | 2 | 8 | The next player loses their turn. |
| Reverse | 2 | 8 | Turn order flips. With two players it acts as a Skip. |
| Surge | 2 | 8 | Attack: +2 to the attack stack. Meltdown +1. |
| Stabilize | 1 | 4 | Meltdown −2. Can also block an attack (see 4). |
| Rift | 1 | 4 | Shifts reality to the next Reality Rule. Meltdown +1. |
| Wild | — | 4 | Choose the active color. |
| Overload | — | 4 | Wild attack: choose a color, +4 to the attack stack, Meltdown +1. |
| Wild Rift | — | 2 | Choose a color and shift reality. Meltdown +1. |

Seven cards each. One card is turned up to start the discard pile (redrawn until it is a number).
When the draw pile runs out, the discard pile (except its top card) is shuffled into a new draw pile.

## 2. A turn

Play one legal card, **or** draw one card. If a card you drew is legal you may play it straight away; otherwise your turn ends.

A card is legal when it matches the active **color**, the top card's **number**, or the top card's **symbol**.
Wild, Overload and Wild Rift are always legal. The current Reality Rule and the Meltdown stage can change this (below);
the game only ever lets you play legal cards and highlights them in your hand.

When rules disagree, this order decides (first match wins): facing an attack → Wilds → stage effects (Critical Rifts) →
rules that allow more (Open Fire) → rules that restrict (Odd World, Color Lock) → normal matching, plus Echo.
So a Rift at Critical can be played even under Color Lock.

Playing a Wild-type card includes choosing the color, so there is never a separate waiting step.

**Last card.** When you play your second-to-last card, press **Last card** first. If you don't, anyone can **Catch** you
until the next player finishes their turn, and you draw 2. You can still save yourself by pressing **Last card** before someone catches you.

The first player to empty their hand wins. Winning with any card, including an action card, counts.

## 3. Reality Rules and Rifts

The table starts on **Stable** (normal rules). Every match deals a shuffled **Rift queue** of six rules from the pool of nine;
the next rule in the queue is always visible. Playing a Rift (or a Reality Fracture collapse) replaces the current rule with the next one.
When the queue runs out it is reshuffled. Only one Reality Rule is ever active, so rules never stack on each other.

| Rule | In one sentence | Leans toward |
| --- | --- | --- |
| Odd World | Only odd numbers can be played; action and Wild cards still work. | hand management |
| Color Lock | Matching a number or symbol no longer counts — you must match the color. | hand management |
| Echo | A number one step away from the top number (4 → 3 or 5) can be played on any color. | flexibility |
| Aftershock | Every non-number card played raises Meltdown by 1. | aggression / danger |
| Low Gravity | Playing a lower number than the top number raises Meltdown by 1; a higher one lowers it by 1. | Meltdown control |
| Hot Potato | If you draw on your turn and don't play, you draw 1 more. | aggression |
| Mirror | At the end of every turn the active color flips to its opposite (Cyan ↔ Crimson, Gold ↔ Violet). | planning |
| Spotlight | Players holding 3 or fewer cards draw 2 instead of 1 when they draw on their turn. | catch-up |
| Open Fire | Surge cards can be played on any card. | aggression |

## 4. Attacks

Surge (+2) and Overload (+4) start or grow the **attack stack** against the next player. Facing a stack, you may:

1. **Counter** — play any Surge or Overload (color doesn't matter) to add to the stack and pass it on.
2. **Block** — play any Stabilize (color doesn't matter): you take only half the stack (rounded down), and Meltdown still drops by 2.
3. **Accept** — draw the whole stack. Your turn ends.

**Overcharge.** When you play an attack you may overcharge it: +1 card on the stack and Meltdown +1.

The stack is capped at **10**. Once it is at 10 it can't be countered, only blocked or accepted.

## 5. Meltdown

A shared meter from 0 to 10, starting at **2**. Every change is announced with its reason ("MELTDOWN +1 — Rift").
Cards in your hand show a small ▲/▼ badge with what playing them would do to the meter.

| Raises | Lowers |
| --- | --- |
| Rift / Wild Rift +1 | Stabilize −2 |
| Surge +1, Overload +1 | Any 0 card −1 |
| Overcharge +1 | Low Gravity: playing higher −1 |
| Aftershock: any non-number card +1 | |
| Low Gravity: playing lower +1 | |

| Stage | Meltdown | Effect |
| --- | --- | --- |
| Unstable | 0–3 | Normal play. |
| Critical | 4–6 | Rift cards can be played on any card. |
| Breaking | 7–9 | As Critical, and every attack card adds +1 to its penalty. |
| **Collapse** | 10 | The announced Collapse Event happens, then Meltdown resets to 3. |

The next Collapse Event is always shown on the meter, so pushing the table toward 10 is a choice, not a gamble.
Events come from a shuffled bag of the four below (refilled when empty).

| Collapse Event | Effect |
| --- | --- |
| Shockwave | Every player except the one who caused the collapse draws 1. |
| Gravity Well | The player(s) holding the fewest cards draw 2. |
| Reality Fracture | Reality shifts to the next rule in the queue. |
| Chain Reaction | The next attack card played adds +2 more. |

## 6. Resolution order (deterministic)

For every card played:

1. The card goes to the discard pile; the active color becomes its color (or the chosen color).
2. Its effect resolves: Skip / Reverse / attack stack / block / Rift shift.
3. Meltdown changes are added up in a fixed order — the card, then Overcharge, then the Reality Rule — and applied as one change, clamped at 0.
4. If the player's hand is empty, they win now. Nothing else resolves.
5. If Meltdown reached 10, the Collapse Event resolves and Meltdown resets to 3.
6. The turn ends: Mirror flips the color, a missed Last-card call stays catchable, and play moves to the next player (skipping one if a Skip was played).

## 7. Safety rules

- Hand limit 25: cards that would go beyond it aren't drawn.
- If neither pile has cards, drawing does nothing and the turn passes.
- After 600 turns the player with the fewest cards wins (it has never come up in testing; it's a guarantee the match ends).
- Optional turn timer (off, 15, 25 or 40 seconds). When it runs out, the player draws (or accepts the attack) and the turn passes.
- A player who disconnects is played by a Normal bot after 10 seconds and gets their seat back when they reconnect.
- Someone who joins a room mid-match watches it and is dealt in at the next match.

## 8. Balance notes (from simulation)

Numbers below come from thousands of bot-vs-bot matches (`node --test` runs a smaller version of this every time).

| Table | Turns per match | Rifts | Collapses | Average Meltdown |
| --- | --- | --- | --- | --- |
| 2 players | ~54 | ~2.4 | ~0.5 | ~4.1 |
| 4 players | ~62 | ~3.1 | ~0.7 | ~4.5 |
| 6 players | ~73 | ~3.9 | ~1.0 | ~4.6 |
| 8 players | ~90 | ~5.3 | ~1.5 | ~4.9 |

Two changes came out of playtesting: Surge now raises Meltdown (attacks destabilize reality) and a match starts at
Meltdown 2. Before them the meter averaged under 3 and a Collapse happened in fewer than one match in four.

## 9. Bots

Bots read exactly what a human in their seat sees (`viewFor(botId)`) and send commands through the same path, so
they can't cheat or make illegal moves.

- **Easy** plays a random legal card (preferring plain cards), sometimes picks a poor color, forgets Last card 30% of the time.
- **Normal** scores every legal play: shedding, keeping Wilds, the colour it leaves itself, whether a Rift's next rule suits its hand,
  the Meltdown arithmetic and the announced Collapse, attacking players close to going out, blocking big stacks.
- **Hard** uses the same scoring with weights tuned by simulation against Normal bots, and also tracks which colours each
  opponent drew on (a public tell that they lack it) to pick Wild colours that strand the next player.

In simulation Hard wins about 20% more often than chance at a table of Normal bots, and about two-thirds of 1-v-1 games against Easy.
Bots think for 0.4–1.5 s depending on the room's Bot speed, plus a pause after Rift and Collapse announcements.
