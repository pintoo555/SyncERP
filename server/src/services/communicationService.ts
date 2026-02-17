/**
 * Communication module service: channels, send/receive, stats.
 * Supports Ultramsg (WhatsApp) and extensible for SMS and other providers.
 */

import { getRequest } from '../db/pool';
import { config } from '../utils/config';

const SCHEMA = config.db.schema || 'dbo';
const CHANNEL_TABLE = `[${SCHEMA}].[react_CommunicationChannel]`;
const MESSAGE_TABLE = `[${SCHEMA}].[react_CommunicationMessage]`;

export type ChannelType = 'whatsapp' | 'sms';
export type ProviderCode = 'ultramsg' | 'twilio' | 'custom';

export interface ChannelRow {
  ChannelID: number;
  Name: string;
  ChannelType: string;
  ProviderCode: string;
  InstanceId: string | null;
  Token: string | null;
  ConfigJson: string | null;
  IsActive: boolean;
  IsDefault: boolean;
  WebhookUrl: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface MessageRow {
  MessageID: number;
  ChannelID: number;
  Direction: string;
  ExternalId: string | null;
  FromNumber: string;
  ToNumber: string;
  Body: string | null;
  MessageType: string;
  Status: string | null;
  SentByUserID: number | null;
  ReceivedAt: Date | null;
  SentAt: Date | null;
  MetadataJson: string | null;
}

// --- Channels ---

export async function listChannels(): Promise<ChannelRow[]> {
  const req = await getRequest();
  const result = await req.query(`
    SELECT ChannelID, Name, ChannelType, ProviderCode, InstanceId, Token, ConfigJson, IsActive, IsDefault, WebhookUrl, CreatedAt, UpdatedAt
    FROM ${CHANNEL_TABLE}
    ORDER BY IsDefault DESC, Name
  `);
  return (result.recordset || []) as ChannelRow[];
}

export async function getChannelById(id: number): Promise<ChannelRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT ChannelID, Name, ChannelType, ProviderCode, InstanceId, Token, ConfigJson, IsActive, IsDefault, WebhookUrl, CreatedAt, UpdatedAt
    FROM ${CHANNEL_TABLE}
    WHERE ChannelID = @id
  `);
  const row = (result.recordset as ChannelRow[])?.[0];
  return row || null;
}

export async function getDefaultChannel(channelType?: ChannelType): Promise<ChannelRow | null> {
  const req = await getRequest();
  let q = `SELECT TOP 1 ChannelID, Name, ChannelType, ProviderCode, InstanceId, Token, ConfigJson, IsActive, IsDefault, WebhookUrl, CreatedAt, UpdatedAt
    FROM ${CHANNEL_TABLE}
    WHERE IsDefault = 1 AND IsActive = 1`;
  if (channelType) {
    q += ` AND ChannelType = @channelType`;
  }
  q += ` ORDER BY ChannelID`;
  const r = channelType ? req.input('channelType', channelType) : req;
  const result = await r.query(q);
  const row = (result.recordset as ChannelRow[])?.[0];
  return row || null;
}

export interface CreateChannelInput {
  name: string;
  channelType: ChannelType;
  providerCode: ProviderCode;
  instanceId?: string | null;
  token?: string | null;
  configJson?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
}

export async function createChannel(input: CreateChannelInput): Promise<ChannelRow> {
  const req = await getRequest();
  if (input.isDefault) {
    await req.input('ct', input.channelType).query(`UPDATE ${CHANNEL_TABLE} SET IsDefault = 0 WHERE ChannelType = @ct`);
  }
  const result = await req
    .input('name', input.name)
    .input('channelType', input.channelType)
    .input('providerCode', input.providerCode)
    .input('instanceId', input.instanceId ?? null)
    .input('token', input.token ?? null)
    .input('configJson', input.configJson ?? null)
    .input('isActive', input.isActive !== false ? 1 : 0)
    .input('isDefault', input.isDefault === true ? 1 : 0)
    .query(`
      INSERT INTO ${CHANNEL_TABLE} (Name, ChannelType, ProviderCode, InstanceId, Token, ConfigJson, IsActive, IsDefault, UpdatedAt)
      OUTPUT INSERTED.ChannelID, INSERTED.Name, INSERTED.ChannelType, INSERTED.ProviderCode, INSERTED.InstanceId, INSERTED.Token, INSERTED.ConfigJson, INSERTED.IsActive, INSERTED.IsDefault, INSERTED.WebhookUrl, INSERTED.CreatedAt, INSERTED.UpdatedAt
      VALUES (@name, @channelType, @providerCode, @instanceId, @token, @configJson, @isActive, @isDefault, GETDATE())
    `);
  const row = (result.recordset as ChannelRow[])?.[0];
  if (!row) throw new Error('Failed to create channel');
  return row;
}

export async function updateChannel(id: number, updates: Partial<CreateChannelInput>): Promise<ChannelRow | null> {
  const req = await getRequest();
  const existing = await getChannelById(id);
  if (!existing) return null;
  if (updates.isDefault === true) {
    await req.input('ct', existing.ChannelType).input('id', id).query(`UPDATE ${CHANNEL_TABLE} SET IsDefault = 0 WHERE ChannelType = @ct AND ChannelID <> @id`);
  }
  const name = updates.name ?? existing.Name;
  const isActive = updates.isActive !== undefined ? updates.isActive : existing.IsActive;
  const isDefault = updates.isDefault !== undefined ? updates.isDefault : existing.IsDefault;
  const instanceId = updates.instanceId !== undefined ? updates.instanceId : existing.InstanceId;
  const token = updates.token !== undefined ? updates.token : existing.Token;
  const configJson = updates.configJson !== undefined ? updates.configJson : existing.ConfigJson;
  await req
    .input('id', id)
    .input('name', name)
    .input('instanceId', instanceId ?? null)
    .input('token', token ?? null)
    .input('configJson', configJson ?? null)
    .input('isActive', isActive ? 1 : 0)
    .input('isDefault', isDefault ? 1 : 0)
    .query(`
      UPDATE ${CHANNEL_TABLE}
      SET Name = @name, InstanceId = @instanceId, Token = @token, ConfigJson = @configJson, IsActive = @isActive, IsDefault = @isDefault, UpdatedAt = GETDATE()
      WHERE ChannelID = @id
    `);
  return getChannelById(id);
}

export async function deleteChannel(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${CHANNEL_TABLE} WHERE ChannelID = @id`);
  return (result.rowsAffected?.[0] ?? 0) > 0;
}

