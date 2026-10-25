# Unlike Hero — co-op game hub

A folder of browser games for two or more people who have to talk to win, plus a launcher that lists them.
Every game is self-contained in `games/<id>/` and plugs into the hub through a small shared SDK.

## Play

**Quickest (no install):** double-click `index.html`. The hub opens and every game runs.
Multiplayer between tabs and devices needs the server below.

**With friends (one step):** double-click `Start Hub.command` in Finder, or run:

```bash
npm run play
```

It stops an old copy of the hub, installs packages if needed, starts the server and prints the link to share
(copied to the clipboard). On a Mac the link is `http://<mac-name>.local:8080` when the network has no normal
address (an iPhone hotspot on an IPv6-only carrier), so it keeps working when the hotspot reconnects.

**With multiplayer across devices, by hand:**

```bash
npm install
npm start
```

Open http://localhost:8080. Other devices on the same network use this computer's IP address, for example `http://192.168.1.20:8080`.
The server hosts the folder and relays game messages over WebSocket, so linked play works across devices with no setup.

## Games

| Game | Players | Notes |
| --- | --- | --- |
| [Dragon Clash](games/dragon-clash/) | 1–8 (CPUs fill seats) | 2D dragon platform fighter: build a dragon on a 100-point budget in the Dragon Forge, then fight in 1v1, 2v2, 3v3, free-for-all, a local or online tournament, or training. Two keyboard layouts plus gamepads on one screen; online rooms run on the game's own server (loaded by `npm start`). Character art comes from the Dragon Warrior pack's idle sheet, processed into a recolourable cutout rig by `games/dragon-clash/tools/process_pack.py`. Details: `games/dragon-clash/README.md`. |
| [Short Fuse](games/short-fuse/) | 2 (Defuser + Expert) | 3D bomb defusal. The Expert opens `games/short-fuse/index.html#manual` and can link to the Defuser's case ID to see the live timer and strikes. |
| [Sea of Chaos: Flag Raiders](games/sea-of-chaos/) | 1–8 (free for all) | Third-person pirate arcade combat. Steal the Skull Flag from the central wreck, bring it to your personal buoy, and stash three to win. Solo play includes AI rivals and two Sea Raiders; host or join with a 4-letter room code. Keyboard, mouse and touch controls. |
| [Mafia](games/mafia/) | 4–16 (bots fill seats) | Social deduction with no moderator: an automated storyteller deals secret roles, runs the nights, reads the morning paper aloud (record the narrator in `record.html`) and runs the trials. Host a room and share the 6-digit code; online rooms run on the game's own server (loaded by `npm start`) so roles stay secret. Solo play against bots works offline. 12 optional roles. |
| [Party Pack](games/party-pack/) | 1–8 + audience (bots fill seats) | Eleven phones-as-controllers party games: The Comedy Writer, The Bluffing Game, The Terrible Artist, The Cutthroat Quiz, The Chaos Mashup, The Imposter's Pitch, Mind Meld, Who Said That?, Most Likely To, Guesstimate and Emoji Charades. Over 2,000 prompts, and each Main Stage remembers what it has shown so questions don't repeat until a game's whole list is used up. Open **Main Stage** on the TV or computer; everyone joins from their phone with the 4-character code. Give the hosts real voices: make the lines in `games/party-pack/voice/SCRIPT.md` with any text-to-speech service, upload them in the Voice Booth (`games/party-pack/#booth`), then commit `games/party-pack/voice`. Design document: `games/party-pack/docs/GDD.md`. |
| [Putt Club](games/putt-club/) | 1–8 (bots fill seats) | Multiplayer mini-golf: everyone plays each hole at once on their own device. Three diorama courses (Sunset Cove, Clockwork Garden, Neon Underground) × 6 holes, 12 power-ups, casual and 3/6/9-course tournaments. Host creates a room and shares the 4-letter code, link or QR. Rapier rigid-body physics runs on the game's server (authoritative scoring) and in the browser (aim preview); solo practice with bots works offline. |
| [RIFTBREAK](games/riftbreak/) | 2–8 (bots fill seats) | A shedding-card party game where the rules keep changing. Rift cards swap the active Reality Rule and a shared Meltdown meter climbs toward a Collapse Event. Quick Play against Easy/Normal/Hard bots works offline; online rooms (4-letter code or invite link) run on the game's own server, loaded by `npm start`, so hands stay secret. Rules and balance notes: `games/riftbreak/docs/RULES.md`. |
| [Neon Casino](games/casino/) | 1–12 | A private casino night: host a room, share the 5-character code, and everyone starts with the same play-money wallet that follows them to every table. The server is the bank (wallets, ledger, decks and wheel never reach a browser), and rooms survive a server restart. Rendered in 3D (three.js) as a dim back-room tavern with animal regulars, synthesised music and sound, and house bots the host can add. Tables: blackjack (plus a high-roller table), European roulette, no-limit Texas Hold'em, Teen Patti, Lucky Sevens slots and Jacks-or-Better video poker. Borrow from the casino or each other, watch the interest pile up, and go bankrupt if nobody bails you out. Challenge friends to high-card, dice or coin-flip duels, unlock 17 achievements, and replay the night in the session story. Design: `games/casino/docs/DESIGN.md`. |
| [RECESS](games/recess/) | 1–16 per room (2–8 per game, bots fill seats) | A school-desk game hub: one person makes a room, friends join with the 4-letter code on their own phones, and pairs or gangs pick games independently — Tic-Tac-Toe, Stone Paper Scissors, Dots & Boxes, Raja Mantri Chor Sipahi, FLAMES, Name Place Animal Thing, Bluff, Colour Colour, Snakes & Ladders, Ludo, Pen Fight, Marble Knockout and Carrom. Needs `npm start` (the game's own server keeps every move honest); rooms live in memory, so a restart ends them. |
| [The Hollow](games/the-hollow/) | 1–6 (ghost companions fill seats) | Dark-fantasy horror expedition, ~30–45 min. Explore 42 places across six regions, roll d20 checks with honest odds, uncover a four-part mystery, keep a secret objective, and vote on how the bell ends (14 conclusions). Server-authoritative: every roll and reward is decided on the server, each player sees only what they may know, rooms survive restarts and reconnects. Host a room and share the 4-letter code; solo and AI ghost companions work offline. Painted environments, illustrated characters, recorded audio and cinematic scares accompany a guided opening and a streamlined HUD. Full documentation: [games/the-hollow/README.md](games/the-hollow/README.md). |
| [Signal Pair](games/signal-pair/) | 2 (Caller + Operator) | Small example built from the starter template. Safe to delete. |

## Putt Club

```bash
npm install && npm start        # then open http://localhost:8080/games/putt-club/
```

Create a room, then friends on the same Wi-Fi scan the QR code or open the invite link (the game swaps
`localhost` for this computer's Wi-Fi address). To test alone, open two browser windows (or a normal and a
private window): create in one, join with the code in the other. **Practice solo** works without the server.

- Rules, physics and courses: `games/putt-club/engine/` (shared by server and browser). Courses are data in
  `engine/courses.js`; `node games/putt-club/tools/solver.js` proves every hole can be finished.
- Tests: `node --test test/putt-club-*.test.mjs` (physics, courses, rules and power-ups, real Socket.io rooms).
  `PUTT_FULL=1` also solves every mirrored tournament hole.
- Deploy: it is part of the hub server. Any Node 18+ host that runs `npm start` (e.g. Render, Fly.io, a home
  PC) serves the game and its rooms; set `PORT` if needed. WebSockets must be allowed. A static host alone can only
  offer solo practice.

## Mafia's narrator

Mafia's storyteller plays pre-recorded lines from `games/mafia/voice/`. To record them:

1. `npm start`, then open http://localhost:8080/games/mafia/record.html on the same computer.
2. Press **Record** (or **R**) on each of the ~100 short lines (about 30 minutes), read it, press again to stop. Takes save straight into
   `games/mafia/voice/`; silence is trimmed and a narrator effect (warmth, compression, room echo, optional
   "deepen") is applied when played. You can also **Upload** mp3/m4a/wav files made elsewhere (e.g. ElevenLabs).
3. Commit `games/mafia/voice/` so every player hears the recordings.

No line contains a player name, so one recording covers every game. Until the first line is recorded, the game
falls back to the browser's speech voice. Saving only works from the computer running the hub (localhost).

## Add a game

```bash
node tools/new-game.mjs my-game "My Game"
```

This copies `templates/coop-starter/` into `games/my-game/`, fills in the id and title, and rebuilds the registry. The game appears in the hub immediately. Edit `games/my-game/index.html` and `game.json` from there.

After editing any `game.json` by hand, run `npm run registry`.

## Folder layout

```
index.html                 the hub launcher (reads games/registry.js)
games/
  registry.js / .json      generated list of games — do not edit by hand
  short-fuse/              one folder per game: index.html, game.json, thumbnail.svg, assets
shared/sdk/
  hub-sdk.js               the game ↔ hub contract: identity, storage, results, exit, multiplayer rooms
  hub-config.js            default config (the server replaces it with its relay address)
templates/coop-starter/    starting point for new games
tools/                     build-registry.mjs, new-game.mjs
server/relay.mjs           static host + WebSocket relay (npm start)
docs/ARCHITECTURE.md       how it fits together, the manifest spec, the SDK API, and the path to a hosted platform
short-fuse.html            redirect from the game's old location
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before building the hosted platform.
