/**
 * Lead Conversation Service – CRUD and actions for utbl_Leads_Conversation
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type {
  Conversation,
  ConversationMessage,
  ConversationStatus,
  InboxChannelType,
  PaginatedResult,
} from './leads.types';

const SCHEMA = config.db.schema || 'dbo';
const CONV = `[${SCHEMA}].[utbl_Leads_Conversation]`;
const MSG = `[${SCHEMA}].[utbl_Leads_ConversationMessage]`;
const CHANNEL = `[${SCHEMA}].[utbl_Leads_InboxChannel]`;
const LEAD = `[${SCHEMA}].[utbl_Leads_Master]`;
const CLIENT = `[${SCHEMA}].[utbl_Client]`;
const USER = `[${SCHEMA}].[utbl_Users_Master]`;

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}
function dateToIsoOrNull(d: unknown): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

export interface ListConversationsParams {
  channelType?: string;
  status?: string;
  assignedToUserId?: number;
  leadId?: number;
  search?: string;
  page: number;
  pageSize: number;
}

export interface GetMessagesParams {
  page: number;
  pageSize: number;
}

export interface ReplyData {
  body: string;
  mediaUrl?: string;
  channelType?: string;
}

export interface InternalNoteData {
  body: string;
}

export interface UpdateStatusData {
  status: string;
  snoozedUntil?: string | null;
}

export interface AssignData {
  assignedToUserId: number | null;
}

export interface LinkLeadData {
  leadId: number;
}

export interface FindOrCreateConversationParamsPhoneEmail {
  externalPhone?: string | null;
  externalEmail?: string | null;
  externalName?: string | null;
}

export interface FindOrCreateConversationParamsSocial {
  inboxChannelId: number;
  externalSocialId: string;
  externalName?: string | null;
  externalSocialProfilePic?: string | null;
}

export type FindOrCreateConversationParams =
  | FindOrCreateConversationParamsPhoneEmail
  | (FindOrCreateConversationParamsSocial & { _variant?: 'social' });

export interface AddMessageParams {
  direction: 'INBOUND' | 'OUTBOUND';
  messageText?: string | null;
  messageHtml?: string | null;
  subject?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  isInternal?: boolean;
  senderUserId?: number | null;
  isForwarded?: boolean;
  originalSenderEmail?: string | null;
  originalSenderName?: string | null;
}

export async function findOrCreateConversation(
  inboxChannelIdOrParams: number | FindOrCreateConversationParamsSocial,
  params?: FindOrCreateConversationParamsPhoneEmail
): Promise<Conversation> {
  const isSocial = typeof inboxChannelIdOrParams === 'object';
  if (isSocial) {
    const p = inboxChannelIdOrParams as FindOrCreateConversationParamsSocial;
    const { inboxChannelId, externalSocialId, externalName, externalSocialProfilePic } = p;
    const req = await getRequest();
    req.input('inboxChannelId', inboxChannelId);
    req.input('externalSocialId', externalSocialId.trim().slice(0, 200));
    req.input('externalName', externalName ? externalName.trim().slice(0, 200) : null);
    req.input('externalSocialProfilePic', externalSocialProfilePic ? externalSocialProfilePic.trim().slice(0, 500) : null);

    const result = await req.query(`
      SELECT TOP 1 c.ConversationId AS conversationId, c.InboxChannelId AS inboxChannelId,
             ch.ChannelType AS channelType, ch.DisplayName AS channelDisplayName,
             c.ExternalPhone AS externalPhone, c.ExternalEmail AS externalEmail,
             c.ExternalSocialId AS externalSocialId, c.ExternalSocialUsername AS externalSocialUsername,
             c.ExternalSocialProfilePic AS externalSocialProfilePic, c.ExternalName AS externalName,
             c.LeadId AS leadId, l.LeadCode AS leadCode, l.CompanyName AS leadCompanyName,
             c.ClientId AS clientId, cl.ClientName AS clientName,
             c.IsExistingClient AS isExistingClient,
             c.Status AS status, c.SnoozedUntil AS snoozedUntil,
             c.AssignedToUserId AS assignedToUserId, u.Name AS assignedToName,
             c.LastMessageAt AS lastMessageAt, c.LastMessagePreview AS lastMessagePreview,
             c.UnreadCount AS unreadCount, c.IsActive AS isActive, c.CreatedOn AS createdOn
      FROM ${CONV} c
      INNER JOIN ${CHANNEL} ch ON ch.InboxChannelId = c.InboxChannelId
      LEFT JOIN ${LEAD} l ON l.LeadId = c.LeadId
      LEFT JOIN ${CLIENT} cl ON cl.Id = c.ClientId
      LEFT JOIN ${USER} u ON u.UserId = c.AssignedToUserId
      WHERE c.InboxChannelId = @inboxChannelId AND c.ExternalSocialId = @externalSocialId AND c.IsActive = 1
    `);
    const existing = result.recordset?.[0];
    if (existing) return mapConversation(existing);

    const insertReq = await getRequest();
    insertReq.input('inboxChannelId', inboxChannelId);
    insertReq.input('externalSocialId', externalSocialId.trim().slice(0, 200));
    insertReq.input('externalName', externalName ? externalName.trim().slice(0, 200) : null);
    insertReq.input('externalSocialProfilePic', externalSocialProfilePic ? externalSocialProfilePic.trim().slice(0, 500) : null);

    const insertResult = await insertReq.query(`
      DECLARE @out TABLE (ConversationId BIGINT);
      INSERT INTO ${CONV} (InboxChannelId, ExternalSocialId, ExternalName, ExternalSocialProfilePic)
      OUTPUT INSERTED.ConversationId INTO @out
      VALUES (@inboxChannelId, @externalSocialId, @externalName, @externalSocialProfilePic);
      SELECT ConversationId FROM @out;
    `);
    const newId = (insertResult.recordset as { ConversationId: number }[])[0]?.ConversationId;
    const conv = await getConversation(newId!);
    return conv!;
  }

  const inboxChannelId = inboxChannelIdOrParams as number;
  const { externalPhone, externalEmail, externalName } = params!;
  const hasPhone = externalPhone && String(externalPhone).trim();
  const hasEmail = externalEmail && String(externalEmail).trim();
  if (!hasPhone && !hasEmail) {
    throw new Error('At least one of externalPhone or externalEmail is required');
  }

  const req = await getRequest();
  req.input('inboxChannelId', inboxChannelId);
  req.input('externalPhone', hasPhone ? String(externalPhone).trim().slice(0, 30) : null);
  req.input('externalEmail', hasEmail ? String(externalEmail).trim().slice(0, 256) : null);

  const result = await req.query(`
    SELECT TOP 1 c.ConversationId AS conversationId, c.InboxChannelId AS inboxChannelId,
           ch.ChannelType AS channelType, ch.DisplayName AS channelDisplayName,
           c.ExternalPhone AS externalPhone, c.ExternalEmail AS externalEmail,
           c.ExternalSocialId AS externalSocialId, c.ExternalSocialUsername AS externalSocialUsername,
           c.ExternalSocialProfilePic AS externalSocialProfilePic, c.ExternalName AS externalName,
           c.LeadId AS leadId, l.LeadCode AS leadCode, l.CompanyName AS leadCompanyName,
           c.ClientId AS clientId, cl.ClientName AS clientName,
           c.IsExistingClient AS isExistingClient,
           c.Status AS status, c.SnoozedUntil AS snoozedUntil,
           c.AssignedToUserId AS assignedToUserId, u.Name AS assignedToName,
           c.LastMessageAt AS lastMessageAt, c.LastMessagePreview AS lastMessagePreview,
           c.UnreadCount AS unreadCount, c.IsActive AS isActive, c.CreatedOn AS createdOn
    FROM ${CONV} c
    INNER JOIN ${CHANNEL} ch ON ch.InboxChannelId = c.InboxChannelId
    LEFT JOIN ${LEAD} l ON l.LeadId = c.LeadId
    LEFT JOIN ${CLIENT} cl ON cl.Id = c.ClientId
    LEFT JOIN ${USER} u ON u.UserId = c.AssignedToUserId
    WHERE c.InboxChannelId = @inboxChannelId AND c.IsActive = 1
      AND (
        (@externalPhone IS NOT NULL AND c.ExternalPhone = @externalPhone)
        OR (@externalEmail IS NOT NULL AND c.ExternalEmail = @externalEmail)
      )
  `);

  const existing = result.recordset?.[0];
  if (existing) {
    return mapConversation(existing);
  }

  const insertReq = await getRequest();
  insertReq.input('inboxChannelId', inboxChannelId);
  insertReq.input('externalPhone', hasPhone ? String(externalPhone).trim().slice(0, 30) : null);
  insertReq.input('externalEmail', hasEmail ? String(externalEmail).trim().slice(0, 256) : null);
  insertReq.input('externalName', externalName ? String(externalName).trim().slice(0, 200) : null);

  const insertResult = await insertReq.query(`
    DECLARE @out TABLE (ConversationId BIGINT);
    INSERT INTO ${CONV} (InboxChannelId, ExternalPhone, ExternalEmail, ExternalName)
    OUTPUT INSERTED.ConversationId INTO @out
    VALUES (@inboxChannelId, @externalPhone, @externalEmail, @externalName);
    SELECT ConversationId FROM @out;
  `);
  const newId = (insertResult.recordset as { ConversationId: number }[])[0]?.ConversationId;
  if (!newId) throw new Error('Failed to create conversation');

  const conv = await getConversation(newId);
  return conv!;
}

export async function addMessage(
  conversationId: number,
  params: AddMessageParams
): Promise<ConversationMessage> {
  const req = await getRequest();
  req.input('conversationId', conversationId);
  req.input('direction', params.direction);
  req.input('isInternal', params.isInternal ? 1 : 0);
  req.input('senderUserId', params.senderUserId ?? null);
  req.input('messageText', params.messageText ? String(params.messageText).trim().slice(0, 10000) : null);
  req.input('messageHtml', params.messageHtml ? String(params.messageHtml).trim().slice(0, 100000) : null);
  req.input('subject', params.subject ? String(params.subject).trim().slice(0, 300) : null);
  req.input('mediaUrl', params.mediaUrl ? String(params.mediaUrl).trim().slice(0, 500) : null);
  req.input('mediaType', params.mediaType ? String(params.mediaType).trim().slice(0, 50) : null);
  req.input('isForwarded', params.isForwarded ? 1 : 0);
  req.input('originalSenderEmail', params.originalSenderEmail ? String(params.originalSenderEmail).trim().slice(0, 256) : null);
  req.input('originalSenderName', params.originalSenderName ? String(params.originalSenderName).trim().slice(0, 200) : null);

  const result = await req.query(`
    DECLARE @out TABLE (MessageId BIGINT);
    INSERT INTO ${MSG} (ConversationId, Direction, IsInternal, SenderUserId, MessageText, MessageHtml, Subject, MediaUrl, MediaType, IsForwarded, OriginalSenderEmail, OriginalSenderName)
    OUTPUT INSERTED.MessageId INTO @out
    VALUES (@conversationId, @direction, @isInternal, @senderUserId, @messageText, @messageHtml, @subject, @mediaUrl, @mediaType, @isForwarded, @originalSenderEmail, @originalSenderName);
    SELECT MessageId FROM @out;
  `);
  const messageId = (result.recordset as { MessageId: number }[])[0]?.MessageId;

  const preview = params.messageText
    ? String(params.messageText).trim().slice(0, 300)
    : params.subject
      ? String(params.subject).trim().slice(0, 300)
      : null;

  if (preview) {
    await updateConversationLastMessage(conversationId, preview);
  }

  if (params.direction === 'INBOUND') {
    const incReq = await getRequest();
    incReq.input('id', conversationId);
    await incReq.query(`
      UPDATE ${CONV}
      SET UnreadCount = UnreadCount + 1
      WHERE ConversationId = @id
    `);
  }

  const msgReq = await getRequest();
  const msgResult = await msgReq.input('messageId', messageId).query(`
    SELECT m.MessageId AS messageId, m.ConversationId AS conversationId,
           m.Direction AS direction, m.IsInternal AS isInternal,
           m.SenderUserId AS senderUserId, u.Name AS senderName,
           m.MessageText AS messageText, m.MessageHtml AS messageHtml,
           m.Subject AS subject, m.MediaUrl AS mediaUrl, m.MediaType AS mediaType,
           m.IsForwarded AS isForwarded, m.OriginalSenderEmail AS originalSenderEmail,
           m.OriginalSenderName AS originalSenderName, m.CreatedOn AS createdOn
    FROM ${MSG} m
    LEFT JOIN ${USER} u ON u.UserId = m.SenderUserId
    WHERE m.MessageId = @messageId
  `);
  const r = msgResult.recordset?.[0];
  return r ? mapMessage(r) : ({} as ConversationMessage);
}

function mapConversation(r: Record<string, unknown>): Conversation {
  return {
    conversationId: (r.conversationId ?? r.ConversationId) as number,
    inboxChannelId: (r.inboxChannelId ?? r.InboxChannelId) as number,
    channelType: (r.channelType ?? r.ChannelType) as InboxChannelType,
    channelDisplayName: (r.channelDisplayName ?? r.ChannelDisplayName ?? '') as string,
    externalPhone: (r.externalPhone ?? r.ExternalPhone) as string | null,
    externalEmail: (r.externalEmail ?? r.ExternalEmail) as string | null,
    externalSocialId: (r.externalSocialId ?? r.ExternalSocialId) as string | null,
    externalSocialUsername: (r.externalSocialUsername ?? r.ExternalSocialUsername) as string | null,
    externalSocialProfilePic: (r.externalSocialProfilePic ?? r.ExternalSocialProfilePic) as string | null,
    externalName: (r.externalName ?? r.ExternalName) as string | null,
    leadId: (r.leadId ?? r.LeadId) as number | null,
    leadCode: (r.leadCode ?? r.LeadCode) as string | null,
    leadCompanyName: (r.leadCompanyName ?? r.LeadCompanyName) as string | null,
    clientId: (r.clientId ?? r.ClientId) as number | null,
    clientName: (r.clientName ?? r.ClientName) as string | null,
    isExistingClient: !!(r.isExistingClient ?? r.IsExistingClient),
    status: (r.status ?? r.Status) as ConversationStatus,
    snoozedUntil: dateToIsoOrNull(r.snoozedUntil ?? r.SnoozedUntil),
    assignedToUserId: (r.assignedToUserId ?? r.AssignedToUserId) as number | null,
    assignedToName: (r.assignedToName ?? r.AssignedToName) as string | null,
    lastMessageAt: dateToIsoOrNull(r.lastMessageAt ?? r.LastMessageAt),
    lastMessagePreview: (r.lastMessagePreview ?? r.LastMessagePreview) as string | null,
    unreadCount: Number((r.unreadCount ?? r.UnreadCount) ?? 0),
    isActive: !!(r.isActive ?? r.IsActive),
    createdOn: dateToIso(r.createdOn ?? r.CreatedOn),
  };
}

function mapMessage(r: Record<string, unknown>): ConversationMessage {
  return {
    messageId: (r.messageId ?? r.MessageId) as number,
    conversationId: (r.conversationId ?? r.ConversationId) as number,
    direction: (r.direction ?? r.Direction) as 'INBOUND' | 'OUTBOUND',
    isInternal: !!(r.isInternal ?? r.IsInternal),
    senderUserId: (r.senderUserId ?? r.SenderUserId) as number | null,
    senderName: (r.senderName ?? r.SenderName) as string | null,
    messageText: (r.messageText ?? r.MessageText) as string | null,
    messageHtml: (r.messageHtml ?? r.MessageHtml) as string | null,
    subject: (r.subject ?? r.Subject) as string | null,
    mediaUrl: (r.mediaUrl ?? r.MediaUrl) as string | null,
    mediaType: (r.mediaType ?? r.MediaType) as string | null,
    isForwarded: !!(r.isForwarded ?? r.IsForwarded),
    originalSenderEmail: (r.originalSenderEmail ?? r.OriginalSenderEmail) as string | null,
    originalSenderName: (r.originalSenderName ?? r.OriginalSenderName) as string | null,
    createdOn: dateToIso(r.createdOn ?? r.CreatedOn),
  };
}

export async function listConversations(
  params: ListConversationsParams
): Promise<PaginatedResult<Conversation> & { data: Conversation[] }> {
  const { channelType, status, assignedToUserId, leadId, search, page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  const req = await getRequest();
  req.input('channelType', channelType ?? null);
  req.input('status', status ?? null);
  req.input('assignedToUserId', assignedToUserId ?? null);
  req.input('leadId', leadId ?? null);
  req.input('search', search ? `%${search.trim()}%` : null);
  req.input('offset', offset);
  req.input('pageSize', pageSize);

  const countResult = await req.query(`
    SELECT COUNT(*) AS total
    FROM ${CONV} c
    INNER JOIN ${CHANNEL} ch ON ch.InboxChannelId = c.InboxChannelId
    LEFT JOIN ${LEAD} l ON l.LeadId = c.LeadId
    LEFT JOIN ${CLIENT} cl ON cl.Id = c.ClientId
    LEFT JOIN ${USER} u ON u.UserId = c.AssignedToUserId
    WHERE c.IsActive = 1
      AND (@channelType IS NULL OR ch.ChannelType = @channelType)
      AND (@status IS NULL OR c.Status = @status)
      AND (@assignedToUserId IS NULL OR c.AssignedToUserId = @assignedToUserId)
      AND (@leadId IS NULL OR c.LeadId = @leadId)
      AND (@search IS NULL OR c.ExternalPhone LIKE @search OR c.ExternalEmail LIKE @search
           OR c.ExternalName LIKE @search OR c.LastMessagePreview LIKE @search
           OR l.CompanyName LIKE @search OR l.ContactName LIKE @search)
  `);
  const total = (countResult.recordset?.[0] as { total: number })?.total ?? 0;

  const dataReq = await getRequest();
  dataReq.input('channelType', channelType ?? null);
  dataReq.input('status', status ?? null);
  dataReq.input('assignedToUserId', assignedToUserId ?? null);
  dataReq.input('leadId', leadId ?? null);
  dataReq.input('search', search ? `%${search.trim()}%` : null);
  dataReq.input('offset', offset);
  dataReq.input('pageSize', pageSize);

  const dataResult = await dataReq.query(`
    SELECT c.ConversationId AS conversationId, c.InboxChannelId AS inboxChannelId,
           ch.ChannelType AS channelType, ch.DisplayName AS channelDisplayName,
           c.ExternalPhone AS externalPhone, c.ExternalEmail AS externalEmail,
           c.ExternalSocialId AS externalSocialId, c.ExternalSocialUsername AS externalSocialUsername,
           c.ExternalSocialProfilePic AS externalSocialProfilePic, c.ExternalName AS externalName,
           c.LeadId AS leadId, l.LeadCode AS leadCode, l.CompanyName AS leadCompanyName,
           c.ClientId AS clientId, cl.ClientName AS clientName,
           c.IsExistingClient AS isExistingClient,
           c.Status AS status, c.SnoozedUntil AS snoozedUntil,
           c.AssignedToUserId AS assignedToUserId, u.Name AS assignedToName,
           c.LastMessageAt AS lastMessageAt, c.LastMessagePreview AS lastMessagePreview,
           c.UnreadCount AS unreadCount, c.IsActive AS isActive, c.CreatedOn AS createdOn
    FROM ${CONV} c
    INNER JOIN ${CHANNEL} ch ON ch.InboxChannelId = c.InboxChannelId
    LEFT JOIN ${LEAD} l ON l.LeadId = c.LeadId
    LEFT JOIN ${CLIENT} cl ON cl.Id = c.ClientId
    LEFT JOIN ${USER} u ON u.UserId = c.AssignedToUserId
    WHERE c.IsActive = 1
      AND (@channelType IS NULL OR ch.ChannelType = @channelType)
      AND (@status IS NULL OR c.Status = @status)
      AND (@assignedToUserId IS NULL OR c.AssignedToUserId = @assignedToUserId)
      AND (@leadId IS NULL OR c.LeadId = @leadId)
      AND (@search IS NULL OR c.ExternalPhone LIKE @search OR c.ExternalEmail LIKE @search
           OR c.ExternalName LIKE @search OR c.LastMessagePreview LIKE @search
           OR l.CompanyName LIKE @search OR l.ContactName LIKE @search)
    ORDER BY CASE WHEN c.LastMessageAt IS NULL THEN 1 ELSE 0 END, c.LastMessageAt DESC, c.ConversationId DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  const data = (dataResult.recordset || []).map(mapConversation);
  return { data, total, page, pageSize };
}

export interface AddInboundMessageData {
  messageText?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  metaMessageId?: string | null;
}

export interface AddOutboundMessageData {
  messageText?: string | null;
  mediaUrl?: string | null;
  senderUserId?: number | null;
}

export async function addInboundMessage(
  conversationId: number,
  data: AddInboundMessageData
): Promise<void> {
  const req = await getRequest();
  req.input('conversationId', conversationId);
  req.input('messageText', data.messageText ? data.messageText.trim().slice(0, 10000) : null);
  req.input('mediaUrl', data.mediaUrl ? data.mediaUrl.trim().slice(0, 500) : null);
  req.input('mediaType', data.mediaType ? data.mediaType.trim().slice(0, 50) : null);
  req.input('metaMessageId', data.metaMessageId ? data.metaMessageId.trim().slice(0, 200) : null);

  await req.query(`
    INSERT INTO ${MSG} (ConversationId, Direction, IsInternal, MessageText, MediaUrl, MediaType, MetaMessageId)
    VALUES (@conversationId, 'INBOUND', 0, @messageText, @mediaUrl, @mediaType, @metaMessageId);
  `);

  const preview = (data.messageText || data.mediaUrl || '[Media]').trim().slice(0, 300);
  const updReq = await getRequest();
  updReq.input('id', conversationId);
  updReq.input('preview', preview);
  await updReq.query(`
    UPDATE ${CONV}
    SET LastMessageAt = GETDATE(), LastMessagePreview = @preview, UnreadCount = UnreadCount + 1
    WHERE ConversationId = @id
  `);
}

export async function addOutboundMessage(
  conversationId: number,
  data: AddOutboundMessageData
): Promise<void> {
  const req = await getRequest();
  req.input('conversationId', conversationId);
  req.input('messageText', data.messageText ? data.messageText.trim().slice(0, 10000) : null);
  req.input('mediaUrl', data.mediaUrl ? data.mediaUrl.trim().slice(0, 500) : null);
  req.input('senderUserId', data.senderUserId ?? null);

  await req.query(`
    INSERT INTO ${MSG} (ConversationId, Direction, IsInternal, SenderUserId, MessageText, MediaUrl)
    VALUES (@conversationId, 'OUTBOUND', 0, @senderUserId, @messageText, @mediaUrl);
  `);

  const preview = (data.messageText || data.mediaUrl || '[Media]').trim().slice(0, 300);
  await updateConversationLastMessage(conversationId, preview);
}

export async function getConversation(id: number): Promise<Conversation | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT c.ConversationId AS conversationId, c.InboxChannelId AS inboxChannelId,
           ch.ChannelType AS channelType, ch.DisplayName AS channelDisplayName,
           c.ExternalPhone AS externalPhone, c.ExternalEmail AS externalEmail,
           c.ExternalSocialId AS externalSocialId, c.ExternalSocialUsername AS externalSocialUsername,
           c.ExternalSocialProfilePic AS externalSocialProfilePic, c.ExternalName AS externalName,
           c.LeadId AS leadId, l.LeadCode AS leadCode, l.CompanyName AS leadCompanyName,
           c.ClientId AS clientId, cl.ClientName AS clientName,
           c.IsExistingClient AS isExistingClient,
           c.Status AS status, c.SnoozedUntil AS snoozedUntil,
           c.AssignedToUserId AS assignedToUserId, u.Name AS assignedToName,
           c.LastMessageAt AS lastMessageAt, c.LastMessagePreview AS lastMessagePreview,
           c.UnreadCount AS unreadCount, c.IsActive AS isActive, c.CreatedOn AS createdOn
    FROM ${CONV} c
    INNER JOIN ${CHANNEL} ch ON ch.InboxChannelId = c.InboxChannelId
    LEFT JOIN ${LEAD} l ON l.LeadId = c.LeadId
    LEFT JOIN ${CLIENT} cl ON cl.Id = c.ClientId
    LEFT JOIN ${USER} u ON u.UserId = c.AssignedToUserId
    WHERE c.ConversationId = @id
  `);
  const r = result.recordset?.[0];
  return r ? mapConversation(r) : null;
}

export async function getMessages(
  conversationId: number,
  params: GetMessagesParams
): Promise<PaginatedResult<ConversationMessage> & { data: ConversationMessage[] }> {
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  const countReq = await getRequest();
  const countResult = await countReq.input('conversationId', conversationId).query(`
    SELECT COUNT(*) AS total FROM ${MSG} WHERE ConversationId = @conversationId
  `);
  const total = (countResult.recordset?.[0] as { total: number })?.total ?? 0;

  const dataReq = await getRequest();
  dataReq.input('conversationId', conversationId);
  dataReq.input('offset', offset);
  dataReq.input('pageSize', pageSize);

  const dataResult = await dataReq.query(`
    SELECT m.MessageId AS messageId, m.ConversationId AS conversationId,
           m.Direction AS direction, m.IsInternal AS isInternal,
           m.SenderUserId AS senderUserId, u.Name AS senderName,
           m.MessageText AS messageText, m.MessageHtml AS messageHtml,
           m.Subject AS subject, m.MediaUrl AS mediaUrl, m.MediaType AS mediaType,
           m.IsForwarded AS isForwarded, m.OriginalSenderEmail AS originalSenderEmail,
           m.OriginalSenderName AS originalSenderName, m.CreatedOn AS createdOn
    FROM ${MSG} m
    LEFT JOIN ${USER} u ON u.UserId = m.SenderUserId
    WHERE m.ConversationId = @conversationId
    ORDER BY m.CreatedOn ASC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  const data = (dataResult.recordset || []).map(mapMessage);
  return { data, total, page, pageSize };
}

export async function replyToConversation(
  conversationId: number,
  data: ReplyData,
  userId: number
): Promise<ConversationMessage> {
  const req = await getRequest();
  req.input('conversationId', conversationId);
  req.input('body', (data.body || '').trim().slice(0, 10000));
  req.input('mediaUrl', data.mediaUrl ? data.mediaUrl.trim().slice(0, 500) : null);
  req.input('senderUserId', userId);

  const result = await req.query(`
    DECLARE @out TABLE (MessageId BIGINT);
    INSERT INTO ${MSG} (ConversationId, Direction, IsInternal, SenderUserId, MessageText, MediaUrl)
    OUTPUT INSERTED.MessageId INTO @out
    VALUES (@conversationId, 'OUTBOUND', 0, @senderUserId, @body, @mediaUrl);
    SELECT MessageId FROM @out;
  `);
  const messageId = (result.recordset as { MessageId: number }[])[0]?.MessageId;

  await updateConversationLastMessage(conversationId, (data.body || '').trim().slice(0, 300));

  const msgReq = await getRequest();
  const msgResult = await msgReq.input('messageId', messageId).query(`
    SELECT m.MessageId AS messageId, m.ConversationId AS conversationId,
           m.Direction AS direction, m.IsInternal AS isInternal,
           m.SenderUserId AS senderUserId, u.Name AS senderName,
           m.MessageText AS messageText, m.MessageHtml AS messageHtml,
           m.Subject AS subject, m.MediaUrl AS mediaUrl, m.MediaType AS mediaType,
           m.IsForwarded AS isForwarded, m.OriginalSenderEmail AS originalSenderEmail,
           m.OriginalSenderName AS originalSenderName, m.CreatedOn AS createdOn
    FROM ${MSG} m
    LEFT JOIN ${USER} u ON u.UserId = m.SenderUserId
    WHERE m.MessageId = @messageId
  `);
  const r = msgResult.recordset?.[0];
  return r ? mapMessage(r) : ({} as ConversationMessage);
}

export async function addInternalNote(
  conversationId: number,
  data: InternalNoteData,
  userId: number
): Promise<ConversationMessage> {
  const req = await getRequest();
  req.input('conversationId', conversationId);
  req.input('body', (data.body || '').trim().slice(0, 10000));
  req.input('senderUserId', userId);

  const result = await req.query(`
    DECLARE @out TABLE (MessageId BIGINT);
    INSERT INTO ${MSG} (ConversationId, Direction, IsInternal, SenderUserId, MessageText)
    OUTPUT INSERTED.MessageId INTO @out
    VALUES (@conversationId, 'OUTBOUND', 1, @senderUserId, @body);
    SELECT MessageId FROM @out;
  `);
  const messageId = (result.recordset as { MessageId: number }[])[0]?.MessageId;

  const msgReq = await getRequest();
  const msgResult = await msgReq.input('messageId', messageId).query(`
    SELECT m.MessageId AS messageId, m.ConversationId AS conversationId,
           m.Direction AS direction, m.IsInternal AS isInternal,
           m.SenderUserId AS senderUserId, u.Name AS senderName,
           m.MessageText AS messageText, m.MessageHtml AS messageHtml,
           m.Subject AS subject, m.MediaUrl AS mediaUrl, m.MediaType AS mediaType,
           m.IsForwarded AS isForwarded, m.OriginalSenderEmail AS originalSenderEmail,
           m.OriginalSenderName AS originalSenderName, m.CreatedOn AS createdOn
    FROM ${MSG} m
    LEFT JOIN ${USER} u ON u.UserId = m.SenderUserId
    WHERE m.MessageId = @messageId
  `);
  const r = msgResult.recordset?.[0];
  return r ? mapMessage(r) : ({} as ConversationMessage);
}

export async function updateConversationStatus(
  conversationId: number,
  data: UpdateStatusData,
  _userId: number
): Promise<Conversation | null> {
  const req = await getRequest();
  req.input('id', conversationId);
  req.input('status', (data.status || '').trim().slice(0, 20));
  req.input('snoozedUntil', data.snoozedUntil ?? null);

  await req.query(`
    UPDATE ${CONV}
    SET Status = @status, SnoozedUntil = @snoozedUntil
    WHERE ConversationId = @id
  `);
  return getConversation(conversationId);
}

export async function assignConversation(
  conversationId: number,
  data: AssignData,
  _userId: number
): Promise<Conversation | null> {
  const req = await getRequest();
  req.input('id', conversationId);
  req.input('assignedToUserId', data.assignedToUserId ?? null);

  await req.query(`
    UPDATE ${CONV}
    SET AssignedToUserId = @assignedToUserId
    WHERE ConversationId = @id
  `);
  return getConversation(conversationId);
}

export async function linkConversationToLead(
  conversationId: number,
  data: LinkLeadData,
  _userId: number
): Promise<Conversation | null> {
  const req = await getRequest();
  req.input('id', conversationId);
  req.input('leadId', data.leadId);

  await req.query(`
    UPDATE ${CONV}
    SET LeadId = @leadId
    WHERE ConversationId = @id
  `);
  return getConversation(conversationId);
}

export async function createLeadFromConversation(
  conversationId: number,
  userId: number
): Promise<{ leadId: number; conversation: Conversation }> {
  const conv = await getConversation(conversationId);
  if (!conv) throw new Error('Conversation not found');

  const leadService = await import('./leads.service');
  const leadId = await leadService.createLead(
    {
      contactName: conv.externalName || conv.externalEmail || conv.externalPhone || 'Unknown',
      email: conv.externalEmail ?? undefined,
      phone: conv.externalPhone ?? undefined,
      whatsAppNumber: conv.externalPhone ?? undefined,
    },
    userId
  );

  await linkConversationToLead(conversationId, { leadId }, userId);
  const updated = await getConversation(conversationId);
  return { leadId, conversation: updated! };
}

export async function getConversationStats(): Promise<{
  total: number;
  open: number;
  pending: number;
  resolved: number;
  snoozed: number;
  unread: number;
}> {
  const req = await getRequest();
  const result = await req.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN Status = 'Open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN Status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
      SUM(CASE WHEN Status = 'Snoozed' THEN 1 ELSE 0 END) AS snoozed,
      SUM(UnreadCount) AS unread
    FROM ${CONV}
    WHERE IsActive = 1
  `);
  const r = result.recordset?.[0] as Record<string, number>;
  return {
    total: r?.total ?? 0,
    open: r?.open ?? 0,
    pending: r?.pending ?? 0,
    resolved: r?.resolved ?? 0,
    snoozed: r?.snoozed ?? 0,
    unread: r?.unread ?? 0,
  };
}

export async function markConversationRead(
  conversationId: number,
  _userId: number
): Promise<Conversation | null> {
  const req = await getRequest();
  req.input('id', conversationId);

  await req.query(`
    UPDATE ${CONV}
    SET UnreadCount = 0
    WHERE ConversationId = @id
  `);
  return getConversation(conversationId);
}

async function updateConversationLastMessage(conversationId: number, preview: string): Promise<void> {
  const req = await getRequest();
  req.input('id', conversationId);
  req.input('preview', preview.slice(0, 300));
  await req.query(`
    UPDATE ${CONV}
    SET LastMessageAt = GETDATE(), LastMessagePreview = @preview
    WHERE ConversationId = @id
  `);
}