// --- Send WhatsApp (for use by other modules e.g. OTP) ---

export async function sendWhatsAppText(to: string, body: string, sentByUserId?: number | null): Promise<{ success: boolean; error?: string }> {
  const channel = await getDefaultChannel('whatsapp');
  if (!channel || !channel.IsActive)
    return { success: false, error: 'No active WhatsApp channel configured' };
  if (channel.ProviderCode !== 'ultramsg' || !channel.InstanceId || !channel.Token)
    return { success: false, error: 'Channel must be configured with Ultramsg' };
  let normalizedTo = to.replace(/\s/g, '');
  if (/^\d{10}$/.test(normalizedTo)) normalizedTo = '+91' + normalizedTo;
  else if (/^0\d{10}$/.test(normalizedTo)) normalizedTo = '+91' + normalizedTo.slice(1);
  else if (!normalizedTo.startsWith('+')) normalizedTo = '+' + normalizedTo;
  const { sendText } = await import('./ultramsgProvider');
  const result = await sendText(
    { instanceId: channel.InstanceId, token: channel.Token },
    normalizedTo,
    body
  );
  if (!result.success) return { success: false, error: result.error };
  const fromNumber = channel.InstanceId ? `instance-${channel.InstanceId}` : 'unknown';
  await saveOutboundMessage({
    channelId: channel.ChannelID,
    externalId: result.messageId ?? null,
    fromNumber,
    toNumber: normalizedTo,
    body,
    status: 'sent',
    sentByUserId: sentByUserId ?? null,
    sentAt: new Date(),
  });
  return { success: true };
}

