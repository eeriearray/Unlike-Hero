# Sea of Chaos: Plunder · 6.0.0

A fast pirate brawl for **1v1, 2v2 and 3v3**. Bots fill any empty berths.

## The game in one breath

Scoop up glowing treasure → sail it home to your harbor to **bank** it → sink rivals so the gold *they* carry spills into the sea for you to steal. After three minutes, the crew with the most banked gold wins.

- **Carried gold is at risk.** It piles up on your deck (everyone can see it, and your name label shows how much you hold). Sink, and all of it spills out, plus a small bounty.
- **Your harbor** is the ring of buoys in front of your tower. Sail inside it to bank. It also repairs your hull, and the tower fires at enemy raiders.
- **Broadsides.** Cannons fire sideways and aim themselves at whoever is alongside, leading moving targets. Get a rival beside you and fire.
- **Treasure galleon** sails across the map at 2:10 and 1:02. It fights back, and sinking it bursts open ten chests.
- **Whirlpools** wander the sea on a random walk, lurching onto new headings without warning. They drag ships in, spin them and grind their hull in the eye. Loot gets trapped circling inside, so they make tempting bait. Boosting halves their grip, and bots steer around them.
- **Barrels** give power-ups: ✹ Big Guns (5-ball broadsides), ➤ Fair Wind (speed), ✚ Repair.
- **Final 30 seconds:** banked gold counts double.

## Controls

| | Keyboard / mouse | Touch |
|---|---|---|
| Steer | A / D or ← → | Left stick |
| Speed | Cruises by itself · W full sail · S brake | Always full sail; pull the stick back to brake |
| Fire | Space, F or click (hold to keep firing) | FIRE button |
| Boost | Shift | Boost button |
| Pause | Esc | ❚❚ |

## Files

| File | What it does |
|---|---|
| `plunder.js` | Host-only simulation: sailing, broadsides, loot, galleon, harbors, bots |
| `sea-map.js` | Map layout (harbors, islands, wreck) and collision |
| `view.js` | three.js renderer: sea shader, islands, ships, effects, camera |
| `main.js` | Menus, rooms, HUD, chart and the game loop |
| `input.js`, `network.js`, `audio.js`, `music.js`, `sound-design.js` | Controls, snapshots and synthesized audio |

Multiplayer is host-authoritative: the host simulates at 30Hz and sends columnar snapshots at 10Hz; clients send controls at 20Hz. Disconnected captains are handed to bots.

## Run and test

```sh
npm start   # then open http://localhost:8080/games/sea-of-chaos/
node --test test/sea-of-chaos.test.mjs
```

Play-testing switches: `?autopilot` lets the bot brain sail your ship, and `?at=SECONDS` starts a solo match later (for example `?at=150` jumps to the final rush).
