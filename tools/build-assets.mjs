#!/usr/bin/env node
// Local asset preparation only. No source-pack contents are executed.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node tools/build-assets.mjs [--source DIR]\nRequires python3, ffmpeg, ffprobe and cwebp. Local preview only; restricted packs are excluded.');
  process.exit(0);
}
if (args.some((v, i) => v !== '--source' && args[i - 1] !== '--source') || (args.includes('--source') && !args[args.indexOf('--source') + 1])) throw Error('Use --help for usage');
const source = path.resolve(args.includes('--source') ? args[args.indexOf('--source') + 1] : path.join(os.homedir(), 'Desktop/horror game assets'));
const art = path.join(root, 'games/the-hollow/art');
const packs = JSON.parse(await fs.readFile(path.join(root, 'tools/hollow-asset-packs.json'), 'utf8'));
const budget = 39_000_000; // Leave room for the manifest and existing procedural sources.
const run = (cmd, argv) => {
  const r = spawnSync(cmd, argv, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw Error(`${cmd}: ${r.error?.message || r.stderr}`);
  return r.stdout;
};
run('python3', ['--version']);
run('ffmpeg', ['-version']);
run('ffprobe', ['-version']);
run('cwebp', ['-version']);
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'hollow-assets-'));
const staging = path.join(temp, 'generated');
await fs.mkdir(staging);
const manifest = { version: 1, mode: 'local-preview-not-cleared-for-publication', maxBytes: 40_000_000, totalBytes: 0, assets: {}, regions: {}, packs: [], skipped: [] };
const snake = s => s.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
try {
  for (const pack of packs) {
    const input = path.join(source, pack.file);
    const report = { id: pack.id, source: pack.file, author: pack.author, license: pack.license, status: pack.status, included: 0 };
    manifest.packs.push(report);
    if (pack.status === 'excluded') { report.reason = pack.reason; continue; }
    try { await fs.access(input); } catch { report.reason = 'Source missing'; continue; }
    const extracted = path.join(temp, pack.id);
    await fs.mkdir(extracted);
    let files;
    if (pack.file.endsWith('.zip')) {
      // Validate archive paths, symlinks and uncompressed size BEFORE extraction.
      files = JSON.parse(run('python3', ['-c', `import zipfile,pathlib,stat,json,sys
with zipfile.ZipFile(sys.argv[1]) as z:
 infos=z.infolist()
 if sum(i.file_size for i in infos)>2_000_000_000: raise ValueError('Archive too large')
 for i in infos:
  p=pathlib.PurePosixPath(i.filename)
  if p.is_absolute() or '..' in p.parts or '\\\\' in i.filename or stat.S_ISLNK(i.external_attr>>16): raise ValueError('Unsafe archive path')
 z.extractall(sys.argv[2])
 print(json.dumps([i.filename for i in infos if not i.is_dir()]))`, input, extracted]));
    } else {
      await fs.copyFile(input, path.join(extracted, pack.file));
      files = [pack.file];
    }
    files.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const selected = files.filter(f => !f.includes('__MACOSX') && !path.basename(f).startsWith('.') && !/preview|1920x1080|1280x720/i.test(f) && /\.(png|jpe?g|wav|ogg|mp3|ttf)$/i.test(f));
    // Explicit cue selections take precedence over the starter pack limit.
    const priority = pack.priority || [];
    selected.sort((a, b) => {
      const ai = priority.indexOf(a), bi = priority.indexOf(b);
      return (ai < 0 ? priority.length : ai) - (bi < 0 ? priority.length : bi);
    });
    if (pack.audioSelection && pack.audioSelection.some(f => !selected.includes(f))) throw Error('Missing selected audio in ' + pack.id);
    let images = 0, sounds = 0;
    for (const file of selected) {
      const ext = path.extname(file).toLowerCase();
      const audio = ['.wav', '.ogg', '.mp3'].includes(ext);
      const type = audio ? 'audio' : ext === '.ttf' ? 'font' : 'image';
      // Curated audio avoids duplicate WAV/OGG exports; other packs retain the starter cap.
      if (audio && pack.audioSelection && !pack.audioSelection.includes(file)) {
        manifest.skipped.push({ pack: pack.id, source: file, reason: 'Not in curated audio selection' }); continue;
      }
      if ((type === 'image' && images++ >= (pack.background ? 8 : 100)) || (audio && sounds++ >= (pack.audioSelection ? pack.audioSelection.length : 18))) {
        manifest.skipped.push({ pack: pack.id, source: file, reason: 'Starter selection limit' }); continue;
      }
      const hash = createHash('sha256').update(file).digest('hex').slice(0, 8);
      const id = `${pack.id}_${snake(file.slice(0, -ext.length))}_${hash}`;
      const name = `${id}${audio ? '.mp3' : type === 'font' ? '.ttf' : '.webp'}`;
      const out = path.join(staging, name);
      if (type === 'font') await fs.copyFile(path.join(extracted, file), out);
      else if (audio) run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', path.join(extracted, file), '-vn', '-c:a', 'libmp3lame', '-q:a', '5', out]);
      else {
        const dimensions = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', path.join(extracted, file)])).streams[0];
        run('cwebp', ['-quiet', '-q', '80', ...(pack.pixel ? ['-lossless'] : []), ...(dimensions.width > 1920 ? ['-resize', '1920', '0'] : []), path.join(extracted, file), '-o', out]);
      }
      const bytes = (await fs.stat(out)).size;
      if (manifest.totalBytes + bytes > budget) {
        await fs.unlink(out); manifest.skipped.push({ pack: pack.id, source: file, reason: 'Payload budget' }); continue;
      }
      manifest.assets[id] = { file: `art/generated/${name}`, type, bytes, pack: pack.id, source: file, regions: pack.regions, pixel: !!pack.pixel };
      for (const region of pack.regions) (manifest.regions[region] ||= []).push(id);
      manifest.totalBytes += bytes;
      report.included++;
    }
    console.log(`${pack.id}: ${report.included} assets`);
  }
  // UI atlas crops remain reproducible and inherit the original pack's license.
  const slices = JSON.parse(await fs.readFile(path.join(root, 'tools/hollow-asset-slices.json'), 'utf8'));
  for (const slice of slices) {
    const parent = Object.values(manifest.assets).find(a => a.pack === slice.pack && a.source === slice.source);
    if (!parent) { manifest.skipped.push({ pack: slice.pack, source: slice.source, reason: 'Slice source unavailable' }); continue; }
    if (!/^[a-z0-9_]+$/.test(slice.id) || slice.crop.length !== 4 || !slice.crop.every(Number.isInteger)) throw Error('Invalid atlas slice');
    const name = `${slice.id}.webp`, out = path.join(staging, name);
    run('cwebp', ['-quiet', '-lossless', '-crop', ...slice.crop.map(String), path.join(temp, slice.pack, slice.source), '-o', out]);
    const bytes = (await fs.stat(out)).size;
    if (manifest.totalBytes + bytes > budget) throw Error('UI slices exceed payload budget');
    manifest.assets[slice.id] = { file: `art/generated/${name}`, type: 'image', bytes, pack: slice.pack,
      source: slice.source, crop: slice.crop, border: slice.border, regions: ['shared'], pixel: true };
    (manifest.regions.shared ||= []).push(slice.id);
    manifest.totalBytes += bytes;
    manifest.packs.find(p => p.id === slice.pack).included++;
  }
  const json = JSON.stringify(manifest, null, 2) + '\n';
  if (manifest.totalBytes + Buffer.byteLength(json) > manifest.maxBytes) throw Error('Manifest exceeds payload budget');
  // Retain the last successful output until every conversion has succeeded.
  const output = path.join(art, 'generated');
  const backup = path.join(art, '.generated-backup');
  await fs.mkdir(art, { recursive: true });
  try { await fs.access(backup); throw Error('Previous backup exists; inspect art/.generated-backup before rebuilding'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  let previous = false;
  try { await fs.rename(output, backup); previous = true; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  try {
    await fs.cp(staging, output, { recursive: true });
    await fs.writeFile(path.join(art, 'manifest.json.tmp'), json);
    await fs.rename(path.join(art, 'manifest.json.tmp'), path.join(art, 'manifest.json'));
  } catch (e) {
    await fs.rm(output, { recursive: true, force: true });
    if (previous) await fs.rename(backup, output);
    throw e;
  }
  if (previous) await fs.rm(backup, { recursive: true });
  console.log(`Built ${Object.keys(manifest.assets).length} assets; ${(manifest.totalBytes / 1e6).toFixed(2)} MB. No media loads until requested by the registry.`);
} finally { await fs.rm(temp, { recursive: true, force: true }); }
