/**
 * Lead Email Poller Service – polls dedicated email inboxes via IMAP
 * and creates conversations from incoming emails.
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as nodemailer from 'nodemailer';
import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import { parseStoredCredentials } from '../../utils/leadCredentialsUtils';
import * as conversationService from './leadConversation.service';
import * as channelService from './leadInboxChannel.service';

const SCHEMA = config.db.schema || 'dbo';
const LEAD = `[${SCHEMA}].[utbl_Leads_Master]`;

/** Parsed email structure for forward detection */
interface ParsedEmailForForward {
  subject?: string;
  text?: string;
  html?: string;
  headers?: { get?(name: string): string | string[] | undefined };
}

/**
 * Detect forwarded email patterns and extract original sender.
 */
export function detectForwardedEmail(parsed: ParsedEmailForForward): {
  originalEmail?: string;
  originalName?: string;
} {
  const result: { originalEmail?: string; originalName?: string } = {};
  const emailRegex = /[\w.+-]+@[\w.-]+\.\w+/g;

  const subject = (parsed.subject || '').trim();
  const subLower = subject.toLowerCase();
  if (subLower.startsWith('fwd:') || subLower.startsWith('fw:')) {
    const match = subject.match(emailRegex);
    if (match) result.originalEmail = match[0];
  }

  const text = (parsed.text || '').trim();
  const html = (parsed.html || '').trim();
  const body = text || (html ? html.replace(/<[^>]+>/g, ' ') : '');

  const forwardPatterns = [
    /----------\s*Forwarded message\s*----------\s*\n*.*?From:\s*(.+?)(?:\n|$)/is,
    /Begin forwarded message:\s*\n*.*?From:\s*(.+?)(?:\n|$)/is,
    /^From:\s*(.+?)(?:\n|$)/m,
  ];

  for (const pattern of forwardPatterns) {
    const m = body.match(pattern);
    if (m) {
      const fromLine = m[1]?.trim() || '';
      const emailMatch = fromLine.match(emailRegex);
      if (emailMatch) {
        result.originalEmail = emailMatch[0];
        const nameMatch = fromLine.match(/^([^<]+)</);
        if (nameMatch) {
          result.originalName = nameMatch[1].replace(/["']/g, '').trim();
        }
        break;
      }
    }
  }

  const xForwarded = parsed.headers?.get?.('x-forwarded-for');
  if (!result.originalEmail && xForwarded) {
    const match = String(xForwarded).match(emailRegex);
    if (match) result.originalEmail = match[0];
  }

  return result;
}

/**
 * Test email channel credentials (IMAP, optionally SMTP) without persisting.
 * Returns { success: true } or { success: false, error: string }.
 */
export interface TestEmailCredentialsInput {
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  imapUser?: string;
  imapPassword: string;
  imapUseTls?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpUseTls?: boolean;
}

export async function testEmailCredentials(input: TestEmailCredentialsInput): Promise<{ success: true } | { success: false; error: string }> {
  const imapHost = (input.imapHost || '').trim();
  const emailAddress = (input.emailAddress || '').trim();
  const imapPassword = (input.imapPassword || '').trim();

  if (!imapHost || !emailAddress) {
    return { success: false, error: 'Email address and IMAP host are required.' };
  }
  if (!imapPassword) {
    return { success: false, error: 'IMAP password is required to test.' };
  }

  const imapUser = (input.imapUser || '').trim() || emailAddress;
  const port = Number(input.imapPort) || 993;
  const secure = input.imapUseTls !== false;

  const client = new ImapFlow({
    host: imapHost,
    port,
    secure,
    auth: { user: imapUser, pass: imapPassword },
    tls: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    lock.release();
    await client.logout();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `IMAP: ${msg}` };
  } finally {
    try {
      client.close();
    } catch {
      // ignore
    }
  }

  if (input.smtpHost && (input.smtpPassword != null && input.smtpPassword !== '')) {
    const smtpHost = (input.smtpHost || '').trim();
    const smtpPort = Number(input.smtpPort) || 587;
    const smtpUser = (input.smtpUser || '').trim() || emailAddress;
    const smtpPass = (input.smtpPassword || '').trim();
    const smtpSecure = input.smtpUseTls !== false && smtpPort === 465;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });

    try {
      await transporter.verify();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `SMTP: ${msg}` };
    }
  }

  return { success: true };
}