// --- Messages ---

export async function saveOutboundMessage(params: {
  channelId: number;
  externalId?: string | null;
  fromNumber: string;
  toNumber: string;
  body: string | null;
  messageType?: string;
  status?: string | null;
  sentByUserId: number | null;
  sentAt?: Date | null;
  metadataJson?: string | null;
}): Promise<number> {
  const req = await getRequest();
  const result = await req
    .input('channelId', params.channelId)
    .input('externalId', params.externalId ?? null)
    .input('fromNumber', params.fromNumber)
    .input('toNumber', params.toNumber)
    .input('body', params.body ?? null)
    .input('messageType', params.messageType ?? 'text')
    .input('status', params.status ?? 'sent')
    .input('sentByUserId', params.sentByUserId ?? null)
    .input('sentAt', params.sentAt ?? new Date())
    .input('metadataJson', params.metadataJson ?? null)
    .query(`
      INSERT INTO ${MESSAGE_TABLE} (ChannelID, Direction, ExternalId, FromNumber, ToNumber, Body, MessageType, Status, SentByUserID, SentAt, MetadataJson)
      OUTPUT INSERTED.MessageID
      VALUES (@channelId, 'outbound', @externalId, @fromNumber, @toNumber, @body, @messageType, @status, @sentByUserId, @sentAt, @metadataJson)
    `);
  const r = (result.recordset as { MessageID: number }[])?.[0];
  return r?.MessageID ?? 0;
}

export async function saveInboundMessage(params: {
  channelId: number;
  externalId?: string | null;
  fromNumber: string;
  toNumber: string;
  body: string | null;
  messageType?: string;
  status?: string | null;
  receivedAt?: Date | null;
  metadataJson?: string | null;
}): Promise<number> {
  const req = await getRequest();
  const result = await req
    .input('channelId', params.channelId)
    .input('externalId', params.externalId ?? null)
    .input('fromNumber', params.fromNumber)
    .input('toNumber', params.toNumber)
    .input('body', params.body ?? null)
    .input('messageType', params.messageType ?? 'text')
    .input('status', params.status ?? 'received')
    .input('receivedAt', params.receivedAt ?? new Date())
    .input('metadataJson', params.metadataJson ?? null)
    .query(`
      INSERT INTO ${MESSAGE_TABLE} (ChannelID, Direction, ExternalId, FromNumber, ToNumber, Body, MessageType, Status, ReceivedAt, MetadataJson)
      OUTPUT INSERTED.MessageID
      VALUES (@channelId, 'inbound', @externalId, @fromNumber, @toNumber, @body, @messageType, @status, @receivedAt, @metadataJson)
    `);
  const r = (result.recordset as { MessageID: number }[])?.[0];
  return r?.MessageID ?? 0;
}

export interface MessageListItem {
  messageId: number;
  channelId: number;
  channelName: string;
  direction: string;
  fromNumber: string;
  toNumber: string;
  body: string | null;
  messageType: string;
  status: string | null;
  sentByUserId: number | null;
  sentByName: string | null;
  receivedAt: string | null;
  sentAt: string | null;
}

