/**
 * Chat: conversations list, message history, send message.
 * Table schema is auto-detected so it works whether the table is in dbo or another schema.
 */

import { getRequest } from '../../config/db';
import * as fileService from '../../services/fileService';
import type { ChatMessageReaction, ChatMessageRow, ConversationRow } from './chat.types';

let chatTableName: string | null = null;

/** Resolve schema-qualified table name. Cached after first lookup. Creates table in dbo if missing. */
async function getChatTableName(): Promise<string> {
  if (chatTableName) return chatTableName;
  const req = await getRequest();
  const result = await req.query(`
    SELECT OBJECT_SCHEMA_NAME(t.object_id) AS schema_name
    FROM sys.tables t
    WHERE LOWER(LTRIM(RTRIM(CAST(t.name AS NVARCHAR(128))))) = N'react_chatmessage'
  `);
  const row = result.recordset?.[0] as Record<string, string> | undefined;
  const schema = row?.schema_name ?? row?.schema_Name ?? row?.SCHEMA_NAME;
  if (schema) {
    chatTableName = `[${schema}].[react_ChatMessage]`;
    return chatTableName;
  }
  // Table not in this database – create it in dbo (same as migration 007_chat.sql)
  await req.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_ChatMessage' AND t.schema_id = SCHEMA_ID(N'dbo'))
    BEGIN
      CREATE TABLE dbo.react_ChatMessage (
        MessageID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SenderUserID INT NOT NULL,
        ReceiverUserID INT NOT NULL,
        MessageText NVARCHAR(MAX) NOT NULL,
        SentAt DATETIME NOT NULL DEFAULT GETDATE(),
        DeliveredAt DATETIME NULL,
        ReadAt DATETIME NULL,
        AttachmentFileID INT NULL
      );
      CREATE INDEX IX_react_ChatMessage_Receiver_Sent ON dbo.react_ChatMessage(ReceiverUserID, SentAt DESC);
      CREATE INDEX IX_react_ChatMessage_Sender_Sent ON dbo.react_ChatMessage(SenderUserID, SentAt DESC);
    END
  `);
  chatTableName = 'dbo.react_ChatMessage';
  return chatTableName;
}

/** Add AttachmentFileID column if missing (for existing DBs). Call after getChatTableName. */
let attachmentColumnChecked = false;
async function ensureAttachmentColumn(): Promise<void> {
  if (attachmentColumnChecked) return;
  const table = await getChatTableName();
  const req = await getRequest();
  const tableEscaped = table.replace(/'/g, "''");
  await req.query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns c
      INNER JOIN sys.tables t ON c.object_id = t.object_id
      WHERE t.name = N'react_ChatMessage' AND c.name = N'AttachmentFileID'
    )
    EXEC sp_executesql N'ALTER TABLE ${tableEscaped} ADD AttachmentFileID INT NULL'
  `);
  attachmentColumnChecked = true;
}

