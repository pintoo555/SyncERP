/**
 * Chat: conversations, message history, send message, upload attachment, download attachment.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { getRequest } from '../../config/db';
import * as apiConfigService from '../../services/apiConfigService';
import * as chatService from './chat.service';
import * as fileService from '../../services/fileService';
import { emitChatMessage, emitMessagesDelivered, emitMessagesRead, emitChatReaction } from '../../realtime/setup';
import { improveMessage } from './chat.improve';
import fs from 'fs';

/** GET /api/chat/ai-models – list active AI-only configs for chat improve (excludes GSTZEN etc.). */
export async function getAIModels(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await apiConfigService.listActiveAiForDropdown();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/** List users for "Start a chat" - auth only (no USERS.VIEW required). */
export async function getChatUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myUserId = req.user?.userId;
    if (myUserId == null) return next(new AppError(401, 'Unauthorized'));
    const reqDb = await getRequest();
    const result = await reqDb
      .input('myUserId', myUserId)
      .query(`
        SELECT UserId AS userId, Name AS name, Email AS email
        FROM utbl_Users_Master
        WHERE IsActive = 1 AND UserId != @myUserId
        ORDER BY Name
      `);
    const data = (result.recordset || []) as { userId: number; name: string; email: string }[];
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getConversations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const data = await chatService.getConversations(userId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const count = await chatService.getUnreadCount(userId);
    res.json({ success: true, count });
  } catch (e) {
    next(e);
  }
}

export async function getMessages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const withUserId = parseInt(String(req.query.with ?? ''), 10);
    if (Number.isNaN(withUserId)) return next(new AppError(400, 'Query "with" (user id) is required'));
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || 40), 10) || 40));
    const beforeRaw = req.query.before;
    const beforeMessageId = beforeRaw != null && beforeRaw !== '' ? parseInt(String(beforeRaw), 10) : undefined;
    const data = await chatService.getMessages(userId, withUserId, limit, beforeMessageId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const body = req.body as { toUserId?: number; text?: string; attachmentFileId?: number; replyToMessageId?: number };
    const toUserId = parseInt(String(body.toUserId), 10);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const attachmentFileId = body.attachmentFileId != null ? Number(body.attachmentFileId) : undefined;
    const replyToMessageId = body.replyToMessageId != null ? Number(body.replyToMessageId) : undefined;
    if (Number.isNaN(toUserId) || toUserId === userId) return next(new AppError(400, 'Valid toUserId required'));
    if (text.length === 0 && (attachmentFileId == null || attachmentFileId === 0)) {
      return next(new AppError(400, 'Message text or attachment required'));
    }
    const message = await chatService.sendMessage(userId, toUserId, text, attachmentFileId, replyToMessageId);
    await chatService.updateLastSeen(userId);
    emitChatMessage(toUserId, {
      messageId: message.messageId,
      senderUserId: message.senderUserId,
      receiverUserId: message.receiverUserId,
      senderName: message.senderName,
      messageText: message.messageText,
      sentAt: message.sentAt,
      ...(message.attachmentFileId != null && message.attachmentFileId > 0
        ? {
            attachmentFileId: message.attachmentFileId,
            attachmentFileName: message.attachmentFileName ?? undefined,
            attachmentMimeType: message.attachmentMimeType ?? undefined,
            attachmentAccessToken: message.attachmentAccessToken ?? undefined,
          }
        : {}),
      ...(message.replyToMessageId != null ? { replyToMessageId: message.replyToMessageId, replyToPreview: message.replyToPreview, replyToSenderName: message.replyToSenderName } : {}),
    });
    res.status(201).json({ success: true, data: message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to send message';
    console.error('Chat sendMessage error:', msg, e instanceof Error ? e.stack : '');
    next(new AppError(500, msg));
  }
}

/** POST /api/chat/improve – improve message text using AI. */
export async function improveMessageHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const body = req.body as { text?: string; variant?: 'professional' | 'friendly' | 'concise'; serviceCode?: string };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return next(new AppError(400, 'Text is required'));
    const result = await improveMessage(text, body.variant, {
      serviceCode: body.serviceCode ?? null,
      userId,
    });
    res.json({ success: true, data: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to improve message';
    next(new AppError(400, msg));
  }
}

export async function getLastSeen(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const targetUserId = parseInt(String(req.params.userId ?? ''), 10);
    if (Number.isNaN(targetUserId)) return next(new AppError(400, 'User ID required'));
    const lastSeenAt = await chatService.getLastSeen(targetUserId);
    res.json({ success: true, data: { lastSeenAt } });
  } catch (e) {
    next(e);
  }
}

