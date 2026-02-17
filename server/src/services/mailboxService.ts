/**
 * Per-user mailbox (hMailServer): credentials storage and IMAP/SMTP operations.
 */

import { simpleParser } from 'mailparser';
import { getRequest } from '../db/pool';
import { config } from '../utils/config';
import { encryptMailboxPassword, decryptMailboxPassword } from '../utils/mailboxCrypto';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

const SCHEMA = config.db.schema || 'dbo';
const TABLE = `[${SCHEMA}].[react_UserMailbox]`;
const PROFILE_TABLE = `[${SCHEMA}].[hrms_EmployeeProfile]`;

const DEFAULT_IMAP_HOST = process.env.MAILBOX_IMAP_HOST || 'localhost';
const DEFAULT_IMAP_PORT = parseInt(process.env.MAILBOX_IMAP_PORT || '143', 10);
const DEFAULT_IMAP_SECURE = (process.env.MAILBOX_IMAP_SECURE || '').toLowerCase() === 'true';
const DEFAULT_SMTP_HOST = process.env.MAILBOX_SMTP_HOST || 'localhost';
const DEFAULT_SMTP_PORT = parseInt(process.env.MAILBOX_SMTP_PORT || '587', 10);
const DEFAULT_SMTP_SECURE = (process.env.MAILBOX_SMTP_SECURE || '').toLowerCase() === 'true';

