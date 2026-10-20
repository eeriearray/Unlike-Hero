// Maps each catalog entry to its server engine. Matchmaking rules live in shared/catalog.js.
import { CATALOG } from '../shared/catalog.js';
import { TttEngine } from './engines/ttt.mjs';
import { SpsEngine } from './engines/sps.mjs';
import { DotsEngine } from './engines/dots.mjs';
import { RmcsEngine } from './engines/rmcs.mjs';
import { FlamesEngine } from './engines/flames.mjs';
import { NpatEngine } from './engines/npat.mjs';
import { BluffEngine } from './engines/bluff.mjs';
import { ColourEngine } from './engines/colour.mjs';
import { SnakesEngine } from './engines/snakes.mjs';
import { LudoEngine } from './engines/ludo.mjs';
import { PenFightEngine } from './engines/penfight.mjs';
import { MarblesEngine } from './engines/marbles.mjs';
import { CarromEngine } from './engines/carrom.mjs';

const ENGINES = {
  ttt: TttEngine,
  sps: SpsEngine,
  dots: DotsEngine,
  rmcs: RmcsEngine,
  flames: FlamesEngine,
  npat: NpatEngine,
  bluff: BluffEngine,
  colour: ColourEngine,
  snakes: SnakesEngine,
  ludo: LudoEngine,
  penfight: PenFightEngine,
  marbles: MarblesEngine,
  carrom: CarromEngine
};

export const GAMES = Object.fromEntries(
  CATALOG.filter(g => ENGINES[g.id]).map(g => [g.id, { ...g, Engine: ENGINES[g.id] }])
);
