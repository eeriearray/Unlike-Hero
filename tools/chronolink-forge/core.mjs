// Loads ChronoLink's DOM-free rules and solver from the game page, as the tests do.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../../games/chronolink/index.html', import.meta.url), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.match(/<script id="chrono-core">([\s\S]*?)<\/script>/)[1], ctx);
export const C = ctx.ChronoCore;
