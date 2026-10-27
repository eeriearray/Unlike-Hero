# Crownfall Kart

A browser-native arcade kart racer for Unlike Hero. It uses classic JavaScript scripts and a vendored Three.js r147 build; there is no bundler, Unity dependency or CDN request. The 3D environments and sports coupes use detailed procedural geometry, bundled PBR textures, HDR reflections and cascaded sun shadows.

## Play

Run the hub from the repository root:

```sh
npm start
```

Open `http://localhost:8080/games/crownfall-kart/`, or choose **Crownfall Kart** in the hub. If the server was already running when this folder was added, restart it to load the new online server. Static solo play needs no server simulation; the classic scripts and bundled assets are served over local HTTP. Online rooms require the Node hub server and HTTP/HTTPS.

The game defaults to a three-lap **Lap race** driven from the cockpit. Driving is manual by default on keyboard and gamepad; touch screens start with **Auto accelerate** and **Gentle steering assist** on, and both are options in the garage on every device. Manual left/right input always overrides assistance. Use **Explore the courses** to inspect the actual route maps, terrain and soundtrack tempo. Choose a weight class, mode and track, then **Take the crown** to play solo. **Host online** creates a four-letter room code; friends open the same hub server and choose **Join race**. The host starts when the lobby is ready. Up to eight humans can join, and AI fills remaining seats. Races already in progress reject late joins. Disconnecting turns that seat into an AI; the next connected human inherits host controls. Reconnection/seat reclamation and cross-server matchmaking are not included.

| Control | Action |
| --- | --- |
| W/S or Up/Down | Accelerate / brake and reverse |
| A/D or Left/Right | Steer |
| Space | Hop; hold through a turn to drift; release for a charged turbo |
| Space while airborne | Tap in the last 0.16 seconds before a ramp landing for a trick boost |
| E or item slot | Use held item |
| R | Return to last validated checkpoint; invalidates a time-trial record |
| C or View button | Switch between the Cockpit and Hood views (remembered on this device) |
| Escape | Pause/resume solo; open/close menu online while racing continues |
| Gamepad | Left stick steer; R2 accelerate; L2 brake; A drift; X item; Y camera view |
| Touch | Steering arrows, Go, Brake, Drift and tappable item; View button in the top bar; optional auto acceleration |

| Camera | View |
| --- | --- |
| Cockpit (default) | Driver's eye inside the kart: a windscreen frame and mirror in your paint colour, a racing wheel that turns with your input, and a dash display with a rev arc, gear, speed and turbo charge. A row of lights above it shows revs, or fills in the tier colour while you charge a drift |
| Hood | Just above the bonnet, with nothing of the car in front of the road |

You race in first person. Short third-person cutscenes take over at set moments and then ease back into the cockpit: a sweep around your kart during the countdown, a chase shot through ramp jumps, a pulled-back shot when you spin out, a drone shot when you fall off the road, and a slow orbit at the finish. Spectating in Battle uses the chase camera.

From the driver's seat the road is seen at a low angle, so road features also stand up off it. Ramps are drawn as glowing kickers with painted approach chevrons, striped lip pylons and a JUMP AHEAD gantry. Gaps have a red edge where the road ends and an amber line where it resumes. Boost pads have chevron posts on both sides, and hex mines carry a tall beacon. Markers are merged into one draw call per colour.

Three presets trade acceleration/turning against speed and collision mass. Light Wisp is agile, medium Revenant is balanced, heavy Colossus has a higher top speed and sends lighter karts sideways. Driving explicitly controls acceleration and lateral grip; it does not simulate wheels or tire friction. Bumps use inverse-mass impulse sharing. Thin edge rails bounce normal departures; larger airborne departures fall into the void and respawn.

## Modes