/**
 * Send a test lead email to the inbox and verify it was received via IMAP.
 * Tests SMTP send + IMAP receive round-trip.
 * Returns { success: true, message } or { success: false, error: string }.
 */
export interface SendTestLeadEmailInput {
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  imapUser?: string;
  imapPassword: string;
  imapUseTls?: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser?: string;
  smtpPassword: string;
  smtpUseTls?: boolean;
}

const TEST_LEAD_SUBJECT_PREFIX = '[SyncERP Test Lead] Verification';

export async function sendTestLeadEmail(input: SendTestLeadEmailInput): Promise<
  { success: true; message: string } | { success: false; error: string }
> {
  const emailAddress = (input.emailAddress || '').trim();
  const imapHost = (input.imapHost || '').trim();
  const imapPassword = (input.imapPassword || '').trim();
  const smtpHost = (input.smtpHost || '').trim();
  const smtpPassword = (input.smtpPassword || '').trim();

  if (!emailAddress || !imapHost) {
    return { success: false, error: 'Email address and IMAP host are required.' };
  }
  if (!imapPassword || !smtpHost || !smtpPassword) {
    return { success: false, error: 'IMAP and SMTP credentials are required to send test lead.' };
  }

  const smtpUser = (input.smtpUser || '').trim() || emailAddress;
  const smtpPort = Number(input.smtpPort) || 587;
  const smtpSecure = input.smtpUseTls !== false && smtpPort === 465;
  const testSubject = `${TEST_LEAD_SUBJECT_PREFIX} ${Date.now()}`;
  const testBody = 'This is a test lead email from SyncERP Channel Settings. It verifies SMTP send and IMAP receive.';

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPassword },
  });

  try {
    await transporter.sendMail({
      from: smtpUser,
      to: emailAddress,
      subject: testSubject,
      text: testBody,
      html: `<p>${testBody.replace(/\n/g, '<br>')}</p>`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `SMTP send failed: ${msg}` };
  }

  const imapUser = (input.imapUser || '').trim() || emailAddress;
  const imapPort = Number(input.imapPort) || 993;
  const secure = input.imapUseTls !== false;

  await new Promise((r) => setTimeout(r, 3000));

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure,
    auth: { user: imapUser, pass: imapPassword },
    tls: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ seen: false }, { uid: true });
      const uidList = Array.isArray(uids) ? uids : [];
      const messages = await client.fetchAll(uidList, { envelope: true, source: true }, { uid: true });

      for (const msg of messages) {
        const source = msg.source;
        if (!source) continue;
        const parsed = await simpleParser(source);
        const subject = ((parsed as { subject?: string }).subject || '').trim();
        if (subject.includes(TEST_LEAD_SUBJECT_PREFIX)) {
          await client.logout();
          return {
            success: true,
            message: 'Test email sent to inbox and received. The poller will add it to Team Inbox when it runs.',
          };
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `IMAP check failed: ${msg}` };
  } finally {
    try {
      client.close();
    } catch {
      /* ignore */
    }
  }

  return {
    success: true,
    message: 'Test email sent. If not visible in inbox, check spam or wait a moment and try again.',
  };
}

/**
 * Test email channel using stored credentials (for editing existing channel).
 */
export async function testEmailChannelById(channelId: number): Promise<
  { success: true } | { success: false; error: string }
