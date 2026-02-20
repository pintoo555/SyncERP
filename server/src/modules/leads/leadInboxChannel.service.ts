/**
 * Lead Inbox Channel Service – CRUD for utbl_Leads_InboxChannel
 * Supports WhatsApp, Email, Facebook Messenger, and Instagram channels.
 */

import { getRequest } from '../../config/db';
import { extractUsernames } from '../../utils/leadCredentialsUtils';
import { config } from '../../config/env';
import type { InboxChannel, InboxChannelType } from './leads.types';

const SCHEMA = config.db.schema || 'dbo';
const CHANNEL = `[${SCHEMA}].[utbl_Leads_InboxChannel]`;

export interface InboxChannelCreateData {
  channelType: InboxChannelType;
  displayName: string;
  isActive?: boolean;
  isDefault?: boolean;
  communicationChannelId?: number | null;
  emailAddress?: string | null;
  imapHost?: string | null;
  imapPort?: number | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  authType?: string | null;
  encryptedCredentials?: string | null;
  oAuthRefreshToken?: string | null;
  pollIntervalSeconds?: number;
  metaPageId?: string | null;
  metaPageAccessToken?: string | null;
  metaAppId?: string | null;
  metaAppSecret?: string | null;
  metaInstagramAccountId?: string | null;
  metaWebhookVerifyToken?: string | null;
}

export interface InboxChannelUpdateData {
  displayName?: string;
  isActive?: boolean;
  isDefault?: boolean;
  communicationChannelId?: number | null;
  emailAddress?: string | null;
  imapHost?: string | null;
  imapPort?: number | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  authType?: string | null;
  encryptedCredentials?: string | null;
  oAuthRefreshToken?: string | null;
  pollIntervalSeconds?: number;
  metaPageId?: string | null;
  metaPageAccessToken?: string | null;
  metaAppId?: string | null;
  metaAppSecret?: string | null;
  metaInstagramAccountId?: string | null;
  metaWebhookVerifyToken?: string | null;
}

function mapChannelRow(r: Record<string, unknown>): InboxChannel {
  const base: InboxChannel = {
    inboxChannelId: Number(r.inboxChannelId ?? r.InboxChannelId),
    channelType: (r.channelType ?? r.ChannelType) as InboxChannelType,
    displayName: (r.displayName ?? r.DisplayName) as string,
    isActive: !!(r.isActive ?? r.IsActive),
    isDefault: !!(r.isDefault ?? r.IsDefault),
    communicationChannelId: (r.communicationChannelId ?? r.CommunicationChannelId) as number | null,
    emailAddress: (r.emailAddress ?? r.EmailAddress) as string | null,
    metaPageId: (r.metaPageId ?? r.MetaPageId) as string | null,
    metaInstagramAccountId: (r.metaInstagramAccountId ?? r.MetaInstagramAccountId) as string | null,
    createdOn: (r.createdOn ?? r.CreatedOn) as string,
  };
  if ('imapHost' in r || 'IMAPHost' in r) {
    (base as Record<string, unknown>).imapHost = r.imapHost ?? r.IMAPHost ?? null;
  }
  if ('imapPort' in r || 'IMAPPort' in r) {
    (base as Record<string, unknown>).imapPort = r.imapPort ?? r.IMAPPort ?? null;
  }
  if ('smtpHost' in r || 'SMTPHost' in r) {
    (base as Record<string, unknown>).smtpHost = r.smtpHost ?? r.SMTPHost ?? null;
  }
  if ('smtpPort' in r || 'SMTPPort' in r) {
    (base as Record<string, unknown>).smtpPort = r.smtpPort ?? r.SMTPPort ?? null;
  }
  if ('pollIntervalSeconds' in r || 'PollIntervalSeconds' in r) {
    (base as Record<string, unknown>).pollIntervalSeconds = r.pollIntervalSeconds ?? r.PollIntervalSeconds ?? null;
  }
  if ('metaPageAccessToken' in r || 'MetaPageAccessToken' in r) {
    (base as Record<string, unknown>).metaPageAccessToken = r.metaPageAccessToken ?? r.MetaPageAccessToken ?? null;
  }
  if ('metaAppSecret' in r || 'MetaAppSecret' in r) {
    (base as Record<string, unknown>).metaAppSecret = r.metaAppSecret ?? r.MetaAppSecret ?? null;
  }
  if ('metaWebhookVerifyToken' in r || 'MetaWebhookVerifyToken' in r) {
    (base as Record<string, unknown>).metaWebhookVerifyToken = r.metaWebhookVerifyToken ?? r.MetaWebhookVerifyToken ?? null;
  }
  return base;
}

