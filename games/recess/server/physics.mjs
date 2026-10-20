// Server-side shot physics for RECESS's flick games (Marble Knockout, Carrom, Pen Fight).
//
// Clients never simulate. They send a shot (where and how hard), the server runs the whole shot at a
// fixed time step until everything stops, and every player replays the same recorded frames.

export const DT = 1 / 120;
const FRAME_EVERY = 4;           // 30 recorded frames per second
const MAX_STEPS = 120 * 12;      // no shot lasts longer than 12 s
const REST_SPEED = 0.6;          // units/s below which a body stops

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Simulate discs on a flat surface.
 * bodies: [{ id, x, y, vx, vy, r, m, kind }] (mutated in place; bodies that leave get .gone = 'pocket' | 'out')
 * opts:
 *   friction      linear deceleration, units/s²
 *   restitution   disc–disc bounce
 *   walls         { minX, minY, maxX, maxY, restitution } or null for an open surface
 *   pockets       [{ x, y, r }]: a disc whose centre enters a pocket is removed
 *   outside(b)    returns true when a disc has left the playing area (open surfaces)
 */
export function simulateDiscs(bodies, opts) {
  const { friction = 30, restitution = 0.92, walls = null, pockets = [], outside = null } = opts;
  const frames = [];
  const events = [];
  const record = () => frames.push(bodies.map(b => (b.gone ? null : [r1(b.x), r1(b.y)])));
  record();
  let step = 0;
  for (; step < MAX_STEPS; step++) {
    let moving = false;
    for (const b of bodies) {
      if (b.gone) continue;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp < REST_SPEED) { b.vx = 0; b.vy = 0; continue; }
      moving = true;
      const ns = Math.max(0, sp - friction * DT);
      b.vx *= ns / sp; b.vy *= ns / sp;
      b.x += b.vx * DT; b.y += b.vy * DT;
    }
    if (!moving && step > 0) break;

    // disc–disc collisions
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (a.gone) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (b.gone) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const overlap = rr - d;
        const ia = 1 / a.m, ib = 1 / b.m;
        a.x -= nx * overlap * ia / (ia + ib); a.y -= ny * overlap * ia / (ia + ib);
        b.x += nx * overlap * ib / (ia + ib); b.y += ny * overlap * ib / (ia + ib);
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn >= 0) continue;
        const jimp = -(1 + restitution) * vn / (ia + ib);
        a.vx -= jimp * nx * ia; a.vy -= jimp * ny * ia;
        b.vx += jimp * nx * ib; b.vy += jimp * ny * ib;
        if (events.length < 120) events.push({ f: Math.floor(step / FRAME_EVERY), type: 'hit', a: a.id, b: b.id, v: r1(-vn) });
      }
    }

    for (const b of bodies) {
      if (b.gone) continue;
      if (walls) {
        const e = walls.restitution ?? 0.75;
        let hit = 0;
        if (b.x - b.r < walls.minX) { b.x = walls.minX + b.r; b.vx = Math.abs(b.vx) * e; hit = Math.abs(b.vx); }
        if (b.x + b.r > walls.maxX) { b.x = walls.maxX - b.r; b.vx = -Math.abs(b.vx) * e; hit = Math.abs(b.vx); }
        if (b.y - b.r < walls.minY) { b.y = walls.minY + b.r; b.vy = Math.abs(b.vy) * e; hit = Math.abs(b.vy); }
        if (b.y + b.r > walls.maxY) { b.y = walls.maxY - b.r; b.vy = -Math.abs(b.vy) * e; hit = Math.abs(b.vy); }
        if (hit > 8 && events.length < 120) events.push({ f: Math.floor(step / FRAME_EVERY), type: 'wall', a: b.id, v: r1(hit) });
      }
      for (const p of pockets) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < p.r) {
          b.gone = 'pocket'; b.x = p.x; b.y = p.y; b.vx = b.vy = 0;
          events.push({ f: Math.floor(step / FRAME_EVERY), type: 'pocket', a: b.id });
          break;
        }
      }
      if (!b.gone && outside && outside(b)) {
        b.gone = 'out';
        events.push({ f: Math.floor(step / FRAME_EVERY), type: 'out', a: b.id });
      }
    }
    if (step % FRAME_EVERY === 0) record();
  }
  record();
  return { frames, events, ids: bodies.map(b => b.id) };
}

// ─── Pens: rigid capsules that slide and spin ─────────────────────────────

export function penEnds(p) {
  const hx = Math.cos(p.a) * p.len / 2, hy = Math.sin(p.a) * p.len / 2;
  return [p.x - hx, p.y - hy, p.x + hx, p.y + hy];
}

