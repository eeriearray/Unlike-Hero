#!/usr/bin/env node
// Writes the hosts' recording script from js/content.js:
//   voice/SCRIPT.md   every line, grouped by host, with casting notes and the exact filename to save
//   voice/script.csv  the same lines for bulk text-to-speech tools (filename,host,voice notes,text)
// Run after editing any host line:  node games/party-pack/tools/voice-script.mjs
import { writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = {}; sandbox.window = sandbox;
vm.runInNewContext(await readFile(join(root, 'js', 'content.js'), 'utf8'), sandbox);
const PP = sandbox.PP;
const lines = PP.scriptLines();
const games = { lobby: 'The lobby, between games', quip: 'The Comedy Writer', fib: 'The Bluffing Game', draw: 'The Terrible Artist', quiz: 'The Cutthroat Quiz', tee: 'The Chaos Mashup', pitch: "The Imposter's Pitch", meld: 'Mind Meld', whosaid: 'Who Said That?', likely: 'Most Likely To', guess: 'Guesstimate', emoji: 'Emoji Charades', edge: 'Shared lines: ties, AFK, hype and other surprises (played in the Announcer\'s voice in every game)' };
const hostOf = h => h === 'edge' ? PP.HOSTS.lobby : PP.HOSTS[h];

let md = `# Party Pack: the hosts' script

${lines.length} lines across six hosts and the Announcer. Generate each line with any text-to-speech service (or record it),
and save it with the **exact filename** shown: the line id plus \`.mp3\` (\`.m4a\`, \`.wav\`, \`.ogg\` and \`.webm\` also work).

**Upload:** run \`npm start\`, open **http://localhost:8080/games/party-pack/#booth** on this computer and press
**Upload files**. Select all your files at once: each one lands on its line by its filename and is saved into this
folder. Then commit the folder:

\`\`\`bash
git add games/party-pack/voice
git commit -m "Voice the Party Pack hosts"
git push
\`\`\`

Lines never contain player names or answers (those stay on screen), so one set of files covers every game.
Keep each file under 4 MB. Leave a little silence at the start and end; the game trims it.
Any line you skip falls back to the computer's built-in voice.

**Starter cast:** the game ships with every line voiced by macOS's built-in voices (Samantha as the Announcer, Karen as
Margo, Rishi as Dex, Daniel as Pallette and, pitched down, the Proprietor, Moira as Ripley, Aman as Chad), made by
\`node games/party-pack/tools/mac-voices.mjs\`. Uploading a file for a line replaces its starter version.

A CSV of the same lines (\`script.csv\`) is next to this file for bulk tools.
`;
const groups = [];
for (const l of lines) { let g = groups.find(x => x.host === l.host); if (!g) groups.push(g = { host: l.host, items: [] }); g.items.push(l); }
for (const g of groups) {
  const h = hostOf(g.host);
  md += `\n## ${g.host === 'edge' ? 'The Announcer: shared lines' : h.name} — ${games[g.host]}\n\n**Voice:** ${h.cast}\n\n| File | Line |\n| --- | --- |\n`;
  for (const l of g.items) md += `| \`${l.id}.mp3\` | ${l.text.replace(/\|/g, '\\|')} |\n`;
}
const csvq = s => '"' + String(s).replace(/"/g, '""') + '"';
const csv = 'filename,host,voice,text\n' + lines.map(l => [l.id + '.mp3', l.host === 'edge' ? 'The Announcer' : hostOf(l.host).name, hostOf(l.host).cast, l.text].map(csvq).join(',')).join('\n') + '\n';
await writeFile(join(root, 'voice', 'SCRIPT.md'), md);
await writeFile(join(root, 'voice', 'script.csv'), csv);
console.log(`Wrote voice/SCRIPT.md and voice/script.csv (${lines.length} lines).`);