export async function listMessages(params: {
  channelId?: number;
  direction?: 'inbound' | 'outbound';
  fromNumber?: string;
  toNumber?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}): Promise<{ messages: MessageListItem[]; total: number }> {
  const req = await getRequest();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));
  const offset = (page - 1) * limit;

  const fromNum = params.fromNumber?.trim() ? `%${params.fromNumber.trim()}%` : null;
  const toNum = params.toNumber?.trim() ? `%${params.toNumber.trim()}%` : null;

  const countReq = await getRequest();
  let countQ = `SELECT COUNT(*) AS cnt FROM ${MESSAGE_TABLE} m WHERE 1=1`;
  if (params.channelId != null) countQ += ` AND m.ChannelID = @channelId`;
  if (params.direction) countQ += ` AND m.Direction = @direction`;
  if (fromNum) countQ += ` AND m.FromNumber LIKE @fromNumber`;
  if (toNum) countQ += ` AND m.ToNumber LIKE @toNumber`;
  if (params.fromDate) countQ += ` AND (m.SentAt >= @fromDate OR m.ReceivedAt >= @fromDate)`;
  if (params.toDate) countQ += ` AND (m.SentAt <= @toDate OR m.ReceivedAt <= @toDate)`;

  let countR = countReq;
  if (params.channelId != null) countR = countR.input('channelId', params.channelId);
  if (params.direction) countR = countR.input('direction', params.direction);
  if (fromNum) countR = countR.input('fromNumber', fromNum);
  if (toNum) countR = countR.input('toNumber', toNum);
  if (params.fromDate) countR = countR.input('fromDate', params.fromDate);
  if (params.toDate) countR = countR.input('toDate', params.toDate);
  const countResult = await countR.query(countQ);
  const total = ((countResult.recordset as { cnt: number }[])?.[0]?.cnt) ?? 0;

  let listQ = `
    SELECT m.MessageID, m.ChannelID, c.Name AS ChannelName, m.Direction, m.FromNumber, m.ToNumber, m.Body, m.MessageType, m.Status,
           m.SentByUserID, u.name AS SentByName,
           m.ReceivedAt, m.SentAt
    FROM ${MESSAGE_TABLE} m
    LEFT JOIN ${CHANNEL_TABLE} c ON c.ChannelID = m.ChannelID
    LEFT JOIN dbo.rb_users u ON u.userid = m.SentByUserID
    WHERE 1=1
  `;
  if (params.channelId != null) listQ += ` AND m.ChannelID = @channelId`;
  if (params.direction) listQ += ` AND m.Direction = @direction`;
  if (fromNum) listQ += ` AND m.FromNumber LIKE @fromNumber`;
  if (toNum) listQ += ` AND m.ToNumber LIKE @toNumber`;
  if (params.fromDate) listQ += ` AND (m.SentAt >= @fromDate OR m.ReceivedAt >= @fromDate)`;
  if (params.toDate) listQ += ` AND (m.SentAt <= @toDate OR m.ReceivedAt <= @toDate)`;
  listQ += ` ORDER BY COALESCE(m.SentAt, m.ReceivedAt) DESC OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;

  let listR = req;
  if (params.channelId != null) listR = listR.input('channelId', params.channelId);
  if (params.direction) listR = listR.input('direction', params.direction);
  if (fromNum) listR = listR.input('fromNumber', fromNum);
  if (toNum) listR = listR.input('toNumber', toNum);
  if (params.fromDate) listR = listR.input('fromDate', params.fromDate);
  if (params.toDate) listR = listR.input('toDate', params.toDate);
  const listResult = await listR.query(listQ);
  const rows = (listResult.recordset || []) as Record<string, unknown>[];
  const messages: MessageListItem[] = rows.map((r) => ({
    messageId: r.MessageID as number,
    channelId: r.ChannelID as number,
    channelName: (r.ChannelName as string) ?? '',
    direction: r.Direction as string,
    fromNumber: r.FromNumber as string,
    toNumber: r.ToNumber as string,
    body: (r.Body as string) ?? null,
    messageType: (r.MessageType as string) ?? 'text',
    status: (r.Status as string) ?? null,
    sentByUserId: (r.SentByUserID as number) ?? null,
    sentByName: (r.SentByName as string) ?? null,
    receivedAt: r.ReceivedAt ? new Date(r.ReceivedAt as Date).toISOString() : null,
    sentAt: r.SentAt ? new Date(r.SentAt as Date).toISOString() : null,
  }));

  return { messages, total };
}

// --- Dashboard stats ---

export interface DashboardStats {
  totalSent: number;
  totalReceived: number;
  sentToday: number;
  receivedToday: number;
  messagesByChannel: { channelName: string; channelId: number; sent: number; received: number }[];
  messagesByDay: { date: string; sent: number; received: number }[];
  topSenders: { userId: number; userName: string; count: number }[];
}

export async function getDashboardStats(days: number = 30): Promise<DashboardStats> {
  const safeDays = Math.max(1, Math.min(365, Number(days) || 30));

  const [totals, byChannel, byDay, topSenders] = await Promise.all([
    (await getRequest()).query(`
      SELECT
        SUM(CASE WHEN Direction = 'outbound' THEN 1 ELSE 0 END) AS TotalSent,
        SUM(CASE WHEN Direction = 'inbound' THEN 1 ELSE 0 END) AS TotalReceived,
        SUM(CASE WHEN Direction = 'outbound' AND (SentAt >= CAST(GETDATE() AS DATE)) THEN 1 ELSE 0 END) AS SentToday,
        SUM(CASE WHEN Direction = 'inbound' AND (ReceivedAt >= CAST(GETDATE() AS DATE)) THEN 1 ELSE 0 END) AS ReceivedToday
      FROM ${MESSAGE_TABLE}
    `),
    (await getRequest()).query(`
      SELECT c.ChannelID, c.Name AS ChannelName,
        ISNULL(SUM(CASE WHEN m.Direction = 'outbound' THEN 1 ELSE 0 END), 0) AS Sent,
        ISNULL(SUM(CASE WHEN m.Direction = 'inbound' THEN 1 ELSE 0 END), 0) AS Received
      FROM ${CHANNEL_TABLE} c
      LEFT JOIN ${MESSAGE_TABLE} m ON m.ChannelID = c.ChannelID AND (m.SentAt >= DATEADD(day, -${safeDays}, GETDATE()) OR m.ReceivedAt >= DATEADD(day, -${safeDays}, GETDATE()))
      GROUP BY c.ChannelID, c.Name
    `),
    (await getRequest()).query(`
      SELECT CONVERT(date, COALESCE(m.SentAt, m.ReceivedAt)) AS Dt,
        SUM(CASE WHEN m.Direction = 'outbound' THEN 1 ELSE 0 END) AS Sent,
        SUM(CASE WHEN m.Direction = 'inbound' THEN 1 ELSE 0 END) AS Received
      FROM ${MESSAGE_TABLE} m
      WHERE COALESCE(m.SentAt, m.ReceivedAt) >= DATEADD(day, -${safeDays}, GETDATE())
      GROUP BY CONVERT(date, COALESCE(m.SentAt, m.ReceivedAt))
      ORDER BY Dt
    `),
    (await getRequest()).query(`
      SELECT TOP 10 m.SentByUserID AS UserId, u.name AS UserName, COUNT(*) AS Cnt
      FROM ${MESSAGE_TABLE} m
      LEFT JOIN dbo.rb_users u ON u.userid = m.SentByUserID
      WHERE m.Direction = 'outbound' AND m.SentAt >= DATEADD(day, -${safeDays}, GETDATE())
      GROUP BY m.SentByUserID, u.name
      ORDER BY Cnt DESC
    `),
  ]);

  const t = (totals.recordset as { TotalSent: number; TotalReceived: number; SentToday: number; ReceivedToday: number }[])?.[0];
  const bc = (byChannel.recordset || []) as { ChannelID: number; ChannelName: string; Sent: number; Received: number }[];
  const bd = (byDay.recordset || []) as { Dt: Date; Sent: number; Received: number }[];
  const ts = (topSenders.recordset || []) as { UserId: number; UserName: string; Cnt: number }[];

  return {
    totalSent: t?.TotalSent ?? 0,
    totalReceived: t?.TotalReceived ?? 0,
    sentToday: t?.SentToday ?? 0,
    receivedToday: t?.ReceivedToday ?? 0,
    messagesByChannel: bc.map((r) => ({ channelId: r.ChannelID, channelName: r.ChannelName, sent: r.Sent, received: r.Received })),
    messagesByDay: bd.map((r) => ({
      date: r.Dt instanceof Date ? r.Dt.toISOString().slice(0, 10) : String(r.Dt).slice(0, 10),
      sent: r.Sent,
      received: r.Received,
    })),
    topSenders: ts.map((r) => ({ userId: r.UserId, userName: r.UserName ?? 'Unknown', count: r.Cnt })),
  };
}