function closestOnSegments(ax, ay, bx, by, cx, cy, dx, dy) {
  // Closest points between segments AB and CD (Ericson, Real-Time Collision Detection 5.1.9).
  const d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy;
  const rx = ax - cx, ry = ay - cy;
  const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry;
  const c = d1x * rx + d1y * ry, b = d1x * d2x + d1y * d2y;
  const den = a * e - b * b;
  let s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
  let t = (b * s + f) / e;
  if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
  else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
  return [ax + d1x * s, ay + d1y * s, cx + d2x * t, cy + d2y * t];
}

/**
 * pens: [{ id, x, y, a, vx, vy, w, len, r, m }]; desk: { w, h }.
 * A pen whose centre leaves the desk falls off (gone = 'off').
 */
export function simulatePens(pens, desk) {
  const frames = [];
  const events = [];
  // Paper is grippy and pens are not billiard balls: a hit passes on only part of the speed, so one
  // flick rarely clears the desk, and a hard flick tends to carry your own pen on after the hit.
  const LIN_F = 60, ANG_F = 9, E = 0.35;
  const inertia = (p) => p.m * p.len * p.len / 12;
  const record = () => frames.push(pens.map(p => [r1(p.x), r1(p.y), Math.round(p.a * 1000) / 1000, p.gone ? 1 : 0]));
  record();
  for (let step = 0; step < MAX_STEPS; step++) {
    let moving = false;
    for (const p of pens) {
      if (p.gone) continue;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp < REST_SPEED) { p.vx = p.vy = 0; } else {
        const ns = Math.max(0, sp - LIN_F * DT);
        p.vx *= ns / sp; p.vy *= ns / sp;
        moving = true;
      }
      if (Math.abs(p.w) < 0.05) p.w = 0; else {
        p.w = Math.sign(p.w) * Math.max(0, Math.abs(p.w) - ANG_F * DT);
        moving = true;
      }
      p.x += p.vx * DT; p.y += p.vy * DT; p.a += p.w * DT;
    }
    if (!moving && step > 0) break;

    for (let i = 0; i < pens.length; i++) {
      for (let j = i + 1; j < pens.length; j++) {
        const A = pens[i], B = pens[j];
        if (A.gone || B.gone) continue;
        const [ax, ay, bx, by] = penEnds(A);
        const [cx, cy, dx, dy] = penEnds(B);
        const [px, py, qx, qy] = closestOnSegments(ax, ay, bx, by, cx, cy, dx, dy);
        let nx = qx - px, ny = qy - py;
        const d = Math.hypot(nx, ny);
        const rr = A.r + B.r;
        if (d >= rr) continue;
        if (d < 1e-6) { nx = B.x - A.x; ny = B.y - A.y; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; } else { nx /= d; ny /= d; }
        const cxp = (px + qx) / 2, cyp = (py + qy) / 2;
        const rax = cxp - A.x, ray = cyp - A.y, rbx = cxp - B.x, rby = cyp - B.y;
        // separate
        const overlap = rr - d;
        A.x -= nx * overlap / 2; A.y -= ny * overlap / 2;
        B.x += nx * overlap / 2; B.y += ny * overlap / 2;
        const vax = A.vx - A.w * ray, vay = A.vy + A.w * rax;
        const vbx = B.vx - B.w * rby, vby = B.vy + B.w * rbx;
        const vn = (vbx - vax) * nx + (vby - vay) * ny;
        if (vn >= 0) continue;
        const raxn = rax * ny - ray * nx, rbxn = rbx * ny - rby * nx;
        const jimp = -(1 + E) * vn / (1 / A.m + 1 / B.m + raxn * raxn / inertia(A) + rbxn * rbxn / inertia(B));
        A.vx -= jimp * nx / A.m; A.vy -= jimp * ny / A.m; A.w -= raxn * jimp / inertia(A);
        B.vx += jimp * nx / B.m; B.vy += jimp * ny / B.m; B.w += rbxn * jimp / inertia(B);
        if (events.length < 60) events.push({ f: Math.floor(step / FRAME_EVERY), type: 'hit', v: r1(-vn) });
      }
    }
    for (const p of pens) {
      if (!p.gone && (p.x < 0 || p.y < 0 || p.x > desk.w || p.y > desk.h)) {
        p.gone = 'off';
        events.push({ f: Math.floor(step / FRAME_EVERY), type: 'off', a: p.id });
      }
    }
    if (step % FRAME_EVERY === 0) record();
  }
  record();
  return { frames, events };
}

/** Flick a pen: impulse (jx, jy) applied at `grab` (-1..1 along the pen from tail to tip). */
export function flickPen(p, grab, jx, jy) {
  const I = p.m * p.len * p.len / 12;
  const ox = Math.cos(p.a) * grab * p.len / 2, oy = Math.sin(p.a) * grab * p.len / 2;
  p.vx += jx / p.m; p.vy += jy / p.m;
  p.w += (ox * jy - oy * jx) / I;
}
