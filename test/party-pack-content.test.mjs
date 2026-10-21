// Party Pack content: enough questions per game, no duplicates, well-formed entries, every game has a host,
// a voice for each line, a look and a deck that never repeats until the list is used up.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../games/party-pack/', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
function load() {
  const store = {};
  const sb = { localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } }, sessionStorage: { getItem: () => null, setItem() {} } };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(read('js/content.js'), sb);
  for (const f of readdirSync(new URL('js/content/', root)).sort()) vm.runInContext(read('js/content/' + f), sb);
  vm.runInContext(read('js/core.js'), sb);
  sb.PP.GAMES = {};
  vm.runInContext(read('js/games/common.js'), sb);
  return sb.PP;
}
const PP = load(), C = PP.CONTENT;
const MIN = { quip: 200, gauntlet: 100, fib: 80, draw: 200, quiz: 150, exit: 80, pitch: 60, meld: 120, whosaid: 120, likely: 120, guess: 80, emoji: 120, teeInspo: 50, teeSlogan: 30 };
const keyOf = x => typeof x === 'string' ? x.toLowerCase() : (x.q || x.name || x.t).toLowerCase();

test('every game has plenty of questions and no duplicates', () => {
  for (const [k, n] of Object.entries(MIN)) {
    assert.ok(Array.isArray(C[k]) && C[k].length >= n, `${k}: ${C[k] && C[k].length} items (want ${n}+)`);
    const seen = new Set(), dupes = [];
    for (const x of C[k]) { const id = keyOf(x); if (seen.has(id)) dupes.push(id); seen.add(id); }
    assert.deepEqual(dupes, [], `${k} has duplicates`);
  }
});

test('entries are well-formed', () => {
  for (const q of C.quiz.concat(C.exit)) {
    assert.ok(q.q && Array.isArray(q.o) && q.a >= 0 && q.a < q.o.length, 'bad question: ' + q.q);
    assert.equal(new Set(q.o.map(o => o.toLowerCase())).size, q.o.length, 'repeated option: ' + q.q);
  }
  for (const f of C.fib) {
    assert.ok(f.q.includes('____') && f.a && f.house.length >= 3, 'bad fact: ' + f.q);
    for (const h of f.house) assert.ok(!PP.isTruth(h, f.a, f.alts), `a fake answer is the truth: ${f.q} / ${h}`);
  }
  for (const g of C.gauntlet) assert.ok(g.includes('____'), 'gauntlet blank missing: ' + g);
  for (const m of C.meld) assert.ok(m.q && m.a.length >= 3, 'meld needs answers: ' + m.q);
  for (const g of C.guess) assert.ok(g.q && Number.isFinite(g.a), 'guess needs a number: ' + g.q);
  for (const e of C.emoji) { assert.ok(e.t && e.cat && e.e, 'emoji item incomplete: ' + e.t); assert.equal(PP.emojiOnly(e.e), e.e, 'bot clue must be emoji only: ' + e.t); }
  for (const p of C.pitch) assert.ok(p.name && p.line && p.hints.length === 3 && p.words.length === 3, 'pitch incomplete: ' + p.name);
  for (const l of C.likely) assert.match(l, /^Who'?s most likely to .+\?$/, 'likely prompt format: ' + l);
});

test('the deck never repeats a question until the whole list has been played', () => {
  const list = Array.from({ length: 30 }, (_, i) => 'q' + i), ctx = {};
  const seen = new Set();
  for (let night = 0; night < 6; night++) for (const q of PP.G.deal(ctx, 'test', list, 5)) { assert.ok(!seen.has(q), 'repeated ' + q); seen.add(q); }
  assert.equal(seen.size, 30, 'six nights of five used all thirty');
  assert.equal(PP.G.deal(ctx, 'test', list, 5).length, 5, 'then a new cycle starts');
});

test('every game has a host with an intro line, a voice for every line and a theme', () => {
  const games = readdirSync(new URL('js/games/', root)).filter(f => f !== 'common.js').map(f => f.replace('.js', ''));
  const keys = { quip: 'quip', fib: 'fib', artist: 'draw', quiz: 'quiz', tee: 'tee', pitch: 'pitch', meld: 'meld', whosaid: 'whosaid', likely: 'likely', guess: 'guess', emoji: 'emoji' };
  const voices = JSON.parse(read('voice/index.json')).clips, css = read('css/party.css'), art = read('js/art.js');
  assert.equal(games.length, 11);
  for (const g of games) {
    const k = keys[g]; assert.ok(k, 'unknown game file ' + g);
    assert.ok(PP.HOSTS[k] && PP.HOSTS[k].lines.intro, k + ' host intro');
    assert.ok(css.includes(`[data-theme=${k}]`), k + ' theme');
    assert.ok(new RegExp(`\\n\\s+${k}: \``).test(art), k + ' host art');
  }
  const missing = PP.scriptLines().filter(l => !voices[l.id]).map(l => l.id);
  assert.equal(missing.length, 0, 'lines without a voice file: ' + missing.join(', '));
});
