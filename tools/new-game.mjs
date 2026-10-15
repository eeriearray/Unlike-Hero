#!/usr/bin/env node
// Create a new game from the co-op starter and register it with the hub.
//   node tools/new-game.mjs my-game "My Game"
import { cpSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(' ').trim();
if (!id || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(id) || !title) {
  console.error('Usage: node tools/new-game.mjs <id> "<Title>"   (id: lowercase letters, digits and dashes)');
  process.exit(1);
}
const dest = join(root, 'games', id);
if (existsSync(dest)) { console.error(`games/${id} already exists.`); process.exit(1); }

cpSync(join(root, 'templates', 'coop-starter'), dest, { recursive: true });
const fill = dir => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { fill(p); continue; }
    if (!/\.(html|json|svg|js|css|md)$/.test(f)) continue;
    writeFileSync(p, readFileSync(p, 'utf8').replaceAll('GAME_ID', id).replaceAll('GAME_TITLE', title));
  }
};
fill(dest);
console.log(`Created games/${id} from templates/coop-starter.`);
execFileSync(process.execPath, [join(root, 'tools', 'build-registry.mjs')], { stdio: 'inherit' });
