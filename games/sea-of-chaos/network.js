export function connect(code,handlers){if(!window.Hub)return null;const room=window.Hub.room(`sea-of-chaos:${code}`);for(const [topic,fn]of Object.entries(handlers))room.on(topic,fn);return room;}
export function roomCode(){const letters='ABCDEFGHJKLMNPQRSTUVWXYZ';return Array.from({length:4},()=>letters[Math.floor(Math.random()*letters.length)]).join('');}
// Columnar packets send field names once per table, including six detailed ships.
// This preserves all simulation state while leaving headroom for the relay envelope.
const tables=['ships','shots','loot','fields','events'];
export function snapshot(w,events=[]){const state={...w,events},columns={};for(const name of tables){const rows=state[name]||[],keys=[...new Set(rows.flatMap(Object.keys))];columns[name]={keys,rows:rows.map(row=>keys.map(k=>row[k]??null))};delete state[name];}return JSON.parse(JSON.stringify({wire:2,state,columns},(k,v)=>typeof v==='number'?Math.round(v*1000)/1000:v));}
export function readSnapshot(packet){if(packet?.wire!==2)return packet;if(!packet.state||!packet.columns)return null;const state={...packet.state};for(const name of tables){const table=packet.columns[name];if(!Array.isArray(table?.keys)||!Array.isArray(table?.rows)||table.rows.some(row=>!Array.isArray(row)))return null;state[name]=table.rows.map(row=>Object.fromEntries(table.keys.map((k,i)=>[k,row[i]])));}return state;}

// Preserve edge actions across newer movement packets until the host consumes them.
export function mergeControls(previous={},next={}){const result={...next};if(previous.fire&&!next.fire){result.side=previous.side;result.fallback=previous.fallback;result.ammo=previous.ammo;}for(const key of ['fire','utility','buy','command'])if(previous[key]&&!next[key])result[key]=previous[key];return result;}
