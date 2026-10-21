// Prompt packs shared through the hub: the Prompt Studio on any device on this hub POSTs a pack and gets a
// 7-digit code (6 digits + a Luhn check digit); any Main Stage on the hub can then load it by code.
// Packs are plain JSON files in games/party-pack/packs/ (one per code). Text is checked with the same
// profanity filter the browser uses (js/core.js), and sizes are capped.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const KINDS = ['quip', 'gauntlet', 'fib', 'draw', 'quiz', 'pitch'];
const MAX_BYTES = 64 * 1024, MAX_ITEMS = 200;
export const luhn = digits => { let sum = 0; digits.split('').reverse().forEach((d, i) => { let n = Number(d); if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; } sum += n; }); return String((10 - (sum % 10)) % 10); };
export const validCode = c => /^\d{7}$/.test(c) && luhn(c.slice(0, 6)) === c[6];

async function loadFilter() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'js');
  const sandbox = { window: {}, sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { getItem: () => null, setItem() {} }, document: {} };
  sandbox.window = sandbox;
  vm.runInNewContext(await readFile(join(root, 'core.js'), 'utf8'), sandbox);
  return sandbox.PP.filter;
}
const texts = v => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(texts) : v && typeof v === 'object' ? Object.values(v).flatMap(texts) : [];

export async function createPackStore({ dir }) {
  const filter = await loadFilter();
  const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
  const read = req => new Promise((resolve, reject) => { const parts = []; let n = 0; req.on('data', c => { n += c.length; if (n > MAX_BYTES) { reject(new Error('too large')); req.destroy(); } else parts.push(c); }); req.on('end', () => resolve(Buffer.concat(parts).toString('utf8'))); req.on('error', reject); });

  async function handle(req, res, rest) {
    await mkdir(dir, { recursive: true });
    if (req.method === 'GET' && /^\/\d{7}$/.test(rest)) {
      const code = rest.slice(1);
      if (!validCode(code)) return json(res, 400, { error: 'That code has a typo.' });
      try { return json(res, 200, JSON.parse(await readFile(join(dir, code + '.json'), 'utf8'))); } catch { return json(res, 404, { error: 'No pack with that code on this hub.' }); }
    }
    if (req.method === 'POST' && (rest === '' || rest === '/')) {
      let pack;
      try { pack = JSON.parse(await read(req)); } catch (e) { return json(res, e.message === 'too large' ? 413 : 400, { error: e.message === 'too large' ? 'That pack is too big.' : 'Not a pack.' }); }
      if (!pack || !KINDS.includes(pack.kind) || !Array.isArray(pack.items) || !pack.items.length || pack.items.length > MAX_ITEMS) return json(res, 400, { error: 'Not a valid pack.' });
      const clean = { v: 1, title: String(pack.title || 'Untitled').slice(0, 40), author: String(pack.author || '').slice(0, 24), kind: pack.kind, items: pack.items, created: Date.now() };
      if (texts([clean.title, clean.author, clean.items]).some(t => filter.test(t))) return json(res, 400, { error: 'Some lines tripped the profanity filter. Shared packs have to be family-friendly.' });
      for (let tries = 0; tries < 20; tries++) {
        const six = String(Math.floor(Math.random() * 1e6)).padStart(6, '0'), code = six + luhn(six);
        const file = join(dir, code + '.json');
        try { await access(file); continue; } catch { /* free */ }
        await writeFile(file, JSON.stringify(clean, null, 1));
        return json(res, 200, { code });
      }
      return json(res, 500, { error: 'Could not allocate a code.' });
    }
    return json(res, 404, { error: 'Not found.' });
  }
  return { handle };
}
