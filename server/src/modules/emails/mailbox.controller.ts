/**
 * Webmail (hMailServer): per-user credentials, folders, messages, send.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';
import * as mailboxService from '../../services/mailboxService';

/** GET /api/mailbox/credentials - get my mailbox config (no password). */
export async function getCredentials(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const cred = await mailboxService.getCredentials(userId);
    res.json({ success: true, data: cred });
  } catch (e) {
    next(e);
  }
}

/** PUT /api/mailbox/credentials - save my mailbox config (email, password, IMAP/SMTP). */
export async function setCredentials(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const body = req.body as {
      email?: string;
      password?: string;
      imapHost?: string;
      imapPort?: number;
      imapSecure?: boolean;
      smtpHost?: string;
      smtpPort?: number;
      smtpSecure?: boolean;
    };
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email) return next(new AppError(400, 'Email is required'));
    if (!password) return next(new AppError(400, 'Password is required'));
    await mailboxService.setCredentials(userId, {
      email,
      password,
      imapHost: (body.imapHost || '').trim() || 'localhost',
      imapPort: typeof body.imapPort === 'number' ? body.imapPort : 143,
      imapSecure: !!body.imapSecure,
      smtpHost: (body.smtpHost || '').trim() || 'localhost',
      smtpPort: typeof body.smtpPort === 'number' ? body.smtpPort : 587,
      smtpSecure: !!body.smtpSecure,
    });
    logAuditFromRequest(req, { eventType: 'update', entityType: 'mailbox_credentials', entityId: String(userId) });
    const cred = await mailboxService.getCredentials(userId);
    res.json({ success: true, data: cred });
  } catch (e) {
    next(e);
  }
}

/** GET /api/mailbox/unread-count - total unread across all folders. */
export async function getUnreadCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const folders = await mailboxService.listFolders(userId);
    const count = (folders || []).reduce((sum, f) => sum + (f.unseen ?? 0), 0);
    res.json({ success: true, count });
  } catch (e: unknown) {
    const err = e as Error & { code?: string };
    const msg = (err?.message ?? '').trim();
    if (msg.includes('not configured') || msg.includes('Mailbox not configured')) {
      return res.json({ success: true, count: 0 });
    }
    if (msg.includes('Invalid object name') && msg.includes('UserMailbox')) {
      return res.json({ success: true, count: 0 });
    }
    return res.json({ success: true, count: 0 });
  }
}

/** GET /api/mailbox/folders - list IMAP folders. */
export async function listFolders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const folders = await mailboxService.listFolders(userId);
    res.json({ success: true, data: folders });
  } catch (e: unknown) {
    const err = e as Error & { code?: string };
    console.error('[mailbox/listFolders]', err?.message ?? e);
    const msg = (err?.message ?? '').trim();
    const code = err?.code ?? '';
    if (msg.includes('not configured') || msg.includes('Mailbox not configured')) {
      return next(new AppError(400, msg));
    }
    if (msg.includes('Invalid object name') && msg.includes('UserMailbox')) {
      return next(new AppError(503, 'Mailbox database table is missing. Please run migration 014_user_mailbox.sql.'));
    }
    if (msg.includes('decrypt') || msg.includes('credentials could not be read') || msg.includes('Invalid encrypted')) {
      return next(new AppError(400, 'Mailbox credentials could not be read. Re-save your email and password in Emails > Settings.'));
    }
    if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || msg.includes('connect') || msg.includes('Connection')) {
      return next(new AppError(400, 'Could not connect to mail server. Check IMAP host, port, and SSL in Email Settings.'));
    }
    if (msg.includes('Authentication') || msg.includes('Invalid credentials') || msg.includes('LOGIN')) {
      return next(new AppError(400, 'Mail server rejected login. Check email and password in Email Settings.'));
    }
    if (msg.includes('wrong version number') || msg.includes('SSL routines') || msg.includes('ssl3_get_record') || msg.includes('ECONNRESET') && msg.includes('ssl')) {
      return next(new AppError(400, 'SSL/TLS mismatch: turn IMAP "SSL/TLS" OFF if your server uses port 143 (plain), or ON if it uses port 993. Same for SMTP (port 587 = usually no SSL; 465 = SSL).'));
    }
    // Any other error: return 400 with safe message so we never return 500
    const safeMsg = (msg && msg.length <= 400 && !msg.includes('\n') ? msg : 'Could not load folders. Configure your email in Emails > Settings and try again.');
    return next(new AppError(400, safeMsg));
  }
}

