/**
 * Meta (Facebook Messenger / Instagram) webhook service.
 * Handles inbound messages from Meta Graph API webhooks.
 */

import crypto from 'crypto';
import * as channelService from './leadInboxChannel.service';
import * as conversationService from './leadConversation.service';

export async function verifyWebhook(
  mode: string,
  token: string,
  challenge: string,
  channelId?: number
): Promise<string | null> {
  if (mode !== 'subscribe' || !token || !challenge) return null;
  const channel = await channelService.getChannelWithMetaVerifyToken(token, channelId);
  return channel ? challenge : null;
}

export function validateSignature(
  rawBody: string | Buffer,
  signature: string,
  appSecret: string
): boolean {
  if (!signature || !appSecret) return false;
  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const expected =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex');
  try {
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export interface MetaWebhookEntry {
  id: string;
  time: number;
  messaging?: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
      mid: string;
      text?: string;
      attachments?: Array<{
        type: string;
        payload: { url: string };
      }>;
    };
    delivery?: unknown;
    read?: unknown;
  }>;
}

export interface MetaWebhookPayload {
  object: 'page' | 'instagram';
  entry: MetaWebhookEntry[];
}

export async function handleMetaWebhook(payload: MetaWebhookPayload): Promise<void> {
  const channelType =
    payload.object === 'page' ? 'facebook_messenger' : 'instagram';
  const entries = payload.entry || [];

  for (const entry of entries) {
    const channel =
      channelType === 'facebook_messenger'
        ? await channelService.getChannelByMetaPageId(entry.id)
        : await channelService.getChannelByMetaInstagramAccountId(entry.id);

    if (!channel || !channel.metaPageAccessToken) continue;

    const messaging = entry.messaging || [];
    for (const event of messaging) {
      if (event.delivery || event.read) continue;

      const senderId = event.sender?.id;
      if (!senderId) continue;

      const message = event.message;
      const text = message?.text?.trim() || null;
      const attachments = message?.attachments || [];
      const mid = message?.mid || null;

      let profile: { name: string; profilePic?: string } | null = null;
      try {
        profile = await fetchMetaUserProfile(senderId, channel.metaPageAccessToken);
      } catch {
        profile = { name: 'Unknown' };
      }

      const conv = await conversationService.findOrCreateConversation({
        inboxChannelId: channel.inboxChannelId,
        externalSocialId: senderId,
        externalName: profile?.name ?? null,
        externalSocialProfilePic: profile?.profilePic ?? null,
      });

      if (text || attachments.length > 0) {
        const firstAttachment = attachments[0];
        const mediaUrl = firstAttachment?.payload?.url ?? null;
        const mediaType = firstAttachment?.type ?? null;

        await conversationService.addInboundMessage(conv.conversationId, {
          messageText: text,
          mediaUrl,
          mediaType: mediaType || undefined,
          metaMessageId: mid,
        });

        for (let i = 1; i < attachments.length; i++) {
          const att = attachments[i];
          await conversationService.addInboundMessage(conv.conversationId, {
            messageText: null,
            mediaUrl: att?.payload?.url ?? null,
            mediaType: att?.type ?? undefined,
            metaMessageId: null,
          });
        }
      }
    }
  }
}

export async function sendMetaReply(
  conversationId: number,
  body: string,
  mediaUrl?: string
): Promise<void> {
  const conv = await conversationService.getConversation(conversationId);
  if (!conv) throw new Error('Conversation not found');

  const externalId = conv.externalSocialId;
  if (!externalId) throw new Error('Conversation has no external social ID');

  const channel = await channelService.getChannelWithMetaCredentials(conv.inboxChannelId);
  if (!channel) throw new Error('Channel not found');

  const accessToken = channel.metaPageAccessToken;
  if (!accessToken) throw new Error('Channel has no Meta Page Access Token');

  const recipient = { id: externalId };
  let messagePayload: Record<string, unknown>;

  if (mediaUrl?.trim()) {
    const mediaType = inferMediaType(mediaUrl);
    messagePayload = {
      attachment: {
        type: mediaType,
        payload: { url: mediaUrl.trim(), is_reusable: true },
      },
    };
  } else {
    messagePayload = { text: (body || '').trim() || ' ' };
  }

  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, message: messagePayload }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Meta API error ${res.status}: ${errText}`);
  }

  await conversationService.addOutboundMessage(conversationId, {
    messageText: body.trim(),
    mediaUrl: mediaUrl?.trim(),
    senderUserId: null,
  });
}

function inferMediaType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('.mp4') || lower.includes('video')) return 'video';
  if (lower.includes('.mp3') || lower.includes('audio')) return 'audio';
  return 'image';
}

async function fetchMetaUserProfile(
  userId: string,
  accessToken: string
): Promise<{ name: string; profilePic?: string } | null> {
  try {
    const url = `https://graph.facebook.com/v18.0/${userId}?fields=name,profile_pic&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string; profile_pic?: string };
    return { name: data.name || 'Unknown', profilePic: data.profile_pic };
  } catch {
    return null;
  }
}