export interface MailboxCredentials {
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

export interface MailboxCredentialsWithPassword extends MailboxCredentials {
  password: string;
}

export interface MailFolder {
  name: string;
  path: string;
  flags: string[];
  exists?: number;
  unseen?: number;
}

export interface MailEnvelope {
  date?: Date | string;
  subject?: string;
  from?: Array<{ address?: string; name?: string }>;
  to?: Array<{ address?: string; name?: string }>;
  cc?: Array<{ address?: string; name?: string }>;
}

export interface MailMessageHeader {
  uid: number;
  seq?: number;
  envelope: MailEnvelope;
  flags: string[];
  hasAttachments?: boolean;
}

export interface MailMessageBody {
  uid: number;
  envelope?: MailEnvelope;
  text: string | null;
  html: string | null;
  attachments: Array<{ filename: string; contentType: string; size: number; index: number }>;
}

async function getCredentialsRow(userId: number): Promise<{
  Email: string;
  EncryptedPassword: string;
  ImapHost: string;
  ImapPort: number;
  ImapSecure: boolean;
  SmtpHost: string;
  SmtpPort: number;
  SmtpSecure: boolean;
} | null> {
  const req = await getRequest();
  const profileResult = await req.input('userId', userId).query(`
    SELECT InternalEmail AS Email, InternalEmailPassword AS EncryptedPassword
    FROM ${PROFILE_TABLE} WHERE UserID = @userId AND InternalEmail IS NOT NULL AND InternalEmail <> '' AND InternalEmailPassword IS NOT NULL
  `);
  const profileRow = (profileResult.recordset as any[])?.[0];
  if (profileRow?.Email && profileRow?.EncryptedPassword) {
    return {
      Email: profileRow.Email,
      EncryptedPassword: profileRow.EncryptedPassword,
      ImapHost: DEFAULT_IMAP_HOST,
      ImapPort: DEFAULT_IMAP_PORT,
      ImapSecure: DEFAULT_IMAP_SECURE,
      SmtpHost: DEFAULT_SMTP_HOST,
      SmtpPort: DEFAULT_SMTP_PORT,
      SmtpSecure: DEFAULT_SMTP_SECURE,
    };
  }
  const result = await req.input('userId', userId).query(`
    SELECT Email, EncryptedPassword, ImapHost, ImapPort, ImapSecure, SmtpHost, SmtpPort, SmtpSecure
    FROM ${TABLE} WHERE UserId = @userId
  `);
  const row = (result.recordset as any[])?.[0];
  return row ?? null;
}

/** Get credentials for API response (no password). */
export async function getCredentials(userId: number): Promise<MailboxCredentials | null> {
  const row = await getCredentialsRow(userId);
  if (!row) return null;
  return {
    email: row.Email,
    imapHost: row.ImapHost,
    imapPort: row.ImapPort,
    imapSecure: !!row.ImapSecure,
    smtpHost: row.SmtpHost,
    smtpPort: row.SmtpPort,
    smtpSecure: !!row.SmtpSecure,
  };
}

/** Get credentials with decrypted password (for IMAP/SMTP). */
export async function getCredentialsWithPassword(userId: number): Promise<MailboxCredentialsWithPassword | null> {
  const row = await getCredentialsRow(userId);
  if (!row) return null;
  let password: string;
  try {
    password = decryptMailboxPassword(row.EncryptedPassword);
  } catch {
    throw new Error('Mailbox credentials could not be read. Please re-save your password in Email Settings.');
  }
  return {
    email: row.Email,
    imapHost: row.ImapHost,
    imapPort: row.ImapPort,
    imapSecure: !!row.ImapSecure,
    smtpHost: row.SmtpHost,
    smtpPort: row.SmtpPort,
    smtpSecure: !!row.SmtpSecure,
    password,
  };
}

export async function setCredentials(userId: number, data: MailboxCredentials & { password: string }): Promise<void> {
  const req = await getRequest();
  const encrypted = encryptMailboxPassword(data.password);
  await req
    .input('userId', userId)
    .input('email', (data.email || '').trim().slice(0, 256))
    .input('encryptedPassword', encrypted)
    .input('imapHost', (data.imapHost || '').trim().slice(0, 256))
    .input('imapPort', data.imapPort ?? 143)
    .input('imapSecure', data.imapSecure ? 1 : 0)
    .input('smtpHost', (data.smtpHost || '').trim().slice(0, 256))
    .input('smtpPort', data.smtpPort ?? 587)
    .input('smtpSecure', data.smtpSecure ? 1 : 0)
    .query(`
      MERGE ${TABLE} AS t
      USING (SELECT @userId AS UserId, @email AS Email, @encryptedPassword AS EncryptedPassword,
                    @imapHost AS ImapHost, @imapPort AS ImapPort, @imapSecure AS ImapSecure,
                    @smtpHost AS SmtpHost, @smtpPort AS SmtpPort, @smtpSecure AS SmtpSecure) AS s
      ON t.UserId = s.UserId
      WHEN MATCHED THEN UPDATE SET
        Email = s.Email, EncryptedPassword = s.EncryptedPassword,
        ImapHost = s.ImapHost, ImapPort = s.ImapPort, ImapSecure = s.ImapSecure,
        SmtpHost = s.SmtpHost, SmtpPort = s.SmtpPort, SmtpSecure = s.SmtpSecure,
        UpdatedAt = SYSDATETIME()
      WHEN NOT MATCHED THEN INSERT (UserId, Email, EncryptedPassword, ImapHost, ImapPort, ImapSecure, SmtpHost, SmtpPort, SmtpSecure)
      VALUES (s.UserId, s.Email, s.EncryptedPassword, s.ImapHost, s.ImapPort, s.ImapSecure, s.SmtpHost, s.SmtpPort, s.SmtpSecure);
    `);
}

function createImapClient(cred: MailboxCredentialsWithPassword): ImapFlow {
  return new ImapFlow({
    host: cred.imapHost,
    port: cred.imapPort,
    secure: cred.imapSecure,
    auth: { user: cred.email, pass: cred.password },
    logger: false,
  });
}

/** Extract attachment parts from IMAP BODYSTRUCTURE. */
function extractAttachmentParts(structure: any): Array<{ partId: string; filename: string; contentType: string; size: number }> {
  const attachments: Array<{ partId: string; filename: string; contentType: string; size: number }> = [];
  function walk(node: any) {
    if (!node) return;
    const disp = (node.disposition || '').toLowerCase();
    const type = (node.type || '').toLowerCase();
    const filename = node.dispositionParameters?.filename || node.parameters?.name || '';
    if (disp === 'attachment' || (filename && type !== 'text/plain' && type !== 'text/html')) {
      attachments.push({
        partId: node.part || '1',
        filename: filename || 'attachment',
        contentType: type || 'application/octet-stream',
        size: node.size || 0,
      });
    }
    if (node.childNodes) {
      for (const child of node.childNodes) walk(child);
    }
  }
  walk(structure);
  return attachments;
}

/** Check if BODYSTRUCTURE has any attachment parts. */
function hasAttachmentsInStructure(structure: any): boolean {
  if (!structure) return false;
  const disp = (structure.disposition || '').toLowerCase();
  const filename = structure.dispositionParameters?.filename || structure.parameters?.name || '';
  const type = (structure.type || '').toLowerCase();
  if (disp === 'attachment' || (filename && type !== 'text/plain' && type !== 'text/html')) return true;
  if (structure.childNodes) {
    return structure.childNodes.some((child: any) => hasAttachmentsInStructure(child));
  }
  return false;
}

/** List folders (INBOX, Sent, etc.). */
export async function listFolders(userId: number): Promise<MailFolder[]> {
  const cred = await getCredentialsWithPassword(userId);
  if (!cred) throw new Error('Mailbox not configured. Save your email settings first.');
  const client = createImapClient(cred);
  try {
    await client.connect();
    let list: Array<{ name: string; path: string; flags?: Set<string>; status?: { messages?: number; unseen?: number } }>;
    try {
      list = await client.list({ statusQuery: { messages: true, unseen: true } }) as any[];
    } catch {
      list = await client.list() as any[];
    }
    return list.map((b) => ({
      name: b.name,
      path: b.path,
      flags: b.flags ? Array.from(b.flags) : [],
      exists: b.status?.messages,
      unseen: b.status?.unseen,
    }));
  } finally {
    client.logout().catch(() => {});
  }
}

/** Normalize folder path for IMAP (INBOX is case-insensitive per RFC 3501). */
function normalizeFolderPath(path: string): string {
  const p = path?.trim();
  return (p?.toUpperCase() === 'INBOX') ? 'INBOX' : (p || path);
}

/** Get message list for a folder. */
export async function getMessages(
  userId: number,
  folderPath: string,
  page: number = 1,
  limit: number = 50
): Promise<{ messages: MailMessageHeader[]; total: number }> {
  const cred = await getCredentialsWithPassword(userId);
  if (!cred) throw new Error('Mailbox not configured.');
  const client = createImapClient(cred);
  try {
    await client.connect();
    const pathToUse = normalizeFolderPath(folderPath);
    const mailbox = await client.mailboxOpen(pathToUse);
    const total = mailbox.exists ?? 0;
    const start = Math.max(1, total - (page - 1) * limit - limit + 1);
    const end = Math.max(1, total - (page - 1) * limit);
    if (start > end) {
      return { messages: [], total };
    }
    const range = `${start}:${end}`;
    const messages: MailMessageHeader[] = [];
    const lock = await client.getMailboxLock(pathToUse);
    try {
      for await (const msg of client.fetch(range, { envelope: true, uid: true, flags: true, bodyStructure: true })) {
        const env = msg.envelope as MailEnvelope;
        if (env?.date && typeof env.date === 'object') (env as any).date = (env.date as Date).toISOString();
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          envelope: env,
          flags: msg.flags ? Array.from(msg.flags) : [],
          hasAttachments: hasAttachmentsInStructure((msg as any).bodyStructure),
        });
      }
    } finally {
      lock.release();
    }
    messages.reverse();
    return { messages, total };
  } finally {
    client.logout().catch(() => {});
  }
}