- **Rift Sprint:** ten validated checkpoints, finishing at a different location before returning to the start. AI-driven checks finish the courses in roughly 26–65 seconds; player times vary.
- **Lap race (default):** three laps against an eight-kart grid, with a named rival (the bot that starts beside you). A banner shows the rival's gap in seconds and whether to chase or hold. Races time out after six minutes.
- **Grand Prix:** four consecutive races, starting at the selected track and wrapping through the eight-map catalog below. Points `[15,12,10,8,6,4,2,1]` persist between rounds. Final standings sort by points, then the final race's place. Every map has its own road layout. Unfinished racers are placed by validated progress when every connected human finishes; each race has a four-minute limit.
- **Time trial:** three laps, one kart, no AI/items/dynamic hazards. Record a clean run to save a personal-best pose ghost per track and class in local storage. The format is versioned; samples contain elapsed simulation time, position and heading. Replay interpolates the short heading arc, with no collision or race participation. Respawning invalidates the run. A four-minute limit bounds recording size. Saved ghosts are local to this browser/device, not a global leaderboard.
- **Battle:** an enclosed arena, three balloons per kart, independent battle loot. Accepted hits remove one balloon; immunity and hit grace prevent repeated damage from a single contact. Eliminated players spectate the leading survivor. Last survivor wins; after three minutes, remaining balloons determine standings (ties currently use stable racer ID).

## Driving, items and progression

Version 1.2 replaces the broad loop variants with figure-eight crossings, technical switchbacks, substantial elevation, gap jumps and a spiral climb. Driving acceleration is stronger; drift tiers charge sooner; edge contact preserves more momentum. Cyan road pads grant a short boost. Staying close behind another kart for 0.85 seconds grants a slipstream boost, with a cooldown. Gap ramps launch the kart, and trick timing remains a separate player action.

Steering is screen-relative: D/Right, right touch input and positive gamepad input steer right on screen. The optional gentle steering assistant follows the course while no direction is held, using about two thirds of full steering and firming up over the last 50 m before a ramp so it never misses a gap; it never fires items or overrides active manual steering. Keyboard and touch steering ramp in over a few frames so taps make small corrections. New local ghosts use version 4; old ghosts remain stored but are excluded because the geometry and handling changed.

## Maps

| Course | Layout and landmarks |
| --- | --- |
| Shattered Crown | Multi-crossing figure eight with a raised skybridge, underpass and three gap launches |
| Ember Keep | Fortress switchbacks, a long furnace straight, lava below and jump ramps |
| Moonveil Ruins | Serpentine chicanes, three lantern-covered road sections and gap launches |
| Void Cathedral | A cathedral ascent to forty metres and a sustained descent |
| Frostgrave Pass | A mountain slalom with changing altitude, gap launches, ice crystals and drifting snow |
| Bloodroot Fen | Root maze, tight hairpins, targeted mud regions and giant trees |
| Stormspire Causeway | A spiral climb above sixty metres, lightning orreries and a descending exit |
| Sunken Observatory | A four-lobed cloverleaf with repeated direction changes and celestial landmarks |

Rift Sprint, lap race and time trial can select any of the eight courses; online lobbies preserve that selection. The map picker is generated from the same data as the simulation, and the minimap scales to each circuit's bounds. Battle retains its enclosed arena.

## Handling and items

Drift time charges only while grounded with a signed slip angle, at 0.35 / 0.8 / 1.3 seconds. Releasing grants a bounded forward velocity impulse and temporary extra speed that grow clearly with the tier: about 8 / 12 / 16 m/s of push for 1.1 / 1.6 / 2.2 seconds. Bots get 60% of that, so a clean player drift wins. Charge is visible as blue, orange and purple sparks on the kart, the dash lights and a screen-edge glow. A trick press within 0.2 seconds of a ramp landing gives a 1.2-second landing boost. Holding a straight line, falling through the air, or taking a hit does not charge a turbo. A controller hop cannot farm a ramp trick. Discrete hop/use/reset inputs are latched through network packet coalescing. Boosts bypass mud, expire using simulation time, and cannot add unbounded velocity.

| Placement | Default loot weights |
| --- | --- |
| First / second | Hex mine 45, soul bolt 35, crown shard 20 |
| Middle pack | Wraith seeker 35, trinity bolts 30, rift boost 35 |
| Last | Undying 30, phantom drive 40, crown breaker 30 |

