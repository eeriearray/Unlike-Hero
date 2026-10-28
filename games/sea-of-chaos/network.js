export function connect(code, handlers) { if (!window.Hub) return null; const room = window.Hub.room(`sea-of-chaos:${code}`); for (const [topic, fn] of Object.entries(handlers)) room.on(topic, fn); return room; }
export function roomCode() { const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; return Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join(''); }

// Columnar packets send each table's field names once and round numbers, which
// keeps a full 3v3 snapshot well under the relay's 16KiB message cap.
const TABLES = ['ships', 'shots', 'loot', 'powers', 'events'];
const SKIP = new Set(['rudder', 'greed', 'slot', 'lastHitBy']);
export function snapshot(w) {
 const state = {}, columns = {};
 for (const [k, v] of Object.entries(w)) if (!TABLES.includes(k)) state[k] = v;
 for (const name of TABLES) {
  const rows = w[name] || [], keys = [...new Set(rows.flatMap(Object.keys))].filter(k => !SKIP.has(k));
  columns[name] = { keys, rows: rows.map(row => keys.map(k => row[k] ?? null)) };
 }
 return JSON.parse(JSON.stringify({ wire: 3, state, columns }, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v));
}
export function readSnapshot(packet) {
 if (packet?.wire !== 3 || !packet.state || !packet.columns) return null;
 const state = { ...packet.state };
 for (const name of TABLES) {
  const table = packet.columns[name];
  if (!Array.isArray(table?.keys) || !Array.isArray(table?.rows) || table.rows.some(row => !Array.isArray(row))) return null;
  state[name] = table.rows.map(row => Object.fromEntries(table.keys.map((k, i) => [k, row[i]])));
 }
 return state;
}
