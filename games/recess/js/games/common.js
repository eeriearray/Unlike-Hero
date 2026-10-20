// Helpers shared by the RECESS game modules.

/** Player strip entries from a view. fn(p) may return { score, sub, active, color }. */
export function strip(view, fn = () => ({})) {
  return view.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, left: p.left, ...fn(p) }));
}

export function nameOf(view, id) { return view.players.find(p => p.id === id)?.name || 'Someone'; }

/** Sorted scoreboard for the results card. */
export function board(view, scores, fmt = (v) => v) {
  const best = Math.max(...view.players.map(p => scores[p.id] ?? 0));
  return view.players
    .map(p => ({ id: p.id, name: p.name, avatar: p.avatar, pts: fmt(scores[p.id] ?? 0), raw: scores[p.id] ?? 0, win: (scores[p.id] ?? 0) === best }))
    .sort((a, b) => b.raw - a.raw);
}

/**
 * Replay recorded physics frames at 30 fps.
 * onFrame(frameA, frameB, t, index) is called on every animation frame; returns a cancel function.
 */
export function replay(frames, onFrame, onDone, fps = 30) {
  let raf;
  const start = performance.now();
  const calm = document.body.classList.contains('calm');
  const total = frames.length - 1;
  const tick = (now) => {
    const f = calm ? total : Math.min(total, ((now - start) / 1000) * fps);
    const i = Math.floor(f);
    onFrame(frames[i], frames[Math.min(total, i + 1)], f - i, i);
    if (f >= total) { onDone?.(); return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/** Convert a pointer event to coordinates in an SVG's viewBox. */
export function svgPoint(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

/**
 * Pull-back aiming on an SVG: press near `origin()`, drag away, release to shoot in the opposite direction.
 * opts: { origin(): {x,y} | null (null = not allowed), grabRadius, maxPull, onAim({dx,dy,power,from}), onShoot({vx,vy,power,from}), onCancel() }
 */
export function pullAim(svg, opts) {
  let drag = null;
  const down = (e) => {
    const o = opts.origin(e);
    if (!o) return;
    const p = svgPoint(svg, e);
    if (Math.hypot(p.x - o.x, p.y - o.y) > (opts.grabRadius ?? 12)) return;
    drag = { o, from: p, id: e.pointerId };
    svg.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    move(e);
  };
  const vec = (e) => {
    const p = svgPoint(svg, e);
    let dx = drag.o.x - p.x, dy = drag.o.y - p.y; // opposite of the pull
    const len = Math.hypot(dx, dy);
    const max = opts.maxPull ?? 30;
    if (len > max) { dx *= max / len; dy *= max / len; }
    return { dx, dy, power: Math.min(1, len / max), from: drag.from, at: p };
  };
  const move = (e) => { if (drag && e.pointerId === drag.id) opts.onAim?.(vec(e)); };
  const up = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const v = vec(e);
    drag = null;
    if (v.power < 0.06) opts.onCancel?.(); else opts.onShoot(v);
  };
  const cancel = () => { if (drag) { drag = null; opts.onCancel?.(); } };
  svg.addEventListener('pointerdown', down);
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', cancel);
  svg.style.touchAction = 'none';
  return () => {
    svg.removeEventListener('pointerdown', down);
    svg.removeEventListener('pointermove', move);
    svg.removeEventListener('pointerup', up);
    svg.removeEventListener('pointercancel', cancel);
  };
}

export const NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  parent?.append(el);
  return el;
}

/** Wobbly hand-drawn line path between two points. */
export function wobble(x1, y1, x2, y2, amt = 1.2, seed = 1) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const nx = -(y2 - y1), ny = x2 - x1;
  const l = Math.hypot(nx, ny) || 1;
  const k = Math.sin(seed * 12.9898) * amt;
  return `M${x1} ${y1}Q${mx + nx / l * k} ${my + ny / l * k} ${x2} ${y2}`;
}

/** Die face SVG markup (value 1..6). */
export function dieFace(v, size = 56, color = '#fff') {
  const pips = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]], 5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] }[v] || [];
  return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-label="Die showing ${v}"><rect x="2" y="2" width="36" height="36" rx="8" fill="${color}" stroke="#1d2b4f" stroke-width="3"/>${pips.map(([x, y]) => `<circle cx="${x * 9 + 2}" cy="${y * 9 + 2}" r="3.6" fill="#1d2b4f"/>`).join('')}</svg>`;
}