Last place takes precedence for a two-racer race; the current game fills an eight-kart grid. Battle uses its own offensive table. Shards grant a small boost every three collected. Invincibility blocks damage and bumps other racers into spin-outs. Phantom drive temporarily hands control to the waypoint driver, supplies a large boost and protects the kart. Crown breaker reacquires the current leader every physics tick and ignores every other racer; this super item can float across the void. Ordinary bolts sweep their travelled segment against karts and disappear off the road/at the arena boundary. Homing items retain the slot if no legal target is available. Full inventories leave item boxes available.

The spline is sampled into an arc-length table. Each kart projects only near its prior segment, validates twelve checkpoint sectors in order and stores unwrapped progress. Respawns resume a few metres behind the last on-road progress with a rolling start, never before the last validated gate, and back off before a ramp so the run-up is long enough; jumping to another part of the track cannot award a lap. Ramps launch on a ballistic arc aimed at the road beyond the gap, so gap jumps on bends land on the road. Bots run at 91% of their class pace. Rubber banding uses unwrapped distance from a human reference, with an 8-metre dead zone, so the pack stays in reach: a bot behind recovers up to +8%, a bot ahead eases off up to −8%, smoothly blended, and no bot ever exceeds its class's own pace. The named rival has a tighter leash (4-metre dead zone, up to +12% catch-up and only −5% easing), so there is nearly always a close duel. In a multi-human room, the first active human is the explicit reference. Only AI receives these modifiers.

## Sound and presentation

The soundtrack is an original, clock-scheduled Web Audio composition: kick, snare, hi-hat, bass, chord pads, arpeggios and a four-bar lead motif arranged over 32 bars with breakdowns and drum fills. Each course has its own key (natural minor on the theme root), tempo (138–154 BPM) and lead timbre. The garage uses a quieter pad/bell arrangement. No melody is borrowed and there are no external music downloads.

The race music reacts to the race. An intensity score from your position, how close the nearest rival is and how far through the course you are picks one of three arrangements: pads only, then bass and drums, then the full mix with arpeggio and lead. Changes have hysteresis and only take effect on bar lines; each layer fades on its own bus. A rising stinger plays over the countdown and lands on the tonic at GO. The last two checkpoints switch to a final-stretch variation (no breakdown, doubled hats, octave bass, lead an octave up). First place gets a fanfare that resolves to the relative major; other finishes get a softer falling outro. The music low-passes while paused and during big ramp jumps, opens on landing, and ducks about 3 dB under impacts and boosts so it sits under the engine and effects.

Sound effects are procedural Web Audio voices:

- **Engine:** a sawtooth rumble with a sub octave plus a band-passed whine, with RPM following speed through five fake gear shifts. Wisp, Revenant and Colossus each have their own pitch and weight. The two nearest rivals get their own engine voices with exaggerated doppler, distance attenuation and stereo panning.
- **Tyres:** rolling noise that is a dry hiss on asphalt and a low, wobbling squelch in mud. Drift squeal rises in pitch and level with the turbo charge, with a distinct chime for each mini-turbo tier.
- **Jumps:** a whoosh on ramp launch, wind while airborne, a landing thud (heaviest for Colossus) and a crisp chime for a trick-landing boost.
- **World:** a rumble from the rolling boulder that grows as it nears, a wall-scrape loop while touching a rail, a rift-pad zap, an item-box shatter, a distinct launch sound for every item, and hit sounds that differ for mines, bolts, the crown breaker and rams.
- **UI:** countdown beeps in the course key, a checkpoint tick, up/down cues when your place changes, and menu hover and click ticks.

Cues come from comparing your kart with the previous frame, so solo and online sound the same and the shared simulation is untouched. Audio unlocks on the first pointer gesture, Sound mutes everything, the context suspends while the tab is hidden, and one-shot voices share a 90-voice budget and are disconnected when they finish. Persistent loops (engine, tyres, wind, scrape, boulder, two rival engines) are built once and only change level.

