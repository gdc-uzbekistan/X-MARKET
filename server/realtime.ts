import type { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { resolveToken } from './security.ts';

interface ClientMeta {
  ws: WebSocket;
  actorType: 'guest' | 'customer' | 'admin';
  actorId: number | null;
}

const clients = new Set<ClientMeta>();

export function setupWebSocketServer(httpServer: Server): void {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    const meta: ClientMeta = { ws, actorType: 'guest', actorId: null };
    clients.add(meta);

    sendJson(ws, {
      type: 'connected',
      presence: getPresenceSummary(),
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'auth' && typeof msg.token === 'string') {
          const resolved = resolveToken(msg.token);
          if (resolved?.actorType === 'customer' && resolved.customer) {
            meta.actorType = 'customer';
            meta.actorId = resolved.customer.id;
            broadcastPresence();
          } else if (resolved?.actorType === 'admin' && resolved.admin) {
            meta.actorType = 'admin';
            meta.actorId = resolved.admin.id;
            broadcastPresence();
          }
          sendJson(ws, {
            type: 'auth:ack',
            actorType: meta.actorType,
            actorId: meta.actorId,
            presence: getPresenceSummary(),
          });
        } else if (msg.type === 'ping') {
          sendJson(ws, { type: 'pong' });
        }
      } catch {
        // Ignore malformed client packets
      }
    });

    ws.on('close', () => {
      const wasAuthed = meta.actorType !== 'guest';
      clients.delete(meta);
      if (wasAuthed) {
        broadcastPresence();
      }
    });
  });
}

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function getPresenceSummary(): { adminOnline: boolean; onlineUserIds: number[] } {
  let adminOnline = false;
  const userSet = new Set<number>();
  for (const c of clients) {
    if (c.ws.readyState !== WebSocket.OPEN) continue;
    if (c.actorType === 'admin') adminOnline = true;
    if (c.actorType === 'customer' && c.actorId) userSet.add(c.actorId);
  }
  return { adminOnline, onlineUserIds: Array.from(userSet) };
}

function broadcastPresence(): void {
  broadcastAll('presence:update', getPresenceSummary());
}

export function broadcastAll(eventType: string, data: unknown): void {
  const payload = JSON.stringify({ type: eventType, data });
  for (const c of clients) {
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(payload);
    }
  }
}

export function sendToAdmins(eventType: string, data: unknown): void {
  const payload = JSON.stringify({ type: eventType, data });
  for (const c of clients) {
    if (c.ws.readyState === WebSocket.OPEN && c.actorType === 'admin') {
      c.ws.send(payload);
    }
  }
}

export function sendToUser(userId: number, eventType: string, data: unknown): void {
  const payload = JSON.stringify({ type: eventType, data });
  for (const c of clients) {
    if (c.ws.readyState === WebSocket.OPEN && c.actorType === 'customer' && c.actorId === userId) {
      c.ws.send(payload);
    }
  }
}
