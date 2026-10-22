// Shared helpers for the Dragon Clash tests.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const D = require('../games/dragon-clash/engine/dc-data.js');
export const Build = require('../games/dragon-clash/engine/dc-build.js');
export const Sim = require('../games/dragon-clash/engine/dc-sim.js');
export const Bot = require('../games/dragon-clash/engine/dc-ai.js');
export const Cup = require('../games/dragon-clash/engine/dc-tournament.js');
export const B = Sim.BTN;

const SIG = { fire: ['fireball', 'emberBurst'], ice: ['iceShard', 'frostWall'], lightning: ['bolt', 'staticPulse'], earth: ['boulder', 'stoneSkin'], water: ['waterJet', 'tidePool'] };

/** A plain, valid build of an element: balanced body, strider, no upgrade (identical stats across elements). */
export function plain(element, over = {}) {
  const b = Build.presetBuild('warrior');
  Object.assign(b, { element, body: 'balanced', mobility: 'strider', signature: SIG[element][0], ability: SIG[element][1], upgrade: 'none', name: element + ' test' }, over);
  return b;
}

/** Two dragons on the main platform, `gap` apart, A facing B. */
export function duel(a, b, opts = {}) {
  const sim = new Sim({ arena: 'skyforge', stocks: opts.stocks || 3, seed: 1, friendlyFire: !!opts.friendlyFire, timeLimit: opts.timeLimit || 0,
    fighters: [{ build: a, team: 0 }, { build: b, team: opts.sameTeam ? 0 : 1 }].concat(opts.extra || []) });
  const A = sim.fighters[0], T = sim.fighters[1];
  A.x = opts.x || 760; T.x = A.x + (opts.gap || 60);
  A.facing = 1; T.facing = -1;
  sim.drainEvents();
  return { sim, A, T };
}

/** Press a button for fighter i on the next tick, then run `ticks` more ticks with no input. Returns events. */
export function press(sim, i, bits, ticks = 40, held = 0) {
  const ev = [];
  const inputs = sim.fighters.map(() => ({ held: 0, pressed: 0 }));
  inputs[i] = { held, pressed: bits };
  sim.step(inputs);
  ev.push(...sim.drainEvents());
  for (let k = 0; k < ticks; k++) {
    const idle = sim.fighters.map(() => ({ held: 0, pressed: 0 }));
    idle[i] = { held, pressed: 0 };
    sim.step(idle);
    ev.push(...sim.drainEvents());
  }
  return ev;
}

export const hits = (ev) => ev.filter((e) => e.type === 'hit');
