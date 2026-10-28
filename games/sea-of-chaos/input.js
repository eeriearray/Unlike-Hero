// Keyboard, mouse and touch controls. Fire is "hold to keep firing"; a quick tap
// is latched until the next read so it is never lost between network sends.
export function createInput(canvas, unlock) {
 const keys = new Set(), touch = new Set();
 let mode = 'menu', touchMode = false, tapped = false, mouse = false, stickId = null, sx = 0, sy = 0, escape = () => {};
 const GAME = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyF']);
 addEventListener('keydown', e => {
  if (e.code === 'Escape') { escape(); return; }
  if (mode !== 'game' || e.target.matches?.('input,textarea,select')) return;
  if (GAME.has(e.code)) { e.preventDefault(); keys.add(e.code); if (!e.repeat && (e.code === 'Space' || e.code === 'KeyF')) tapped = true; }
 });
 addEventListener('keyup', e => keys.delete(e.code));
 canvas.addEventListener('pointerdown', e => { if (mode !== 'game' || e.pointerType === 'touch') return; unlock(); mouse = true; tapped = true; });
 addEventListener('pointerup', e => { if (e.pointerType !== 'touch') mouse = false; });
 for (const b of document.querySelectorAll('[data-act]')) {
  const act = b.dataset.act;
  b.addEventListener('pointerdown', e => { if (mode !== 'game') return; e.preventDefault(); unlock(); b.setPointerCapture?.(e.pointerId); touch.add(act); if (act === 'fire') tapped = true; b.classList.add('on'); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { touch.delete(act); b.classList.remove('on'); });
 }
 const stick = document.getElementById('stick'), knob = document.getElementById('knob');
 function move(e) { const r = stick.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2, l = Math.hypot(x, y), k = Math.min(44, l); sx = l ? x / l * k / 44 : 0; sy = l ? y / l * k / 44 : 0; knob.style.transform = `translate(${sx * 44}px,${sy * 44}px)`; }
 stick?.addEventListener('pointerdown', e => { if (mode !== 'game' || stickId !== null) return; e.preventDefault(); unlock(); touchMode = true; stickId = e.pointerId; stick.setPointerCapture(e.pointerId); move(e); });
 stick?.addEventListener('pointermove', e => { if (e.pointerId === stickId) move(e); });
 function resetStick() { stickId = null; sx = sy = 0; if (knob) knob.style.transform = ''; }
 for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) stick?.addEventListener(ev, resetStick);
 function reset() { keys.clear(); touch.clear(); tapped = mouse = false; resetStick(); document.querySelectorAll('[data-act]').forEach(b => b.classList.remove('on')); }
 addEventListener('blur', reset);
 const axis = v => Math.abs(v) < 0.12 ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - 0.12) / 0.75);
 const has = (...codes) => codes.some(c => keys.has(c));
 return {
  read() {
   if (mode !== 'game') return {};
   const fire = tapped || mouse || touch.has('fire') || has('Space', 'KeyF'); tapped = false;
   // Screen-right is starboard, which turns the heading negative.
   const turn = stickId !== null ? -axis(sx) : Number(has('KeyA', 'ArrowLeft')) - Number(has('KeyD', 'ArrowRight'));
   // Ships cruise on their own; W is full sail, S brakes. Touch captains make
   // full way unless they pull the stick right back.
   const throttle = stickId !== null ? (sy > 0.55 ? -1 : 1) : touchMode ? 1 : has('KeyW', 'ArrowUp') ? 1 : has('KeyS', 'ArrowDown') ? -1 : 0.6;
   return { throttle, turn, fire, boost: touch.has('boost') || has('ShiftLeft', 'ShiftRight') };
  },
  setMode(m) { mode = m; reset(); },
  onEscape(fn) { escape = fn; },
 };
}