export async function markDelivered(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myUserId = req.user?.userId;
    if (myUserId == null) return next(new AppError(401, 'Unauthorized'));
    const body = req.body as { withUserId?: number; messageIds?: number[] };
    const withUserId = typeof body.withUserId === 'number' ? body.withUserId : parseInt(String(body.withUserId), 10);
    const messageIds = Array.isArray(body.messageIds) ? body.messageIds.filter((id) => typeof id === 'number') : [];
    if (Number.isNaN(withUserId) || messageIds.length === 0) {
      return next(new AppError(400, 'withUserId and messageIds (array) required'));
    }
    const result = await chatService.markMessagesDelivered(myUserId, withUserId, messageIds);
    if (result) emitMessagesDelivered(withUserId, { messageIds: result.messageIds, deliveredAt: result.deliveredAt });
    res.json({ success: true, data: result ?? { messageIds: [], deliveredAt: null } });
  } catch (e) {
    next(e);
  }
}

export async function markRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const myUserId = req.user?.userId;
    if (myUserId == null) return next(new AppError(401, 'Unauthorized'));
    const body = req.body as { withUserId?: number; messageIds?: number[] };
    const withUserId = typeof body.withUserId === 'number' ? body.withUserId : parseInt(String(body.withUserId), 10);
    const messageIds = Array.isArray(body.messageIds) ? body.messageIds.filter((id) => typeof id === 'number') : [];
    if (Number.isNaN(withUserId)) return next(new AppError(400, 'withUserId required'));
    const result = messageIds.length > 0
      ? await chatService.markMessagesRead(myUserId, withUserId, messageIds)
      : await chatService.markAllMessagesRead(myUserId, withUserId);
    if (result) {
      emitMessagesRead(withUserId, { messageIds: result.messageIds, readAt: result.readAt });
      await chatService.updateLastSeen(myUserId);
    }
    res.json({ success: true, data: result ?? { messageIds: [], readAt: null } });
  } catch (e) {
    next(e);
  }
}

/** POST /api/chat/upload - upload file for chat (voice, image, etc.). Returns fileId for use in send. */
export async function uploadChatFile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const file = (req as any).file;
    if (!file || !file.buffer) return next(new AppError(400, 'No file uploaded'));
    const { file: saved } = await fileService.saveFileForChat(
      file.buffer,
      file.originalname || 'file',
      file.mimetype || 'application/octet-stream',
      userId
    );
    res.status(201).json({
      success: true,
      data: {
        fileId: saved.fileId,
        originalFileName: saved.originalFileName,
        mimeType: saved.mimeType,
        ...(saved.accessToken != null ? { accessToken: saved.accessToken } : {}),
      },
    });
  } catch (e) {
    next(e);
  }
}

/** GET /api/chat/attachment/:tokenOrId - stream chat attachment by unguessable token or legacy numeric fileId (only if user has access). */
export async function getChatAttachment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const tokenOrId = String(req.params.tokenOrId ?? req.params.fileId ?? '').trim();
    if (!tokenOrId) return next(new AppError(400, 'Invalid attachment reference'));

    let record: Awaited<ReturnType<typeof fileService.getFileById>> | null;
    let fileId: number;

    if (/^\d+$/.test(tokenOrId)) {
      fileId = parseInt(tokenOrId, 10);
      record = await fileService.getFileById(fileId);
    } else {
      record = await fileService.getFileByChatToken(tokenOrId);
      fileId = record?.file.fileId ?? 0;
    }

    if (!record) return next(new AppError(404, 'File not found'));
    const canAccess = await chatService.canAccessChatFile(userId, fileId);
    if (!canAccess) return next(new AppError(403, 'Access denied to this file'));
    if (!fs.existsSync(record.absolutePath)) return next(new AppError(404, 'File not found'));
    const disposition = record.file.originalFileName
      ? `inline; filename="${record.file.originalFileName.replace(/"/g, '\\"')}"`
      : 'inline';
    res.setHeader('Content-Type', record.file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', disposition);
    const stream = fs.createReadStream(record.absolutePath);
    stream.on('error', (err) => { if (!res.headersSent) next(err); });
    stream.pipe(res);
  } catch (e) {
    next(e);
  }
}

