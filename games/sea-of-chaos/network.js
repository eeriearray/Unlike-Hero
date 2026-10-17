export function connect(code,handlers){if(!window.Hub)return null;const room=window.Hub.room(`sea-of-chaos:${code}`);for(const [topic,fn] of Object.entries(handlers))room.on(topic,fn);return room}
export function roomCode(){return Array.from({length:4},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random()*24)]).join('')}