> {
  const channel = await channelService.getChannelWithCredentials(channelId);
  if (!channel) return { success: false, error: 'Channel not found.' };
  if (channel.channelType !== 'email') return { success: false, error: 'Channel is not an email channel.' };

  const emailAddress = channel.emailAddress?.trim();
  const imapHost = channel.imapHost?.trim();
  if (!emailAddress || !imapHost) return { success: false, error: 'Email address and IMAP host are required.' };

  const creds = parseStoredCredentials(channel.encryptedCredentials);
  if (!creds?.imapPassword) return { success: false, error: 'No stored credentials. Enter password and save, then test.' };

  return testEmailCredentials({
    emailAddress,
    imapHost,
    imapPort: channel.imapPort ?? 993,
    imapUser: creds.imapUser ?? emailAddress,
    imapPassword: creds.imapPassword,
    imapUseTls: true,
    smtpHost: channel.smtpHost ?? undefined,
    smtpPort: channel.smtpPort ?? undefined,
    smtpUser: creds.smtpUser ?? emailAddress,
    smtpPassword: channel.smtpHost ? (creds.smtpPassword ?? creds.imapPassword) : undefined,
    smtpUseTls: channel.smtpPort === 465,
  });
}

/**
 * Send test lead email using stored credentials (for editing existing channel).
 */
export async function sendTestLeadEmailByChannelId(channelId: number): Promise<
  { success: true; message: string } | { success: false; error: string }
> {
  const channel = await channelService.getChannelWithCredentials(channelId);
  if (!channel) return { success: false, error: 'Channel not found.' };
  if (channel.channelType !== 'email') return { success: false, error: 'Channel is not an email channel.' };

  const emailAddress = channel.emailAddress?.trim();
  const imapHost = channel.imapHost?.trim();
  const smtpHost = channel.smtpHost?.trim();
  if (!emailAddress || !imapHost) return { success: false, error: 'Email address and IMAP host are required.' };
  if (!smtpHost) return { success: false, error: 'SMTP host is required. Update channel and save first.' };

  const creds = parseStoredCredentials(channel.encryptedCredentials);
  if (!creds?.imapPassword) return { success: false, error: 'No stored credentials. Enter password and save, then try again.' };

  return sendTestLeadEmail({
    emailAddress,
    imapHost,
    imapPort: channel.imapPort ?? 993,
    imapUser: creds.imapUser ?? emailAddress,
    imapPassword: creds.imapPassword,
    imapUseTls: true,
    smtpHost,
    smtpPort: channel.smtpPort ?? 587,
    smtpUser: creds.smtpUser ?? emailAddress,
    smtpPassword: creds.smtpPassword ?? creds.imapPassword,
    smtpUseTls: channel.smtpPort === 465,
  });
}

/**
 * Poll all active email inbox channels and process unread emails.
 */
export async function pollEmailChannels(): Promise<void> {
  const channels = await channelService.getChannelByType('email');
  for (const ch of channels) {
    const fullChannel = await channelService.getChannelWithCredentials(ch.inboxChannelId);
    if (!fullChannel) continue;
    await pollSingleChannel(fullChannel);
  }
}

/**
 * Poll a single email channel via IMAP.
 */
