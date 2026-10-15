# Architecture

The hub is designed so that today's folder can become a hosted platform without rewriting the games.
Three rules make that possible:

1. **A game is a folder.** Everything a game needs lives in `games/<id>/`. Games never import from each other.
2. **A game describes itself.** `game.json` is the only thing the hub reads to list, launch and describe a game.
3. **A game talks to the hub through one contract.** `shared/sdk/hub-sdk.js` (window `Hub`). Games must also run with the SDK absent.

```
            ┌─────────────── hub (index.html, or the future platform) ───────────────┐
            │  reads games/registry.js  →  library cards  →  full-window <iframe>    │
            │  listens for postMessage { source: 'hub-game', type: ready|event|exit } │
            └──────────────────────────────────┬──────────────────────────────────────┘
                                               │ iframe  ?hub=1
                              ┌────────────────▼────────────────┐
                              │ games/<id>/index.html            │
                              │   Hub.init / report / storage    │
                              │   Hub.room(name)  ───────────────┼──► relay (server/relay.mjs or any compatible server)
                              └──────────────────────────────────┘        or BroadcastChannel (same browser)
```

## game.json (manifest)

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Lowercase, dashes. Must equal the folder name. Used for storage namespaces and room names. |
| `title` | yes | Display name. |
| `version` | yes | Semver of the game. Bump on every release so a platform can cache-bust. |
| `entry` | yes | Page to open, relative to the folder. May carry a `#hash`. |
| `tagline` | no | One sentence for the card. |
| `thumbnail` | no | Cover image (16:10 works best). |
| `accent` | no | Brand colour for the card. |
| `sdk` | no | SDK major version the game was built against, e.g. `"1.x"`. |
| `players` | no | `{ "min": 2, "max": 4 }`. |
| `roles` | no | `[{ "id", "name", "entry", "description" }]`. Each role can have its own entry page or hash. The first role is the default. |
| `multiplayer` | no | `{ "style", "sameDevice", "transports": ["local","relay"], "notes" }`. |
| `tags`, `requires`, `status` | no | Free-form metadata: `status` is `playable`, `prototype` or similar. |

`tools/build-registry.mjs` validates every manifest (required fields, id matches folder, entry exists) and writes
`games/registry.js` (a script, so the hub works from `file://`) and `games/registry.json` (for servers).

## Hub SDK v1 (`window.Hub`)

Load it with relative paths and guard every use:

```html
<script src="../../shared/sdk/hub-config.js"></script>
<script src="../../shared/sdk/hub-sdk.js"></script>
<script>
  const hub = window.Hub ? Hub.init({ id: 'my-game', version: '1.0.0', title: 'My Game' }) : null;
</script>
```

| Call | Purpose |
| --- | --- |
| `Hub.init(meta)` | Register the game; posts `ready` to the hub. Returns `Hub`. |
| `Hub.inHub` | `true` when running inside the hub (iframe or `?hub=1`). |
| `Hub.player()` | `{ id, name }` — the person playing; the name is set in the hub. |
| `Hub.storage(ns?)` | Namespaced local storage: `.get(key, default)`, `.set(key, value)`. |
| `Hub.report(event, data)` | Report progress. Standard events: `session-start` and `session-end` with `{ result: 'win'|'lose'|'quit', … }`. The hub keeps the last 50 sessions. |
| `Hub.exit()` | Return to the hub (posts `exit`, or navigates to `../../index.html` when standalone). |
| `Hub.room(name, opts?)` | Join a multiplayer room. Returns `{ on, emit, presence, peers, leave, transport }`. |

### Rooms

Everyone who calls `Hub.room('<game-id>:<code>')` with the same name hears each other.

- `room.emit(topic, data)` sends JSON to every other member; `room.on(topic, fn)` receives `(data, from)`.
- `room.presence(state)` publishes a small per-member state that late joiners receive.
- `room.on('peers', list => …)` fires when members join or leave; `room.peers()` reads the list.
- `room.on('status', s => …)` reports `connected` / `disconnected` for the relay transport (it reconnects automatically).
- Transport is chosen automatically: **relay** (WebSocket) when `relayUrl` is configured, otherwise **local** (`BroadcastChannel`, same browser only).
- Prefix room names with the game id so games never collide.
- Messages are relayed, not validated. Treat everything received as untrusted input, keep messages small (16 KB cap on the bundled relay), and send whole state rather than diffs where you can.

Short Fuse uses a room named `short-fuse:<case id>`: the Defuser emits `state` every second and on every strike, solve and result; the Expert's manual shows it live.

### Relay protocol

Plain JSON text frames over `ws(s)://host/relay?room=<name>`. The relay forwards each frame to every other socket in the same room and never echoes it back. Frames the SDK sends:

```json
{ "t": "hello" | "presence" | "leave" | "msg", "topic": "…", "data": {}, "state": {}, "from": "<connection id>", "player": "<player id>", "name": "…", "room": "…" }
```

Any server that implements this forwarding (Node, Cloudflare Durable Objects, Supabase Realtime bridge, etc.) can replace `server/relay.mjs`. Point games at it with `hub-config.js` (`window.HUB_CONFIG = { relayUrl }`) or `?relay=` on the URL.

### Hub ↔ game messages

Games post to the parent window: `{ source: 'hub-game', sdk, type: 'ready' | 'event' | 'exit', gameId, meta?, event?, data? }`.
A platform hosting games in iframes only needs to listen for these.

## Path to a hosted platform

The folder already works as a static site. When you build the platform:

1. **Hosting.** Serve the folder from any static host or CDN; deploy the relay separately (or as part of the same Node service). Set `relayUrl` in a generated `hub-config.js`.
2. **Catalog.** Read `games/registry.json` (or each `game.json`) to build the platform's own library and game pages.
3. **Accounts.** Replace `Hub.player()`'s local identity with the signed-in user (keep the same `{ id, name }` shape).
4. **Results and leaderboards.** Listen for `session-end` postMessages and store them server-side.
5. **Rooms at scale.** Add auth to the relay (signed room tokens), rate limits, and room size caps per game (`players.max`).
6. **Versioning.** Keep SDK v1 calls working; add new calls rather than changing old ones. Bump `sdk` in manifests when a game needs a newer SDK.

## Conventions for new games

- Put all assets inside the game folder and reference them with relative paths.
- Load third-party libraries from a pinned CDN version, or vendor them into the game folder for offline play.
- Namespace storage with `Hub.storage()` (Short Fuse predates this and uses `shortfuse.*` keys, which is fine).
- The game must be playable when opened directly, without the hub.
- Keep game rules in data tables and generate any printed instructions from them, as Short Fuse does, so the rules and the manual can never disagree.
