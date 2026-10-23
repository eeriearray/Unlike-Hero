# THE HOLLOW — a multiplayer horror expedition

*Chapter One: The Missing Bell.* New games offer a focused village opening; experienced players can select the full expedition in the character lobby. The title screen includes the supplied optional 60-second trailer.

 Thornwick has vanished from every map. Its bell rings every night anyway, though the tower
has stood empty for forty years, and each toll remembers a new name. One to six players explore a cursed, interconnected
realm, collect clues and relics, make bargains, and decide the bell's fate before the Haunting Clock runs out.

A 30–45 minute dark-fantasy tabletop RPG with dice, stats, secret objectives and nine possible conclusions.

The play screen keeps a compact objective HUD beside the scene. Click or tap marked objects to inspect them and review real encounter choices; the next objective is highlighted. Narrow screens can pan sideways to reach objects, and action cards remain available. The square’s notice board and well use positions from the supplied illustration. During the village opening, one available action is marked **Next step**; optional choices stay under **Other actions**. The travel panel marks the next objective, and guidance follows shared discoveries even after failed rolls.

The opening now ties a personal warning to the removal records, the empty graves, and a bell ringing beneath the Abbey. Each character has a safe alternative at a relevant obstacle. Companions offer +2 aid, or +3 when their opening expertise applies, for 1 Sanity. At the empty frame, choose to delay a toll or risk one to recover a name. See [the opening beat sheet](art/OPENING-REDESIGN.md) for rules and validation.

A dismissible expedition letter opens as play begins after character selection. It explains the goal, scene interaction, costs and dice, health and sanity, and solo or party turn pacing. Close it with ×, Escape or **Fold the letter**, and reopen it under **How this works**.

## Play

From the repository root:

```bash
npm install
npm start          # http://localhost:8080  (PORT=9000 npm start to change the port)
```

Open **The Hollow** from the hub, or go straight to `http://localhost:8080/games/the-hollow/`.

| Mode | How |
| --- | --- |
| **Online** (2–6 players) | One player chooses **Host an expedition** and shares the 4-letter code or the *Copy invite link* button. Others choose **Join with a code**. Pick distinct characters, press *Ready*, the host presses *Set out*. |
| **Solo** | **Play solo** runs the same engine in your browser tab, offline, and saves to your browser after every move (refresh-safe, resume from the title screen). The host can add AI **ghost companions** in the lobby. |
| **Reconnecting** | Refresh, lose Wi-Fi, lock the phone, close the tab, even restart the server: your seat is kept and the page reconnects by itself. Moves made while the connection is down are sent once it is back (never twice). The title screen offers *Return to expedition*. On another device, or after clearing the browser, join with the code and the **same name** to take your seat back. In the lobby a seat is held for two minutes. |
| **Phones** | The layout switches to four tabs (Map · Act · You · Journal) below 960 px. |

Opening the game with `?dev=1` exposes the live solo engine as `HollowDev.game()` in the console (for testing and demos).

### Requirements and environment variables

* Node 18+ for the server (`npm install` pulls `socket.io` and `ws`). No database.
* `PORT` — hub port (default 8080).
* `HOLLOW_DATA_DIR` — where online expeditions are saved (default `games/the-hollow/server/.data/`, git-ignored). On a restart the
  server restores every unfinished room, and players reconnect to their seats automatically.
* The page loads its fonts from Google Fonts when online and falls back to system serif/sans fonts offline. Supplied paintings, cast, items, interface assets, recorded/prepared audio, and the trailer load through the local asset registry. Procedural artwork and synthesis remain fallbacks. See `art/FINAL-ASSET-GAPS.md` and `art/OPENING-MEDIA.md` for current coverage.

The scene interaction pass adds magnifiable inspections, explicit scene panning, object-aligned opening hotspots and a clickable tower door. New writing, quiet-knock and iron sounds come from the supplied asset folder; changing village rooms preserves the music. See [asset audit and validation](art/PRESENCE-PASS.md).

## The scene is the game

The screen is one large illustrated place with a compact HUD over it (you, the Haunting Clock dial, the party, pack,
purse, journal, map, sound) and a tabletop of action cards below it. Journal, character sheet and pack are drawers.

* **Stage** (`js/stage.js`): renders a place as parallax layers with a camera. Objects in the picture are hotspots:
  hover names them, a tap glides the camera onto the object, dims the rest and opens an **interaction card** beside it
  (close-up, one or two big choices, odds and stakes before any roll). Every object maps only to real actions: an
  option of the place's encounter, a standing action (search, travel) or a road. The Haunting Clock drives the
  picture: windows go dark, the lantern string and its light pools gutter out, the palette cools, fog thickens, and
  phase II/III add details (handprints, a watcher in a far window, crows, red dates on the notices).