/** POST /api/chat/message/:messageId/react - set emoji reaction. */
export async function reactToMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const messageId = parseInt(String(req.params.messageId), 10);
    const body = req.body as { emoji?: string };
    const emoji = typeof body.emoji === 'string' ? body.emoji.trim().slice(0, 32) : '👍';
    if (Number.isNaN(messageId)) return next(new AppError(400, 'Invalid message ID'));
    await chatService.setReaction(messageId, userId, emoji);
    const participants = await chatService.getMessageParticipants(messageId);
    if (participants) {
      const otherUserId = participants.senderUserId === userId ? participants.receiverUserId : participants.senderUserId;
      const reactions = await chatService.getReactionsForMessage(messageId, otherUserId);
      let reactorName = 'Someone';
      try {
        const nameRes = await getRequest().then((r) => r.input('userId', userId).query(`SELECT Name FROM utbl_Users_Master WHERE UserId = @userId`));
        const nameRow = nameRes.recordset?.[0] as { Name?: string } | undefined;
        if (nameRow?.Name) reactorName = nameRow.Name;
      } catch {
        // ignore
      }
      emitChatReaction(otherUserId, {
        messageId,
        senderUserId: participants.senderUserId,
        receiverUserId: participants.receiverUserId,
        reactions,
        reactorUserId: userId,
        reactorName,
        added: true,
      });
    }
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/chat/message/:messageId/react - remove reaction. */
export async function removeReaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const messageId = parseInt(String(req.params.messageId), 10);
    if (Number.isNaN(messageId)) return next(new AppError(400, 'Invalid message ID'));
    await chatService.removeReaction(messageId, userId);
    const participants = await chatService.getMessageParticipants(messageId);
    if (participants) {
      const otherUserId = participants.senderUserId === userId ? participants.receiverUserId : participants.senderUserId;
      const reactions = await chatService.getReactionsForMessage(messageId, otherUserId);
      let reactorName = 'Someone';
      try {
        const nameRes = await getRequest().then((r) => r.input('userId', userId).query(`SELECT Name FROM utbl_Users_Master WHERE UserId = @userId`));
        const nameRow = nameRes.recordset?.[0] as { Name?: string } | undefined;
        if (nameRow?.Name) reactorName = nameRow.Name;
      } catch {
        // ignore
      }
      emitChatReaction(otherUserId, {
        messageId,
        senderUserId: participants.senderUserId,
        receiverUserId: participants.receiverUserId,
        reactions,
        reactorUserId: userId,
        reactorName,
        added: false,
      });
    }
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** POST /api/chat/message/:messageId/forward - forward to user. */
export async function forwardMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const messageId = parseInt(String(req.params.messageId), 10);
    const body = req.body as { toUserId?: number };
    const toUserId = parseInt(String(body.toUserId), 10);
    if (Number.isNaN(messageId)) return next(new AppError(400, 'Invalid message ID'));
    if (Number.isNaN(toUserId) || toUserId === userId) return next(new AppError(400, 'Valid toUserId required'));
    const message = await chatService.forwardMessage(messageId, userId, toUserId);
    await chatService.updateLastSeen(userId);
    emitChatMessage(toUserId, {
      messageId: message.messageId,
      senderUserId: message.senderUserId,
      receiverUserId: message.receiverUserId,
      senderName: message.senderName,
      messageText: message.messageText,
      sentAt: message.sentAt,
      ...(message.attachmentFileId != null ? {
        attachmentFileId: message.attachmentFileId,
        attachmentFileName: message.attachmentFileName ?? undefined,
        attachmentMimeType: message.attachmentMimeType ?? undefined,
        attachmentAccessToken: message.attachmentAccessToken ?? undefined,
      } : {}),
    });
    res.status(201).json({ success: true, data: message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Forward failed';
    next(new AppError(400, msg));
  }
}

/** POST /api/chat/message/:messageId/delete - delete for me or for everyone. */
export async function deleteMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const messageId = parseInt(String(req.params.messageId), 10);
    const body = req.body as { forEveryone?: boolean };
    if (Number.isNaN(messageId)) return next(new AppError(400, 'Invalid message ID'));
    if (body.forEveryone === true) {
      await chatService.deleteMessageForEveryone(messageId, userId);
    } else {
      await chatService.deleteMessageForMe(messageId, userId);
    }
    res.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Delete failed';
    next(new AppError(400, msg));
  }
}

/** POST /api/chat/message/:messageId/star - star message. */
export async function starMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const messageId = parseInt(String(req.params.messageId), 10);
    if (Number.isNaN(messageId)) return next(new AppError(400, 'Invalid message ID'));
    await chatService.starMessage(messageId, userId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/chat/message/:messageId/star - unstar message. */
export async function unstarMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const messageId = parseInt(String(req.params.messageId), 10);
    if (Number.isNaN(messageId)) return next(new AppError(400, 'Invalid message ID'));
    await chatService.unstarMessage(messageId, userId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** POST /api/chat/message/:messageId/pin - pin message (like WhatsApp). */
export async function pinMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const messageId = parseInt(String(req.params.messageId), 10);
    if (Number.isNaN(messageId)) return next(new AppError(400, 'Invalid message ID'));
    await chatService.pinMessage(messageId, userId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/chat/message/:messageId/pin - unpin message. */
export async function unpinMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const messageId = parseInt(String(req.params.messageId), 10);
    if (Number.isNaN(messageId)) return next(new AppError(400, 'Invalid message ID'));
    await chatService.unpinMessage(messageId, userId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