export async function listChannels(includeInactive?: boolean): Promise<InboxChannel[]> {
  const req = await getRequest();
  req.input('all', includeInactive ? 1 : 0);
  const result = await req.query(`
    SELECT InboxChannelId AS inboxChannelId, ChannelType AS channelType, DisplayName AS displayName,
           IsActive AS isActive, IsDefault AS isDefault,
           CommunicationChannelId AS communicationChannelId,
           EmailAddress AS emailAddress,
           MetaPageId AS metaPageId, MetaInstagramAccountId AS metaInstagramAccountId,
           CreatedOn AS createdOn
    FROM ${CHANNEL}
    WHERE (@all = 1 OR IsActive = 1)
    ORDER BY ChannelType, DisplayName
  `);
  return (result.recordset || []).map(mapChannelRow);
}

export async function getChannel(id: number): Promise<InboxChannel | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT InboxChannelId AS inboxChannelId, ChannelType AS channelType, DisplayName AS displayName,
           IsActive AS isActive, IsDefault AS isDefault,
           CommunicationChannelId AS communicationChannelId,
           EmailAddress AS emailAddress, IMAPHost AS imapHost, IMAPPort AS imapPort,
           SMTPHost AS smtpHost, SMTPPort AS smtpPort, AuthType AS authType,
           EncryptedCredentials AS encryptedCredentials, OAuthRefreshToken AS oAuthRefreshToken,
           LastSyncAt AS lastSyncAt, PollIntervalSeconds AS pollIntervalSeconds,
           MetaPageId AS metaPageId, MetaPageAccessToken AS metaPageAccessToken,
           MetaAppId AS metaAppId, MetaAppSecret AS metaAppSecret,
           MetaInstagramAccountId AS metaInstagramAccountId, MetaWebhookVerifyToken AS metaWebhookVerifyToken,
           CreatedOn AS createdOn, CreatedBy AS createdBy, UpdatedOn AS updatedOn
    FROM ${CHANNEL}
    WHERE InboxChannelId = @id
  `);
  const r = result.recordset?.[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  const base = mapChannelRow(r);
  const channelType = (r.channelType ?? r.ChannelType) as string;
  if (channelType === 'email') {
    const enc = (r.encryptedCredentials ?? r.EncryptedCredentials) as string | null | undefined;
    const usernames = extractUsernames(enc ?? null);
    if (usernames) {
      (base as Record<string, unknown>).imapUser = usernames.imapUser ?? undefined;
      (base as Record<string, unknown>).smtpUser = usernames.smtpUser ?? undefined;
    }
  }
  return base;
}

export async function getChannelWithMetaCredentials(id: number): Promise<InboxChannelWithMetaCredentials | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT InboxChannelId AS inboxChannelId, ChannelType AS channelType, DisplayName AS displayName,
           IsActive AS isActive, IsDefault AS isDefault,
           CommunicationChannelId AS communicationChannelId,
           EmailAddress AS emailAddress,
           MetaPageId AS metaPageId, MetaPageAccessToken AS metaPageAccessToken,
           MetaAppId AS metaAppId, MetaAppSecret AS metaAppSecret,
           MetaInstagramAccountId AS metaInstagramAccountId, MetaWebhookVerifyToken AS metaWebhookVerifyToken,
           CreatedOn AS createdOn
    FROM ${CHANNEL}
    WHERE InboxChannelId = @id
  `);
  const r = result.recordset?.[0];
  return r ? mapChannelWithMeta(r) : null;
}