The cutscene cameras use critically damped springs on their offset from the kart (so speed never drags them back), with separate stiffness for position and look target, and aim toward the road 16–30 m ahead. They roll slightly into corners, dip briefly under hard braking, pull back with a small FOV kick on boost (72° at most), rise and pull back to frame ramp landings, and cast a ray from the kart against invisible road, rail and bridge shells so the camera pulls in instead of clipping through scenery. Respawns and view changes ease over about 0.6 s instead of cutting. First-person views add a speed-based FOV of 75–85°, a light head bob from speed and road roughness, head tilt into corners and a landing jolt. With `prefers-reduced-motion`, the cameras skip roll, tilt, bob, jolts, shake, FOV kicks and speed streaks, and the first-person FOV stays at 78°.

Presentation includes fine-grain asphalt with tire wear, rounded metallic bodywork, detailed alloy wheels, sunset environment reflections, a player-following soft shadow map, continuous bridge decks, guardrails, structural piers, track lighting, red-and-white curbs and boost-pad arrows, named sector gates, turn boards, biome monuments, themed lava/snow/tunnels, drift sparks, landing bursts, exhaust trails and boost speed streaks. Close signboards are culled near the camera. Racers use normal camera-frustum clipping so overtakes do not trigger proximity-based hide/show popping. Road ribbons share vertices at segment boundaries to prevent overlapping surfaces and flickering at bends. The course atlas makes the layouts visible before starting.

## Source layout

```text
index.html / style.css    Garage, lobby, race HUD, help, results and responsive touch layout
app.js                    Local session lifecycle, HUD, hub reports, ghost storage, online view
input.js                  Keyboard, multi-touch, gamepad and edge-action capture
audio.js                  Gesture-unlocked synthesis: layered music buses, engine/tyre/world loops, one-shot effects
engine/score.js           Original 32-bar arrangement plus intensity, layers, stinger and fanfare cues
camera.js                 Pure camera math: modes, springs, FOV, roll, dip, head bob and pull-in
renderer.js               Textured road, landmarks, karts, particles, speed streaks, cameras, cockpit and minimap
network.js                WebSocket client; room/lobby/input protocol
engine/data.js            Weight presets, item tables, themes and deterministic seeded RNG
engine/track.js           Closed spline, arc length, projection, mud, hazards and box poses
engine/simulation.js      Shared 60 Hz rules: driving, bots, collisions, items, modes, ghost sampling
engine/package.json      CommonJS in Node; same engine files load as classic browser scripts
server/index.mjs          Authoritative WebSocket rooms, input checks, capacity and host lifecycle
vendor/                   Vendored Three.js r147 and its MIT license
game.json / thumbnail.svg Hub registration and procedural cover art
```

`server/relay.mjs` discovers the server from `game.json` at startup. The server uses `/games/crownfall-kart/ws`, runs shared simulation at 60 Hz and sends snapshots at 15 Hz. Browsers submit controls at 20 Hz and smooth visual motion. The server owns inventory, RNG, damage, placement, tournament points and win conditions. Input never accepts client positions or item assignments. Payload, connection, room and rate limits bound anonymous room traffic. This is authoritative room play, not deterministic lockstep; there is no latency prediction or durable room persistence yet.

The Hub SDK supplies identity defaults, namespaced storage, session-start/session-end reports and exit. The game guards SDK use and works standalone. A Grand Prix reports one session across four rounds; exiting reports a quit. Registry files are generated with `npm run registry`.

## Checks

From the repository root:

```sh
node --test test/crownfall-kart*.test.mjs
npm run registry
```

The tests cover all eight lap and sprint routes through completion, actual grade-separated crossings, pad activation, ramp launch/gap geometry, musical voice/event bounds, assistance priority, distinct layout shapes, screen-relative left/right controls for keyboard/touch/gamepad, four-round point retention and catalog wrapping, weighted loot, input sanitization/latching, acceleration, turbo release, ramp-landing windows, immunity, boost bounds, mud, checkpoint recovery/skip rejection, collision mass, leader retargeting, lap-wrap rubber banding, battle elimination, pose interpolation and real WebSocket room behavior. The online checks verify joining, host-only starts, eight-seat capacity, new-map selection, untrusted packet rejection, late-join rejection and disconnect takeover.