* **Scenes** (`js/scenes/*.js`): the Silent Square is hand-made (1600×900 layered vector illustration: the well that
  drips upward, the notice board, the abandoned lantern and cold camp, scattered postcards, the empty bell tower, the
  lanes out). Other places use the procedural art in the same stage. Painted raster layers can be dropped in; see
  `art/README.md`.
* **Action cards** (`js/cards.js`): two or three primary choices plus Travel, the rest behind "More". Artwork is the
  object itself framed from the scene. Spent, locked (with the reason) and dangerous choices look different.
* **Event presentation** (`js/events.js`): every result at your place, yours or a companion's, plays in the scene:
  camera to the object, the object reacts, a physical D20 tumbles and lands on the server's number, success or
  failure lighting, then each consequence from the result's chips (nothing else) travels: clues unfold and fly into
  the journal, items into the pack, coin into the purse, Sanity loss warps the scene, the Haunting snuffs a lantern.
  The HUD's numbers change as each consequence lands. Click, Space or Esc fast-forwards; a watchdog ends any sequence
  within seconds; reduced motion shortens everything to fades. Turn changes show a short banner.
* **Phones**: the world is wider than the screen and can be dragged sideways; the cards scroll; the interaction card
  becomes a bottom sheet.

To give another place a hand-made scene, copy `js/scenes/square.js`, list its objects with the option ids from
`engine/data/loc-*.js`, and add its `<script>` to `index.html`. Results carry `oid` (option id) and `loc`, which is how a
client knows which object to animate.

## What a turn looks like