/** GET /api/mailbox/folders/:path/messages - list messages in folder. */
export async function getMessages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const folderPath = decodeURIComponent((req.params as { path: string }).path);
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 50));
    const result = await mailboxService.getMessages(userId, folderPath, page, limit);
    res.json({ success: true, data: result.messages, total: result.total });
  } catch (e: unknown) {
    const err = e as Error;
    const msg = err?.message ?? '';
    if (msg.includes('not configured')) return next(new AppError(400, msg));
    if (msg.includes('Invalid object name') && msg.includes('UserMailbox')) {
      return next(new AppError(503, 'Mailbox database table is missing. Please run migration 014_user_mailbox.sql.'));
    }
    next(e);
  }
}

/** GET /api/mailbox/folders/:path/messages/:uid - get one message body. Query ?seq=N for fallback. */
export async function getMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const folderPath = decodeURIComponent((req.params as { path: string }).path || '');
    const uid = parseInt((req.params as { uid: string }).uid, 10);
    const seq = parseInt(String(req.query?.seq), 10);
    if (!Number.isInteger(uid) || uid < 1) return next(new AppError(400, 'Invalid message uid'));
    const message = await mailboxService.getMessage(userId, folderPath, uid, Number.isInteger(seq) && seq >= 1 ? seq : undefined);
    if (!message) {
      console.warn('[mailbox/getMessage] Message not found:', { folderPath, uid, seq });
      return next(new AppError(404, 'Message not found'));
    }
    res.json({ success: true, data: message });
  } catch (e) {
    next(e);
  }
}

/** PUT /api/mailbox/folders/:path/messages/:uid/read - mark message as read or unread. */
export async function markMessageRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const folderPath = decodeURIComponent((req.params as { path: string }).path);
    const uid = parseInt((req.params as { uid: string }).uid, 10);
    if (!Number.isInteger(uid) || uid < 1) return next(new AppError(400, 'Invalid message uid'));
    const read = (req.body as { read?: boolean }).read !== false;
    await mailboxService.markAsRead(userId, folderPath, uid, read);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** POST /api/mailbox/folders/:path/mark-all-read - mark all messages in folder as read. */
export async function markAllRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const folderPath = decodeURIComponent((req.params as { path: string }).path);
    await mailboxService.markAllAsRead(userId, folderPath);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** POST /api/mailbox/send - send email via user's SMTP. Accepts JSON (attachments base64) or FormData (files in 'attachments' field). */
export async function sendMail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const body = req.body as {
      to?: string;
      cc?: string;
      bcc?: string;
      subject?: string;
      text?: string;
      html?: string;
      attachments?: Array<{ filename: string; content: string; contentType?: string }>;
    };
    const files = (req as any).files as Express.Multer.File[] | undefined;
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    if (!to) return next(new AppError(400, 'To is required'));

    let attachments: Array<{ filename: string; content: string; contentType?: string }> | undefined;
    if (Array.isArray(files) && files.length > 0) {
      attachments = files.map((f) => ({
        filename: f.originalname || f.fieldname || 'attachment',
        content: f.buffer.toString('base64'),
        contentType: f.mimetype || 'application/octet-stream',
      }));
    } else if (Array.isArray(body.attachments) && body.attachments.length > 0) {
      attachments = body.attachments
        .filter((a) => a && typeof a.filename === 'string' && typeof a.content === 'string')
        .map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType }));
    }

    await mailboxService.sendMail(userId, {
      to,
      cc: typeof body.cc === 'string' ? body.cc.trim() : undefined,
      bcc: typeof body.bcc === 'string' ? body.bcc.trim() : undefined,
      subject: typeof body.subject === 'string' ? body.subject.trim() : '(No subject)',
      text: typeof body.text === 'string' ? body.text : undefined,
      html: typeof body.html === 'string' ? body.html : undefined,
      attachments,
    });
    logAuditFromRequest(req, { eventType: 'create', entityType: 'mailbox_message', details: `to ${to}` });
    res.json({ success: true, message: 'Sent' });
  } catch (e) {
    next(e);
  }
}