/** Get single message body. Marks message as read when opened (IMAP \\Seen flag). Tries UID first, then seq as fallback. */
export async function getMessage(
  userId: number,
  folderPath: string,
  uid: number,
  seq?: number
): Promise<MailMessageBody | null> {
  const cred = await getCredentialsWithPassword(userId);
  if (!cred) throw new Error('Mailbox not configured.');
  const client = createImapClient(cred);
  try {
    await client.connect();
    const pathToUse = normalizeFolderPath(folderPath);
    const lock = await client.getMailboxLock(pathToUse);
    const query = { source: true, envelope: true, uid: true, flags: true, bodyStructure: true };
    let msg: { uid?: number; source?: Buffer; envelope?: MailEnvelope; flags?: Set<string>; bodyStructure?: any } | null = null;
    try {
      const byUid = await client.fetchAll(`${uid}:${uid}`, query, { uid: true });
      msg = byUid?.[0] ?? null;
      if (!msg && seq != null && seq >= 1) {
        const bySeq = await client.fetchAll(String(seq), query, { uid: false });
        msg = bySeq?.[0] ?? null;
      }
      if (!msg || !msg.source) return null;
      const source = msg.source as Buffer;
      const parsed = await parseSimpleMail(source);
      const env = msg.envelope as MailEnvelope | undefined;
      if (env?.date && typeof env.date === 'object') (env as any).date = (env.date as Date).toISOString();
      const resultUid = msg.uid ?? uid;
      const result: MailMessageBody = {
        uid: resultUid,
        envelope: env,
        text: parsed.text,
        html: parsed.html,
        attachments: parsed.attachments.map((att, idx) => ({ ...att, index: idx })),
      };
      const isUnread = !msg.flags?.has('\\Seen') && !msg.flags?.has('Seen');
      if (isUnread) {
        await client.messageFlagsAdd(String(resultUid), ['\\Seen'], { uid: true });
      }
      return result;
    } finally {
      lock.release();
    }
  } finally {
    client.logout().catch(() => {});
  }
}

