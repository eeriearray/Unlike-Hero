import { SEA, EDGE, TEAMS, ISLANDS, BANK_RADIUS, GUARD_RADIUS, distance, angleDelta, forward, starboard, onLand, collideSea, shoreRadius } from './sea-map.js';

// Host-only fixed-step simulation of a Plunder match.
// Sink rivals to spill their gold, scoop treasure, bank it at your harbor.
// Most banked gold when the clock runs out wins.
export const RULES = {
 duration: 180,      // seconds per match
 finalRush: 30,      // last N seconds: banked gold counts double
 hull: 100,
 speed: 17,
 reload: 1.15,
 ballSpeed: 58,
 ballDamage: 11,
 range: 68,
 respawn: 4,
 shield: 3,          // seconds of spawn protection
 boost: 1.6, boostCooldown: 6,
 chestValue: 8, maxChests: 7, chestEvery: 4,
 bounty: 4,          // extra gold that spills from every sunk ship
 galleonAt: [50, 118], galleonHull: 300, galleonGold: 60,
 powerEvery: 11, maxPowers: 3,
 powerTime: 12,
 whirls: 2, whirlRadius: 26, whirlCore: 7, whirlGrind: 60, // hull per second in the eye
 whirlSwallow: 3.5, // closer than this to the centre and the sea takes you
};
export const POWERS = {
 triple: { name: 'Big Guns', note: '5-ball broadsides' },
 gust: { name: 'Fair Wind', note: 'Extra speed' },
 repair: { name: 'Repair Kit', note: '+50 hull' },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function createMatch(captains, { seed = Date.now(), duration = RULES.duration } = {}) {
 const w = {
  t: 0, duration, phase: 'play', winner: null, final: false,
  teams: TEAMS.map(t => ({ id: t.id, score: 0 })),
  ships: [], shots: [], loot: [], powers: [], galleon: null,
  events: [], eventN: 0, nextId: 1, chestClock: 0, powerClock: 4, galleons: 0,
 };
 Object.defineProperty(w, 'random', { value: rng(seed), enumerable: false });
 captains.forEach((c, i) => {
  const team = c.team ?? i % 2, slot = Math.floor(i / 2);
  const s = {
   id: c.id, name: c.name || `Captain ${i + 1}`, team, ai: !!c.ai, slot,
   x: 0, z: 0, a: 0, v: 0, rudder: 0, yawRate: 0,
   hp: RULES.hull, gold: 0, banked: 0, sinks: 0,
   dead: false, respawnIn: 0, shield: 0, reload: 0.4, boost: 0, boostCd: 0,
   power: '', powerFor: 0, lastHitBy: null, greed: 18 + ((i * 7) % 4) * 6,
  };
  spawn(s);
  w.ships.push(s);
 });
 for (let i = 0; i < 6; i++) spawnChest(w, i < 3);
 w.whirls = Array.from({ length: RULES.whirls }, (_, k) => {
  const a = k * Math.PI + Math.PI / 2 + (w.random() - 0.5);
  return { x: Math.cos(a) * 45, z: Math.sin(a) * 45, heading: w.random() * Math.PI * 2, speed: 5, r: RULES.whirlRadius, dir: k % 2 ? -1 : 1, lurch: 2 + w.random() * 4, spin: 0 };
 });
 return w;
}

function spawn(s) {
 const home = TEAMS[s.team], lane = (s.slot - 1) * 9;
 s.x = home.x + Math.sign(home.x) * -2; s.z = lane; s.a = home.face; s.v = 4;
 s.hp = RULES.hull; s.dead = false; s.shield = RULES.shield; s.gold = 0; s.reload = 0.4;
 s.rudder = s.yawRate = 0; s.boost = 0; s.power = ''; s.powerFor = 0;
}

function emit(w, type, data = {}) {
 w.events.push({ n: ++w.eventN, type, ...data });
 if (w.events.length > 40) w.events.shift();
}

function openWater(w, near) {
 for (let tries = 0; tries < 30; tries++) {
  const r = near ? 10 + w.random() * 34 : 30 + w.random() * 95, a = w.random() * Math.PI * 2;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (onLand(x, z, 7)) continue;
  if (TEAMS.some(t => Math.hypot(x - t.x, z - t.z) < 42)) continue;
  return { x, z };
 }
 return { x: 0, z: 20 };
}

function spawnChest(w, near = w.random() < 0.5) {
 const p = openWater(w, near);
 w.loot.push({ id: w.nextId++, kind: 'chest', value: RULES.chestValue, x: p.x, z: p.z, vx: 0, vz: 0, ttl: 999 });
}

// Spilled gold pops out in pouches that drift away from the wreck.
function spill(w, x, z, total, kind = 'coins', piece = 5) {
 const n = Math.max(1, Math.ceil(total / piece));
 for (let i = 0; i < n; i++) {
  const a = (i / n) * Math.PI * 2 + w.random(), sp = 4 + w.random() * 5, value = Math.min(piece, total - i * piece);
  if (value <= 0) break;
  w.loot.push({ id: w.nextId++, kind, value, x: x + Math.cos(a) * 2, z: z + Math.sin(a) * 2, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, ttl: 45 });
 }
 if (w.loot.length > 48) w.loot.splice(0, w.loot.length - 48);
}

function sail(s, u, dt) {
 const turn = clamp(u.turn, -1, 1), throttle = clamp(u.throttle, -1, 1);
 s.rudder += (turn - s.rudder) * damp(14, dt);
 const handling = 1.55 + 0.5 * Math.min(1, Math.abs(s.v) / 14);
 s.yawRate += (s.rudder * handling - s.yawRate) * damp(12, dt);
 s.a += s.yawRate * dt;
 const laden = 1 - Math.min(0.3, s.gold / 180);
 const top = RULES.speed * laden * (s.power === 'gust' ? 1.35 : 1) + (s.boost > 0 ? 11 : 0);
 const want = throttle * (throttle < 0 ? 6 : top);
 s.v += (want - s.v) * damp(throttle * s.v < 0 ? 6 : throttle === 0 ? 1.6 : 2.4, dt);
 const f = forward(s.a);
 s.x += f.x * s.v * dt; s.z += f.z * s.v * dt;
}

// Picks the best target abeam of `s` and returns {side, dir} for a broadside.
export function aimBroadside(w, s) {
 let best = null, bestScore = 0;
 const targets = w.ships.filter(o => !o.dead && o.team !== s.team);
 if (w.galleon && !w.galleon.dead) targets.push(w.galleon);
 for (const o of targets) {
  const dx = o.x - s.x, dz = o.z - s.z, d = Math.hypot(dx, dz);
  if (d > RULES.range + 4 || d < 1) continue;
  const rel = angleDelta(Math.atan2(dx, dz), s.a), beam = Math.abs(Math.sin(rel));
  if (beam < 0.4) continue;
  const score = beam * (1.25 - d / (RULES.range + 10)) * (o.galleon ? 0.8 : 1);
  if (score > bestScore) { bestScore = score; best = { o, rel, d }; }
 }
 if (!best) return null;
 const { o, rel, d } = best, side = rel < 0 ? 1 : -1; // 1 = starboard
 const lead = d / RULES.ballSpeed, ov = o.v || 0, of = forward(o.a || 0);
 const px = o.x + of.x * ov * lead, pz = o.z + of.z * ov * lead;
 const beamDir = side > 0 ? s.a - Math.PI / 2 : s.a + Math.PI / 2;
 let dir = Math.atan2(px - s.x, pz - s.z);
 dir = beamDir + clamp(angleDelta(dir, beamDir), -0.75, 0.75);
 return { side, dir, d: Math.hypot(px - s.x, pz - s.z), target: o.id };
}

function fire(w, s) {
 const aim = aimBroadside(w, s);
 const sides = aim ? [aim] : [
  { side: 1, dir: s.a - Math.PI / 2, d: RULES.range * 0.8 },
  { side: -1, dir: s.a + Math.PI / 2, d: RULES.range * 0.8 },
 ];
 const count = s.power === 'triple' ? 5 : 3, f = forward(s.a);
 for (const shot of sides) {
  const sb = starboard(s.a), sx = s.x + sb.x * shot.side * 2.4, sz = s.z + sb.z * shot.side * 2.4;
  const life = clamp(shot.d / RULES.ballSpeed + 0.12, 0.35, RULES.range / RULES.ballSpeed + 0.1);
  for (let i = 0; i < count; i++) {
   const k = i - (count - 1) / 2, wobble = s.ai ? (w.random() - 0.5) * 0.12 : 0;
   const dir = shot.dir + k * 0.035 + wobble;
   w.shots.push({ id: w.nextId++, by: s.id, team: s.team, x: sx + f.x * k * 1.6, z: sz + f.z * k * 1.6, y: 2,
    vx: Math.sin(dir) * RULES.ballSpeed + f.x * s.v * 0.5, vz: Math.cos(dir) * RULES.ballSpeed + f.z * s.v * 0.5,
    vy: (0.5 * 22 * life * life - 1.6) / life, life, age: 0, dmg: RULES.ballDamage });
  }
  emit(w, 'fire', { id: s.id, side: shot.side, x: sx, z: sz });
 }
 s.reload = RULES.reload;
}

function damage(w, s, amount, by) {
 if (s.dead || s.shield > 0) return;
 s.hp -= amount; s.lastHitBy = by;
 emit(w, 'hit', { id: s.id, by, x: s.x, z: s.z });
 if (s.hp <= 0) sink(w, s, by);
}

function sink(w, s, by) {
 s.dead = true; s.hp = 0; s.respawnIn = RULES.respawn; s.v = 0;
 const lost = s.gold;
 spill(w, s.x, s.z, lost + RULES.bounty);
 s.gold = 0;
 const killer = w.ships.find(o => o.id === by);
 if (killer && killer.team !== s.team) killer.sinks++;
 emit(w, 'sink', { id: s.id, by, gold: lost, x: s.x, z: s.z });
}

function startGalleon(w) {
 const flip = w.galleons++ % 2 ? -1 : 1, from = { x: -100 * flip, z: -132 }, to = { x: 100 * flip, z: 132 };
 w.galleon = { id: 'galleon', galleon: true, name: 'Treasure Galleon', team: -1, x: from.x, z: from.z,
  a: Math.atan2(to.x - from.x, to.z - from.z), v: 7, hp: RULES.galleonHull, max: RULES.galleonHull, reload: 2, to, dead: false, sinkT: 0 };
 emit(w, 'galleon', { x: from.x, z: from.z });
}

function stepGalleon(w, dt) {
 const g = w.galleon;
 if (!g) return;
 if (g.dead) { g.sinkT += dt; if (g.sinkT > 4) w.galleon = null; return; }
 const f = forward(g.a);
 g.x += f.x * g.v * dt; g.z += f.z * g.v * dt;
 if (Math.hypot(g.x - g.to.x, g.z - g.to.z) < 6) { emit(w, 'galleonescaped', {}); w.galleon = null; return; }
 g.reload -= dt;
 if (g.reload <= 0) {
  const prey = w.ships.filter(s => !s.dead && distance(s, g) < 48).sort((a, b) => distance(a, g) - distance(b, g))[0];
  if (prey) {
   g.reload = 2.4;
   const dir = Math.atan2(prey.x - g.x, prey.z - g.z), life = clamp(distance(prey, g) / 50, 0.4, 1);
   for (const k of [-1, 1]) w.shots.push({ id: w.nextId++, by: 'galleon', team: -1, x: g.x, z: g.z, y: 3, vx: Math.sin(dir + k * 0.04) * 50, vz: Math.cos(dir + k * 0.04) * 50,
    vy: (0.5 * 22 * life * life - 3) / life, life, age: 0, dmg: 8 });
   emit(w, 'fire', { id: 'galleon', x: g.x, z: g.z });
  }
 }
}

function stepShots(w, dt) {
 const keep = [];
 for (const b of w.shots) {
  b.age += dt; b.x += b.vx * dt; b.z += b.vz * dt; b.vy -= 22 * dt; b.y += b.vy * dt;
  let gone = false;
  const victims = w.ships.filter(s => !s.dead && s.team !== b.team);
  if (b.team !== -1 && w.galleon && !w.galleon.dead) victims.push(w.galleon);
  for (const s of victims) {
   const f = forward(s.a), len = s.galleon ? 8 : 4.6, rad = s.galleon ? 4.2 : 2.7;
   const dx = b.x - s.x, dz = b.z - s.z, along = clamp(dx * f.x + dz * f.z, -len, len);
   if (Math.hypot(dx - f.x * along, dz - f.z * along) < rad && b.y < 7) {
    if (s.galleon) hitGalleon(w, b.by, b.dmg); else damage(w, s, b.dmg, b.by);
    gone = true; break;
   }
  }
  if (!gone && onLand(b.x, b.z, -1) && b.y < 5) { emit(w, 'thud', { x: b.x, z: b.z }); gone = true; }
  if (!gone && (b.y <= 0 || b.age > 2.2)) { emit(w, 'splash', { x: b.x, z: b.z }); gone = true; }
  if (!gone) keep.push(b);
 }
 w.shots = keep.slice(-90);
}

function hitGalleon(w, by, dmg) {
 const g = w.galleon;
 g.hp -= dmg;
 emit(w, 'hit', { id: 'galleon', by, x: g.x, z: g.z });
 if (g.hp <= 0) {
  g.dead = true; g.hp = 0;
  spill(w, g.x, g.z, RULES.galleonGold, 'chest', 6);
  const killer = w.ships.find(o => o.id === by);
  emit(w, 'galleonsunk', { by, team: killer?.team ?? -1, x: g.x, z: g.z });
 }
}

function harbor(w, s, dt) {
 const home = TEAMS[s.team];
 if (Math.hypot(s.x - home.x, s.z - home.z) < BANK_RADIUS) {
  if (s.hp < RULES.hull) s.hp = Math.min(RULES.hull, s.hp + 25 * dt);
  if (s.gold > 0) {
   const value = s.gold * (w.final ? 2 : 1);
   w.teams[s.team].score += value; s.banked += value;
   emit(w, 'bank', { id: s.id, team: s.team, gold: value, double: w.final });
   s.gold = 0;
  }
 }
}

// Each harbor tower lobs shells at raiders that come too close.
function guards(w, dt) {
 w.guardClock = (w.guardClock || 0) - dt;
 if (w.guardClock > 0) return;
 w.guardClock = 1.6;
 for (const home of TEAMS) {
  const raider = w.ships.find(s => !s.dead && s.team !== home.id && Math.hypot(s.x - home.x, s.z - home.z) < GUARD_RADIUS);
  if (!raider) continue;
  const tx = home.x + Math.sign(home.x) * 22, d = Math.hypot(raider.x - tx, raider.z), life = clamp(d / 45, 0.4, 1.2);
  const dir = Math.atan2(raider.x + forward(raider.a).x * raider.v * life - tx, raider.z + forward(raider.a).z * raider.v * life);
  w.shots.push({ id: w.nextId++, by: `tower-${home.id}`, team: home.id, x: tx, z: 0, y: 9, vx: Math.sin(dir) * 45, vz: Math.cos(dir) * 45,
   vy: (0.5 * 22 * life * life - 9) / life, life, age: 0, dmg: 14 });
  emit(w, 'tower', { team: home.id });
 }
}

export function step(w, controls = {}, dt = 1 / 30) {
 if (w.phase !== 'play') return w;
 w.t += dt;
 const left = w.duration - w.t;
 if (!w.final && left <= RULES.finalRush) { w.final = true; emit(w, 'final', {}); }
 if (RULES.galleonAt.some(at => w.t >= at && w.t - dt < at)) startGalleon(w);
 for (const s of w.ships) {
  if (s.dead) { s.respawnIn -= dt; if (s.respawnIn <= 0) { spawn(s); emit(w, 'respawn', { id: s.id }); } continue; }
  const u = s.ai ? botControl(w, s) : controls[s.id] || {};
  s.reload -= dt; s.boostCd -= dt; s.boost -= dt; s.shield -= dt;
  if (s.powerFor > 0 && (s.powerFor -= dt) <= 0) s.power = '';
  if (u.boost && s.boostCd <= 0) { s.boost = RULES.boost; s.boostCd = RULES.boostCooldown; emit(w, 'boost', { id: s.id }); }
  sail(s, u, dt);
  if (collideSea(s) && Math.abs(s.v) > 8) emit(w, 'bump', { id: s.id });
  if (u.fire && s.reload <= 0) { fire(w, s); s.shield = Math.min(s.shield, 0); }
  harbor(w, s, dt);
 }
 separateShips(w);
 stepGalleon(w, dt);
 stepWhirls(w, dt);
 stepShots(w, dt);
 guards(w, dt);
 collect(w, dt);
 w.chestClock -= dt;
 if (w.chestClock <= 0) { w.chestClock = RULES.chestEvery; if (w.loot.filter(l => l.kind === 'chest' && l.ttl > 100).length < RULES.maxChests) spawnChest(w); }
 w.powerClock -= dt;
 if (w.powerClock <= 0) {
  w.powerClock = RULES.powerEvery;
  if (w.powers.length < RULES.maxPowers) { const p = openWater(w, false), kinds = Object.keys(POWERS); w.powers.push({ id: w.nextId++, kind: kinds[Math.floor(w.random() * kinds.length)], x: p.x, z: p.z }); }
 }
 if (left <= 0) finish(w);
 return w;
}

function separateShips(w) {
 const live = w.ships.filter(s => !s.dead);
 if (w.galleon && !w.galleon.dead) live.push(w.galleon);
 for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
  const a = live[i], b = live[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), r = (a.galleon || b.galleon) ? 11 : 8;
  if (d < r && d > 0.01) {
   const push = (r - d) / 2, nx = dx / d, nz = dz / d;
   if (!a.galleon) { a.x -= nx * push * (b.galleon ? 2 : 1); a.z -= nz * push * (b.galleon ? 2 : 1); a.v *= 0.9; }
   if (!b.galleon) { b.x += nx * push * (a.galleon ? 2 : 1); b.z += nz * push * (a.galleon ? 2 : 1); b.v *= 0.9; }
  }
 }
}

