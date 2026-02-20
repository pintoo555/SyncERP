/**
 * Lead WhatsApp Webhook Service – handles incoming Ultramsg webhooks
 * and routes them into the Team Inbox conversation system.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import * as conversationService from './leadConversation.service';
import * as channelService from './leadInboxChannel.service';
import * as commService from '../../services/communicationService';

const SCHEMA = config.db.schema || 'dbo';
const LEAD = `[${SCHEMA}].[utbl_Leads_Master]`;

export interface UltramsgWebhookPayload {
  event_type: string;
  instanceId: string;
  data: {
    id: string;
    from: string;
    to: string;
    body: string;
    type: string;
    timestamp: number;
    pushname: string;
    fromMe: boolean;
    media?: string;
  };
}

/**
 * Normalize phone from Ultramsg format (e.g. 919876543210@c.us) to +91... format.
 */
function extractPhoneFromFrom(from: string): string {
  if (!from || typeof from !== 'string') return '';
  const digits = from.replace(/@c\.us$/, '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 && /^[6-9]/.test(digits)) return '+91' + digits;
  if (digits.startsWith('91') && digits.length === 12) return '+' + digits;
  return digits.startsWith('+') ? '+' + digits.replace(/\D/g, '') : '+' + digits;
}

/**
 * Find lead by phone or WhatsApp number (normalized formats).
 */
async function findLeadByPhone(phone: string): Promise<{ leadId: number } | null> {
  if (!phone || phone.length < 10) return null;
  const digits = phone.replace(/\D/g, '');
  const variants: string[] = [phone];
  if (digits.startsWith('91') && digits.length === 12) {
    variants.push('+' + digits, digits.slice(2));
  } else if (digits.length === 10) {
    variants.push('91' + digits, '+91' + digits);
  }

  const req = await getRequest();
  req.input('p0', variants[0]);
  req.input('p1', variants.length > 1 ? variants[1] : variants[0]);
  req.input('p2', variants.length > 2 ? variants[2] : variants[0]);

  const result = await req.query(`
    SELECT TOP 1 l.LeadId AS leadId
    FROM ${LEAD} l
    WHERE l.IsActive = 1
      AND (
        l.Phone = @p0 OR l.WhatsAppNumber = @p0
        OR l.Phone = @p1 OR l.WhatsAppNumber = @p1
        OR l.Phone = @p2 OR l.WhatsAppNumber = @p2
      )
  `);
  const r = result.recordset?.[0] as { leadId: number } | undefined;
  return r ? { leadId: r.leadId } : null;
}

/**
 * Handle incoming WhatsApp message from Ultramsg webhook.
 */
export async function handleIncomingWhatsApp(payload: UltramsgWebhookPayload): Promise<void> {
  const eventType = (payload?.event_type || '').toLowerCase();
  const fromMe = payload?.data?.fromMe === true;

  if (fromMe) return;

  const acceptedEvents = ['message_received', 'messages_received', 'message'];
  if (!acceptedEvents.some((e) => eventType.includes(e))) {
    return;
  }

  const data = payload?.data;
  if (!data?.from || !data?.body) return;

  const phone = extractPhoneFromFrom(data.from);
  if (!phone) return;

  const pushname = (data.pushname || '').trim() || null;
  const body = String(data.body || '').trim();
  const mediaUrl = data.media ? String(data.media).trim() : undefined;
  const msgType = (data.type || 'chat').toLowerCase();

  let channels = await channelService.getChannelByType('whatsapp');
  const instanceId = (payload.instanceId || '').trim();

  if (instanceId) {
    const commChannel = await commService.getChannelById(Number(instanceId));
    if (commChannel) {
      const matching = channels.filter(
        (ch) => ch.communicationChannelId === commChannel.ChannelID
      );
      if (matching.length > 0) channels = matching;
    }
  }

  if (channels.length === 0) {
    const defaultCh = await channelService.getDefaultChannel('whatsapp');
    if (defaultCh) channels = [defaultCh];
  }

  if (channels.length === 0) return;

  const channel = channels[0];
  const inboxChannelId = channel.inboxChannelId;

  const conv = await conversationService.findOrCreateConversation(inboxChannelId, {
    externalPhone: phone,
    externalEmail: null,
    externalName: pushname,
  });

  await conversationService.addMessage(conv.conversationId, {
    direction: 'INBOUND',
    messageText: body,
    mediaUrl: mediaUrl || (msgType !== 'chat' ? data.media : undefined),
    mediaType: msgType !== 'chat' ? msgType : undefined,
    isInternal: false,
  });

  const lead = await findLeadByPhone(phone);
  if (lead) {
    await conversationService.linkConversationToLead(
      conv.conversationId,
      { leadId: lead.leadId },
      0
    );
  }
}

/**
 * Send WhatsApp reply via Ultramsg and add outbound message to conversation.
 */
export async function sendWhatsAppReply(
  conversationId: number,
  body: string,
  mediaUrl?: string
): Promise<void> {
  const conv = await conversationService.getConversation(conversationId);
  if (!conv) throw new Error('Conversation not found');

  const phone = conv.externalPhone;
  if (!phone) throw new Error('Conversation has no external phone for WhatsApp');

  const channel = await channelService.getChannel(conv.inboxChannelId);
  if (!channel) throw new Error('Inbox channel not found');

  const commChannelId = channel.communicationChannelId;
  if (!commChannelId) throw new Error('WhatsApp channel has no CommunicationChannelId');

  const commChannel = await commService.getChannelById(commChannelId);
  if (!commChannel || !commChannel.InstanceId || !commChannel.Token) {
    throw new Error('Ultramsg credentials not configured for this channel');
  }

  const instanceId = String(commChannel.InstanceId).trim();
  const token = String(commChannel.Token).trim();

  const to = phone.replace(/\D/g, '');
  const recipient = to.startsWith('91') && to.length === 12 ? to : to.length === 10 ? '91' + to : to;

  const url = mediaUrl
    ? `https://api.ultramsg.com/${instanceId}/messages/image`
    : `https://api.ultramsg.com/${instanceId}/messages/chat`;

  const bodyPayload: Record<string, string> = {
    token,
    to: recipient,
    body: body || ' ',
  };
  if (mediaUrl) {
    bodyPayload.image = mediaUrl;
    bodyPayload.caption = body || '';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });

  const data = (await res.json()) as { id?: string; error?: string };
  if (!res.ok) {
    throw new Error(data?.error || `Ultramsg API error: HTTP ${res.status}`);
  }

  await conversationService.addMessage(conversationId, {
    direction: 'OUTBOUND',
    messageText: body,
    mediaUrl: mediaUrl || undefined,
    isInternal: false,
    senderUserId: null,
  });
}
