// WebSocket Networking Client for RECESS

export class RecessNetwork {
  constructor() {
    this.ws = null;
    this.rid = 0;
    this.pending = new Map();
    this.listeners = {
      'lobby-state': [],
      'game-state': [],
      'status': []
    };
    this.code = sessionStorage.getItem('recess_code') || null;
    this.playerId = sessionStorage.getItem('recess_player_id') || null;
    this.token = sessionStorage.getItem('recess_token') || null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  connect() {
    return new Promise((resolve) => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${location.host}/games/recess/ws`;

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (e) {
        console.error('Failed to create WebSocket:', e);
        this.notifyStatus('error');
        return resolve(false);
      }

      this.ws.onopen = async () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyStatus('connected');

        // Check if we can resume an existing room session
        if (this.code && this.playerId && this.token) {
          const res = await this.req('resume', {
            code: this.code,
            playerId: this.playerId,
            token: this.token
          });
          if (!res.ok) {
            this.clearSession();
          }
        }

        resolve(true);
      };

      this.ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        if (!msg) return;

        if (msg.t === 'reply') {
          const handler = this.pending.get(msg.rid);
          if (handler) {
            handler(msg.res);
            this.pending.delete(msg.rid);
          }
        } else if (msg.t === 'lobby-state') {
          this.emit('lobby-state', msg.view);
        } else if (msg.t === 'game-state') {
          this.emit('game-state', { matchId: msg.matchId, view: msg.view });
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (e) => {
        this.notifyStatus('error');
      };
    });
  }

  scheduleReconnect() {
    if (this.reconnectAttempts > 8) return;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
    this.reconnectAttempts++;
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, delay);
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  notifyStatus(status) {
    this.emit('status', status);
  }

  req(t, data = {}) {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return resolve({ ok: false, error: 'Connection unavailable' });
      }

      const id = ++this.rid;
      this.pending.set(id, resolve);

      const payload = JSON.stringify({ t, rid: id, ...data });
      this.ws.send(payload);

      // Timeout after 8 seconds
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve({ ok: false, error: 'Request timed out' });
        }
      }, 8000);
    });
  }

  saveSession(code, playerId, token) {
    this.code = code;
    this.playerId = playerId;
    this.token = token;
    sessionStorage.setItem('recess_code', code);
    sessionStorage.setItem('recess_player_id', playerId);
    sessionStorage.setItem('recess_token', token);
  }

  clearSession() {
    this.code = null;
    this.playerId = null;
    this.token = null;
    sessionStorage.removeItem('recess_code');
    sessionStorage.removeItem('recess_player_id');
    sessionStorage.removeItem('recess_token');
  }

  // Room Commands
  async createRoom(name, avatar) {
    const res = await this.req('create', { name, avatar });
    if (res.ok) {
      this.saveSession(res.code, res.playerId, res.token);
    }
    return res;
  }

  async joinRoom(code, name, avatar) {
    const res = await this.req('join', { code, name, avatar });
    if (res.ok) {
      this.saveSession(res.code, res.playerId, res.token);
    }
    return res;
  }

  async leaveRoom() {
    const res = await this.req('leave');
    this.clearSession();
    return res;
  }

  queue(gameType, withBots = false) {
    return this.req('queue', { gameType, withBots });
  }

  leaveQueue(gameType) {
    return this.req('leave-queue', { gameType });
  }

  gameAction(matchId, action) {
    return this.req('game-action', { matchId, action });
  }

  leaveMatch(matchId) {
    return this.req('leave-match', { matchId });
  }

  chat(text) {
    return this.req('chat', { text });
  }
}

export const net = new RecessNetwork();