1. **The world speaks.** A new round draws an *omen* (a world event) and the Haunting Clock may enter a new phase.
2. **You have 2 actions** (3 when playing with one or two people). Every action is a choice:
   * **Travel**: *step carefully* (traps are avoided), *sprint* up to two roads (noisy, hazards bite), *sneak* past a monster with Wit, *follow* a friend,
     force or unlock a locked road in several ways, or *follow an echo* into a hidden shortcut at the cost of Sanity.
   * **Investigate** a place for hidden routes and secret options (a lantern, a vagabond's eye or a roll finds them).
   * **Look around** (the place's own encounter, with options unique to that place), **explore** the region for a one-off event, **rest** (heals, but the Hollow draws closer), or use a class gift or item.
3. **Rolls are honest.** `d20 + stat + bonuses` against a DC (8 easy · 11 standard · 14 hard · 17 very hard · 20 extreme). Stat, DC, every modifier and your chance of success are shown *before* you commit. A natural 20 is an exceptional result, a natural 1 a complication.
   **Failure always advances the story**: it costs, reveals, changes the world or opens another way.
4. **Others may help.** An ally in your place can *lend a hand* (+2, costs them 1 Sanity, once a round), give you items, or heal you. The fallen can whisper hints, lend strength or try to return.
5. **The Haunting advances**: bleeding ticks, enemies move (pilgrims follow, hounds hunt the weakest, statues stalk the lonely, the Bellkeeper tolls), the clock moves.

## Systems at a glance

* **Characters (6):** Occultist, Hunter, Apothecary, Medium, Vagabond, Exorcist. Each has Vitality, Sanity, Might, Wit, Fate, a passive, a limited active gift, a backstory and a reason to be there. Classes are unique per party and change real numbers (rerolls, snares, brewing, calming, slipping away, three rites of sealing).
* **Map:** 42 places in six regions (Dying Village, Black Estate, Whispering Woods, Forsaken Abbey, Sunken Crypt, Heart of the Hollow), 33 distinct place kinds, 152 place-specific options. Fog of war, hidden routes, locked roads (every lock has an item-free way), one-way drops, a shifting corridor, a guarded stair and temporary collapses. The server proves in its tests that the Heart is always reachable.
* **Mystery:** 19 clues in four *pillars* of truth (what became of Thornwick, why the bell rings, what waits beneath, how it might end), each spread over three or more regions. Six puzzle secrets are drawn per game (bell's name, sigil, star, shelf, reflection, offering, grave, herb, last name…); wrong guesses are ruled out for everyone, so every puzzle is solvable by elimination. Clues can be private until shared.
* **World memory:** flags and a curse ledger. Rob the merchant and prices rise; burn the garden and its herbwife is gone; smash the shrine and hounds hunt the Woods; free a spirit, rescue Tamsin, Hob or Ketterick and they help at every phase and in the finale; ignored curses feed the Haunting and weigh on the final roll.
* **Haunting Clock:** 36 ticks, three phases (*Something Is Wrong*, *It Knows Your Name*, *The Hollow Awakens*). Phase II sours safe places, collapses roads and wakes the entity; Phase III opens the Escape Gate and sends hounds. The base speed scales with party size.
* **Enemies (9) and a boss:** Whisperling (false rumors), Drowned Pilgrim (follows), Hollow Stag (punishes noise and lanterns), Grave Warden (guards rewards), Mirror Twin (counters repetition), Bellkeeper (tolls, closes roads), Carrion Swarm, Hollow Hound, Weeping Statue. **The Abbey Warden** has three chains, four phases and eight different answers: break the chains, strike, speak the bell's name, perform the Ritual Chamber's rite, bring down the cracked vault, remind him of his oath, cut with grave-iron, or slip past.
* **Items (22):** limited 7-slot pack with heavy items, charges, equipment, relics with trade-offs, keys with costs; give, drop and pick up.
* **Progression:** XP from firsts, clues, enemies and the boss. Each level offers three random upgrades (stats, vitality, sanity, skills, a deeper class gift), so characters diverge. Glory comes only from one-time deeds; nothing can be farmed.
* **Secret objectives (8):** Collector, Truthseeker, Survivor, Pactbound, Redeemer, Unmaker, Opportunist, Wanderer. Hidden from everyone until revealed; none requires sabotage.
* **Falling:** zero Vitality or Sanity makes you a **spirit**, not a spectator. Once a round: whisper a hint (shared cap), lend +2 to the next roll, chill an enemy, or try to return (once, scarred). The altar and moonwater can wake the fallen, at most twice per party. A Pact saves you once.
* **Ending:** in the Heart Chamber a living player proposes **Silence the Bell**, **Ring It Backward**, **Make a Bargain** or **Break the Bell**; the table (including the fallen) votes; a final roll uses everything you did on the way. Or leave early through the Gate. There are 14 distinct conclusions, in four outcomes (success, partial, failure, unresolved), plus per-player legacies: fate, title, secret objective, Glory breakdown, relics, allies and a written epilogue.
* **Hallucination:** low Sanity adds unreliable flavor lines and a shimmer to descriptions, and penalises supernatural checks. Numbers, odds and rules are never distorted (and the effect can be switched off in Settings).

## Sound, art and accessibility

* **Audio** (`js/audio.js`, Web Audio, all synthesised): region ambience (wind, drones, creaks, whispers, dripping, choir, heartbeat), a layered adaptive score (pad, shimmer, tension, drums, boss brass) that moves between *explore · danger · combat · boss · victory · defeat*, 29 effects (dice rattle, steps, doors, locks, traps, pickups, clue chimes, success/fail/critical/fumble, damage, sanity, healing, level up, clock toll, phase swell, enemy growl, boss cue, falling, returning, three ending themes). Ambience intensifies with the Haunting Clock; the music ducks before discoveries and phase changes. Separate master / music / ambience / effects volumes, mute, persistence, autoplay-safe start after the first click, per-sound cooldowns and a polyphony cap. *Show sound captions* prints each sound as text.
* **Art** (`js/art.js`): all SVG and procedural: 42 scenes composed from 55 layers, 6 class portraits, 11 monster portraits, 60 icons, a 3D-tumbling D20 with critical and fumble effects, drifting dust and fog. Reduced-motion is respected (and can be forced).
* **Accessibility:** keyboard-navigable map nodes and every control, visible focus rings, ARIA roles/labels, an aria-live narration region, larger text, high contrast, reduced motion, sound captions, no information carried by audio alone.

## Architecture

```
games/the-hollow/
  game.json            hub manifest (server module, 1–6 players)
  index.html           page shell
  engine/              THE RULES — runs on the server; the same files run in the browser for solo play
    data/*.js          all content as data: classes, items, enemies, story, 42 places (one file per region), map, events
    core.js            lobby, commands, duplicate suppression, timers & AFK policy, snapshots
    rules.js           d20 checks, option evaluation, outcomes, inventory, damage, falling, levels, abilities, aid
    world.js           rounds & turns, movement, enemies, clues & puzzles, omens, the Haunting Clock
    finale.js          boss, vote & endings, objectives & legacies, spirits, the AI ghost-hand
    view.js            viewFor(player): the only way state leaves the engine; catalog() for the client
  server/index.mjs     Socket.io rooms, tokens, reconnect, persistence, heartbeat (loaded by server/relay.mjs)
  js/                  net (online/solo transports), ui (HTML components), map, fx, art, audio, app (screens & input),
                       stage (the scene and camera), scenes/ (hand-made places), cards (action cards), events (event presentation)
  css/hollow.css
```

* **The server is authoritative.** Clients send *intent* (`move`, `choose`, `use`…); the engine validates turn order, legality, resources and dice. Every command carries an id, so retries and reconnects cannot repeat a reward. Option choices carry the encounter id, so a stale screen is refused. The random stream is seeded and the log records every roll.
* **Secrets stay secret.** Each player receives only their own view: no other player's objective or private clues, no unseen places, no hidden routes or secret options until found, no puzzle answers. Online, the browser never receives the rules or the outcomes (only a catalogue of names, art keys and descriptions).
* **Persistence.** The engine serialises to plain JSON (`snapshot()` / `HollowGame.restore()`); the server writes unfinished rooms every few seconds and restores them at start-up. Solo games save to `localStorage`.
* **AFK policy** (chosen by the host, announced to the table): *skip* a player's turns after 40 s offline, let a *ghost-hand* play them, or *wait* up to five minutes. Idle turns time out (default 2.5 min).

### Adding content

Everything is data; no engine edits are needed for new places, items, events or enemies:

* **A place:** add an object to `engine/data/loc-*.js` (id, region, kind, map position, glyph, scene layers, description, `options`) and a route in `engine/data/map.js`.
* **An option:** `{ id, label, stat, dc, stakes, req/show/hide, cost, once, retry, mods, ok, fail, crit, fumble }`, or `puzzle:{key}`, or `auto`. Outcomes list effects (`vit san xp glory silver item clue hint flag clock noise reveal open spawn hurt kill status cleanse ally stat party move …`).
* **An item / class / enemy / event / omen:** `data/core.js`, `data/events.js`.
* **A region's sound:** a profile in `REGIONS` in `js/audio.js`. **A scene:** a keyword list on the place; new layer keywords go in `js/art.js`.
* The test suite validates references, forbids farmable rewards, requires every failed check to have a consequence, and re-proves that the map has no softlocks.

## Warning from tomorrow and discovery effects

New expeditions begin with a short, gesture-started warning from the player's future self. A dark doorway, timed narration text, knocks and a sudden Whisperling appearance establish the mystery before the expedition letter. The final beat gives the player a concrete goal: trace the missing bell beneath the Abbey and recover the names it took.

`js/dread.js` and `css/dread.css` also add moving-ink, graveyard apparition and bell-tower resonance effects to fresh local story discoveries. These are cosmetic: they do not send commands, spend actions or consume gameplay randomness. Each beat is claimed once per run, with a cooldown and deferral while other panels are open. Loaded history and remote discoveries do not replay scares in the wrong scene.

Skip/Escape immediately continues to the expedition letter. Reduced motion, reduced scares or disabled jump scares provide a readable static opening. Hidden tabs pause the buildup. Supplied scene artwork, the Whisperling portrait and existing audio assets are reused through the shared mixer.

Validation: all 176 Hollow tests pass, including six dedicated dread lifecycle tests. Desktop opening-to-letter and mobile Skip-to-letter flows were exercised in the browser; screenshots are in `art/validation/warning-opening.png` and `warning-mobile.png`. Subjective audio mixing still benefits from listening on the player's own speakers or headphones.

## Tests

```bash
npm test      # includes test/the-hollow-engine.test.mjs (rules) and test/the-hollow-server.test.mjs (real WebSocket clients)
```

Covered: content minimums and integrity, farmable rewards, clue redundancy, map reachability/softlocks, legal and illegal moves, turn order, exactly-once encounters, duplicate commands, failure consequences, natural 20/1, item limits, one-time rewards, puzzles, privacy of objectives and private clues, aid and trading, the Haunting phases, classes, the Fallen, revival caps, the boss, every ending, voting, reconnecting, snapshots, restarts, AFK policies, stale/malformed commands, and 24 whole games played by the AI plus 30 random-command fuzz games.

## Implemented vs. not

**Implemented and verified:** everything above, including real multiplayer (tested with two browser tabs and with automated WebSocket clients), reconnect and restart recovery, solo and ghost companions, mobile and desktop layouts, and all four milestones of the brief.

**Honest limits:**
* One chapter. The data format is built for more.
* Balance is tuned by simulation and rules analysis, not by large-scale human play: expect to adjust DCs, damage and the clock speed (`CFG` in `engine/core.js`) after real sessions.
* Supplied painted art and prepared audio are integrated. Some procedural fallbacks remain. Subjective sound mixing and first-session pacing still need human playtesting.
* The ghost-hand is a competent-but-simple heuristic player, not a strategist.
* No accounts, chat or matchmaking (play on voice chat). Rooms live in server memory plus a JSON file, not a database.
* Audio was exercised for correctness (no errors across every sound, region and mood) but this environment cannot judge how it *sounds*: expect to tune gains in `js/audio.js`.
