// RECESS sound: every effect is synthesised with Web Audio, so there are no copied or licensed assets.
// Nothing plays until the player interacts with the page (browser autoplay rules), and music is off by default.

const KEY = 'recess_audio';
const defaults = { on: true, master: 0.7, sfx: 0.8, music: 0.35, musicOn: false };

class Sound {
  constructor() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
    this.s = { ...defaults, ...saved };
    this.ctx = null;
    this.unlocked = false;
    this.last = {};
    const unlock = () => {
      this.unlocked = true;
      this.ensure();
      if (this.s.musicOn) this.startMusic();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch {} }

  set(key, value) {
    this.s[key] = value;
    this.save();
    if (this.master) this.master.gain.value = this.s.on ? this.s.master : 0;
    if (this.sfxBus) this.sfxBus.gain.value = this.s.sfx;
    if (this.musicBus) this.musicBus.gain.value = this.s.music * 0.25;
    if (key === 'musicOn') value ? this.startMusic() : this.stopMusic();
  }

  ensure() {
    if (!this.unlocked) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.s.on ? this.s.master : 0;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.s.sfx;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.s.music * 0.25;
      this.musicBus.connect(this.master);
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  // ─── building blocks ───
  tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = 0, attack = 0.005, bus } = {}) {
    const c = this.ensure();
    if (!c || !this.s.on) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { freq = 2000, q = 1, vol = 0.2, at = 0, type = 'bandpass', sweep = 0 } = {}) {
    const c = this.ensure();
    if (!c || !this.s.on) return;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  /** Avoid machine-gun repeats of the same sound. */
  gate(name, ms) {
    const now = performance.now();
    if (now - (this.last[name] || 0) < ms) return false;
    this.last[name] = now;
    return true;
  }

  // ─── the library ───
  play(name, opts = {}) {
    const fn = this[`_${name}`];
    if (!fn || !this.s.on) return;
    try { fn.call(this, opts); } catch {}
  }

  _click() { this.tone(1400, 0.04, { type: 'triangle', vol: 0.12 }); }
  _tap() { this.noise(0.04, { freq: 3200, q: 2, vol: 0.25 }); this.tone(700, 0.05, { type: 'triangle', vol: 0.1 }); }
  _pencil() { if (!this.gate('pencil', 60)) return; this.noise(0.16, { freq: 3800, q: 4, vol: 0.18, sweep: 0.7 }); }
  _scribble() { for (let i = 0; i < 3; i++) this.noise(0.07, { freq: 3000 + i * 500, q: 3, vol: 0.14, at: i * 0.06 }); }
  _paper() { this.noise(0.25, { freq: 1600, q: 0.6, vol: 0.16, sweep: 2.4 }); }
  _page() { this.noise(0.35, { freq: 900, q: 0.5, vol: 0.14, sweep: 4 }); this.noise(0.12, { freq: 4000, q: 1, vol: 0.06, at: 0.2 }); }
  _eraser() { for (let i = 0; i < 4; i++) this.noise(0.08, { freq: 500, q: 1.5, vol: 0.12, at: i * 0.07, type: 'lowpass' }); }
  _pen() { this.tone(2200, 0.03, { type: 'square', vol: 0.06 }); this.tone(1500, 0.03, { type: 'square', vol: 0.05, at: 0.05 }); }
  _pop() { this.tone(520, 0.12, { type: 'sine', vol: 0.25, slide: 2.2 }); }
  _fill() { this.tone(660, 0.18, { type: 'triangle', vol: 0.18 }); this.tone(990, 0.22, { type: 'sine', vol: 0.12, at: 0.06 }); }
  _good() { this.tone(784, 0.12, { type: 'triangle', vol: 0.2 }); this.tone(1175, 0.18, { type: 'triangle', vol: 0.18, at: 0.08 }); }
  _bad() { this.tone(240, 0.22, { type: 'sawtooth', vol: 0.08, slide: 0.7 }); }
  _tick() { this.tone(1800, 0.025, { type: 'square', vol: 0.05 }); }
  _whoosh() { this.noise(0.3, { freq: 400, q: 0.8, vol: 0.2, sweep: 6 }); }
  _slide() { this.tone(900, 0.5, { type: 'triangle', vol: 0.14, slide: 0.35 }); this.noise(0.45, { freq: 2000, q: 1, vol: 0.06, sweep: 0.3 }); }
  _climb() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.15, at: i * 0.08 })); }
  _dice() {
    for (let i = 0; i < 6; i++) this.noise(0.04, { freq: 1800 + Math.random() * 1500, q: 3, vol: 0.22 - i * 0.025, at: i * 0.06 + Math.random() * 0.02 });
    this.tone(320, 0.06, { type: 'triangle', vol: 0.12, at: 0.38 });
  }
  _wood() { this.tone(420, 0.08, { type: 'triangle', vol: 0.2, slide: 0.8 }); this.noise(0.05, { freq: 1200, q: 2, vol: 0.12 }); }
  _step() { if (!this.gate('step', 70)) return; this.tone(560 + Math.random() * 60, 0.06, { type: 'triangle', vol: 0.14 }); }
  _clack(o) { if (!this.gate('clack', 35)) return; const v = Math.min(1, (o.v || 40) / 60); this.tone(2600 + Math.random() * 600, 0.05, { type: 'sine', vol: 0.08 + 0.2 * v }); this.noise(0.03, { freq: 5000, q: 3, vol: 0.1 * v }); }
  _thud() { if (!this.gate('thud', 50)) return; this.tone(140, 0.12, { type: 'sine', vol: 0.25, slide: 0.6 }); this.noise(0.06, { freq: 500, q: 1, vol: 0.1, type: 'lowpass' }); }
  _pocket() { this.tone(180, 0.18, { type: 'sine', vol: 0.3, slide: 0.5 }); this.noise(0.1, { freq: 300, q: 1, vol: 0.15, type: 'lowpass', at: 0.05 }); }
  _flick() { this.noise(0.05, { freq: 2600, q: 1.5, vol: 0.25 }); this.tone(300, 0.08, { type: 'triangle', vol: 0.15, slide: 1.8 }); }
  _fall() { this.tone(600, 0.5, { type: 'sine', vol: 0.18, slide: 0.25 }); this.tone(90, 0.2, { type: 'sine', vol: 0.3, at: 0.45 }); }
  _card() { this.noise(0.07, { freq: 2600, q: 0.9, vol: 0.22, sweep: 0.6 }); }
  _shuffle() { for (let i = 0; i < 8; i++) this.noise(0.04, { freq: 2800, q: 1, vol: 0.14, at: i * 0.035 }); }
  _bluff() { this.tone(330, 0.1, { type: 'square', vol: 0.12 }); this.tone(247, 0.25, { type: 'square', vol: 0.12, at: 0.1 }); }
  _reveal() { this.tone(392, 0.1, { type: 'triangle', vol: 0.15 }); this.tone(523, 0.1, { type: 'triangle', vol: 0.15, at: 0.1 }); this.tone(659, 0.3, { type: 'triangle', vol: 0.15, at: 0.2 }); }
  _drum() { [0, 0.12, 0.24].forEach((at, i) => this.tone(110 + i * 20, 0.1, { type: 'sine', vol: 0.3, at })); }
  _bell() {
    [[880, 0.22], [1320, 0.1], [1760, 0.06]].forEach(([f, v]) => this.tone(f, 1.4, { type: 'sine', vol: v, attack: 0.002 }));
    this.tone(886, 1.2, { type: 'sine', vol: 0.08, at: 0.02 });
  }
  _start() { this._bell(); }
  _win() {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((f, i) => this.tone(f, i === notes.length - 1 ? 0.5 : 0.14, { type: 'triangle', vol: 0.2, at: i * 0.11 }));
    this.tone(262, 0.7, { type: 'sine', vol: 0.15, at: 0.33 });
  }
  _lose() { [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.14, at: i * 0.16 })); }
  _draw() { this.tone(440, 0.2, { type: 'triangle', vol: 0.14 }); this.tone(440, 0.3, { type: 'triangle', vol: 0.12, at: 0.22 }); }
  _join() { this.tone(660, 0.1, { type: 'sine', vol: 0.14 }); this.tone(880, 0.16, { type: 'sine', vol: 0.12, at: 0.08 }); }
  _react() { this.tone(980, 0.08, { type: 'sine', vol: 0.12, slide: 1.4 }); }
  _countdown() { this.tone(660, 0.12, { type: 'square', vol: 0.08 }); }
  _go() { this.tone(990, 0.3, { type: 'square', vol: 0.1 }); }

  // ─── gentle music: a soft pentatonic music-box loop, low and sparse ───
  startMusic() {
    if (!this.unlocked || this.musicTimer) return;
    const c = this.ensure();
    if (!c) return;
    const scale = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
    const chords = [[0, 2, 4], [1, 3, 5], [0, 3, 5], [2, 4, 6]];
    let bar = 0;
    const playBar = () => {
      if (!this.s.on || !this.s.musicOn) return;
      const chord = chords[bar % chords.length];
      chord.forEach((n, i) => this.tone(scale[n] / 2, 2.4, { type: 'sine', vol: 0.18, at: i * 0.02, attack: 0.3, bus: this.musicBus }));
      for (let b = 0; b < 4; b++) {
        if (Math.random() < 0.65) {
          const n = chord[Math.floor(Math.random() * 3)] + (Math.random() < 0.5 ? 2 : 0);
          this.tone(scale[Math.min(n, scale.length - 1)], 0.6, { type: 'triangle', vol: 0.12, at: b * 0.6, bus: this.musicBus });
        }
      }
      bar++;
    };
    playBar();
    this.musicTimer = setInterval(playBar, 2400);
  }

  stopMusic() { clearInterval(this.musicTimer); this.musicTimer = null; }
}

export const sound = new Sound();
export const sfx = (name, opts) => sound.play(name, opts);
