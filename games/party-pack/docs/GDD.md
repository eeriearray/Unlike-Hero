# Party Pack — Game Design Document and Technical Blueprint

A phones-as-controllers party platform: one shared **Main Stage** screen, up to **8 player phones**, and an
**audience** (the Megaphone) that votes and fills a Hype Meter. Six games ship in the pack.

**What's playable in this repository (`games/party-pack/`).** Everything in this document runs in the browser
build *except* what §8 lists as "designed, not built". The build targets friends in one room: it runs on the
hub's own relay (`npm start`) with no accounts, no streaming services and no third-party APIs. The hosted
architecture in §1 is the plan for scaling the same protocol to streamed rooms with 10,000+ viewers.

| | |
| --- | --- |
| Main Stage | `index.html#host` on a TV or computer. Shows the room code (4 characters, no vowels so it can't spell words) and a QR code. |
| Player phone | `index.html#play`. The first human in is the **VIP** 👑: picks games and can assign a **VIP Moderator** 🛡. |
| Audience | `index.html#audience`, or any phone that joins once 8 seats are full or a game is running. |
| Prompt Studio | `index.html#studio`. Custom prompt packs with 7-digit share codes (§3). |
| Bots | Fill empty seats so a game can start with fewer people (and so it can be tested alone). |

---

## 1. System architecture

### 1.1 Principles

1. **The host is the only authority.** The Main Stage (local build) or a Room Actor (hosted build) owns the state machine,
   timers and scores. Phones are thin terminals: they render a *view* and send *inputs*. Phones never compute
   scores, so a modified client can't award itself points.
2. **Send views, not state.** Each phone gets exactly the screen it should show (`{type:'choice', options, endsIn, …}`).
   Private information (the Imposter's role, your secret drawing prompt) is only ever addressed to one player.
3. **Time is relative.** Views carry `endsIn` (milliseconds remaining) instead of a wall-clock deadline, so phones with
   wrong clocks still count down correctly. The host decides when time is up.
4. **The audience is aggregated, never addressed.** Audience members get one broadcast view per phase. Their votes
   are tallied in memory and flushed in batches (§1.4). No per-viewer message is ever sent back to the host.

### 1.2 Stack

| Layer | Local build (this repo) | Hosted build (recommended) |
| --- | --- | --- |
| Main Stage | Vanilla JS + DOM/CSS, Canvas 2D for drawings, Web Audio for procedural music, Web Speech for the host voice | Same client, plus a WebGL (PixiJS 8) layer for particles and stage effects |
| Phones | Same page, `#play` / `#audience` | Same, served from a CDN edge as a PWA (installable, offline shell) |
| Realtime | `Hub.room()` → `server/relay.mjs` (Node + `ws`), or `BroadcastChannel` between tabs | **Node 22 + uWebSockets.js** gateway nodes behind an L4 load balancer; sticky by room code |
| Room state | In the Main Stage's memory | **Room Actor**: one per room, pinned to one gateway (consistent hashing on room code); snapshot to **Redis** every phase change so another node can resume it |
| Fan-out | Relay forwards to ≤16 sockets | **Redis Streams** per room for gateway→gateway fan-out; audience broadcast through a CDN WebSocket edge (Cloudflare Durable Objects or Fastly Fanout) |
| Votes | In memory | `VoteIngest` (§1.4): in-memory tally per node → 200 ms Redis pipeline flush → one Postgres row per vote at close |
| Durable data | Browser `localStorage` | **Postgres** (users, packs, match history), **S3/R2** (drawings and shirt print files) |
| Moderation | Layer 1 filter (local) + VIP Moderator | Layer 1 + an ML toxicity classifier service + VIP Moderator + report queue |

### 1.3 Wire protocol

JSON frames today (≤16 KB, the relay cap). The hosted build keeps the same shapes and switches to MessagePack once
measured payloads justify it. Every frame has a topic `t` and a monotonically increasing `seq` per sender so the
receiver can drop stale or duplicated frames after a reconnect.

```jsonc
// host → one player (addressed). The phone renders `v` and nothing else.
{ "t": "view", "to": "t_8f2k1x", "seq": 412,
  "v": { "type": "choice", "req": "a91bq3", "endsIn": 14200, "prompt": "Who is the Imposter?",
         "options": [{ "label": "Mira", "badge": "🦊" }, { "label": "Sam", "badge": "🐙", "disabled": true }],
         "effects": { "fog": true },                           // a ghost haunted this phone
         "me": { "name": "Sam", "color": "#3fa7ff", "score": 2250, "vip": false } } }

// host → all audience (broadcast; identical bytes for every viewer, so the edge can cache and fan out)
{ "t": "aud", "seq": 88, "v": { "type": "aud-vote", "req": "a91bq3", "endsIn": 14200, "options": ["Mira", "Sam", "Ade"] } }

// phone → host. `req` ties the input to one prompt; inputs for an old req are ignored.
{ "t": "in", "token": "t_8f2k1x", "req": "a91bq3", "data": 0 }
{ "t": "in", "token": "t_8f2k1x", "req": "a91bq3", "data": { "haunt": "t_77abc", "mode": "scramble" } }
{ "t": "react", "token": "t_8f2k1x", "e": "😂" }               // rate-limited to 1 per 600 ms per sender
{ "t": "hb", "token": "t_8f2k1x" }                            // every 3 s; the host answers "ack"

// large binary (drawings) travel once, then get referenced by id
{ "t": "asset", "to": "t_8f2k1x", "id": "dr_k2j", "data": { "p": ["#1b1b22", "#e8403a"], "d": "<base64 strokes>" } }
```

**Drawings** are strokes on a 256×256 grid packed as bytes (`colour<<4|width`, point count, then `x,y` byte pairs):
a busy drawing is 3–6 KB, so it fits in one frame and renders crisply at any size (`js/draw.js`).

**Identity and reconnects.** Each phone tab holds a random token in `sessionStorage`. Refreshing, locking the phone or
switching Wi-Fi rejoins the same seat: the phone sends `join` again and the host replays the current view.

**Why this survives 1 host + 8 players + 10,000 viewers.**

| Traffic | Per second at peak | Path |
| --- | --- | --- |
| Host → players | ≤ 8 views × ~3 changes | Addressed frames on the room's gateway |
| Players → host | ≤ 8 × a few inputs | Same gateway |
| Host → audience | 1 broadcast × ~3 changes | Room Actor publishes once; the edge fans out to 10,000 sockets |
| Audience → host | up to 5,000+ votes, 10,000+ reactions | Edge workers *aggregate* (§1.4); the Room Actor sees ≤ 5 tally deltas per second |

The host never handles O(audience) work. Reactions are counted at the edge and arrive as `{ "😂": 412, "🔥": 97 }`
every 200 ms, which drives the Hype Meter.

### 1.4 Audience votes at scale

See [`server/vote-ingest.ts`](../server/vote-ingest.ts) (deliverable 5) and its load test
[`server/vote-ingest.test.ts`](../server/vote-ingest.test.ts):

```
node games/party-pack/server/vote-ingest.test.ts
75,000 votes in 18 ms of CPU · 51960 accepted · 74 Redis round trips · 544 commands · final 23504/3322/3390/3481
```

Each vote is an O(1) in-memory update (a `Uint32Array` counter plus a per-voter `Map` for de-duplication and vote
changes). Every 200 ms one Redis pipeline carries only the **deltas** (`HINCRBY` per option, batched `SADD` of new
voters). The database sees **one row per vote, written once, at close**. So 75,000 votes cost 74 round trips and
zero row locks. A failed flush puts its deltas back, so nothing is lost. Memory is bounded by the number of options,
not by vote volume.

### 1.5 Scaling numbers (hosted)

- One uWebSockets.js gateway holds ~50k idle sockets / ~10k active at ~2 vCPU. A 10,000-viewer room spans 1–2 edge
  nodes; its Room Actor lives on one gateway.
- Room Actor snapshot: < 20 KB (players, scores, phase, current prompt), written to Redis on each phase change. If a
  gateway dies, the next one picks up the room within one heartbeat (3 s) and phones replay their view.
- Rate limits: 1 reaction / 600 ms per socket; 1 vote / 250 ms per voter; 16 KB per frame; 8 player seats.

---

## 2. State machine: The Imposter's Pitch

Implemented in [`js/games/pitch.js`](../js/games/pitch.js). The current state is shown in the Main Stage's corner
(`#phase`) for debugging.

```
                 ┌───────────────────────────────────────────────────────────────────────┐
                 │                                LOBBY_WAITING                         │
                 │  players join with the room code · VIP picks "The Imposter's Pitch"   │
                 │  guard: seats ≥ 4 (bots fill empty seats)                             │
                 └───────────────────────────────┬───────────────────────────────────────┘
                                                 │ startGame()  → INTRO (host voice line)
                                                 ▼
   ┌──────────────────────────────────── for round r = 1 … R (R = 2–3) ─────────────────────────────────────┐
   │                                                                                                         │
   │  ROLES_ASSIGNED                                                                                        │
   │    product ← unused product            imposter ← random player who hasn't been the Imposter yet       │
   │    each phone: private role card (hold to peek). Executives see product + one-liner; Imposter sees "?" │
   │    exit: everyone taps "Got it"  OR  20 s                                                              │
   │                         │                                                                               │
   │                         ▼                                                                               │
   │  SLIDE_DRAFTING                                                                                         │
   │    everyone writes one slide headline (the Imposter writes blind)                                      │
   │    validate: headline must not contain the product name                                                │
   │    → profanity filter → VIP Moderator review (if assigned, ≤ 40 s)                                     │
   │    exit: all headlines in  OR  40 s (missing headlines get a stock one)                                │
   │                         │                                                                               │
   │                         ▼                                                                               │
   │  PITCH_PHASE  (loop over presenters; the Imposter is never first)                                      │
   │    Main Stage: a colleague's headline + a game-generated visual (chart / quote / roadmap / stat / team) │
   │               built only from the product's emoji hints and keywords, never its name                   │
   │    presenter's phone: Executive → product + headline · Imposter → blank "?"                            │
   │    everyone else: 💰 Invest (≤ 3 per presenter) and heckle reactions                                   │
   │    exit (per presenter): presenter taps "Done"  OR  35 s                                               │
   │                         │                                                                               │
   │                         ▼                                                                               │
   │  VOTING_PHASE                                                                                          │
   │    players vote "Who is the Imposter?" (not themselves) · audience votes in parallel                   │
   │    exit: all votes in  OR  30 s                                                                         │
   │    caught ⇔ the Imposter has the unique top player vote; a tie is broken by the audience's vote         │
   │              ┌─────────────┴──────────────┐                                                            │
   │        caught│                            │not caught                                                  │
   │              ▼                            │                                                            │
   │  IMPOSTER_GUESS                           │                                                            │
   │    Imposter picks the product from 4      │                                                            │
   │    exit: pick  OR  20 s                   │                                                            │
   │              └─────────────┬──────────────┘                                                            │
   │                            ▼                                                                            │
   │  REVEAL     product revealed · scoring:                                                                │
   │               Imposter not caught: +2000 · caught but guessed: +1500 · caught and wrong: 0             │
   │               each player who voted for the Imposter: +750 (×2 if the audience was unanimous)          │
   │               each presenter: +250 per unique investor ("bought the pitch")                            │
   │                            │                                                                            │
   │                            ▼                                                                            │
   │  ROUND_END  scoreboard ──── r < R ──────────────────────────────────────────────────► ROLES_ASSIGNED     │
   └────────────────────────────┬────────────────────────────────────────────────────────────────────────────┘
                                │ r = R
                                ▼
                            GAME_OVER  → finale (ties: 2-, 3-, 4-way and all-way voice lines) → LOBBY_WAITING

   Any state ── VIP "End game" or host "End game" ──► LOBBY_WAITING (run token bumped; pending prompts discarded)
   Any timed state ── host "Skip" ──► its exit transition, using whatever input has arrived
```

**Edge cases handled**

| Case | Behaviour |
| --- | --- |
| The Imposter disconnects | Their timers expire; they present with a stock line; the vote proceeds. They rejoin the same seat on reconnect. |
| Nobody votes | `caught = false`: the Imposter walks away with the funding. |
| Everyone votes for one innocent | Not caught; the voters get nothing. |
| Player-vote tie | Broken by the audience vote; with no audience, a tie means "not caught". |
| An Executive types the product name into a headline | Rejected on the phone with a message; they write another. |
| A player misses two prompts in a row | Marked AFK; the host calls them out by name; "welcome back" when they return. |
| VIP leaves | VIP passes to the next connected human, with a voice line. |

---

## 3. UGC and monetisation

### 3.1 Prompt packs and 7-digit share codes (built)

- **Prompt Studio** (`#studio`): pick a game category, paste one item per line, save. The pack gets a 7-digit code:
  6 random digits and a **Luhn check digit**, so a mistyped code fails before any lookup. Shown as `482-9173`.
- Categories: Comedy Writer prompts, Gauntlet blanks, Bluffing facts (`fact with ____ | answer | lie, lie`),
  drawing prompts, Cutthroat Quiz questions, Imposter's Pitch products. Bad lines are skipped, and the count is shown.
- **Safety at creation**: every line goes through the profanity filter. Packs that trip it are refused.
- **Playing a pack**: enter the code in Main Stage → Settings → Content. With ≥ 3 items the pack replaces that category;
  fewer are mixed into the built-in content.
- **Sharing**: "Copy share link" puts the whole pack in the URL, so it opens on any device without a server. Opening
  the link imports the pack under the same code.

### 3.2 Hosted pack service (designed)

| Endpoint | Purpose |
| --- | --- |
| `POST /packs` | Create (auth required). Runs the filter plus the ML classifier; stores the pack; returns the code. Codes are allocated from a shuffled 10⁶ space per check digit, so they are not enumerable in order. |
| `GET /packs/:code` | Resolve a code → pack JSON (CDN-cached, 60 s). Unlisted packs resolve by code only. |
| `POST /packs/:code/report` | Report → moderation queue; 3 unique reports auto-hide the pack pending review. |
| `GET /packs?sort=top&game=quip` | The community browser: ranked by plays × completion rate, with a decay. |

Pack row: `code, owner_id, kind, title, items jsonb, visibility (private | unlisted | public), plays, likes, reports, created_at`.

### 3.3 Monetisation (designed)

- **The base pack**: one-time purchase per Main Stage (phones and audience are always free; nobody else needs to buy).
- **Creator Packs**: public packs are free. Creators can opt in to *featured* status. Featured packs are bundled into
  a monthly "Community Spotlight" content drop; 50% of that drop's revenue is shared by play-time.
- **Cosmetics** that never touch scoring: host voice skins, stage themes, avatar frames, reaction-wheel sound packs.
- **Merch**: the Chaos Mashup champion shirt exports a print-ready PNG today. The designed paid flow is a print-on-demand
  checkout run by the store's own server (it holds the provider keys and takes payment; the game never sees a card),
  with a revenue share to the three creators credited on the shirt.
- **No pay-to-win, no ads during play, no selling of audience data.** Streamer-facing features are never paywalled.

---

## 4. Platform features

### 4.1 Main Stage
- Room code in the header and lobby, QR code, join URL. **Streamer Mode** (designed, §8) hides the code behind ••••
  until revealed.
- Player strip: colour, **shape** (●▲■◆★⬟✚⬢, so nothing relies on colour alone), score, ✓ when answered, AFK/BOT badges.
- Timer ring; Skip and End game; Settings.

### 4.2 Phones
- Views update in place with no page reloads, and drafts survive re-sends (typing is never wiped).
- **Haptics** via `navigator.vibrate`: a double nudge at 10 s, a tap every second from 5 s, a long buzz at zero.
  (iOS Safari doesn't implement the Vibration API, so the visible timer bar turns red as a fallback.)
- **Reaction wheel** during downtime: 8 emoji and 4 sounds (airhorn, laugh, boo, rimshot), rate-limited, floating up the
  big screen with the sender's name. Reactions feed the Hype Meter.
- Per-phone settings: text size, high contrast, colour-blind filter, haptics, reduce motion.

### 4.3 Megaphone (audience)
- Joins by default when seats are full or a game is running; anyone can join as audience on purpose.
- Votes on every head-to-head and on the Imposter. The audience counts as **two weighted votes** in Comedy Writer battles.
- **Hype Meter**: filled by reactions and 🔥 taps, decays over time; at 100% → "HYPE TRAIN!" burst.
- **Unanimous audience vote** (≥ 2 voters, all the same) → special stage effect + **double points** for that pick.
- Stream-chat voting (designed, §8): `!1`, `!2`… in Twitch/YouTube chat counted once per chatter.

### 4.4 Audio
- **Procedural soundtrack** (`js/audio.js`): a 16-step Web Audio sequencer. Tempo rises from the game's base BPM by up to
  +58 BPM as the timer drains, with extra hats and kicks. **Standings drive harmony**: a tight race is minor and
  tense; a clear leader (25%+ ahead) flips to major and the melody becomes **the leader's own motif**, one per seat.
  Each game has its own key, swing and instrument colour.
- **Host voices**: six sarcastic hosts, each an on-screen cartoon whose mouth moves while they talk, with a speech
  bubble that doubles as captions. The script (`js/content.js`, 88 lines) never says player names or answers, which
  stay on screen, so **one recording session covers every game**. Edge-case lines: 2-, 3-, **4-way** and all-way ties,
  a **profane name** (the player is renamed, e.g. "Captain Censored"), **AFK** call-outs and welcome-backs, nobody
  answered, only one answered, VIP left, moderator removed something, audience hype.
- **Voice Booth** (`#booth`, built): record each line with a microphone (level meter; Space to record, Enter to play).
  Clips live in the Main Stage browser's IndexedDB and play through a small studio chain: silence trim, rumble
  filter, warmth, presence, compression and a touch of room. Each host gets a "voice character" (tape speed) so one
  person can voice six hosts. Export/Import moves a pack between computers. Unrecorded lines fall back to the best
  installed text-to-speech voice (neural/enhanced voices ranked first, novelty voices never), spoken phrase by phrase
  with pauses.

### 4.5 Art direction
Every game has its own look, swapped by `[data-theme]` on the page: The Comedy Writer is black with paint
splats, The Bluffing Game a 70s game-show sunburst, The Terrible Artist a ruled sketchbook, The Cutthroat Quiz
haunted-hotel wallpaper, The Chaos Mashup diagonal merch stripes, The Imposter's Pitch a corporate grid. Each has
its own display face. Shared rules: flat colour, 4–5 px ink outlines, hard offset shadows, slightly tilted
"sticker" cards, and hand-drawn SVG characters (`js/art.js`) instead of emoji. Players pick one of 12 characters,
tinted with their seat colour.

### 4.6 Accessibility and safety
- High-contrast theme; colour-blind filters (protanopia, deuteranopia, tritanopia, monochrome) plus a colour-blind safe
  Okabe–Ito player palette and per-player shapes; text scale 100–170%; reduce motion; captions.
- **Extended timers**: ×1.5, ×2 or ×3 for every prompt (the Gauntlet's 10 s becomes 15–30 s).
- **Profanity filter, layer 1** (local, always on in family mode): normalises leetspeak (`sh1t`), stretched letters,
  and spaced or dotted spellings (`f.u.c.k`); masks with grawlix; uses an allow-list so "Scunthorpe", "cocktail",
  "suspiciously" and "analysis" pass. Names are filtered at join.
- **Layer 2** (designed): a toxicity classifier (e.g. a fine-tuned small transformer behind `POST /moderate`) scores
  each answer within 150 ms. Above the threshold, the answer is replaced; in the grey zone, it is routed to layer 3.
- **Layer 3, VIP Moderator** (built): the VIP (or the host, in Settings) assigns a player. Before any typed answer
  reaches the big screen, the moderator's phone lists them; tap to remove, then "Approve the rest" (auto-approve at
  40 s). Removed answers show a placeholder and the host comments on it.

---

## 5. The games

| # | Game | Host | Players | Loop | Signature twist |
| --- | --- | --- | --- | --- | --- |
| 1 | The Comedy Writer | Margo Quill | 3–8 | 2 rounds: everyone answers 2 prompts; each prompt is a head-to-head; others + audience vote; 1000×round split by vote share; sweep = +250×round "Quip Lash" | **The Gauntlet**: 3 fill-in-the-blanks at 10 s each; everyone votes a favourite (300/vote, +500 to the audience pick) |
| 2 | The Bluffing Game | Dex Fibbington | 2–8 | 4 questions (×1, ×1, ×2, ×3): write a lie; the truth is rejected (fuzzy match); pick the truth from lies + truth + house lies; truth +1000×m, each player fooled +500×m | **Double Bluff**: once per game, bet all your points that ≥ 3 players (or everyone, if fewer) pick your lie. Success: steal 500×m from each victim. Failure: drop to 0 |
| 3 | The Terrible Artist | Professor Pallette | 3–8 | Draw a secret prompt (two inks, no eraser, no undo); others write decoy titles; everyone finds the real one; guesser +1000, artist +1000 per correct guesser, decoy +500 per fooled | **Blind Contour** (round 2, ×2): your ink fades from your own phone ~0.6 s after you draw it; the big screen shows everything |
| 4 | The Cutthroat Quiz | The Proprietor | 1–8 | 7 questions; living +1000, ghosts +500; wrong → **Killing Floor**: Math or Death, Poisoned Cups or Tap for Your Life | **Haunting**: once per question each ghost can **fog** a living phone (wipe it off with a finger) or **scramble** its answer buttons. Final **Exit** race: living start 3 steps ahead; the first to 9 escapes (a ghost who escapes comes back to life) |
| 5 | The Chaos Mashup | Ripley Thread | 3–8 | Draw 2 pictures, write 3 slogans; each player is dealt others' work and builds a shirt (art, slogan, colour, layout); king-of-the-hill battles (100/vote to the builder, 50/vote to the artist and slogan writer) | **Print**: the champion exports a 3000×3600 px print-ready PNG from the lobby (🖨). Paid print-and-ship checkout is designed in §3.3 |
| 6 | The Imposter's Pitch | Chad Venture | 4–8 | See §2 | The Imposter's phone is blank; they improvise from the slides alone |

---

## 6. Content mockups

### 6.1 Five prompts for The Imposter's Pitch

1. **Ghost Writer™**: a robot vacuum haunted by your ancestors. It only cleans when it's disappointed in you. *(🤖 👻 🧹)*
2. **SoupPhone**: a smartphone made entirely of soup. Waterproof? No. Delicious? Extremely. *(🍲 📱 🥄)*
3. **RockBnB**: a holiday-rental marketplace where pet rocks book beach houses. *(🪨 🏡 🏖️)*
4. **Snooze Insurance**: a policy that pays out every time you oversleep, funded by morning people. *(😴 💸 ⏰)*
5. **The Emotional Support Brick**: a brick that texts you encouragement. Non-refundable. Do not throw. *(🧱 💬 ❤️)*

The emoji are what the Main Stage may show on generated slides: enough for a sharp Imposter to bluff, not enough to name it.

### 6.2 Five bizarre (true) facts for The Bluffing Game

1. Wombats are the only animals known to produce ____-shaped poop. → **cube**
2. In 1932 the Australian military went to war against ____, and lost. → **emus**
3. Fredric Baur, who designed the Pringles can, had some of his ashes buried in ____. → **a Pringles can**
4. The first item ever sold on eBay was a broken ____. → **laser pointer**
5. Cleopatra lived closer in time to the Moon landing than to the building of the ____. → **Great Pyramid**

18 facts ship in `js/content.js`, each with accepted alternate spellings and three house lies.

---

## 7. Code map

```
games/party-pack/
  index.html            one page, five modes (#host, #play, #audience, #studio, #booth)
  css/party.css          stage + phone styles, high contrast, colour-blind filters
  js/content.js          every prompt, fact, product and voice line
  js/core.js             helpers, profanity filter, palettes, identity, network wrapper
  js/draw.js             drawing pad (blind mode) + compact stroke format
  js/art.js              SVG player characters, the six host characters, crowns and shields
  js/booth.js            Voice Booth: record, trim, export and import the hosts' lines
  js/audio.js            procedural music, sound effects, host voice + captions
  js/host.js             Main Stage: rooms, seats, views, ask/timer cycle, moderation, hype, settings
  js/controller.js       phones + audience: view renderers, haptics, reaction wheel, fog/scramble effects
  js/ugc.js              prompt packs, 7-digit Luhn codes, Prompt Studio
  js/games/*.js          the six games (each an async function over the ctx API)
  server/vote-ingest.ts  audience vote batching (deliverable 5) + load test
```

The **ctx API** each game uses: `ask({to, view, secs, audience, validate, partial, bot})` collects input with a timer;
`moderate(items)` runs the VIP Moderator; `stage(html)` draws the Main Stage; `say(lineKey)` speaks a host line;
`score(p, n)`, `scoreboard()`, `finale()`; `unanimous(result)` detects audience hype.

## 8. Designed, not built (this build is for friends in one room)

| Feature | Status | Where it would go |
| --- | --- | --- |
| Twitch / YouTube chat voting | Designed (§4.3). Left out at the owner's request: this build is for playing with friends. | A chat bridge feeding `VoteIngest.cast()` with voter ids `tw:<user>` / `yt:<channel>` |
| Streamer Mode (hide the room code) | Designed (§4.1). Left out for the same reason. | A header toggle that masks the code until "Reveal" |
| Print-and-ship checkout | Designed (§3.3); the print file is built | Store-side endpoint holding the print-on-demand keys |
| 10,000-viewer rooms | Designed (§1); the bundled relay caps a room at 16 connections (host + 8 players + 7 audience) | uWebSockets.js gateways + CDN edge fan-out |
| Hosted pack service, creator revenue share | Designed (§3.2–3.3); packs work locally and via share links | `POST/GET /packs` |
| ML toxicity classifier | Designed (§4.6); layer 1 + VIP Moderator are built | `POST /moderate` |
| Hosted voice packs | The Voice Booth records and plays clips locally (§4.4) | Upload packs to the pack service so every Main Stage can download a cast |
