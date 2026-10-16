/* Drawing pad and compact drawing format, shared by The Terrible Artist and The Chaos Mashup.
   A drawing is { p: [colours], d: base64 } where d packs strokes on a 256×256 grid:
   [strokeCount u16] then per stroke [colour<<4 | width u8][pointCount u16][x u8, y u8]…
   A busy drawing is 3–6 KB, small enough for one relay message (16 KB cap). No eraser, no undo. */
(function () {
  'use strict';
  const PP = window.PP;
  const MAX_POINTS = 2600;
  const WIDTHS = [3, 6, 12];

  function encode(strokes) {
    let n = 2; strokes.forEach(s => { n += 3 + s.pts.length; });
    const b = new Uint8Array(n); let o = 0;
    b[o++] = strokes.length >> 8; b[o++] = strokes.length & 255;
    strokes.forEach(s => {
      const pts = s.pts.length / 2;
      b[o++] = (s.c << 4) | s.w; b[o++] = pts >> 8; b[o++] = pts & 255;
      for (let i = 0; i < s.pts.length; i++) b[o++] = s.pts[i];
    });
    let bin = ''; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    return btoa(bin);
  }
  function decode(d) {
    try {
      const bin = atob(d || ''); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
      let o = 0; const count = (b[o++] << 8) | b[o++]; const out = [];
      for (let k = 0; k < count && o < b.length; k++) {
        const cw = b[o++]; const pts = (b[o++] << 8) | b[o++];
        out.push({ c: cw >> 4, w: cw & 15, pts: Array.from(b.subarray(o, o + pts * 2)) }); o += pts * 2;
      }
      return out;
    } catch (e) { return []; }
  }
  /** Paint a drawing onto a 2D context of any size, with smoothed curves. */
  function render(ctx, drawing, size, opts) {
    opts = opts || {};
    const s = size / 256; const pal = (drawing && drawing.p) || ['#111'];
    if (!opts.transparent) { ctx.fillStyle = opts.bg || '#fbf8f1'; ctx.fillRect(0, 0, size, size); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    decode(drawing && drawing.d).forEach(st => {
      ctx.strokeStyle = pal[st.c] || pal[0]; ctx.lineWidth = (WIDTHS[st.w] || 6) * s * (opts.lineScale || 1);
      const p = st.pts; if (p.length < 2) return;
      ctx.beginPath(); ctx.moveTo(p[0] * s, p[1] * s);
      if (p.length === 2) { ctx.lineTo(p[0] * s + 0.1, p[1] * s); }
      for (let i = 2; i < p.length - 2; i += 2) { const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2; ctx.quadraticCurveTo(p[i] * s, p[i + 1] * s, mx * s, my * s); }
      if (p.length > 2) ctx.lineTo(p[p.length - 2] * s, p[p.length - 1] * s);
      ctx.stroke();
    });
  }
  /** A canvas element showing a drawing. */
  function canvasFor(drawing, px, opts) {
    const c = document.createElement('canvas'); const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(px * dpr); c.style.width = c.style.height = px + 'px'; c.className = 'drawing';
    render(c.getContext('2d'), drawing, c.width, opts); return c;
  }
  /** Random scribble so bots have something to submit. */
  function botDrawing(palette) {
    const strokes = []; const n = 3 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const pts = []; let x = 40 + Math.random() * 176, y = 40 + Math.random() * 176, a = Math.random() * 6.28;
      const len = 10 + Math.floor(Math.random() * 30);
      for (let i = 0; i < len; i++) { a += (Math.random() - 0.5) * 0.9; x = PP.clamp(x + Math.cos(a) * 7, 4, 251); y = PP.clamp(y + Math.sin(a) * 7, 4, 251); pts.push(Math.round(x), Math.round(y)); }
      strokes.push({ c: k % palette.length, w: 1, pts });
    }
    // a face, because bots have feelings
    const cx = 128, cy = 128, r = 50, circle = [];
    for (let i = 0; i <= 24; i++) circle.push(Math.round(cx + Math.cos(i / 24 * 6.283) * r), Math.round(cy + Math.sin(i / 24 * 6.283) * r));
    strokes.push({ c: 0, w: 1, pts: circle }, { c: 0, w: 2, pts: [110, 115] }, { c: 0, w: 2, pts: [146, 115] }, { c: 0, w: 1, pts: [105, 145, 128, 160, 151, 145] });
    return { p: palette, d: encode(strokes) };
  }

  /**
   * Interactive pad. opts: { palette, blind, onInk(count) }.
   * Blind contour: ink fades from the artist's own screen moments after it is drawn,
   * but every stroke is kept and sent; the Main Stage shows the full drawing.
   */
  function pad(canvas, opts) {
    const palette = opts.palette; let color = 0, width = 1, strokes = [], cur = null, total = 0;
    const ctx = canvas.getContext('2d'); const recent = []; let raf = 0;
    function size() { const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.width * dpr); redraw(); }
    function redraw() {
      if (opts.blind) { blindFrame(); return; }
      render(ctx, { p: palette, d: encode(strokes) }, canvas.width);
    }
    function blindFrame() {
      cancelAnimationFrame(raf);
      const now = performance.now(); const s = canvas.width / 256;
      ctx.fillStyle = '#fbf8f1'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      for (let i = recent.length - 1; i >= 0; i--) {
        const seg = recent[i]; const age = now - seg.t; if (age > 650) { recent.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - age / 650; ctx.strokeStyle = palette[seg.c]; ctx.lineWidth = WIDTHS[seg.w] * s;
        ctx.beginPath(); ctx.moveTo(seg.x0 * s, seg.y0 * s); ctx.lineTo(seg.x1 * s, seg.y1 * s); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (recent.length) raf = requestAnimationFrame(blindFrame);
    }
    function pos(e) { const r = canvas.getBoundingClientRect(); return [PP.clamp(Math.round((e.clientX - r.left) / r.width * 255), 0, 255), PP.clamp(Math.round((e.clientY - r.top) / r.height * 255), 0, 255)]; }
    function down(e) {
      if (total >= MAX_POINTS) { opts.onFull && opts.onFull(); return; }
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      const [x, y] = pos(e); cur = { c: color, w: width, pts: [x, y] }; strokes.push(cur); total++;
      segment(x, y, x, y);
    }
    function move(e) {
      if (!cur) return; e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs) {
        const [x, y] = pos(ev); const p = cur.pts; const lx = p[p.length - 2], ly = p[p.length - 1];
        if (Math.abs(x - lx) + Math.abs(y - ly) < 2) continue;
        if (total >= MAX_POINTS) { up(); opts.onFull && opts.onFull(); return; }
        p.push(x, y); total++; segment(lx, ly, x, y);
      }
    }
    function segment(x0, y0, x1, y1) {
      if (opts.blind) { recent.push({ x0, y0, x1, y1, c: color, w: width, t: performance.now() }); blindFrame(); }
      else {
        const s = canvas.width / 256; ctx.strokeStyle = palette[color]; ctx.lineWidth = WIDTHS[width] * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0 * s, y0 * s); ctx.lineTo(x1 * s + (x0 === x1 && y0 === y1 ? 0.1 : 0), y1 * s); ctx.stroke();
      }
      opts.onInk && opts.onInk(total / MAX_POINTS);
    }
    function up() { cur = null; }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.style.touchAction = 'none';
    requestAnimationFrame(size);
    return {
      setColor(i) { color = i; }, setWidth(i) { width = i; },
      isEmpty: () => !strokes.length,
      data: () => ({ p: palette, d: encode(strokes) }),
      resize: size
    };
  }

  PP.Draw = { encode, decode, render, canvasFor, pad, botDrawing, WIDTHS };
})();