// ---------- Whirlpools ----------
// Two maelstroms wander the sea. They drift on a random walk, but every few
// seconds one lurches: a sharp new heading and a burst of speed. They drag
// ships in, spin them round and grind their hull in the eye. Loot caught in
// one circles inside it, which makes for tempting, dangerous bait.
function stepWhirls(w, dt) {
 for (const [n, h] of (w.whirls || []).entries()) {
  h.lurch -= dt;
  if (h.lurch <= 0) { h.lurch = 2.5 + w.random() * 5; h.heading += (w.random() - 0.5) * Math.PI * 1.6; h.speed = 7 + w.random() * 6; if (w.random() < 0.25) h.dir *= -1; }
  h.heading += (w.random() - 0.5) * 2.2 * dt;
  h.speed += (4 - h.speed) * damp(0.35, dt);
  h.spin += h.dir * dt * (1.6 + h.speed * 0.05);
  // Steer away from land, harbors, the sea edge and the other whirlpool.
  let vx = Math.sin(h.heading), vz = Math.cos(h.heading);
  const away = (x, z, reach, k = 2) => { const dx = h.x - x, dz = h.z - z, d = Math.hypot(dx, dz); if (d < reach && d > 0.01) { const f = (reach - d) / reach * k; vx += dx / d * f; vz += dz / d * f; } };
  for (const i of ISLANDS) away(i.x, i.z, shoreRadius(i) + h.r * 0.9);
  for (const t of TEAMS) away(t.x, t.z, BANK_RADIUS + h.r + 18, 3);
  for (const o of w.whirls) if (o !== h) away(o.x, o.z, h.r * 2.6);
  const r = Math.hypot(h.x, h.z); if (r > EDGE - h.r - 10) { vx -= h.x / r * 2; vz -= h.z / r * 2; }
  h.heading += angleDelta(Math.atan2(vx, vz), h.heading) * damp(2.5, dt);
  h.x += Math.sin(h.heading) * h.speed * dt; h.z += Math.cos(h.heading) * h.speed * dt;
  for (const s of w.ships) {
   if (s.dead) continue;
   const dx = h.x - s.x, dz = h.z - s.z, d = Math.hypot(dx, dz);
   if (d > h.r) { if (s.whirled === n) s.whirled = -1; continue; }
   if (s.whirled !== n) { s.whirled = n; emit(w, 'whirlpool', { id: s.id, x: s.x, z: s.z }); }
   // The pull grows steeply toward the eye: full sail escapes the rim, only a boost escapes the middle.
   const k = 1 - d / h.r, grip = s.boost > 0 ? 0.4 : 1, nx = dx / (d || 1), nz = dz / (d || 1);
   const pull = 17 * Math.pow(k, 0.8) * grip, swirl = 14 * k * grip * h.dir;
   s.x += (nx * pull - nz * swirl) * dt; s.z += (nz * pull + nx * swirl) * dt;
   s.a += h.dir * k * 1.3 * grip * dt;
   // Spawn protection does not save you from the sea itself.
   s.hp -= (d < RULES.whirlCore ? RULES.whirlGrind : 8 * k) * dt;
   if (d < RULES.whirlSwallow || s.hp <= 0) { sink(w, s, 'whirlpool'); s.whirled = -1; }
  }
  for (const l of w.loot) {
   const dx = h.x - l.x, dz = h.z - l.z, d = Math.hypot(dx, dz);
   if (d > h.r || d < 0.01) continue;
   const k = 1 - d / h.r, nx = dx / d, nz = dz / d, inward = d > RULES.whirlCore + 2 ? 5 * k : -2;
   l.vx += (nx * inward - nz * 9 * k * h.dir - l.vx) * damp(3, dt); l.vz += (nz * inward + nx * 9 * k * h.dir - l.vz) * damp(3, dt);
   l.x += h.x - (h.px ?? h.x); l.z += h.z - (h.pz ?? h.z);
  }
  h.px = h.x; h.pz = h.z;
 }
}

