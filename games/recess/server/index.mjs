// Authoritative RECESS Online Game Server
import { WebSocketServer } from 'ws';
import { randomInt, randomBytes } from 'node:crypto';
import { TttEngine } from './engines/ttt.mjs';
import { SpsEngine } from './engines/sps.mjs';
import { DotsEngine } from './engines/dots.mjs';
import { RmcsEngine } from './engines/rmcs.mjs';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const MAX_ROOMS = 200;
const ROOM_IDLE_TIMEOUT_MS = 20 * 60_000;

const BOT_NAMES = ['Bunty', 'Chintu', 'Pappu', 'Munna', 'Guddu', 'Pinky', 'Bablu'];
const BOT_AVATARS = ['👓', '🚀', '✏️', '🍎', '🐱', '⚽', '🎒'];

export default function attach({ httpServer, basePath, log = console.log }) {
  const path = `${basePath}ws`;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  /** code -> room */
  const rooms = new Map();

  httpServer.on('upgrade', (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return; }
    if (url.pathname !== path) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  function generateCode() {
    for (let i = 0; i < 50; i++) {
      let code = '';
      for (let k = 0; k < 4; k++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!rooms.has(code)) return code;
    }
    return null;
  }

  function send(ws, msg) {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }

  function broadcastRoom(room) {
    for (const [playerId, ws] of room.sockets) {
      const view = getLobbyView(room, playerId);
      send(ws, { t: 'lobby-state', view });
    }
  }

  function getLobbyView(room, forPlayerId) {
    return {
      code: room.code,
      hostId: room.hostId,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        status: p.currentMatchId ? 'in-game' : (isPlayerQueued(room, p.id) ? 'queued' : 'idle'),
        currentGame: p.currentGame || null
      })),
      queues: {
        ttt: room.queues.ttt.size,
        sps: room.queues.sps.size,
        dots: room.queues.dots.size,
        rmcs: room.queues.rmcs.size
      },
      myQueue: getPlayerQueuedGame(room, forPlayerId),
      chat: room.chat.slice(-20)
    };
  }

  function isPlayerQueued(room, playerId) {
    for (const q of Object.values(room.queues)) {
      if (q.has(playerId)) return true;
    }
    return false;
  }

  function getPlayerQueuedGame(room, playerId) {
    for (const [gameType, q] of Object.entries(room.queues)) {
      if (q.has(playerId)) return gameType;
    }
    return null;
  }

  function removePlayerFromAllQueues(room, playerId) {
    for (const q of Object.values(room.queues)) {
      q.delete(playerId);
    }
  }

  function createRoom(hostName, hostAvatar) {
    const code = generateCode();
    if (!code || rooms.size >= MAX_ROOMS) return null;

    const hostId = 'p_' + randomBytes(4).toString('hex');
    const token = randomBytes(8).toString('hex');

    const room = {
      code,
      hostId,
      players: new Map([[hostId, { id: hostId, name: hostName || 'School Kid', avatar: hostAvatar || '✏️', currentMatchId: null, currentGame: null }]]),
      tokens: new Map([[hostId, token]]),
      sockets: new Map(),
      queues: {
        ttt: new Set(),
        sps: new Set(),
        dots: new Set(),
        rmcs: new Set()
      },
      matches: new Map(), // matchId -> engine
      chat: [{ sender: 'System', text: `🔔 Welcome to RECESS Room ${code}! Choose a game to play.`, time: Date.now() }],
      idleTimer: null
    };

    rooms.set(code, room);
    return { room, hostId, token };
  }

  function syncMatch(room, matchId) {
    const engine = room.matches.get(matchId);
    if (!engine) return;

    for (const p of engine.players) {
      if (p.isBot) continue;
      const ws = room.sockets.get(p.id);
      if (ws) {
        const view = engine.getView(p.id);
        send(ws, { t: 'game-state', matchId, view });
      }
    }
  }

  function startMatch(room, gameType, players) {
    const matchId = 'm_' + randomBytes(4).toString('hex');
    let engine;

    const onUpdate = () => syncMatch(room, matchId);

    if (gameType === 'ttt') {
      engine = new TttEngine(matchId, players, onUpdate);
    } else if (gameType === 'sps') {
      engine = new SpsEngine(matchId, players, onUpdate);
    } else if (gameType === 'dots') {
      engine = new DotsEngine(matchId, players, onUpdate);
    } else if (gameType === 'rmcs') {
      engine = new RmcsEngine(matchId, players, onUpdate);
    }

    if (!engine) return null;

    room.matches.set(matchId, engine);

    // Update player status
    for (const p of players) {
      if (!p.isBot) {
        removePlayerFromAllQueues(room, p.id);
        const playerObj = room.players.get(p.id);
        if (playerObj) {
          playerObj.currentMatchId = matchId;
          playerObj.currentGame = gameType;
        }
      }
    }

    // Broadcast update
    broadcastRoom(room);
    syncMatch(room, matchId);
    return matchId;
  }

  function checkQueue(room, gameType) {
    const q = room.queues[gameType];
    const needed = (gameType === 'rmcs') ? 4 : 2;

    if (q.size >= needed) {
      const matchPlayerIds = Array.from(q).slice(0, needed);
      const matchPlayers = matchPlayerIds.map(id => {
        const p = room.players.get(id);
        return { id: p.id, name: p.name, avatar: p.avatar, isBot: false };
      });

      startMatch(room, gameType, matchPlayers);
    }
  }

  wss.on('connection', (ws) => {
    let currentRoomCode = null;
    let currentPlayerId = null;

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg !== 'object') return;

      const { t, rid } = msg;
      const reply = (res) => send(ws, { t: 'reply', rid, res });

      // CREATE ROOM
      if (t === 'create') {
        const created = createRoom(msg.name, msg.avatar);
        if (!created) return reply({ ok: false, error: 'Could not create room' });

        currentRoomCode = created.room.code;
        currentPlayerId = created.hostId;
        created.room.sockets.set(currentPlayerId, ws);

        reply({ ok: true, code: currentRoomCode, playerId: currentPlayerId, token: created.token });
        broadcastRoom(created.room);
        return;
      }

      // JOIN ROOM
      if (t === 'join') {
        const code = (msg.code || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) return reply({ ok: false, error: 'Room not found' });
        if (room.players.size >= 16) return reply({ ok: false, error: 'Room is full (max 16)' });

        const playerId = 'p_' + randomBytes(4).toString('hex');
        const token = randomBytes(8).toString('hex');

        room.players.set(playerId, {
          id: playerId,
          name: msg.name || 'Desk Buddy',
          avatar: msg.avatar || '🎒',
          currentMatchId: null,
          currentGame: null
        });
        room.tokens.set(playerId, token);
        room.sockets.set(playerId, ws);

        currentRoomCode = code;
        currentPlayerId = playerId;

        room.chat.push({
          sender: 'System',
          text: `👋 ${msg.name || 'Desk Buddy'} joined the desk!`,
          time: Date.now()
        });

        reply({ ok: true, code, playerId, token });
        broadcastRoom(room);
        return;
      }

      // RESUME SESSION
      if (t === 'resume') {
        const code = (msg.code || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) return reply({ ok: false, error: 'Room expired or not found' });
        const expectedToken = room.tokens.get(msg.playerId);
        if (!expectedToken || expectedToken !== msg.token) {
          return reply({ ok: false, error: 'Invalid resume credentials' });
        }

        currentRoomCode = code;
        currentPlayerId = msg.playerId;
        room.sockets.set(currentPlayerId, ws);

        const playerObj = room.players.get(currentPlayerId);
        reply({ ok: true, code, playerId: currentPlayerId, currentMatchId: playerObj?.currentMatchId || null });
        broadcastRoom(room);

        if (playerObj?.currentMatchId) {
          syncMatch(room, playerObj.currentMatchId);
        }
        return;
      }

      // Verify room & player for room-bound commands
      const room = rooms.get(currentRoomCode);
      if (!room || !currentPlayerId) {
        return reply({ ok: false, error: 'Not in a room' });
      }

      // QUEUE FOR GAME (with optional bot fill)
      if (t === 'queue') {
        const { gameType, withBots } = msg;
        if (!['ttt', 'sps', 'dots', 'rmcs'].includes(gameType)) {
          return reply({ ok: false, error: 'Invalid game type' });
        }

        removePlayerFromAllQueues(room, currentPlayerId);

        if (withBots) {
          // Instantly start with smart schoolyard bots!
          const human = room.players.get(currentPlayerId);
          const needed = (gameType === 'rmcs') ? 4 : 2;
          const matchPlayers = [{ id: human.id, name: human.name, avatar: human.avatar, isBot: false }];

          for (let i = 1; i < needed; i++) {
            const bName = BOT_NAMES[(i - 1) % BOT_NAMES.length];
            const bAvatar = BOT_AVATARS[(i - 1) % BOT_AVATARS.length];
            matchPlayers.push({
              id: `bot_${i}_` + randomBytes(2).toString('hex'),
              name: bName,
              avatar: bAvatar,
              isBot: true
            });
          }

          const matchId = startMatch(room, gameType, matchPlayers);
          return reply({ ok: true, matchId });
        }

        // Add to multiplayer waiting queue
        room.queues[gameType].add(currentPlayerId);
        reply({ ok: true, queued: true });
        broadcastRoom(room);
        checkQueue(room, gameType);
        return;
      }

      // LEAVE QUEUE
      if (t === 'leave-queue') {
        removePlayerFromAllQueues(room, currentPlayerId);
        reply({ ok: true });
        broadcastRoom(room);
        return;
      }

      // GAME ACTION
      if (t === 'game-action') {
        const { matchId, action } = msg;
        const engine = room.matches.get(matchId);
        if (!engine) return reply({ ok: false, error: 'Match not found' });

        const res = engine.handleAction(currentPlayerId, action);
        reply(res);
        syncMatch(room, matchId);
        return;
      }

      // LEAVE MATCH (RETURN TO LOBBY)
      if (t === 'leave-match') {
        const { matchId } = msg;
        const playerObj = room.players.get(currentPlayerId);
        if (playerObj) {
          playerObj.currentMatchId = null;
          playerObj.currentGame = null;
        }

        // If all human players have left match, clean it up
        const engine = room.matches.get(matchId);
        if (engine) {
          const anyHumanStillPlaying = engine.players.some(p => {
            if (p.isBot) return false;
            const po = room.players.get(p.id);
            return po && po.currentMatchId === matchId;
          });
          if (!anyHumanStillPlaying) {
            room.matches.delete(matchId);
          }
        }

        reply({ ok: true });
        broadcastRoom(room);
        return;
      }

      // CHAT / TAUNT
      if (t === 'chat') {
        const playerObj = room.players.get(currentPlayerId);
        const text = (msg.text || '').slice(0, 120).trim();
        if (text) {
          room.chat.push({
            sender: playerObj ? playerObj.name : 'Unknown',
            avatar: playerObj ? playerObj.avatar : '💬',
            text,
            time: Date.now()
          });
          if (room.chat.length > 50) room.chat.shift();
          broadcastRoom(room);
        }
        return reply({ ok: true });
      }

      // LEAVE ROOM
      if (t === 'leave') {
        cleanPlayer(room, currentPlayerId);
        reply({ ok: true });
        return;
      }

      reply({ ok: false, error: 'Unknown command' });
    });

    function cleanPlayer(room, playerId) {
      if (!room || !playerId) return;
      removePlayerFromAllQueues(room, playerId);
      room.sockets.delete(playerId);
      const p = room.players.get(playerId);
      room.players.delete(playerId);
      room.tokens.delete(playerId);

      if (p) {
        room.chat.push({
          sender: 'System',
          text: `🚪 ${p.name} left the room.`,
          time: Date.now()
        });
      }

      // If room is empty, close after idle timeout
      if (room.players.size === 0) {
        rooms.delete(room.code);
      } else {
        // Reassign host if host left
        if (room.hostId === playerId) {
          const nextHost = room.players.keys().next().value;
          room.hostId = nextHost;
        }
        broadcastRoom(room);
      }
    }

    ws.on('close', () => {
      if (currentRoomCode && currentPlayerId) {
        const room = rooms.get(currentRoomCode);
        if (room) {
          room.sockets.delete(currentPlayerId);
          // Grace period for refresh or brief disconnect
          setTimeout(() => {
            if (!room.sockets.has(currentPlayerId)) {
              cleanPlayer(room, currentPlayerId);
            }
          }, 15000);
        }
      }
    });

    ws.on('error', () => ws.close());
  });

  return {
    paths: [path],
    close: () => {
      wss.close();
      rooms.clear();
    }
  };
}
