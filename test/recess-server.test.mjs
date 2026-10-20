// Automated tests for RECESS game server and engines
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import attach from '../games/recess/server/index.mjs';

async function startServer() {
  const http = createServer((req, res) => res.writeHead(404).end());
  const srv = attach({ httpServer: http, basePath: '/games/recess/', log: () => {} });
  await new Promise((r) => http.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${http.address().port}/games/recess/ws`;
  return {
    url,
    srv,
    close: () => new Promise((r) => {
      srv.close();
      http.closeAllConnections?.();
      http.close(r);
    })
  };
}

function client(url) {
  const ws = new WebSocket(url);
  let rid = 0;
  const pending = new Map();
  const c = {
    ws,
    lobby: null,
    game: null,
    gameStates: [],
    waiters: []
  };

  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.t === 'reply') {
      pending.get(m.rid)?.(m.res);
      pending.delete(m.rid);
    }
    if (m.t === 'lobby-state') {
      c.lobby = m.view;
    }
    if (m.t === 'game-state') {
      c.game = m.view;
      c.gameStates.push(m.view);
      c.waiters = c.waiters.filter(w => !w(m.view));
    }
  });

  c.open = new Promise((r) => ws.on('open', r));
  c.req = async (t, data = {}) => {
    await c.open;
    const id = ++rid;
    ws.send(JSON.stringify({ t, rid: id, ...data }));
    return new Promise((r) => pending.set(id, r));
  };
  c.untilGame = (pred, ms = 3000) => new Promise((resolve, reject) => {
    if (c.game && pred(c.game)) return resolve(c.game);
    const timer = setTimeout(() => reject(new Error('timed out waiting for game state')), ms);
    c.waiters.push((v) => {
      if (pred(v)) {
        clearTimeout(timer);
        resolve(v);
        return true;
      }
      return false;
    });
  });
  c.close = () => ws.close();
  return c;
}

test('RECESS: Room creation, joining with 4-letter code, and roster listing', async () => {
  const s = await startServer();
  const a = client(s.url);
  const b = client(s.url);

  const resA = await a.req('create', { name: 'Aarav', avatar: '✏️' });
  assert.ok(resA.ok, 'Host created room');
  assert.match(resA.code, /^[A-Z]{4}$/, 'Room code is 4 uppercase letters');

  const resB = await b.req('join', { code: resA.code, name: 'Bhavna', avatar: '🎒' });
  assert.ok(resB.ok, 'Second player joined room');

  // Verify lobby has both players
  await new Promise(r => setTimeout(r, 100));
  assert.equal(a.lobby.players.length, 2);
  assert.equal(a.lobby.players[0].name, 'Aarav');
  assert.equal(a.lobby.players[1].name, 'Bhavna');

  a.close();
  b.close();
  await s.close();
});

test('RECESS: Queueing, leaving queue, and starting match when 2 players queue', async () => {
  const s = await startServer();
  const a = client(s.url);
  const b = client(s.url);

  const ra = await a.req('create', { name: 'Dev', avatar: '👓' });
  const rb = await b.req('join', { code: ra.code, name: 'Diya', avatar: '🚀' });

  // Dev queues for Tic-Tac-Toe
  const qa = await a.req('queue', { gameType: 'ttt' });
  assert.ok(qa.ok);
  await new Promise(r => setTimeout(r, 50));
  assert.equal(a.lobby.queues.ttt, 1);

  // Dev leaves queue
  const lq = await a.req('leave-queue', { gameType: 'ttt' });
  assert.ok(lq.ok);
  await new Promise(r => setTimeout(r, 50));
  assert.equal(a.lobby.queues.ttt, 0);

  // Both queue for Tic-Tac-Toe -> Match starts automatically!
  await a.req('queue', { gameType: 'ttt' });
  await b.req('queue', { gameType: 'ttt' });

  const ga = await a.untilGame(g => g.gameType === 'ttt');
  const gb = await b.untilGame(g => g.gameType === 'ttt');

  assert.equal(ga.gameType, 'ttt');
  assert.equal(gb.gameType, 'ttt');
  assert.equal(ga.matchId, gb.matchId);
  assert.equal(ga.players.length, 2);

  a.close();
  b.close();
  await s.close();
});

test('RECESS: Tic-Tac-Toe turn validation, illegal move rejection, and win detection', async () => {
  const s = await startServer();
  const a = client(s.url);
  const b = client(s.url);

  const ra = await a.req('create', { name: 'PlayerX' });
  await b.req('join', { code: ra.code, name: 'PlayerO' });

  await a.req('queue', { gameType: 'ttt' });
  await b.req('queue', { gameType: 'ttt' });

  const g0 = await a.untilGame(g => g.gameType === 'ttt');
  const matchId = g0.matchId;

  // Player X moves cell 0
  const m1 = await a.req('game-action', { matchId, action: { type: 'move', cell: 0 } });
  assert.ok(m1.ok);

  // Player X attempts to move again (not their turn) -> rejected!
  const mIllegalTurn = await a.req('game-action', { matchId, action: { type: 'move', cell: 1 } });
  assert.equal(mIllegalTurn.ok, false);
  assert.match(mIllegalTurn.error, /turn/i);

  // Player O attempts to move to cell 0 (occupied) -> rejected!
  const mOccupied = await b.req('game-action', { matchId, action: { type: 'move', cell: 0 } });
  assert.equal(mOccupied.ok, false);
  assert.match(mOccupied.error, /occupied/i);

  // Player O moves cell 3
  await b.req('game-action', { matchId, action: { type: 'move', cell: 3 } });

  // Player X moves cell 1
  await a.req('game-action', { matchId, action: { type: 'move', cell: 1 } });

  // Player O moves cell 4
  await b.req('game-action', { matchId, action: { type: 'move', cell: 4 } });

  // Player X moves cell 2 -> ROW 0, 1, 2 WIN!
  await a.req('game-action', { matchId, action: { type: 'move', cell: 2 } });

  const gWin = await a.untilGame(g => g.status === 'won');
  assert.equal(gWin.winner, ra.playerId);
  assert.deepEqual(gWin.winningLine, [0, 1, 2]);
  assert.equal(gWin.scores[ra.playerId], 1);

  // Return to lobby
  const leave = await a.req('leave-match', { matchId });
  assert.ok(leave.ok);

  a.close();
  b.close();
  await s.close();
});

test('RECESS: Stone Paper Scissors secret choices remain hidden until both commit', async () => {
  const s = await startServer();
  const a = client(s.url);
  const b = client(s.url);

  const ra = await a.req('create', { name: 'Karan' });
  const rb = await b.req('join', { code: ra.code, name: 'Arjun' });

  await a.req('queue', { gameType: 'sps' });
  await b.req('queue', { gameType: 'sps' });

  const g0 = await a.untilGame(g => g.gameType === 'sps');
  const matchId = g0.matchId;

  // Karan chooses 'stone'
  const ca = await a.req('game-action', { matchId, action: { type: 'choose', choice: 'stone' } });
  assert.ok(ca.ok);

  // Crucial check: Arjun's view MUST NOT see Karan's choice yet!
  await new Promise(r => setTimeout(r, 50));
  assert.equal(b.game.choices[ra.playerId], null, 'Opponent choice must remain SECRET until reveal!');
  assert.equal(b.game.status, 'choosing');

  // Arjun chooses 'scissors'
  const cb = await b.req('game-action', { matchId, action: { type: 'choose', choice: 'scissors' } });
  assert.ok(cb.ok);

  // Now both have chosen -> Server resolves!
  const gRev = await a.untilGame(g => g.status === 'revealed');
  assert.equal(gRev.status, 'revealed');
  assert.equal(gRev.choices[ra.playerId], 'stone');
  assert.equal(gRev.choices[rb.playerId], 'scissors');
  assert.equal(gRev.lastResult.winnerId, ra.playerId);
  assert.equal(gRev.scores[ra.playerId], 1);

  a.close();
  b.close();
  await s.close();
});

test('RECESS: Dots and Boxes extra turn on box completion and score tracking', async () => {
  const s = await startServer();
  const a = client(s.url);
  const b = client(s.url);

  const ra = await a.req('create', { name: 'Rohit' });
  const rb = await b.req('join', { code: ra.code, name: 'Virat' });

  await a.req('queue', { gameType: 'dots' });
  await b.req('queue', { gameType: 'dots' });

  const g0 = await a.untilGame(g => g.gameType === 'dots');
  const matchId = g0.matchId;

  // Draw 3 sides of box (0,0):
  // Top: H(0,0), Left: V(0,0), Bottom: H(1,0)
  await a.req('game-action', { matchId, action: { type: 'move', lineType: 'h', r: 0, c: 0 } }); // A turn -> passes to B
  await b.req('game-action', { matchId, action: { type: 'move', lineType: 'v', r: 0, c: 0 } }); // B turn -> passes to A
  await a.req('game-action', { matchId, action: { type: 'move', lineType: 'h', r: 1, c: 0 } }); // A turn -> passes to B

  // Now box (0,0) has 3 sides. B completes the 4th side (Right: V(0,1))!
  await b.req('game-action', { matchId, action: { type: 'move', lineType: 'v', r: 0, c: 1 } });

  const gbAfter = await b.untilGame(g => g.boxes[0][0] !== null);
  assert.equal(gbAfter.boxes[0][0].owner, rb.playerId);
  assert.equal(gbAfter.scores[rb.playerId], 1);

  // BONUS TURN: It should STILL be player B's turn because B completed a box!
  assert.equal(gbAfter.turn, rb.playerId, 'Player must receive bonus turn for completing a box');

  a.close();
  b.close();
  await s.close();
});

test('RECESS: Raja Mantri Chor Sipahi secret role distribution and Mantri guess logic', async () => {
  const s = await startServer();
  const p1 = client(s.url);
  const p2 = client(s.url);
  const p3 = client(s.url);
  const p4 = client(s.url);

  const r1 = await p1.req('create', { name: 'Akbar' });
  const r2 = await p2.req('join', { code: r1.code, name: 'Birbal' });
  const r3 = await p3.req('join', { code: r1.code, name: 'Man Singh' });
  const r4 = await p4.req('join', { code: r1.code, name: 'Tansen' });

  await p1.req('queue', { gameType: 'rmcs' });
  await p2.req('queue', { gameType: 'rmcs' });
  await p3.req('queue', { gameType: 'rmcs' });
  await p4.req('queue', { gameType: 'rmcs' });

  const g0 = await p1.untilGame(g => g.gameType === 'rmcs');
  assert.equal(g0.players.length, 4);

  // Wait for announcement & guessing phase
  const gGuess = await p1.untilGame(g => g.phase === 'guessing');
  assert.ok(gGuess.rajaId, 'Raja announced');
  assert.ok(gGuess.mantriId, 'Mantri announced');

  // Verify secret info: P1 must NOT see unannounced roles during guessing
  const suspects = gGuess.players.filter(p => p.isSuspect);
  assert.equal(suspects.length, 2, 'Exactly 2 suspects (Chor and Sipahi)');
  for (const s of suspects) {
    if (s.id !== r1.playerId) {
      assert.equal(s.role, null, 'Unannounced roles must stay secret from other players');
    }
  }

  // Find which client is the Mantri
  const clients = [
    { c: p1, id: r1.playerId },
    { c: p2, id: r2.playerId },
    { c: p3, id: r3.playerId },
    { c: p4, id: r4.playerId }
  ];
  const mantriClient = clients.find(cl => cl.id === gGuess.mantriId);

  // Mantri guesses one of the suspects
  const suspectId = suspects[0].id;
  const guessRes = await mantriClient.c.req('game-action', {
    matchId: g0.matchId,
    action: { type: 'guess', suspectId }
  });
  assert.ok(guessRes.ok);

  const gVerdict = await p1.untilGame(g => g.phase === 'verdict');
  assert.equal(gVerdict.phase, 'verdict');
  assert.ok(gVerdict.scores[gVerdict.rajaId] >= 1000, 'Raja gets 1000');
  assert.ok(gVerdict.verdictMessage.length > 0);

  p1.close(); p2.close(); p3.close(); p4.close();
  await s.close();
});

test('RECESS: Two independent matches running simultaneously in one room', async () => {
  const s = await startServer();
  const c1 = client(s.url);
  const c2 = client(s.url);
  const c3 = client(s.url);
  const c4 = client(s.url);

  const r1 = await c1.req('create', { name: 'Kid1' });
  await c2.req('join', { code: r1.code, name: 'Kid2' });
  await c3.req('join', { code: r1.code, name: 'Kid3' });
  await c4.req('join', { code: r1.code, name: 'Kid4' });

  // Kid1 and Kid2 queue for Tic-Tac-Toe
  await c1.req('queue', { gameType: 'ttt' });
  await c2.req('queue', { gameType: 'ttt' });

  // Kid3 and Kid4 queue for Stone Paper Scissors
  await c3.req('queue', { gameType: 'sps' });
  await c4.req('queue', { gameType: 'sps' });

  const g1 = await c1.untilGame(g => g.gameType === 'ttt');
  const g3 = await c3.untilGame(g => g.gameType === 'sps');

  assert.equal(g1.gameType, 'ttt');
  assert.equal(g3.gameType, 'sps');
  assert.notEqual(g1.matchId, g3.matchId, 'Matches have separate IDs and run concurrently!');

  c1.close(); c2.close(); c3.close(); c4.close();
  await s.close();
});
