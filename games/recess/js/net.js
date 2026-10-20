// WebSocket client for the RECESS server. Reconnects on its own and resumes the room session.

const SESSION = 'recess_session';

export class Net extends EventTarget {
  constructor() {
    super();
    this.ws = null;
    this.rid = 0;
    this.pending = new Map();
    this.session = null;
    try { this.session = JSON.parse(sessionStorage.getItem(SESSION) || 'null'); } catch {}
    this.connected = false;
    this.attempts = 0;
    this.offset = 0; // serverTime - local time
  }

  url() {
    const base = location.pathname.replace(/[^/]*$/, ''); // folder of index.html
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${base}ws`;
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  connect() {
    if (location.protocol === 'file:') {
      this.emit('status', { state: 'offline', reason: 'file' });
      return;
    }
    let ws;
    try { ws = new WebSocket(this.url()); } catch { this.retry(); return; }
    this.ws = ws;
    this.emit('status', { state: 'connecting' });
    ws.onopen = async () => {
      this.connected = true;
      this.attempts = 0;
      this.emit('status', { state: 'online' });
      if (this.session) {
        const res = await this.req('resume', this.session);
        if (!res.ok) {
          this.clearSession();
          this.emit('session-lost', res);
        } else {
          this.emit('resumed', res);
        }
      } else {
        this.emit('ready');
      }
    };
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'reply') {
        const fn = this.pending.get(m.rid);
        if (fn) { this.pending.delete(m.rid); fn(m.res); }
        return;
      }
      if (m.view?.serverTime) this.offset = m.view.serverTime - Date.now();
      this.emit(m.t, m);
    };
    ws.onclose = () => {
      const was = this.connected;
      this.connected = false;
      for (const fn of this.pending.values()) fn({ ok: false, error: 'Connection lost' });
      this.pending.clear();
      this.emit('status', { state: 'offline', was });
      this.retry();
    };
    ws.onerror = () => {};
  }

  retry() {
    if (this.stopped) return;
    const delay = Math.min(8000, 600 * Math.pow(1.6, this.attempts++));
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  now() { return Date.now() + this.offset; }

  req(t, data = {}) {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== 1) return resolve({ ok: false, error: 'Not connected — reconnecting…' });
      const id = ++this.rid;
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ ...data, t, rid: id }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); resolve({ ok: false, error: 'The server took too long to answer' }); }
      }, 8000);
    });
  }

  saveSession(code, playerId, token) {
    this.session = { code, playerId, token };
    try { sessionStorage.setItem(SESSION, JSON.stringify(this.session)); } catch {}
  }

  clearSession() {
    this.session = null;
    try { sessionStorage.removeItem(SESSION); } catch {}
  }

  async create(name, avatar) {
    const res = await this.req('create', { name, avatar });
    if (res.ok) this.saveSession(res.code, res.playerId, res.token);
    return res;
  }

  async join(code, name, avatar) {
    const res = await this.req('join', { code, name, avatar });
    if (res.ok) this.saveSession(res.code, res.playerId, res.token);
    return res;
  }

  async leave() {
    const res = await this.req('leave');
    this.clearSession();
    return res;
  }
}

export const net = new Net();