Browser smoke checks exercised the course atlas, garage audio startup, solo launch, acceleration, steering, pause and an online lobby/server countdown with no console warnings/errors. A local desktop sample reported approximately 60 FPS; this is not a performance guarantee for other hardware. Direct `file://` browser QA was blocked by the test browser's URL policy; HTTP rendering and the file-compatible loading structure were checked. Mobile controls and gamepad mappings are implemented, but actual phone/controller hardware and high-latency networks still need hands-on tuning. Handling and presentation have been reworked from the first version. Further player feedback should drive balancing; automated checks establish correctness, not whether a race feels fun. This has not been production load tested.

## Rendering and graphics settings

The renderer now uses locally bundled 2K CC0 asphalt and sandstone PBR maps (color, OpenGL normal and roughness), profile-specific HDR skies with PMREM reflections, and original smooth sports-coupe geometry. Each course selects its own terrain, architecture, atmosphere and weather profile. Corrugated steel guardrails, tubular streetlights, rubber wear strips and textured shoulders complete the road. Track layouts, checkpoints, handling and multiplayer collision rules remain unchanged.

The main-menu **Graphics** selector applies immediately and persists on each device:

| Preset | Shadows | Effects | Pixel-ratio cap |
| --- | --- | --- | --- |
| Performance | One 1024px cascade, 90m range | Direct ACES render; post effects off; fewer trees and lower-detail cars | 1.0 × 85% render scale |
| Balanced (default) | Two 1536px cascades, 260m range | Half-resolution 12-sample SSAO, quarter-resolution bloom, profile fog/grading, sun shafts and scaled wet reflections | 1.25 |
| High | Three 2048px cascades, 260m range | Balanced effects plus distant DoF, speed blur, volumetric clouds and full wet reflections | 1.5 |

All presets retain PBR textures, clear-coat paint, steering/hop animation and tire dust. Static car parts are batched by material to keep the eight-car grid affordable; front-wheel steering and wheel spin remain independent. Resolution scales down after sustained frame-budget misses, to a minimum of 60%, and recovers slowly when there is headroom. This targets smooth play but cannot guarantee 60 FPS on every device, especially while the same machine hosts and renders a race. Each LAN player chooses graphics independently; rendering settings do not alter the server tick rate or network state.

The HDR post pipeline requires WebGL2 and floating-point render targets. Unsupported devices use the direct renderer and exponential distance fog. The advanced pipeline reconstructs view-space positions from depth for SSAO, rejects foreground samples during distant DoF/motion blur, resets motion history on camera cuts/resizes, and integrates eight height-fog samples per pixel. This is rasterized real-time rendering, not path tracing. Cars, vegetation and terrain are original procedural assets rather than scanned or licensed production car models. See [asset attribution](assets/ATTRIBUTION.md) for bundled art sources and licenses.

Exhaust density follows acceleration; shoulder/mud driving raises turbulent, fading dust. Drift sparks advance blue → orange → purple. Front wheels steer independently of rotation and the chassis leans inward. Hops and hard landings animate the visual body without changing collision geometry. Boost adds 13° of FOV and speeds above 130 km/h progressively add up to 12° more. Reduced-motion mode disables FOV surge, camera shake, wind streaks, squash/stretch, motion blur and cinematic DoF, and reduces bloom.

### Validation

Run gameplay and online regression tests with:

```sh
node --test test/crownfall-kart.test.mjs test/crownfall-kart-online.test.mjs test/crownfall-kart-environments.test.mjs
```

Serve the repository on port 8080, make Playwright available through `NODE_PATH`, and run:

```sh
node tools/verify-crownfall-canyon.cjs
```