/** Simple mail parser: extract text, html, attachment metadata with size. */
async function parseSimpleMail(source: Buffer): Promise<{ text: string | null; html: string | null; attachments: Array<{ filename: string; contentType: string; size: number }> }> {
  const parsed = await simpleParser(source);
  const attachments = (parsed.attachments || []).map((a: any) => ({
    filename: a.filename || 'attachment',
    contentType: a.contentType || 'application/octet-stream',
    size: a.size || (a.content?.length ?? 0),
  }));
  return {
    text: parsed.text ?? null,
    html: parsed.html ?? null,
    attachments,
  };
}

/** Mark a single message as read or unread. */
export async function markAsRead(
  userId: number,
  folderPath: string,
  uid: number,
  read: boolean
): Promise<void> {
  const cred = await getCredentialsWithPassword(userId);
  if (!cred) throw new Error('Mailbox not configured.');
  const client = createImapClient(cred);
  try {
    await client.connect();
    const pathToUse = normalizeFolderPath(folderPath);
    const lock = await client.getMailboxLock(pathToUse);
    try {
      if (read) {
        await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
      } else {
        await client.messageFlagsRemove(String(uid), ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    client.logout().catch(() => {});
  }
}

/** Mark multiple messages as read by UID. */
export async function markMultipleAsRead(
  userId: number,
  folderPath: string,
  uids: number[],
  read: boolean
): Promise<void> {
  if (!uids.length) return;
  const cred = await getCredentialsWithPassword(userId);
  if (!cred) throw new Error('Mailbox not configured.');
  const client = createImapClient(cred);
  try {
    await client.connect();
    const pathToUse = normalizeFolderPath(folderPath);
    const lock = await client.getMailboxLock(pathToUse);
    try {
      const range = uids.join(',');
      if (read) {
        await client.messageFlagsAdd(range, ['\\Seen'], { uid: true });
      } else {
        await client.messageFlagsRemove(range, ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    client.logout().catch(() => {});
  }
}

/** Batch size for mark-all-read to avoid IMAP/server limits on large ranges. */
const MARK_READ_BATCH_SIZE = 500;

/** Mark all messages in a folder as read. Uses batched UID STORE to handle large mailboxes (e.g. 17k+ unread). */
export async function markAllAsRead(userId: number, folderPath: string): Promise<void> {
  const cred = await getCredentialsWithPassword(userId);
  if (!cred) throw new Error('Mailbox not configured.');
  const client = createImapClient(cred);
  try {
    await client.connect();
    const pathToUse = normalizeFolderPath(folderPath);
    const lock = await client.getMailboxLock(pathToUse);
    try {
      const uidsRaw = await client.search({ seen: false }, { uid: true });
      const uids = Array.isArray(uidsRaw) ? uidsRaw : [];
      if (!uids.length) return;
      for (let i = 0; i < uids.length; i += MARK_READ_BATCH_SIZE) {
        const batch = uids.slice(i, i + MARK_READ_BATCH_SIZE);
        const range = batch.join(',');
        await client.messageFlagsAdd(range, ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    client.logout().catch(() => {});
  }
}

/** Move messages to Trash folder (or permanently delete if already in Trash). */
export async function deleteMessages(
  userId: number,
  folderPath: string,
  uids: number[]
): Promise<void> {
  if (!uids.length) return;
  const cred = await getCredentialsWithPassword(userId);
  if (!cred) throw new Error('Mailbox not configured.');
  const client = createImapClient(cred);
  try {
    await client.connect();
    const boxes = await client.list();
    const trashFolder = boxes.find((b: any) =>
      b.specialUse === '\\Trash' || (b.path || '').toLowerCase().includes('trash')
    );
    const pathToUse = normalizeFolderPath(folderPath);
    const lock = await client.getMailboxLock(pathToUse);
    try {
      const range = uids.join(',');
      if (trashFolder && trashFolder.path.toLowerCase() !== pathToUse.toLowerCase()) {
        await client.messageMove(range, trashFolder.path, { uid: true });
      } else {
        await client.messageFlagsAdd(range, ['\\Deleted'], { uid: true });
        await (client as any).expunge();
      }
    } finally {
      lock.release();
    }
  } finally {
    client.logout().catch(() => {});
  }
}

/** Move messages to a different folder. */
export async function moveMessages(
  userId: number,
  folderPath: string,
  uids: number[],
  destPath: string
): Promise<void> {
  if (!uids.length) return;
  const cred = await getCredentialsWithPassword(userId);
  if (!cred) throw new Error('Mailbox not configured.');
  const client = createImapClient(cred);
  try {
    await client.connect();
    const pathToUse = normalizeFolderPath(folderPath);
    const lock = await client.getMailboxLock(pathToUse);
    try {
      const range = uids.join(',');
      await client.messageMove(range, destPath, { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    client.logout().catch(() => {});
  }
}

/** Toggle a flag (e.g. \\Flagged for star) on a message. */
export async function toggleFlag(
  userId: number,
  folderPath: string,
  uid: number,
  flag: string,
  add: boolean
): Promise<void> {
  const cred = await getCredentialsWithPassword(userId);
  if (!cred) throw new Error('Mailbox not configured.');
  const client = createImapClient(cred);
  try {
    await client.connect();
    const pathToUse = normalizeFolderPath(folderPath);
    const lock = await client.getMailboxLock(pathToUse);
    try {
      if (add) {
        await client.messageFlagsAdd(String(uid), [flag], { uid: true });
      } else {
        await client.messageFlagsRemove(String(uid), [flag], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    client.logout().catch(() => {});
  }
}

/** Download an attachment by index. Re-fetches source and parses with simpleParser for reliability. */
export async function downloadAttachment(
  userId: number,
  folderPath: string,
  uid: number,
  index: number
): Promise<{ content: Buffer; filename: string; contentType: string } | null> {
  const cred = await getCredentialsWithPassword(userId);
  if (!cred) throw new Error('Mailbox not configured.');
  const client = createImapClient(cred);
  try {
    await client.connect();
    const pathToUse = normalizeFolderPath(folderPath);
    const lock = await client.getMailboxLock(pathToUse);
    try {
      const messages = await client.fetchAll(`${uid}:${uid}`, { source: true }, { uid: true });
      const msg = messages?.[0];
      if (!msg?.source) return null;
      const parsed = await simpleParser(msg.source as Buffer);
      const att = parsed.attachments?.[index];
      if (!att) return null;
      return {
        content: att.content,
        filename: att.filename || 'attachment',
        contentType: att.contentType || 'application/octet-stream',
      };
    } finally {
      lock.release();
    }
  } finally {
    client.logout().catch(() => {});
  }
}

/** Search messages in a folder using IMAP SEARCH (searches headers + body). */
export async function searchMessages(
  userId: number,
  folderPath: string,
  query: string,
  limit: number = 100
): Promise<{ messages: MailMessageHeader[]; total: number }> {
  const cred = await getCredentialsWithPassword(userId);
  if (!cred) throw new Error('Mailbox not configured.');
  const client = createImapClient(cred);
  try {
    await client.connect();
    const pathToUse = normalizeFolderPath(folderPath);
    const lock = await client.getMailboxLock(pathToUse);
    try {
      // TEXT searches both headers and body content
      const uidsRaw = await client.search({ text: query }, { uid: true });
      const uids = Array.isArray(uidsRaw) ? uidsRaw : [];
      const total = uids.length;
      if (!uids.length) return { messages: [], total: 0 };
      // Take latest N UIDs (sorted ascending by IMAP, we want newest first)
      const latest = uids.slice(-limit);
      const range = latest.join(',');
      const messages: MailMessageHeader[] = [];
      for await (const msg of client.fetch(range, { envelope: true, uid: true, flags: true, bodyStructure: true }, { uid: true })) {
        const env = msg.envelope as MailEnvelope;
        if (env?.date && typeof env.date === 'object') (env as any).date = (env.date as Date).toISOString();
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          envelope: env,
          flags: msg.flags ? Array.from(msg.flags) : [],
          hasAttachments: hasAttachmentsInStructure((msg as any).bodyStructure),
        });
      }
      // Sort by UID descending (newest first)
      messages.sort((a, b) => b.uid - a.uid);
      return { messages, total };
    } finally {
      lock.release();
    }
  } finally {
    client.logout().catch(() => {});
  }
}

/** Archive messages – move to Archive folder (create if missing). */
export async function archiveMessages(
  userId: number,
  folderPath: string,
  uids: number[]
): Promise<void> {
  if (!uids.length) return;
  const cred = await getCredentialsWithPassword(userId);
  if (!cred) throw new Error('Mailbox not configured.');
  const client = createImapClient(cred);
  try {
    await client.connect();
    const boxes = await client.list();
    let archiveFolder = boxes.find((b: any) =>
      b.specialUse === '\\Archive' || (b.path || '').toLowerCase() === 'archive'
    );
    if (!archiveFolder) {
      await client.mailboxCreate('Archive');
      archiveFolder = { path: 'Archive' } as any;
    }
    const archivePath = archiveFolder!.path;
    const pathToUse = normalizeFolderPath(folderPath);
    if (archivePath.toLowerCase() === pathToUse.toLowerCase()) return; // already in archive
    const lock = await client.getMailboxLock(pathToUse);
    try {
      const range = uids.join(',');
      await client.messageMove(range, archivePath, { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    client.logout().catch(() => {});
  }
}

export interface SendMailAttachment {
  filename: string;
  content: string; // base64
  contentType?: string;
}

export async function sendMail(
  userId: number,
  options: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: SendMailAttachment[];
  }
): Promise<void> {
  const cred = await getCredentialsWithPassword(userId);
  if (!cred) throw new Error('Mailbox not configured.');

  const mailOptions: Record<string, unknown> = {
    from: cred.email,
    to: options.to,
    cc: options.cc || undefined,
    bcc: options.bcc || undefined,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  if (options.attachments?.length) {
    mailOptions.attachments = options.attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType,
    }));
  }

  const transporter = nodemailer.createTransport({
    host: cred.smtpHost,
    port: cred.smtpPort,
    secure: cred.smtpSecure,
    auth: { user: cred.email, pass: cred.password },
  });

  // Send via SMTP normally – let nodemailer handle MIME encoding & attachments natively
  await transporter.sendMail(mailOptions as any);

  // Build raw RFC822 copy for Sent-folder append
  const raw = await buildRawMessage(mailOptions);
  await appendToSentFolder(cred, raw);
}

/** Build raw RFC822 message using nodemailer mail-composer */
async function buildRawMessage(mailOptions: Record<string, unknown>): Promise<Buffer> {
  const MailComposer = require('nodemailer/lib/mail-composer');
  const mc = new MailComposer(mailOptions);
  const mimeNode = mc.compile();
  return new Promise<Buffer>((resolve, reject) => {
    mimeNode.build((err: Error | null, raw: Buffer) => {
      if (err) reject(err);
      else resolve(raw);
    });
  });
}

/** Append sent message to Sent folder via IMAP. Uses same client to list then append. */
async function appendToSentFolder(
  cred: MailboxCredentialsWithPassword,
  raw: Buffer
): Promise<void> {
  const client = createImapClient(cred);
  try {
    await client.connect();
    const boxes = await client.list();
    let sentPath: string | null = boxes.find((b) => b.specialUse === '\\Sent' || (b.path || '').toLowerCase().includes('sent'))?.path ?? null;
    if (!sentPath) {
      console.warn('[mailbox] Sent folder not found. Available:', boxes.map((b) => b.path).join(', '));
      return;
    }
    await client.append(sentPath, raw, ['\\Seen'], new Date());
  } catch (e) {
    console.error('[mailbox] Failed to append to Sent folder:', e);
  } finally {
    client.logout().catch(() => {});
  }
}
