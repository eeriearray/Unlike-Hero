// Trillioner game server. Battle Spend rooms arrive at M7; for now it only claims its path.
import { WebSocketServer } from 'ws';
export default function attach({ httpServer, basePath, log = console.log }) {
  const path = `${basePath}ws`;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  httpServer.on('upgrade', (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return; }
    if (url.pathname !== path) return;
    wss.handleUpgrade(req, socket, head, (ws) => ws.close());
  });
  log(`[trillioner] game server on ${path}`);
  return { paths: [path], close: () => wss.close() };
}
