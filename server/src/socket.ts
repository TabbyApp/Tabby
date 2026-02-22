import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { query } from './db.js';
import { verifyAccessToken } from './middleware/auth.js';

const userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>
let io: Server | null = null;

export function getIo(): Server | null {
  return io;
}

export async function getGroupMemberIds(groupId: string): Promise<string[]> {
  const { rows } = await query<{ user_id: string }>(
    'SELECT user_id FROM group_members WHERE group_id = $1',
    [groupId]
  );
  return rows.map((r) => r.user_id);
}

export function emitToUsers(userIds: string[], event: string, payload: object): void {
  if (!io) return;
  const sent = new Set<string>();
  for (const uid of userIds) {
    const socketIds = userSockets.get(uid);
    if (!socketIds) continue;
    for (const sid of socketIds) {
      if (sent.has(sid)) continue;
      sent.add(sid);
      io.to(sid).emit(event, payload);
    }
  }
}

export async function emitToGroup(groupId: string, event: string, payload: object): Promise<void> {
  const userIds = await getGroupMemberIds(groupId);
  emitToUsers(userIds, event, payload);
}

export function initSocket(server: HttpServer): void {
  io = new Server(server, {
    cors: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL
      ? { origin: process.env.FRONTEND_URL }
      : { origin: true },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    const token =
      (socket.handshake.auth as { token?: string })?.token ||
      (socket.handshake.query as { token?: string }).token;
    if (!token) {
      socket.disconnect(true);
      return;
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      socket.disconnect(true);
      return;
    }
    const userId = payload.userId;
    socket.data.userId = userId;

    let set = userSockets.get(userId);
    if (!set) {
      set = new Set();
      userSockets.set(userId, set);
    }
    set.add(socket.id);

    socket.on('disconnect', () => {
      const s = userSockets.get(userId);
      if (s) {
        s.delete(socket.id);
        if (s.size === 0) userSockets.delete(userId);
      }
    });
  });
}
