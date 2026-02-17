/**
 * Socket.IO namespace /realtime for dashboard and entity updates.
 */

import { Server as HttpServer } from 'http';
import { Server, Namespace } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../utils/config';
import { JwtPayload } from '../middleware/auth';
import * as chatService from '../services/chatService';

let io: Server;
let realtimeNs: Namespace;

const onlineUserIds = new Set<number>();
const awayUserIds = new Set<number>();

export function getRealtimeNamespace(): Namespace {
  return realtimeNs;
}

export function setupRealtime(server: HttpServer): void {
  const allowAllOrigins = config.corsAllowedOrigins.some((o) => o === '*' || o === 'true');
  io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: allowAllOrigins ? true : config.corsAllowedOrigins,
      credentials: true,
    },
  });

  realtimeNs = io.of('/realtime');
  realtimeNs.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(String(token), config.jwt.secret) as JwtPayload;
      (socket as any).userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  realtimeNs.on('connection', (socket) => {
    const rawUserId = (socket as any).userId;
    const userId = rawUserId != null ? Number(rawUserId) : null;
    if (userId != null && !Number.isNaN(userId)) {
      (socket as any).userId = userId;
    }
    console.log('Realtime client connected:', userId);
    if (userId != null && !Number.isNaN(userId)) {
      socket.join(`user:${userId}`);
      awayUserIds.delete(userId);
      onlineUserIds.add(userId);
      realtimeNs.emit('user:online', { userId: Number(userId) });
      chatService.updateLastSeen(userId).catch(() => {});
      socket.emit('presence:list', {
        onlineUserIds: Array.from(onlineUserIds).map(Number),
        awayUserIds: Array.from(awayUserIds).map(Number),
      });
    }
    socket.on('disconnect', () => {
      if (userId != null && !Number.isNaN(userId)) {
        onlineUserIds.delete(userId);
        awayUserIds.delete(userId);
        realtimeNs.emit('user:offline', { userId: Number(userId) });
      }
      console.log('Realtime client disconnected');
    });
    socket.on('presence:away', () => {
      if (userId != null && !Number.isNaN(userId) && onlineUserIds.has(userId)) {
        awayUserIds.add(userId);
        realtimeNs.emit('user:away', { userId: Number(userId) });
      }
    });
    socket.on('presence:online', () => {
      if (userId != null && !Number.isNaN(userId)) {
        awayUserIds.delete(userId);
        onlineUserIds.add(userId);
        realtimeNs.emit('user:online', { userId: Number(userId) });
      }
    });
    socket.on('kanban:reorder-asset', (payload: { columnKey?: string; order?: number[] }) => {
      if (payload && typeof payload.columnKey === 'string' && Array.isArray(payload.order)) {
        realtimeNs.emit('asset:kanban-order', { columnKey: payload.columnKey, order: payload.order });
      }
    });
    socket.on('kanban:reorder-ticket', (payload: { columnKey?: string; order?: number[] }) => {
      if (payload && typeof payload.columnKey === 'string' && Array.isArray(payload.order)) {
        realtimeNs.emit('ticket:kanban-order', { columnKey: payload.columnKey, order: payload.order });
      }
    });
  });
}

/** Send a chat message to a specific user (they must be in room user:userId). */
export function emitChatMessage(
  toUserId: number,
  payload: {
    messageId: number;
    senderUserId: number;
    receiverUserId: number;
    senderName: string;
    messageText: string;
    sentAt: string;
    attachmentFileId?: number;
    attachmentFileName?: string;
    attachmentMimeType?: string;
    attachmentAccessToken?: string;
  }
): void {
  if (realtimeNs) realtimeNs.to(`user:${toUserId}`).emit('chat:message', payload);
}

/** Notify sender that their messages were delivered to the recipient. */
export function emitMessagesDelivered(
  senderUserId: number,
  payload: { messageIds: number[]; deliveredAt: string }
): void {
  if (realtimeNs) realtimeNs.to(`user:${senderUserId}`).emit('chat:messages-delivered', payload);
}

/** Notify sender that their messages were read by the recipient. */
export function emitMessagesRead(
  senderUserId: number,
  payload: { messageIds: number[]; readAt: string }
): void {
  if (realtimeNs) realtimeNs.to(`user:${senderUserId}`).emit('chat:messages-read', payload);
}

/** Notify the other user when someone reacts to a message (so UI updates without refresh). */
export function emitChatReaction(
  toUserId: number,
  payload: {
    messageId: number;
    senderUserId: number;
    receiverUserId: number;
    reactions: { emoji: string; count: number; you: boolean }[];
    reactorUserId: number;
    reactorName: string;
    added: boolean;
  }
): void {
  if (realtimeNs) realtimeNs.to(`user:${toUserId}`).emit('chat:reaction', payload);
}

export function emitDashboardUpdate(): void {
  if (realtimeNs) realtimeNs.emit('dashboard:update');
}

/** Emit when a new asset is created so dashboards can show a toast (asset tag + who added it). */
export function emitNewAsset(payload: { assetId: number; assetTag: string; addedByUserId: number; addedByName: string }): void {
  if (realtimeNs) realtimeNs.emit('dashboard:new-asset', payload);
}

export function emitAssetChanged(
  assetId: number,
  details?: { status?: string; userName?: string; assignedToUserId?: number | null; assignedToUserName?: string | null }
): void {
  if (realtimeNs) realtimeNs.emit('asset:changed', { assetId, ...details });
}

export function emitTicketChanged(ticketId: number, details?: { status: string; userName: string }): void {
  if (realtimeNs) realtimeNs.emit('ticket:changed', { ticketId, ...details });
}
export function emitAuditNew(): void {
  if (realtimeNs) realtimeNs.emit('audit:new');
}

/** Broadcast calendar event created/updated so all clients can refresh or merge. */
export function emitCalendarEventCreated(payload: { id: number; title: string; start: string; end: string | null; allDay: boolean; category: string; createdByUserId: number; createdAt: string; updatedAt: string }): void {
  if (realtimeNs) realtimeNs.emit('calendar:event-created', payload);
}

export function emitCalendarEventUpdated(payload: { id: number; title: string; start: string; end: string | null; allDay: boolean; category: string; createdByUserId: number; createdAt: string; updatedAt: string }): void {
  if (realtimeNs) realtimeNs.emit('calendar:event-updated', payload);
}

export function emitCalendarEventDeleted(eventId: number): void {
  if (realtimeNs) realtimeNs.emit('calendar:event-deleted', { eventId });
}