function collect(w, dt) {
 const keep = [];
 for (const l of w.loot) {
  l.x += l.vx * dt; l.z += l.vz * dt; l.vx *= 1 - damp(1.4, dt); l.vz *= 1 - damp(1.4, dt); l.ttl -= dt;
  if (onLand(l.x, l.z, 1)) { l.vx = -l.vx; l.vz = -l.vz; }
  if (Math.hypot(l.x, l.z) > EDGE) { l.x *= EDGE / Math.hypot(l.x, l.z); l.z *= EDGE / Math.hypot(l.x, l.z); }
  const s = l.ttl > 0 && w.ships.find(s => !s.dead && Math.hypot(s.x - l.x, s.z - l.z) < 5);
  if (s) { s.gold += l.value; emit(w, 'loot', { id: s.id, gold: l.value, x: l.x, z: l.z, kind: l.kind }); }
  else if (l.ttl > 0) keep.push(l);
 }
 w.loot = keep;
 w.powers = w.powers.filter(p => {
  const s = w.ships.find(s => !s.dead && Math.hypot(s.x - p.x, s.z - p.z) < 5);
  if (!s) return true;
  if (p.kind === 'repair') s.hp = Math.min(RULES.hull, s.hp + 50);
  else { s.power = p.kind; s.powerFor = RULES.powerTime; }
  emit(w, 'power', { id: s.id, kind: p.kind, x: p.x, z: p.z });
  return false;
 });
}