async function pollSingleChannel(channel: {
  inboxChannelId: number;
  channelType: string;
  displayName: string;
  emailAddress: string | null;
  imapHost: string | null;
  imapPort: number | null;
  smtpHost: string | null;
  smtpPort: number | null;
  encryptedCredentials: string | null;
}): Promise<void> {
  const imapHost = channel.imapHost?.trim();
  const emailAddress = channel.emailAddress?.trim();
  if (!imapHost || !emailAddress) return;

  const creds = parseStoredCredentials(channel.encryptedCredentials);
  const imapPass = creds?.imapPassword ?? '';
  if (!imapPass) {
    console.error(`[LeadEmailPoller] No credentials for channel ${channel.inboxChannelId}`);
    return;
  }
  const imapUser = creds.imapUser ?? emailAddress;

  const port = channel.imapPort || 993;
  const client = new ImapFlow({
    host: imapHost,
    port,
    secure: port === 993,
    auth: {
      user: imapUser,
      pass: imapPass,
    },
    tls: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const unseenUids = await client.search({ seen: false }, { uid: true });
      const uidList = Array.isArray(unseenUids) ? unseenUids : [];
      if (uidList.length === 0) return;

      const messages = await client.fetchAll(uidList, { envelope: true, source: true }, { uid: true });
      const toMarkSeen: number[] = [];

      for (const msg of messages) {
        try {
          const source = msg.source;
          if (!source) continue;

          const parsed = await simpleParser(source);
          const from = (parsed as { from?: { value?: Array<{ address?: string; name?: string }> } }).from;
          const senderEmail = from?.value?.[0]?.address || '';
          const senderName = from?.value?.[0]?.name || null;
          const subject = ((parsed as { subject?: string }).subject || '').trim();
          const text = (parsed.text || '').trim();
          const html = (parsed.html || '').trim().slice(0, 100000) || null;

          if (!senderEmail) continue;

          const forwarded = detectForwardedEmail(parsed);
          const finalEmail = forwarded.originalEmail || senderEmail;
          const finalName = forwarded.originalName || senderName;

          const conv = await conversationService.findOrCreateConversation(channel.inboxChannelId, {
            externalPhone: null,
            externalEmail: finalEmail,
            externalName: finalName,
          });

          await conversationService.addMessage(conv.conversationId, {
            direction: 'INBOUND',
            messageText: text || html?.replace(/<[^>]+>/g, ' ').slice(0, 10000) || null,
            messageHtml: html,
            subject: subject || null,
            isInternal: false,
            isForwarded: !!forwarded.originalEmail,
            originalSenderEmail: forwarded.originalEmail || null,
            originalSenderName: forwarded.originalName || null,
          });

          const lead = await findLeadByEmail(finalEmail);
          if (lead) {
            await conversationService.linkConversationToLead(
              conv.conversationId,
              { leadId: lead.leadId },
              0
            );
          }

          toMarkSeen.push(msg.uid);
        } catch (err) {
          console.error(`[LeadEmailPoller] Error processing message:`, err);
        }
      }

      if (toMarkSeen.length > 0) {
        await client.messageFlagsAdd(toMarkSeen, ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    console.error(`[LeadEmailPoller] IMAP error for channel ${channel.inboxChannelId}:`, err);
  } finally {
    try {
      client.close();
    } catch {
      // ignore
    }
  }
}

async function findLeadByEmail(email: string): Promise<{ leadId: number } | null> {
  if (!email || !email.includes('@')) return null;
  const req = await getRequest();
  req.input('email', email.trim().toLowerCase());
  const result = await req.query(`
    SELECT TOP 1 LeadId AS leadId
    FROM ${LEAD}
    WHERE IsActive = 1 AND LOWER(Email) = @email
  `);
  const r = result.recordset?.[0] as { leadId: number } | undefined;
  return r ? { leadId: r.leadId } : null;
}

/**
 * Send email reply via SMTP and add outbound message to conversation.
 */
export async function sendEmailReply(
  conversationId: number,
  body: string,
  subject?: string
): Promise<void> {
  const conv = await conversationService.getConversation(conversationId);
  if (!conv) throw new Error('Conversation not found');

  const toEmail = conv.externalEmail;
  if (!toEmail) throw new Error('Conversation has no external email for reply');

  const fullChannel = await channelService.getChannelWithCredentials(conv.inboxChannelId);
  if (!fullChannel) throw new Error('Inbox channel not found');

  const smtpHost = fullChannel.smtpHost?.trim();
  const emailAddress = fullChannel.emailAddress?.trim();
  if (!smtpHost || !emailAddress) {
    throw new Error('Email channel has no SMTP host or email address configured');
  }

  const creds = parseStoredCredentials(fullChannel.encryptedCredentials);
  const smtpPass = creds?.smtpPassword ?? creds?.imapPassword ?? '';
  const smtpUser = creds?.smtpUser ?? creds?.imapUser ?? emailAddress;
  if (!smtpPass) throw new Error('No SMTP credentials stored');

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: fullChannel.smtpPort || 587,
    secure: fullChannel.smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const replySubject = subject || (conv.lastMessagePreview ? `Re: ${conv.lastMessagePreview.slice(0, 50)}` : 'Re:');

  await transporter.sendMail({
    from: emailAddress,
    to: toEmail,
    subject: replySubject,
    text: body,
    html: body.replace(/\n/g, '<br>'),
  });

  await conversationService.addMessage(conversationId, {
    direction: 'OUTBOUND',
    messageText: body,
    subject: replySubject,
    isInternal: false,
    senderUserId: null,
  });
}
