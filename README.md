# Unlike Hero — co-op game hub

A folder of browser games for two or more people who have to talk to win, plus a launcher that lists them.
Every game is self-contained in `games/<id>/` and plugs into the hub through a small shared SDK.

## Play

**Quickest (no install):** double-click `index.html`. The hub opens and every game runs.
Multiplayer between tabs and devices needs the server below.

**With multiplayer across devices:**

```bash
npm install
npm start
```

Open http://localhost:8080. Other devices on the same network use this computer's IP address, for example `http://192.168.1.20:8080`.
The server hosts the folder and relays game messages over WebSocket, so linked play works across devices with no setup.

## Games

| Game | Players | Notes |
| --- | --- | --- |
| [Short Fuse](games/short-fuse/) | 2 (Defuser + Expert) | 3D bomb defusal. The Expert opens `games/short-fuse/index.html#manual` and can link to the Defuser's case ID to see the live timer and strikes. |
| [Sea of Chaos: Arena](games/sea-of-chaos/) | 1–8 (shared crews) | First-person 3D pirate battle royale. One player hosts an arena and shares the 4-letter code; up to 4 players crew one ship (5–8 split into two), and AI pirate ships fill the arena to five. Solo play works offline. Keyboard and mouse. Ship, weapon and shark models are CC-BY-4.0 (KarmaDiya, nedds, KinanArts, Arnaud Bellour, Kieran3D on Sketchfab). |
| [Signal Pair](games/signal-pair/) | 2 (Caller + Operator) | Small example built from the starter template. Safe to delete. |

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