function finish(w) {
 w.phase = 'over';
 const [a, b] = w.teams.map(t => t.score);
 w.winner = a === b ? -1 : a > b ? 0 : 1;
 emit(w, 'end', { winner: w.winner });
}

// ---------- Bots ----------
// Bots follow the same rules: grab treasure, fight what is close, chase the
// galleon, and run home once their hold is worth protecting.
export function botControl(w, s) {
 const home = TEAMS[s.team], homeD = Math.hypot(s.x - home.x, s.z - home.z);
 const enemies = w.ships.filter(o => !o.dead && o.team !== s.team && o.shield <= 0);
 const near = enemies.map(o => ({ o, d: distance(o, s) })).sort((a, b) => a.d - b.d)[0];
 const g = w.galleon && !w.galleon.dead ? w.galleon : null;
 let goal = null, fight = null;
 if (s.gold >= s.greed || (s.gold >= 6 && s.hp < 45) || (w.final && s.gold > 0 && homeD < 100) || (w.duration - w.t < 12 && s.gold > 0)) goal = home;
 else if (near && near.d < (s.hp > 40 ? 46 : 26)) fight = near.o;
 else if (g && distance(g, s) < 110) fight = g;
 else {
  let best = -1;
  for (const l of [...w.loot, ...w.powers]) {
   const value = l.value || (l.kind === 'repair' ? (s.hp < 60 ? 14 : 2) : 9);
   const score = value / (distance(l, s) + 25);
   if (score > best) { best = score; goal = l; }
  }
  goal = goal || { x: 0, z: 30 };
 }
 let desired, throttle = 1;
 if (fight) {
  const d = distance(fight, s), to = Math.atan2(fight.x - s.x, fight.z - s.z);
  const port = angleDelta(to + Math.PI / 2, s.a), star = angleDelta(to - Math.PI / 2, s.a);
  const side = Math.abs(port) < Math.abs(star) ? 1 : -1;
  const ideal = fight.galleon ? 32 : 26, inward = clamp((d - ideal) / 30, -0.6, 0.9);
  desired = to + side * (Math.PI / 2 - inward);
  if (d > 70) desired = to;
 } else desired = Math.atan2(goal.x - s.x, goal.z - s.z);
 // Steer around land and the sea edge.
 let vx = Math.sin(desired), vz = Math.cos(desired);
 const ahead = forward(s.a);
 for (const i of ISLANDS) {
  const px = s.x + ahead.x * 10, pz = s.z + ahead.z * 10, dx = px - i.x, dz = pz - i.z, d = Math.hypot(dx, dz), reach = i.r + 14;
  if (d < reach) { const k = (reach - d) / reach * 2.4; vx += dx / d * k; vz += dz / d * k; }
 }
 for (const h of w.whirls || []) {
  const dx = s.x - h.x, dz = s.z - h.z, d = Math.hypot(dx, dz), reach = h.r + 12;
  if (d < reach) { const k = (reach - d) / reach * 3.2; vx += dx / d * k; vz += dz / d * k; }
 }
 const r = Math.hypot(s.x, s.z);
 if (r > EDGE - 18) { vx -= s.x / r * 1.5; vz -= s.z / r * 1.5; }
 const heading = Math.atan2(vx, vz), err = angleDelta(heading, s.a);
 if (Math.abs(err) > 1.3) throttle = 0.55;
 const aim = aimBroadside(w, s);
 return {
  throttle, turn: clamp(err * 2.2, -1, 1),
  fire: !!aim && aim.d < RULES.range - 6 && s.reload <= 0,
  boost: (goal === home && s.gold > 10 && Math.abs(err) < 0.4 && homeD > 50) || (fight && s.hp < 30 && w.random() < 0.02),
 };
}

export const HOME = TEAMS;
export { SEA, ISLANDS };