Set `CHROME_PATH` if using a local Chrome executable, or `KART_URL` for a different server. Browser checks cover actual shader compilation, asset loads, all three presets and persistence, sports-car mesh density, SSAO/motion uniforms, tire dust, all courses/battle, mobile resize, reduced motion, fallback and adaptive resolution. Screenshots go to `output/crownfall-kart-canyon/`. Software-rendered headless checks validate correctness, not a hardware FPS claim.

## Per-track environment architecture

`engine/environments.js` is the immutable, presentation-only profile registry. Profiles join the existing track catalog by stable `id`; selecting a course, receiving a new online course or advancing a Grand Prix rebuilds the environment automatically. “Crown Skybridge” is the visual profile title/alias for Shattered Crown, not a ninth physics track. Unknown profile keys fall back to Shattered Crown.

| Track | Background and materials | Atmosphere and weather |
| --- | --- | --- |
| Shattered Crown | Floating gothic citadels, slate balustrades, open abyss | Blue moonlight, dense ground mist, stars and clouds |
| Ember Keep | Red sandstone fortress, crenellated walls, desert ridges | Golden-hour HDR, warm sun shafts, rising embers and windblown ground dust |
| Moonveil Ruins | Silver limestone colonnades, broken arches, wooded valley | Cold high-contrast moonlight, heavy low mist |
| Void Cathedral | Obsidian cathedrals, flying buttresses, floating spires | Violet eclipse, luminous celestial ring, drifting ash |
| Frostgrave Pass | Snow-covered alpine summits, iced borders, pine trees and lodges | Green aurora, cold daylight, falling snow |
| Bloodroot Fen | Moss-covered terrain, root silhouettes and dense forest | Copper dusk, green ground haze, shafts through the canopy, drifting leaves |
| Stormspire Causeway | Dense neon skyscrapers, illuminated borders, rain-slick asphalt | Storm ceiling, cyan/magenta bloom, rain streaks and wet-surface SSR |
| Sunken Observatory | Tidal water, oxidized brass domes, telescope arrays | Ringed planet, teal/coral dusk, sea spray and wet reflections |

Each profile specifies terrain type, asphalt color/roughness/normal strength, border material, architecture generator, HDR horizon and celestial body, sun direction/intensity, ambient light, exposure, fog density/height, color grade, bloom, shafts, wetness and weather. Seven skies are original 1024×512 linear HDR environments with radiance above 1.0; Ember Keep additionally loads the bundled 2K Radiance photograph. A profile-specific generated sky is available immediately while that file loads. A three-entry LRU bounds sky/PMREM memory; a late HDR callback checks the current profile before applying. Scene-owned geometry and materials are released on a map change, and shared PBR maps remain reusable.

`environment-architecture.js` batches repeated architecture by geometry/material. `environment-weather.js` manages bounded snow, rain, mist, ember, ash, leaf and spray pools. Particles stay in world space as their volume follows the racer; near-car drag and vortices depend on actual velocity. Performance/Balanced/High draw 30%/65%/100% of the weather pool. Ground dust has its own scaled layer. Weather is cosmetic and does not change traction or online physics.

Wet reflections reconstruct visible surface normals from depth, march a reflection ray and refine depth intersections. They have the normal limitations of screen-space reflections: off-screen objects use the HDR environment fallback. Sun shafts are depth-occluded screen-space scattering, not ray-traced light transport. High mode adds a sixteen-sample volumetric cloud layer; lower modes retain the profile's HDR cloud backdrop. Performance mode uses profile-colored distance fog and PBR reflections without the advanced post stack. Reduced motion suppresses speed blur/DoF and softens shafts/cloud animation; weather never uses flashing lightning.

Run `node tools/verify-crownfall-environments.cjs` with the same Playwright configuration described above. It checks all eight live WebGL profiles, unique skies/materials/architecture, finite weather and aerodynamic movement, wet SSR/shafts, delayed HDR isolation, bounded sky cache, graphics scaling, battle, fallback and mobile resize. `KART_ANGLE=metal` selects native Metal for local Mac testing; the default uses software rendering. Environment screenshots are saved in `output/crownfall-kart-environments/`.
