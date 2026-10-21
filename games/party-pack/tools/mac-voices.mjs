#!/usr/bin/env node
// Voices every host line with macOS's built-in voices: a free starter cast until you upload better ones.
// Needs macOS (`say`) and ffmpeg. Writes voice/<line id>.mp3 for every line and updates voice/index.json.
//   node games/party-pack/tools/mac-voices.mjs            all lines
//   node games/party-pack/tools/mac-voices.mjs quip       one host (lobby, quip, fib, draw, quiz, tee, pitch, meld, whosaid, likely, guess, emoji, edge)
// Files you uploaded yourself are replaced only for the hosts you name, so pass a host to redo just that one.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// voice: a `say -v` name. rate: words per minute. pitch: < 1 deepens (ffmpeg resample, tempo kept).
const CAST = {
  lobby: { voice: 'Samantha', rate: 185 },                 // The Announcer: warm, upbeat
  edge:  { voice: 'Samantha', rate: 185 },                 // shared lines are the Announcer's
  quip:  { voice: 'Karen', rate: 168 },                    // Margo Quill: dry, weary
  fib:   { voice: 'Rishi', rate: 200 },                    // Dex Fibbington: fast game-show patter
  draw:  { voice: 'Daniel', rate: 158 },                   // Professor Pallette: slow, posh
  quiz:  { voice: 'Daniel', rate: 148, pitch: 0.84 },      // The Proprietor: slow, deep, creepy-polite
  tee:   { voice: 'Moira', rate: 205 },                    // Ripley Thread: fast, bright
  pitch: { voice: 'Aman', rate: 192 },                     // Chad Venture: quick, confident
  meld:  { voice: 'Tessa', rate: 150, pitch: 0.94 },       // Madame Meld: slow, mystical
  whosaid: { voice: 'Tara', rate: 205 },                   // Gossip Gerry: fast, nosy
  likely: { voice: 'Rishi', rate: 182, pitch: 0.9 },       // Principal Prom: proud, a bit deeper
  guess: { voice: 'Daniel', rate: 196, pitch: 1.08 },      // Professor Approx: excitable, brighter
  emoji: { voice: 'Karen', rate: 210, pitch: 1.12 }        // Emo Gee: bubbly, high
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const voiceDir = join(root, 'voice');
const sandbox = {}; sandbox.window = sandbox;
vm.runInNewContext(readFileSync(join(root, 'js', 'content.js'), 'utf8'), sandbox);
const lines = sandbox.PP.scriptLines();
const only = process.argv[2];
if (only && !CAST[only]) { console.error(`Unknown host "${only}". Use one of: ${Object.keys(CAST).join(', ')}`); process.exit(1); }

const tmp = mkdtempSync(join(tmpdir(), 'pp-say-'));
const indexFile = join(voiceDir, 'index.json');
let index; try { index = JSON.parse(readFileSync(indexFile, 'utf8')); } catch { index = { clips: {} }; }
index.clips = index.clips || {};
let n = 0;
try {
  for (const l of lines) {
    if (only && l.host !== only) continue;
    const c = CAST[l.host];
    const aiff = join(tmp, l.id + '.aiff');
    // Spoken text: the ellipsis character reads better as a pause.
    execFileSync('say', ['-v', c.voice, '-r', String(c.rate), '-o', aiff, l.text.replace(/…/g, '...')]);
    const filters = ['aresample=44100'];
    if (c.pitch) filters.push(`asetrate=${Math.round(44100 * c.pitch)}`, 'aresample=44100', `atempo=${(1 / c.pitch).toFixed(4)}`);
    filters.push('loudnorm=I=-16:TP=-1.5:LRA=11', 'aresample=44100');     // even loudness across hosts
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', aiff, '-af', filters.join(','), '-ac', '1', '-b:a', '112k', join(voiceDir, l.id + '.mp3')]);
    index.clips[l.id] = l.id + '.mp3';
    n++;
    process.stdout.write(`\r${n} lines voiced`);
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }
// keep script order and known ids only, like the upload server does
const clips = {}; for (const l of lines) if (index.clips[l.id]) clips[l.id] = index.clips[l.id];
writeFileSync(indexFile, JSON.stringify({ note: index.note || 'Party Pack host voices.', clips }, null, 2) + '\n');
console.log(`\nWrote ${n} clips to games/party-pack/voice/ and updated index.json.`);