export interface InboxChannelWithEmailCredentials extends InboxChannel {
  imapHost: string | null;
  imapPort: number | null;
  smtpHost: string | null;
  smtpPort: number | null;
  encryptedCredentials: string | null;
}

export async function getChannelWithCredentials(id: number): Promise<InboxChannelWithEmailCredentials | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT InboxChannelId AS inboxChannelId, ChannelType AS channelType, DisplayName AS displayName,
           IsActive AS isActive, IsDefault AS isDefault,
           CommunicationChannelId AS communicationChannelId,
           EmailAddress AS emailAddress, IMAPHost AS imapHost, IMAPPort AS imapPort,
           SMTPHost AS smtpHost, SMTPPort AS smtpPort, AuthType AS authType,
           EncryptedCredentials AS encryptedCredentials, OAuthRefreshToken AS oAuthRefreshToken,
           LastSyncAt AS lastSyncAt, PollIntervalSeconds AS pollIntervalSeconds,
           MetaPageId AS metaPageId, MetaPageAccessToken AS metaPageAccessToken,
           MetaAppId AS metaAppId, MetaAppSecret AS metaAppSecret,
           MetaInstagramAccountId AS metaInstagramAccountId, MetaWebhookVerifyToken AS metaWebhookVerifyToken,
           CreatedOn AS createdOn, CreatedBy AS createdBy, UpdatedOn AS updatedOn
    FROM ${CHANNEL}
    WHERE InboxChannelId = @id
  `);
  const r = result.recordset?.[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    ...mapChannelRow(r),
    imapHost: (r.imapHost ?? r.IMAPHost) as string | null,
    imapPort: (r.imapPort ?? r.IMAPPort) as number | null,
    smtpHost: (r.smtpHost ?? r.SMTPHost) as string | null,
    smtpPort: (r.smtpPort ?? r.SMTPPort) as number | null,
    encryptedCredentials: (r.encryptedCredentials ?? r.EncryptedCredentials) as string | null,
  };
}

export async function createChannel(data: InboxChannelCreateData, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('channelType', (data.channelType || '').trim().slice(0, 30));
  req.input('displayName', (data.displayName || '').trim().slice(0, 200));
  req.input('isActive', data.isActive !== false ? 1 : 0);
  req.input('isDefault', data.isDefault ? 1 : 0);
  req.input('communicationChannelId', data.communicationChannelId ?? null);
  req.input('emailAddress', data.emailAddress ? data.emailAddress.trim().slice(0, 256) : null);
  req.input('imapHost', data.imapHost ? data.imapHost.trim().slice(0, 200) : null);
  req.input('imapPort', data.imapPort ?? null);
  req.input('smtpHost', data.smtpHost ? data.smtpHost.trim().slice(0, 200) : null);
  req.input('smtpPort', data.smtpPort ?? null);
  req.input('authType', data.authType ? data.authType.trim().slice(0, 20) : null);
  req.input('encryptedCredentials', data.encryptedCredentials ?? null);
  req.input('oAuthRefreshToken', data.oAuthRefreshToken ?? null);
  req.input('pollIntervalSeconds', data.pollIntervalSeconds ?? 60);
  req.input('metaPageId', data.metaPageId ? data.metaPageId.trim().slice(0, 100) : null);
  req.input('metaPageAccessToken', data.metaPageAccessToken ?? null);
  req.input('metaAppId', data.metaAppId ? data.metaAppId.trim().slice(0, 100) : null);
  req.input('metaAppSecret', data.metaAppSecret ?? null);
  req.input('metaInstagramAccountId', data.metaInstagramAccountId ? data.metaInstagramAccountId.trim().slice(0, 100) : null);
  req.input('metaWebhookVerifyToken', data.metaWebhookVerifyToken ? data.metaWebhookVerifyToken.trim().slice(0, 200) : null);
  req.input('createdBy', userId);

  const result = await req.query(`
    DECLARE @out TABLE (InboxChannelId INT);
    INSERT INTO ${CHANNEL}
      (ChannelType, DisplayName, IsActive, IsDefault,
       CommunicationChannelId, EmailAddress, IMAPHost, IMAPPort, SMTPHost, SMTPPort,
       AuthType, EncryptedCredentials, OAuthRefreshToken, PollIntervalSeconds,
       MetaPageId, MetaPageAccessToken, MetaAppId, MetaAppSecret, MetaInstagramAccountId, MetaWebhookVerifyToken,
       CreatedBy)
    OUTPUT INSERTED.InboxChannelId INTO @out
    VALUES
      (@channelType, @displayName, @isActive, @isDefault,
       @communicationChannelId, @emailAddress, @imapHost, @imapPort, @smtpHost, @smtpPort,
       @authType, @encryptedCredentials, @oAuthRefreshToken, @pollIntervalSeconds,
       @metaPageId, @metaPageAccessToken, @metaAppId, @metaAppSecret, @metaInstagramAccountId, @metaWebhookVerifyToken,
       @createdBy);
    SELECT InboxChannelId FROM @out;
  `);
  return (result.recordset as { InboxChannelId: number }[])[0].InboxChannelId;
}

export async function updateChannel(id: number, data: InboxChannelUpdateData, userId: number | null): Promise<void> {
  const sets: string[] = [];
  const req = await getRequest();
  req.input('id', id);

  if (data.displayName !== undefined) {
    req.input('displayName', data.displayName.trim().slice(0, 200));
    sets.push('DisplayName = @displayName');
  }
  if (data.isActive !== undefined) {
    req.input('isActive', data.isActive ? 1 : 0);
    sets.push('IsActive = @isActive');
  }
  if (data.isDefault !== undefined) {
    req.input('isDefault', data.isDefault ? 1 : 0);
    sets.push('IsDefault = @isDefault');
  }
  if (data.communicationChannelId !== undefined) {
    req.input('communicationChannelId', data.communicationChannelId ?? null);
    sets.push('CommunicationChannelId = @communicationChannelId');
  }
  if (data.emailAddress !== undefined) {
    req.input('emailAddress', data.emailAddress ? data.emailAddress.trim().slice(0, 256) : null);
    sets.push('EmailAddress = @emailAddress');
  }
  if (data.imapHost !== undefined) {
    req.input('imapHost', data.imapHost ? data.imapHost.trim().slice(0, 200) : null);
    sets.push('IMAPHost = @imapHost');
  }
  if (data.imapPort !== undefined) {
    req.input('imapPort', data.imapPort ?? null);
    sets.push('IMAPPort = @imapPort');
  }
  if (data.smtpHost !== undefined) {
    req.input('smtpHost', data.smtpHost ? data.smtpHost.trim().slice(0, 200) : null);
    sets.push('SMTPHost = @smtpHost');
  }
  if (data.smtpPort !== undefined) {
    req.input('smtpPort', data.smtpPort ?? null);
    sets.push('SMTPPort = @smtpPort');
  }
  if (data.authType !== undefined) {
    req.input('authType', data.authType ? data.authType.trim().slice(0, 20) : null);
    sets.push('AuthType = @authType');
  }
  if (data.encryptedCredentials !== undefined) {
    req.input('encryptedCredentials', data.encryptedCredentials ?? null);
    sets.push('EncryptedCredentials = @encryptedCredentials');
  }
  if (data.oAuthRefreshToken !== undefined) {
    req.input('oAuthRefreshToken', data.oAuthRefreshToken ?? null);
    sets.push('OAuthRefreshToken = @oAuthRefreshToken');
  }
  if (data.pollIntervalSeconds !== undefined) {
    req.input('pollIntervalSeconds', data.pollIntervalSeconds ?? 60);
    sets.push('PollIntervalSeconds = @pollIntervalSeconds');
  }
  if (data.metaPageId !== undefined) {
    req.input('metaPageId', data.metaPageId ? data.metaPageId.trim().slice(0, 100) : null);
    sets.push('MetaPageId = @metaPageId');
  }
  if (data.metaPageAccessToken !== undefined) {
    req.input('metaPageAccessToken', data.metaPageAccessToken ?? null);
    sets.push('MetaPageAccessToken = @metaPageAccessToken');
  }
  if (data.metaAppId !== undefined) {
    req.input('metaAppId', data.metaAppId ? data.metaAppId.trim().slice(0, 100) : null);
    sets.push('MetaAppId = @metaAppId');
  }
  if (data.metaAppSecret !== undefined) {
    req.input('metaAppSecret', data.metaAppSecret ?? null);
    sets.push('MetaAppSecret = @metaAppSecret');
  }
  if (data.metaInstagramAccountId !== undefined) {
    req.input('metaInstagramAccountId', data.metaInstagramAccountId ? data.metaInstagramAccountId.trim().slice(0, 100) : null);
    sets.push('MetaInstagramAccountId = @metaInstagramAccountId');
  }
  if (data.metaWebhookVerifyToken !== undefined) {
    req.input('metaWebhookVerifyToken', data.metaWebhookVerifyToken ? data.metaWebhookVerifyToken.trim().slice(0, 200) : null);
    sets.push('MetaWebhookVerifyToken = @metaWebhookVerifyToken');
  }

  if (sets.length === 0) return;

  req.input('updatedBy', userId);
  sets.push('UpdatedOn = GETDATE()');

  await req.query(`
    UPDATE ${CHANNEL}
    SET ${sets.join(', ')}
    WHERE InboxChannelId = @id
  `);
}

export async function toggleChannelStatus(id: number, isActive: boolean, userId: number | null): Promise<void> {
  const req = await getRequest();
  req.input('id', id);
  req.input('isActive', isActive ? 1 : 0);
  await req.query(`
    UPDATE ${CHANNEL}
    SET IsActive = @isActive, UpdatedOn = GETDATE()
    WHERE InboxChannelId = @id
  `);
}

export async function getChannelByType(type: InboxChannelType): Promise<InboxChannel[]> {
  const req = await getRequest();
  req.input('channelType', type);
  const result = await req.query(`
    SELECT InboxChannelId AS inboxChannelId, ChannelType AS channelType, DisplayName AS displayName,
           IsActive AS isActive, IsDefault AS isDefault,
           CommunicationChannelId AS communicationChannelId,
           EmailAddress AS emailAddress,
           MetaPageId AS metaPageId, MetaInstagramAccountId AS metaInstagramAccountId,
           CreatedOn AS createdOn
    FROM ${CHANNEL}
    WHERE ChannelType = @channelType AND IsActive = 1
    ORDER BY IsDefault DESC, DisplayName
  `);
  return (result.recordset || []).map(mapChannelRow);
}

export async function getDefaultChannel(type: InboxChannelType): Promise<InboxChannel | null> {
  const req = await getRequest();
  req.input('channelType', type);
  const result = await req.query(`
    SELECT TOP 1
           InboxChannelId AS inboxChannelId, ChannelType AS channelType, DisplayName AS displayName,
           IsActive AS isActive, IsDefault AS isDefault,
           CommunicationChannelId AS communicationChannelId,
           EmailAddress AS emailAddress,
           MetaPageId AS metaPageId, MetaInstagramAccountId AS metaInstagramAccountId,
           CreatedOn AS createdOn
    FROM ${CHANNEL}
    WHERE ChannelType = @channelType AND IsActive = 1 AND IsDefault = 1
  `);
  const r = result.recordset?.[0];
  return r ? mapChannelRow(r) : null;
}

export interface InboxChannelWithMetaCredentials extends InboxChannel {
  metaPageAccessToken: string | null;
  metaAppSecret: string | null;
  metaWebhookVerifyToken: string | null;
}

function mapChannelWithMeta(r: Record<string, unknown>): InboxChannelWithMetaCredentials {
  return {
    ...mapChannelRow(r),
    metaPageAccessToken: (r.metaPageAccessToken ?? r.MetaPageAccessToken) as string | null,
    metaAppSecret: (r.metaAppSecret ?? r.MetaAppSecret) as string | null,
    metaWebhookVerifyToken: (r.metaWebhookVerifyToken ?? r.MetaWebhookVerifyToken) as string | null,
  };
}

export async function getChannelByMetaPageId(metaPageId: string): Promise<InboxChannelWithMetaCredentials | null> {
  const req = await getRequest();
  req.input('metaPageId', metaPageId.trim());
  const result = await req.query(`
    SELECT InboxChannelId AS inboxChannelId, ChannelType AS channelType, DisplayName AS displayName,
           IsActive AS isActive, IsDefault AS isDefault,
           CommunicationChannelId AS communicationChannelId,
           EmailAddress AS emailAddress,
           MetaPageId AS metaPageId, MetaPageAccessToken AS metaPageAccessToken,
           MetaAppId AS metaAppId, MetaAppSecret AS metaAppSecret,
           MetaInstagramAccountId AS metaInstagramAccountId, MetaWebhookVerifyToken AS metaWebhookVerifyToken,
           CreatedOn AS createdOn
    FROM ${CHANNEL}
    WHERE MetaPageId = @metaPageId AND ChannelType = 'facebook_messenger' AND IsActive = 1
  `);
  const r = result.recordset?.[0];
  return r ? mapChannelWithMeta(r) : null;
}

export async function getChannelByMetaInstagramAccountId(metaInstagramAccountId: string): Promise<InboxChannelWithMetaCredentials | null> {
  const req = await getRequest();
  req.input('metaInstagramAccountId', metaInstagramAccountId.trim());
  const result = await req.query(`
    SELECT InboxChannelId AS inboxChannelId, ChannelType AS channelType, DisplayName AS displayName,
           IsActive AS isActive, IsDefault AS isDefault,
           CommunicationChannelId AS communicationChannelId,
           EmailAddress AS emailAddress,
           MetaPageId AS metaPageId, MetaPageAccessToken AS metaPageAccessToken,
           MetaAppId AS metaAppId, MetaAppSecret AS metaAppSecret,
           MetaInstagramAccountId AS metaInstagramAccountId, MetaWebhookVerifyToken AS metaWebhookVerifyToken,
           CreatedOn AS createdOn
    FROM ${CHANNEL}
    WHERE MetaInstagramAccountId = @metaInstagramAccountId AND ChannelType = 'instagram' AND IsActive = 1
  `);
  const r = result.recordset?.[0];
  return r ? mapChannelWithMeta(r) : null;
}

export async function getChannelWithMetaVerifyToken(verifyToken: string, channelId?: number): Promise<InboxChannelWithMetaCredentials | null> {
  const req = await getRequest();
  req.input('verifyToken', verifyToken.trim());
  req.input('channelId', channelId ?? null);
  const result = await req.query(`
    SELECT InboxChannelId AS inboxChannelId, ChannelType AS channelType, DisplayName AS displayName,
           IsActive AS isActive, IsDefault AS isDefault,
           CommunicationChannelId AS communicationChannelId,
           EmailAddress AS emailAddress,
           MetaPageId AS metaPageId, MetaPageAccessToken AS metaPageAccessToken,
           MetaAppId AS metaAppId, MetaAppSecret AS metaAppSecret,
           MetaInstagramAccountId AS metaInstagramAccountId, MetaWebhookVerifyToken AS metaWebhookVerifyToken,
           CreatedOn AS createdOn
    FROM ${CHANNEL}
    WHERE MetaWebhookVerifyToken = @verifyToken AND IsActive = 1
      AND (@channelId IS NULL OR InboxChannelId = @channelId)
  `);
  const r = result.recordset?.[0];
  return r ? mapChannelWithMeta(r) : null;
}