/** Add ReplyToMessageID, DeletedAt, DeletedByUserID and create reaction/hidden/starred tables if missing. */
let chatActionsSchemaChecked = false;
async function ensureChatActionsSchema(): Promise<void> {
  if (chatActionsSchemaChecked) return;
  const table = await getChatTableName();
  const req = await getRequest();
  const tableEscaped = table.replace(/'/g, "''");
  for (const col of ['ReplyToMessageID', 'DeletedAt', 'DeletedByUserID']) {
    const colEscaped = col.replace(/'/g, "''");
    await req.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id WHERE t.name = N'react_ChatMessage' AND c.name = N'${col}')
      EXEC sp_executesql N'ALTER TABLE ${tableEscaped} ADD ${colEscaped} ${col === 'ReplyToMessageID' ? 'INT' : col === 'DeletedAt' ? 'DATETIME' : 'INT'} NULL'
    `);
  }
  await req.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_ChatReaction' AND t.schema_id = SCHEMA_ID(N'dbo'))
    CREATE TABLE dbo.react_ChatReaction (MessageID INT NOT NULL, UserID INT NOT NULL, Emoji NVARCHAR(32) NOT NULL, ReactedAt DATETIME NOT NULL DEFAULT GETUTCDATE(), PRIMARY KEY (MessageID, UserID));
    IF NOT EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_ChatMessageHidden' AND t.schema_id = SCHEMA_ID(N'dbo'))
    CREATE TABLE dbo.react_ChatMessageHidden (MessageID INT NOT NULL, UserID INT NOT NULL, HiddenAt DATETIME NOT NULL DEFAULT GETUTCDATE(), PRIMARY KEY (MessageID, UserID));
    IF NOT EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_ChatStarred' AND t.schema_id = SCHEMA_ID(N'dbo'))
    CREATE TABLE dbo.react_ChatStarred (MessageID INT NOT NULL, UserID INT NOT NULL, StarredAt DATETIME NOT NULL DEFAULT GETUTCDATE(), PRIMARY KEY (MessageID, UserID));
    IF NOT EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_ChatPinned' AND t.schema_id = SCHEMA_ID(N'dbo'))
    CREATE TABLE dbo.react_ChatPinned (UserID INT NOT NULL, PartnerID INT NOT NULL, MessageID INT NOT NULL, PinnedAt DATETIME NOT NULL DEFAULT GETUTCDATE(), PRIMARY KEY (UserID, PartnerID));
  `);
  chatActionsSchemaChecked = true;
}

export type { ChatMessageReaction, ChatMessageRow, ConversationRow } from './chat.types';

/** List users I have a conversation with (have sent or received at least one message), with last message info and unread count. */
export async function getConversations(myUserId: number): Promise<ConversationRow[]> {
  const table = await getChatTableName();
  const req = await getRequest();
  const result = await req.input('userId', myUserId).query(`
    SELECT u.UserId AS userId, u.Name AS name, u.Email AS email,
           CONVERT(NVARCHAR(19), m.SentAt, 120) AS lastMessageAt,
           LEFT(m.MessageText, 60) AS lastMessagePreview,
           (SELECT COUNT(*) FROM ${table} uq WHERE uq.ReceiverUserID = @userId AND uq.SenderUserID = p.partnerId AND uq.ReadAt IS NULL) AS unreadCount
    FROM (
      SELECT CASE WHEN SenderUserID = @userId THEN ReceiverUserID ELSE SenderUserID END AS partnerId
      FROM ${table}
      WHERE SenderUserID = @userId OR ReceiverUserID = @userId
      GROUP BY CASE WHEN SenderUserID = @userId THEN ReceiverUserID ELSE SenderUserID END
    ) p
    INNER JOIN utbl_Users_Master u ON u.UserId = p.partnerId AND u.IsActive = 1
    OUTER APPLY (
      SELECT TOP 1 SentAt, MessageText
      FROM ${table} m2
      WHERE (m2.SenderUserID = @userId AND m2.ReceiverUserID = p.partnerId)
         OR (m2.ReceiverUserID = @userId AND m2.SenderUserID = p.partnerId)
      ORDER BY m2.SentAt DESC
    ) m
    ORDER BY m.SentAt DESC, u.Name
  `);
  return (result.recordset || []) as ConversationRow[];
}

/** Mark messages as delivered (recipient received them). Returns updated message ids and deliveredAt. */
export async function markMessagesDelivered(
  recipientUserId: number,
  senderUserId: number,
  messageIds: number[]
): Promise<{ messageIds: number[]; deliveredAt: string } | null> {
  if (messageIds.length === 0) return null;
  const table = await getChatTableName();
  const req = await getRequest();
  const placeholders = messageIds.map((_, i) => `@dmId${i}`).join(',');
  let reqWithInputs = req
    .input('recipientUserId', recipientUserId)
    .input('senderUserId', senderUserId);
  messageIds.forEach((id, i) => { reqWithInputs = reqWithInputs.input(`dmId${i}`, id); });
  const result = await reqWithInputs.query(`
    UPDATE m SET m.DeliveredAt = GETUTCDATE()
    FROM ${table} m
    WHERE m.ReceiverUserID = @recipientUserId AND m.SenderUserID = @senderUserId
      AND m.MessageID IN (${placeholders}) AND m.DeliveredAt IS NULL
  `);
  const updated = (result.rowsAffected?.[0] ?? 0) as number;
  if (updated === 0) return null;
  const deliveredAt = new Date().toISOString();
  return { messageIds, deliveredAt };
}

/** Mark messages as read (recipient has seen them). Returns updated message ids and readAt. */
export async function markMessagesRead(
  recipientUserId: number,
  senderUserId: number,
  messageIds: number[]
): Promise<{ messageIds: number[]; readAt: string } | null> {
  if (messageIds.length === 0) return null;
  const table = await getChatTableName();
  const req = await getRequest();
  const placeholders = messageIds.map((_, i) => `@rmId${i}`).join(',');
  let reqWithInputs = req
    .input('recipientUserId', recipientUserId)
    .input('senderUserId', senderUserId);
  messageIds.forEach((id, i) => { reqWithInputs = reqWithInputs.input(`rmId${i}`, id); });
  const result = await reqWithInputs.query(`
    UPDATE m SET m.ReadAt = GETUTCDATE()
    FROM ${table} m
    WHERE m.ReceiverUserID = @recipientUserId AND m.SenderUserID = @senderUserId
      AND m.MessageID IN (${placeholders}) AND m.ReadAt IS NULL
  `);
  const updated = (result.rowsAffected?.[0] ?? 0) as number;
  if (updated === 0) return null;
  const readAt = new Date().toISOString();
  return { messageIds, readAt };
}

/** Mark all unread messages from sender to recipient as read. Returns updated message ids and readAt. */
export async function markAllMessagesRead(
  recipientUserId: number,
  senderUserId: number
): Promise<{ messageIds: number[]; readAt: string } | null> {
  const table = await getChatTableName();
  const req = await getRequest();
  const idsResult = await req
    .input('recipientUserId', recipientUserId)
    .input('senderUserId', senderUserId)
    .query(`
    SELECT m.MessageID AS messageId FROM ${table} m
    WHERE m.ReceiverUserID = @recipientUserId AND m.SenderUserID = @senderUserId AND m.ReadAt IS NULL
    ORDER BY m.MessageID
  `);
  const ids = ((idsResult.recordset || []) as { messageId: number }[]).map((r) => r.messageId);
  if (ids.length === 0) return null;
  return markMessagesRead(recipientUserId, senderUserId, ids);
}

/** Total count of unread messages for the current user (as recipient). */
export async function getUnreadCount(myUserId: number): Promise<number> {
  const table = await getChatTableName();
  const req = await getRequest();
  const result = await req.input('userId', myUserId).query(`
    SELECT COUNT(*) AS cnt FROM ${table} m
    WHERE m.ReceiverUserID = @userId AND m.ReadAt IS NULL
  `);
  const row = result.recordset?.[0] as { cnt?: number };
  return Number(row?.cnt ?? 0);
}

/** Check if user can access a file (uploaded by them or attached to a message they sent/received). */
export async function canAccessChatFile(userId: number, fileId: number): Promise<boolean> {
  await ensureAttachmentColumn();
  const table = await getChatTableName();
  const req = await getRequest();
  const result = await req
    .input('userId', userId)
    .input('fileId', fileId)
    .query(`
    SELECT 1 AS ok FROM dbo.react_FileStore f
    WHERE f.FileID = @fileId AND f.FileCategory = 'CHAT'
      AND (f.UploadedByUserID = @userId
           OR EXISTS (SELECT 1 FROM ${table} m WHERE m.AttachmentFileID = @fileId AND (m.SenderUserID = @userId OR m.ReceiverUserID = @userId)))
  `);
  return ((result.recordset?.[0] as { ok?: number })?.ok ?? 0) === 1;
}

/** Get last seen timestamp for a user (ISO string or null). */
export async function getLastSeen(userId: number): Promise<string | null> {
  try {
    const req = await getRequest();
    const result = await req.input('userId', userId).query(`
      SELECT CONVERT(NVARCHAR(19), LastSeenAt, 120) AS lastSeenAt
      FROM dbo.react_UserLastSeen WHERE UserID = @userId
    `);
    const row = result.recordset?.[0] as { lastSeenAt?: string } | undefined;
    return row?.lastSeenAt ?? null;
  } catch {
    return null;
  }
}

/** Update last seen for a user (call on connect, send message, mark read). */
export async function updateLastSeen(userId: number): Promise<void> {
  try {
    const req = await getRequest();
    await req.input('userId', userId).query(`
      MERGE dbo.react_UserLastSeen AS t
      USING (SELECT @userId AS UserID) AS s ON t.UserID = s.UserID
      WHEN MATCHED THEN UPDATE SET LastSeenAt = GETDATE()
      WHEN NOT MATCHED THEN INSERT (UserID, LastSeenAt) VALUES (s.UserID, GETDATE());
    `);
  } catch {
    // Table may not exist if migration 009 not run
  }
}

/** Messages between me and another user (ordered by SentAt asc for display). Returns latest `limit` messages, or older messages when `beforeMessageId` is set. */
export async function getMessages(
  myUserId: number,
  otherUserId: number,
  limit: number = 40,
  beforeMessageId?: number | null
): Promise<ChatMessageRow[]> {
  await ensureAttachmentColumn();
  await ensureChatActionsSchema();
  const table = await getChatTableName();
  const req = await getRequest();
  const toUtcIso = (raw: string | null): string | null => {
    if (raw == null || String(raw).trim() === '') return null;
    const s = String(raw).trim().replace(' ', 'T');
    return s.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`;
  };
  const getVal = (r: Record<string, unknown>, ...keys: string[]): unknown => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null) return v;
    }
    const lower = keys.map((k) => k.toLowerCase());
    for (const [k, v] of Object.entries(r)) {
      if (v !== undefined && v !== null && lower.includes(k.toLowerCase())) return v;
    }
    return undefined;
  };
  const mapRow = (r: Record<string, unknown>): ChatMessageRow => {
    const messageId = (getVal(r, 'messageId', 'MessageID') ?? 0) as number;
    const senderUserId = (getVal(r, 'senderUserId', 'SenderUserID') ?? 0) as number;
    const receiverUserId = (getVal(r, 'receiverUserId', 'ReceiverUserID') ?? 0) as number;
    const rawDelivered = (getVal(r, 'deliveredAt', 'DeliveredAt') ?? null) as string | null;
    const rawRead = (getVal(r, 'readAt', 'ReadAt') ?? null) as string | null;
    const rawSent = (getVal(r, 'sentAt', 'SentAt') ?? '') as string;
    const rawFileId = getVal(r, 'attachmentFileId', 'AttachmentFileID', 'AttachmentFileId');
    const attachmentFileId = rawFileId != null ? Number(rawFileId) : null;
    const attachmentFileName = getVal(r, 'attachmentFileName', 'AttachmentFileName', 'OriginalFileName') as string | null | undefined;
    const attachmentMimeType = getVal(r, 'attachmentMimeType', 'AttachmentMimeType', 'MimeType') as string | null | undefined;
    const attachmentAccessToken = getVal(r, 'attachmentAccessToken', 'AttachmentAccessToken', 'AccessToken') as string | null | undefined;
    const replyToMessageId = getVal(r, 'replyToMessageId', 'ReplyToMessageID') as number | null | undefined;
    const replyToPreview = getVal(r, 'replyToPreview', 'ReplyToPreview') as string | null | undefined;
    const replyToSenderName = getVal(r, 'replyToSenderName', 'ReplyToSenderName') as string | null | undefined;
    const rawDeletedAt = getVal(r, 'deletedAt', 'DeletedAt');
    const isDeleted = rawDeletedAt != null && String(rawDeletedAt).trim() !== '';
    const isStarred = (getVal(r, 'isStarred', 'IsStarred') ?? 0) as number;
    const isPinned = (getVal(r, 'isPinned', 'IsPinned') ?? 0) as number;
    let messageText = (r.messageText ?? r.MessageText) as string;
    if (isDeleted) {
      messageText = 'This message was deleted';
    }
    const out: ChatMessageRow = {
      messageId,
      senderUserId,
      receiverUserId,
      messageText,
      sentAt: toUtcIso(rawSent) ?? rawSent,
      deliveredAt: toUtcIso(rawDelivered),
      readAt: toUtcIso(rawRead),
      senderName: (r.senderName ?? r.SenderName) as string,
      receiverName: (r.receiverName ?? r.ReceiverName) as string,
      attachmentFileId: isDeleted ? undefined : attachmentFileId && !Number.isNaN(attachmentFileId) ? attachmentFileId : undefined,
      attachmentFileName: isDeleted ? undefined : attachmentFileName ?? undefined,
      attachmentMimeType: isDeleted ? undefined : attachmentMimeType ?? undefined,
      attachmentAccessToken: isDeleted ? undefined : attachmentAccessToken ?? undefined,
      replyToMessageId: replyToMessageId != null && !Number.isNaN(Number(replyToMessageId)) ? Number(replyToMessageId) : undefined,
      replyToPreview: replyToPreview ?? undefined,
      replyToSenderName: replyToSenderName ?? undefined,
      isStarred: isStarred === 1,
      isPinned: isPinned === 1,
      isDeleted: isDeleted || undefined,
    };
    return out;
  };
  const topN = Math.min(limit, 500);
  const beforeClause = beforeMessageId != null && beforeMessageId > 0 ? 'AND m.MessageID < @beforeMessageId' : '';
  let messages: ChatMessageRow[] = [];
  try {
    let reqWithInputs = req
      .input('userId1', myUserId)
      .input('userId2', otherUserId);
    if (beforeMessageId != null && beforeMessageId > 0) {
      reqWithInputs = reqWithInputs.input('beforeMessageId', beforeMessageId);
    }
    const result = await reqWithInputs.query(`
      SELECT TOP (${topN})
             m.MessageID AS messageId, m.SenderUserID AS senderUserId, m.ReceiverUserID AS receiverUserId,
             m.MessageText AS messageText, CONVERT(NVARCHAR(19), m.SentAt, 120) AS sentAt,
             CONVERT(NVARCHAR(19), m.DeliveredAt, 120) AS deliveredAt,
             CONVERT(NVARCHAR(19), m.ReadAt, 120) AS readAt,
             u1.Name AS senderName, u2.Name AS receiverName,
             m.AttachmentFileID AS attachmentFileId, f.OriginalFileName AS attachmentFileName, f.MimeType AS attachmentMimeType, f.AccessToken AS attachmentAccessToken,
             m.ReplyToMessageID AS replyToMessageId, LEFT(rt.MessageText, 120) AS replyToPreview, u_rt.Name AS replyToSenderName,
             CONVERT(NVARCHAR(19), m.DeletedAt, 120) AS deletedAt,
             CASE WHEN st.MessageID IS NOT NULL THEN 1 ELSE 0 END AS isStarred,
             CASE WHEN pin.MessageID IS NOT NULL THEN 1 ELSE 0 END AS isPinned
      FROM ${table} m
      INNER JOIN utbl_Users_Master u1 ON u1.UserId = m.SenderUserID
      INNER JOIN utbl_Users_Master u2 ON u2.UserId = m.ReceiverUserID
      LEFT JOIN dbo.react_FileStore f ON f.FileID = m.AttachmentFileID
      LEFT JOIN dbo.react_ChatMessageHidden h ON h.MessageID = m.MessageID AND h.UserID = @userId1
      LEFT JOIN ${table} rt ON rt.MessageID = m.ReplyToMessageID
      LEFT JOIN utbl_Users_Master u_rt ON u_rt.UserId = rt.SenderUserID
      LEFT JOIN dbo.react_ChatStarred st ON st.MessageID = m.MessageID AND st.UserID = @userId1
      LEFT JOIN dbo.react_ChatPinned pin ON pin.MessageID = m.MessageID AND pin.UserID = @userId1 AND pin.PartnerID = @userId2
      WHERE ((m.SenderUserID = @userId1 AND m.ReceiverUserID = @userId2) OR (m.SenderUserID = @userId2 AND m.ReceiverUserID = @userId1))
        AND h.MessageID IS NULL ${beforeClause}
      ORDER BY m.SentAt DESC
    `);
    const rows = (result.recordset || []) as Record<string, unknown>[];
    messages = rows.map(mapRow).reverse();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('DeliveredAt') || msg.includes('ReadAt') || msg.includes('AttachmentFileID') || msg.includes('AccessToken') || msg.includes('ReplyToMessageID') || msg.includes('DeletedAt') || msg.includes('react_ChatMessageHidden') || msg.includes('react_ChatStarred') || msg.includes('react_ChatPinned') || msg.includes('Invalid column') || msg.includes('Invalid object')) {
      const req2 = await getRequest();
      try {
        let req2Input = req2.input('userId1', myUserId).input('userId2', otherUserId);
        if (beforeMessageId != null && beforeMessageId > 0) req2Input = req2Input.input('beforeMessageId', beforeMessageId);
        const withAttachment = await req2Input.query(`
          SELECT TOP (${topN})
                 m.MessageID AS messageId, m.SenderUserID AS senderUserId, m.ReceiverUserID AS receiverUserId,
                 m.MessageText AS messageText, CONVERT(NVARCHAR(19), m.SentAt, 120) AS sentAt,
                 u1.Name AS senderName, u2.Name AS receiverName,
                 m.AttachmentFileID AS attachmentFileId, f.OriginalFileName AS attachmentFileName, f.MimeType AS attachmentMimeType, f.AccessToken AS attachmentAccessToken
          FROM ${table} m
          INNER JOIN utbl_Users_Master u1 ON u1.UserId = m.SenderUserID
          INNER JOIN utbl_Users_Master u2 ON u2.UserId = m.ReceiverUserID
          LEFT JOIN dbo.react_FileStore f ON f.FileID = m.AttachmentFileID
          WHERE ((m.SenderUserID = @userId1 AND m.ReceiverUserID = @userId2) OR (m.SenderUserID = @userId2 AND m.ReceiverUserID = @userId1)) ${beforeClause}
          ORDER BY m.SentAt DESC
        `);
        const rows = (withAttachment.recordset || []) as Record<string, unknown>[];
        messages = rows.map((r) => ({ ...mapRow(r), deliveredAt: null, readAt: null })).reverse();
      } catch {
        const req3 = await getRequest();
        let req3Input = req3.input('userId1', myUserId).input('userId2', otherUserId);
        if (beforeMessageId != null && beforeMessageId > 0) req3Input = req3Input.input('beforeMessageId', beforeMessageId);
        const fallback = await req3Input.query(`
          SELECT TOP (${topN})
                 m.MessageID AS messageId, m.SenderUserID AS senderUserId, m.ReceiverUserID AS receiverUserId,
                 m.MessageText AS messageText, CONVERT(NVARCHAR(19), m.SentAt, 120) AS sentAt,
                 u1.Name AS senderName, u2.Name AS receiverName
          FROM ${table} m
          INNER JOIN utbl_Users_Master u1 ON u1.UserId = m.SenderUserID
          INNER JOIN utbl_Users_Master u2 ON u2.UserId = m.ReceiverUserID
          WHERE ((m.SenderUserID = @userId1 AND m.ReceiverUserID = @userId2) OR (m.SenderUserID = @userId2 AND m.ReceiverUserID = @userId1)) ${beforeClause}
          ORDER BY m.SentAt DESC
        `);
        const rows = (fallback.recordset || []) as Record<string, unknown>[];
        messages = rows.map((r) => ({ ...mapRow(r), deliveredAt: null, readAt: null })).reverse();
      }
    } else {
      throw err;
    }
  }

  const messageIds = messages.map((m) => m.messageId);
  if (messageIds.length > 0) {
    try {
      const byMessage = new Map<number, { emoji: string; userId: number }[]>();
      const BATCH = 50;
      for (let i = 0; i < messageIds.length; i += BATCH) {
        const batch = messageIds.slice(i, i + BATCH);
        const placeholders = batch.map((_, j) => `@mid${j}`).join(',');
        let reqR = await getRequest();
        for (let j = 0; j < batch.length; j++) reqR = reqR.input(`mid${j}`, batch[j]);
        const resR = await reqR.query(`
          SELECT MessageID AS messageId, UserID AS userId, Emoji AS emoji
          FROM dbo.react_ChatReaction
          WHERE MessageID IN (${placeholders})
        `);
        const reactions = (resR.recordset || []) as Record<string, unknown>[];
        for (const re of reactions) {
          const mid = Number(re.messageId ?? re.MessageID ?? (re as any).messageid);
          const uid = Number(re.userId ?? re.UserID ?? (re as any).userid);
          const em = String(re.emoji ?? re.Emoji ?? (re as any).Emoji ?? '').trim();
          if (!mid || !em) continue;
          if (!byMessage.has(mid)) byMessage.set(mid, []);
          byMessage.get(mid)!.push({ emoji: em, userId: uid });
        }
      }
      messages = messages.map((msg) => {
        const list = byMessage.get(msg.messageId) || [];
        const agg = new Map<string, { count: number; you: boolean }>();
        for (const { emoji, userId } of list) {
          const key = emoji;
          if (!agg.has(key)) agg.set(key, { count: 0, you: false });
          const cur = agg.get(key)!;
          cur.count += 1;
          if (userId === myUserId) cur.you = true;
        }
        const reactionList: ChatMessageReaction[] = Array.from(agg.entries()).map(([emoji, v]) => ({ emoji, count: v.count, you: v.you }));
        return reactionList.length ? { ...msg, reactions: reactionList } : msg;
      });
    } catch (e) {
      console.error('Chat reactions fetch failed (table may not exist):', e instanceof Error ? e.message : e);
    }
  }
  return messages;
}

export async function sendMessage(
  senderUserId: number,
  receiverUserId: number,
  messageText: string,
  attachmentFileId?: number | null,
  replyToMessageId?: number | null
): Promise<ChatMessageRow> {
  await ensureAttachmentColumn();
  await ensureChatActionsSchema();
  const table = await getChatTableName();
  const req = await getRequest();
  const text = (messageText ?? '').trim().slice(0, 10000);
  if (!text && (attachmentFileId == null || attachmentFileId === 0)) {
    throw new Error('Message text or attachment required');
  }
  const messageTextToStore = text || (attachmentFileId ? '[Attachment]' : '');
  let request = req
    .input('senderUserId', senderUserId)
    .input('receiverUserId', receiverUserId)
    .input('messageText', messageTextToStore);
  const hasAttachment = attachmentFileId != null && attachmentFileId > 0;
  const hasReply = replyToMessageId != null && replyToMessageId > 0;
  if (hasAttachment) request = request.input('attachmentFileId', attachmentFileId);
  if (hasReply) request = request.input('replyToMessageId', replyToMessageId);
  const insertCols = [
    'SenderUserID', 'ReceiverUserID', 'MessageText', 'SentAt',
    ...(hasAttachment ? ['AttachmentFileID'] : []),
    ...(hasReply ? ['ReplyToMessageID'] : []),
  ];
  const insertVals = [
    '@senderUserId', '@receiverUserId', '@messageText', 'GETUTCDATE()',
    ...(hasAttachment ? ['@attachmentFileId'] : []),
    ...(hasReply ? ['@replyToMessageId'] : []),
  ];
  const insertColumns = `(${insertCols.join(', ')})`;
  const insertValues = `VALUES (${insertVals.join(', ')})`;
  const result = await request.query(`
    INSERT INTO ${table} ${insertColumns}
    OUTPUT INSERTED.MessageID AS messageId, CONVERT(NVARCHAR(19), INSERTED.SentAt, 120) AS sentAt, INSERTED.MessageText AS messageText, INSERTED.AttachmentFileID AS attachmentFileId
    ${insertValues}
  `);
  const row = result.recordset?.[0] as Record<string, unknown> | undefined;
  const messageId = row ? Number(row.messageId ?? row.MessageID) : 0;
  if (!messageId) throw new Error('Failed to get inserted message id');
  const sentAtRaw = (row?.sentAt ?? row?.SentAt ?? new Date().toISOString().slice(0, 19).replace('T', ' ')) as string;
  const sentAt = sentAtRaw.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(sentAtRaw) ? sentAtRaw : `${String(sentAtRaw).replace(' ', 'T')}Z`;
  const messageTextOut = (row?.messageText ?? row?.MessageText ?? messageTextToStore) as string;
  const insertedAttachmentFileId = row ? Number(row.attachmentFileId ?? row.AttachmentFileID ?? row.AttachmentFileId ?? 0) : 0;

  let senderName = '';
  let receiverName = '';
  let attachmentFileName: string | null = null;
  let attachmentMimeType: string | null = null;
  try {
    const nameReq = await getRequest();
    const names = await nameReq
      .input('senderUserId', senderUserId)
      .input('receiverUserId', receiverUserId)
      .query(`
      SELECT (SELECT Name FROM utbl_Users_Master WHERE UserId = @senderUserId) AS senderName,
             (SELECT Name FROM utbl_Users_Master WHERE UserId = @receiverUserId) AS receiverName
      `);
    const n = names.recordset?.[0] as { senderName?: string; receiverName?: string } | undefined;
    senderName = n?.senderName ?? '';
    receiverName = n?.receiverName ?? '';
  } catch {
    // Name lookup optional
  }
  let attachmentAccessToken: string | null = null;
  if (insertedAttachmentFileId > 0) {
    try {
      const fileReq = await getRequest();
      const fileRow = await fileReq.input('fileId', insertedAttachmentFileId).query(`
        SELECT OriginalFileName AS attachmentFileName, MimeType AS attachmentMimeType FROM dbo.react_FileStore WHERE FileID = @fileId
      `);
      const f = fileRow.recordset?.[0] as Record<string, unknown> | undefined;
      attachmentFileName = (f?.attachmentFileName ?? f?.OriginalFileName ?? null) as string | null;
      attachmentMimeType = (f?.attachmentMimeType ?? f?.MimeType ?? null) as string | null;
      attachmentAccessToken = await fileService.getFileAccessToken(insertedAttachmentFileId);
    } catch {
      // optional
    }
  }
  let replyToPreview: string | undefined;
  let replyToSenderName: string | undefined;
  if (hasReply && replyToMessageId) {
    try {
      const rtReq = await getRequest();
      const rtRes = await rtReq.input('replyToMessageId', replyToMessageId).query(`
        SELECT LEFT(m.MessageText, 120) AS replyToPreview, u.Name AS replyToSenderName
        FROM ${table} m
        INNER JOIN utbl_Users_Master u ON u.UserId = m.SenderUserID
        WHERE m.MessageID = @replyToMessageId
      `);
      const rtRow = rtRes.recordset?.[0] as { replyToPreview?: string; replyToSenderName?: string } | undefined;
      replyToPreview = rtRow?.replyToPreview ?? undefined;
      replyToSenderName = rtRow?.replyToSenderName ?? undefined;
    } catch {
      // optional
    }
  }
  return {
    messageId,
    senderUserId,
    receiverUserId,
    messageText: messageTextOut,
    sentAt,
    deliveredAt: null,
    readAt: null,
    senderName,
    receiverName,
    attachmentFileId: insertedAttachmentFileId > 0 ? insertedAttachmentFileId : undefined,
    attachmentFileName: attachmentFileName ?? undefined,
    attachmentMimeType: attachmentMimeType ?? undefined,
    attachmentAccessToken: attachmentAccessToken ?? undefined,
    replyToMessageId: hasReply ? replyToMessageId : undefined,
    replyToPreview,
    replyToSenderName,
  };
}

/** Get a single message by ID (for reply/forward). Returns null if not found or no access. */
export async function getMessageById(messageId: number, myUserId: number): Promise<ChatMessageRow | null> {
  await ensureAttachmentColumn();
  const table = await getChatTableName();
  const req = await getRequest();
  try {
    const result = await req
      .input('messageId', messageId)
      .input('userId', myUserId)
      .query(`
      SELECT m.MessageID AS messageId, m.SenderUserID AS senderUserId, m.ReceiverUserID AS receiverUserId, m.MessageText AS messageText,
             CONVERT(NVARCHAR(19), m.SentAt, 120) AS sentAt,
             u1.Name AS senderName, u2.Name AS receiverName,
             m.AttachmentFileID AS attachmentFileId, f.OriginalFileName AS attachmentFileName, f.MimeType AS attachmentMimeType, f.AccessToken AS attachmentAccessToken
      FROM ${table} m
      INNER JOIN utbl_Users_Master u1 ON u1.UserId = m.SenderUserID
      INNER JOIN utbl_Users_Master u2 ON u2.UserId = m.ReceiverUserID
      LEFT JOIN dbo.react_FileStore f ON f.FileID = m.AttachmentFileID
      WHERE m.MessageID = @messageId AND (m.SenderUserID = @userId OR m.ReceiverUserID = @userId) AND m.DeletedAt IS NULL
    `);
    const row = result.recordset?.[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const sentAtRaw = (row.sentAt ?? row.SentAt ?? '') as string;
    const sentAt = String(sentAtRaw).replace(' ', 'T') + (sentAtRaw && /Z$|[+-]\d{2}:?\d{2}$/.test(sentAtRaw) ? '' : 'Z');
    return {
      messageId: Number(row.messageId ?? row.MessageID),
      senderUserId: Number(row.senderUserId ?? row.SenderUserID),
      receiverUserId: Number(row.receiverUserId ?? row.ReceiverUserID),
      messageText: (row.messageText ?? row.MessageText) as string,
      sentAt,
      deliveredAt: null,
      readAt: null,
      senderName: (row.senderName ?? row.SenderName) as string,
      receiverName: (row.receiverName ?? row.ReceiverName) as string,
      attachmentFileId: row.attachmentFileId != null ? Number(row.attachmentFileId) : undefined,
      attachmentFileName: row.attachmentFileName as string | undefined,
      attachmentMimeType: row.attachmentMimeType as string | undefined,
      attachmentAccessToken: row.attachmentAccessToken as string | undefined,
    };
  } catch {
    return null;
  }
}

/** Set or replace reaction (one emoji per user per message). */
export async function setReaction(messageId: number, userId: number, emoji: string): Promise<void> {
  await ensureChatActionsSchema();
  const req = await getRequest();
  const emojiTrim = String(emoji || '').trim().slice(0, 32);
  if (!emojiTrim) return;
  await req
    .input('messageId', messageId)
    .input('userId', userId)
    .input('emoji', emojiTrim)
    .query(`
    MERGE dbo.react_ChatReaction AS t
    USING (SELECT @messageId AS MessageID, @userId AS UserID, @emoji AS Emoji) AS s
    ON t.MessageID = s.MessageID AND t.UserID = s.UserID
    WHEN MATCHED THEN UPDATE SET Emoji = s.Emoji, ReactedAt = GETUTCDATE()
    WHEN NOT MATCHED THEN INSERT (MessageID, UserID, Emoji) VALUES (s.MessageID, s.UserID, s.Emoji);
  `);
}

/** Remove reaction. */
export async function removeReaction(messageId: number, userId: number): Promise<void> {
  const req = await getRequest();
  await req.input('messageId', messageId).input('userId', userId).query(`
    DELETE FROM dbo.react_ChatReaction WHERE MessageID = @messageId AND UserID = @userId
  `);
}

/** Get sender and receiver of a message (for realtime reaction target). */
export async function getMessageParticipants(messageId: number): Promise<{ senderUserId: number; receiverUserId: number } | null> {
  const table = await getChatTableName();
  const req = await getRequest();
  const res = await req.input('messageId', messageId).query(`
    SELECT SenderUserID AS senderUserId, ReceiverUserID AS receiverUserId FROM ${table} WHERE MessageID = @messageId
  `);
  const row = res.recordset?.[0] as { senderUserId?: number; receiverUserId?: number } | undefined;
  if (!row) return null;
  const sender = Number(row.senderUserId ?? (row as any).SenderUserID);
  const receiver = Number(row.receiverUserId ?? (row as any).ReceiverUserID);
  if (!sender || !receiver) return null;
  return { senderUserId: sender, receiverUserId: receiver };
}

/** Get current reactions for a single message (for realtime payload). */
export async function getReactionsForMessage(messageId: number, forUserId: number): Promise<ChatMessageReaction[]> {
  const req = await getRequest();
  try {
    const res = await req.input('messageId', messageId).query(`
      SELECT MessageID AS messageId, UserID AS userId, Emoji AS emoji
      FROM dbo.react_ChatReaction WHERE MessageID = @messageId
    `);
    const rows = (res.recordset || []) as Record<string, unknown>[];
    const list: { emoji: string; userId: number }[] = [];
    for (const re of rows) {
      const uid = Number(re.userId ?? re.UserID ?? (re as any).userid);
      const em = String(re.emoji ?? re.Emoji ?? '').trim();
      if (em) list.push({ emoji: em, userId: uid });
    }
    const agg = new Map<string, { count: number; you: boolean }>();
    for (const { emoji, userId } of list) {
      if (!agg.has(emoji)) agg.set(emoji, { count: 0, you: false });
      const cur = agg.get(emoji)!;
      cur.count += 1;
      if (userId === forUserId) cur.you = true;
    }
    return Array.from(agg.entries()).map(([emoji, v]) => ({ emoji, count: v.count, you: v.you }));
  } catch {
    return [];
  }
}

/** Forward a message to another user (same text + attachment reference). */
export async function forwardMessage(messageId: number, fromUserId: number, toUserId: number): Promise<ChatMessageRow> {
  const table = await getChatTableName();
  const req = await getRequest();
  const res = await req.input('messageId', messageId).input('userId', fromUserId).query(`
    SELECT MessageText, AttachmentFileID FROM ${table}
    WHERE MessageID = @messageId AND (SenderUserID = @userId OR ReceiverUserID = @userId) AND DeletedAt IS NULL
  `);
  const row = res.recordset?.[0] as { MessageText?: string; AttachmentFileID?: number } | undefined;
  if (!row) throw new Error('Message not found or cannot forward');
  const text = (row.MessageText ?? '[Forwarded]').trim();
  const attachmentFileId = row.AttachmentFileID != null && row.AttachmentFileID > 0 ? row.AttachmentFileID : undefined;
  return sendMessage(fromUserId, toUserId, text, attachmentFileId ?? null, null);
}

/** Delete for me (hide message from my view). */
export async function deleteMessageForMe(messageId: number, userId: number): Promise<void> {
  await ensureChatActionsSchema();
  const req = await getRequest();
  await req.input('messageId', messageId).input('userId', userId).query(`
    INSERT INTO dbo.react_ChatMessageHidden (MessageID, UserID) VALUES (@messageId, @userId)
  `);
}

/** Delete for everyone (soft delete; only sender can do this, and only recent messages). */
export async function deleteMessageForEveryone(messageId: number, userId: number): Promise<void> {
  await ensureChatActionsSchema();
  const table = await getChatTableName();
  const req = await getRequest();
  const check = await req.input('messageId', messageId).input('userId', userId).query(`
    SELECT SenderUserID FROM ${table} WHERE MessageID = @messageId AND DeletedAt IS NULL
  `);
  const row = check.recordset?.[0] as { SenderUserID?: number } | undefined;
  if (!row || row.SenderUserID !== userId) throw new Error('Only the sender can delete for everyone');
  const req2 = await getRequest();
  await req2.input('messageId', messageId).input('userId', userId).query(`
    UPDATE ${table} SET DeletedAt = GETUTCDATE(), DeletedByUserID = @userId WHERE MessageID = @messageId
  `);
}

/** Star a message (for current user). Idempotent if already starred. */
export async function starMessage(messageId: number, userId: number): Promise<void> {
  await ensureChatActionsSchema();
  const req = await getRequest();
  const table = await getChatTableName();
  const check = await req.input('messageId', messageId).input('userId', userId).query(`
    SELECT 1 FROM ${table} WHERE MessageID = @messageId AND (SenderUserID = @userId OR ReceiverUserID = @userId)
  `);
  if (!check.recordset?.length) throw new Error('Message not found');
  const req2 = await getRequest();
  await req2.input('messageId', messageId).input('userId', userId).query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.react_ChatStarred WHERE MessageID = @messageId AND UserID = @userId)
      INSERT INTO dbo.react_ChatStarred (MessageID, UserID) VALUES (@messageId, @userId)
  `);
}

/** Unstar a message. */
export async function unstarMessage(messageId: number, userId: number): Promise<void> {
  const req = await getRequest();
  await req.input('messageId', messageId).input('userId', userId).query(`
    DELETE FROM dbo.react_ChatStarred WHERE MessageID = @messageId AND UserID = @userId
  `);
}

/** Pin a message in this conversation (one pinned per user per conversation; replaces previous pin). */
export async function pinMessage(messageId: number, userId: number): Promise<void> {
  await ensureChatActionsSchema();
  const participants = await getMessageParticipants(messageId);
  if (!participants) throw new Error('Message not found');
  const partnerId = participants.senderUserId === userId ? participants.receiverUserId : participants.senderUserId;
  const req = await getRequest();
  await req
    .input('userId', userId)
    .input('partnerId', partnerId)
    .input('messageId', messageId)
    .query(`
      DELETE FROM dbo.react_ChatPinned WHERE UserID = @userId AND PartnerID = @partnerId;
      INSERT INTO dbo.react_ChatPinned (UserID, PartnerID, MessageID) VALUES (@userId, @partnerId, @messageId);
    `);
}

/** Unpin a message. */
export async function unpinMessage(messageId: number, userId: number): Promise<void> {
  const participants = await getMessageParticipants(messageId);
  if (!participants) throw new Error('Message not found');
  const partnerId = participants.senderUserId === userId ? participants.receiverUserId : participants.senderUserId;
  const req = await getRequest();
  await req
    .input('userId', userId)
    .input('partnerId', partnerId)
    .input('messageId', messageId)
    .query(`
      DELETE FROM dbo.react_ChatPinned WHERE UserID = @userId AND PartnerID = @partnerId AND MessageID = @messageId
    `);
}