/** POST /api/mailbox/folders/:path/mark-read - mark selected messages as read or unread. Body: { uids: number[], read: boolean } */
export async function markMessagesRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const folderPath = decodeURIComponent((req.params as { path: string }).path);
    const body = req.body as { uids?: number[]; read?: boolean };
    const uids = Array.isArray(body.uids)
      ? body.uids.filter((u) => typeof u === 'number' && Number.isInteger(u) && u >= 1)
      : [];
    if (!uids.length) return next(new AppError(400, 'uids array is required'));
    const read = body.read !== false;
    await mailboxService.markMultipleAsRead(userId, folderPath, uids, read);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** POST /api/mailbox/folders/:path/delete - move messages to Trash (or permanently delete from Trash). Body: { uids: number[] } */
export async function deleteMessages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const folderPath = decodeURIComponent((req.params as { path: string }).path);
    const body = req.body as { uids?: number[] };
    const uids = Array.isArray(body.uids)
      ? body.uids.filter((u) => typeof u === 'number' && Number.isInteger(u) && u >= 1)
      : [];
    if (!uids.length) return next(new AppError(400, 'uids array is required'));
    await mailboxService.deleteMessages(userId, folderPath, uids);
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'mailbox_message', details: `folder ${folderPath}, ${uids.length} message(s)` });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** PUT /api/mailbox/folders/:path/messages/:uid/flag - toggle a flag on a message. Body: { flag: string, add: boolean } */
export async function toggleFlag(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const folderPath = decodeURIComponent((req.params as { path: string }).path);
    const uid = parseInt((req.params as { uid: string }).uid, 10);
    if (!Number.isInteger(uid) || uid < 1) return next(new AppError(400, 'Invalid message uid'));
    const body = req.body as { flag?: string; add?: boolean };
    const flag = typeof body.flag === 'string' ? body.flag : '\\Flagged';
    const add = body.add !== false;
    await mailboxService.toggleFlag(userId, folderPath, uid, flag, add);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** GET /api/mailbox/folders/:path/search - search messages in folder. Query: ?q=text&limit=100 */
export async function searchMessages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const folderPath = decodeURIComponent((req.params as { path: string }).path);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) return next(new AppError(400, 'Search query (q) is required'));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit), 10) || 100));
    const result = await mailboxService.searchMessages(userId, folderPath, q, limit);
    res.json({ success: true, data: result.messages, total: result.total });
  } catch (e) {
    next(e);
  }
}

/** POST /api/mailbox/folders/:path/archive-all - archive ALL messages in the folder (no limit). */
export async function archiveAllInFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const folderPath = decodeURIComponent((req.params as { path: string }).path);
    const result = await mailboxService.archiveAllInFolder(userId, folderPath);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'mailbox_message', details: `archive all (${result.archived}) from ${folderPath}` });
    res.json({ success: true, archived: result.archived });
  } catch (e) {
    next(e);
  }
}

/** POST /api/mailbox/folders/:path/archive - archive messages. Body: { uids: number[] } */
export async function archiveMessages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const folderPath = decodeURIComponent((req.params as { path: string }).path);
    const body = req.body as { uids?: number[] };
    const uids = Array.isArray(body.uids)
      ? body.uids.filter((u) => typeof u === 'number' && Number.isInteger(u) && u >= 1)
      : [];
    if (!uids.length) return next(new AppError(400, 'uids array is required'));
    await mailboxService.archiveMessages(userId, folderPath, uids);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'mailbox_message', details: `archive ${uids.length} from ${folderPath}` });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** GET /api/mailbox/folders/:path/messages/:uid/attachments/:index - download an attachment by index. */
export async function downloadAttachment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const folderPath = decodeURIComponent((req.params as any).path);
    const uid = parseInt((req.params as any).uid, 10);
    const index = parseInt((req.params as any).index, 10);
    if (!Number.isInteger(uid) || uid < 1) return next(new AppError(400, 'Invalid uid'));
    if (!Number.isInteger(index) || index < 0) return next(new AppError(400, 'Invalid attachment index'));

    const result = await mailboxService.downloadAttachment(userId, folderPath, uid, index);
    if (!result) return next(new AppError(404, 'Attachment not found'));

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.setHeader('Content-Length', result.content.length);
    res.end(result.content);
  } catch (e) {
    next(e);
  }
}
