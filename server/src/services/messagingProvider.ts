/**
 * Unified messaging provider abstraction.
 * Allows WhatsApp (Ultramsg), Facebook Messenger, and Instagram
 * to be used through a single interface.
 */

const ULTRAMSG_BASE = 'https://api.ultramsg.com';
const META_GRAPH_BASE = 'https://graph.facebook.com/v19.0';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MessageStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';
}

export interface IMessagingProvider {
  sendText(recipientId: string, text: string): Promise<SendResult>;
  sendMedia(
    recipientId: string,
    mediaUrl: string,
    mediaType: string,
    caption?: string,
  ): Promise<SendResult>;
  getMessageStatus?(messageId: string): Promise<MessageStatus>;
}

// ---------------------------------------------------------------------------
// Ultramsg (WhatsApp)
// ---------------------------------------------------------------------------

interface UltramsgConfig {
  instanceId: string;
  token: string;
}

class UltramsgProvider implements IMessagingProvider {
  private instanceId: string;
  private token: string;

  constructor(config: UltramsgConfig) {
    this.instanceId = config.instanceId;
    this.token = config.token;
  }

  async sendText(recipientId: string, text: string): Promise<SendResult> {
    const url = `${ULTRAMSG_BASE}/${this.instanceId}/messages/chat`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: this.token,
          to: recipientId.replace(/\s/g, ''),
          body: text,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) {
        return { success: false, error: data.error ?? `HTTP ${res.status}` };
      }
      return { success: true, messageId: data.id };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async sendMedia(
    recipientId: string,
    mediaUrl: string,
    mediaType: string,
    caption?: string,
  ): Promise<SendResult> {
    const endpoint = mediaType.startsWith('image') ? 'image' : 'document';
    const url = `${ULTRAMSG_BASE}/${this.instanceId}/messages/${endpoint}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: this.token,
          to: recipientId.replace(/\s/g, ''),
          [endpoint === 'image' ? 'image' : 'filename']: mediaUrl,
          caption: caption ?? '',
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) {
        return { success: false, error: data.error ?? `HTTP ${res.status}` };
      }
      return { success: true, messageId: data.id };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

// ---------------------------------------------------------------------------
// Meta Social (Facebook Messenger / Instagram)
// ---------------------------------------------------------------------------

interface MetaSocialConfig {
  pageAccessToken: string;
  pageId: string;
}

class MetaSocialProvider implements IMessagingProvider {
  private pageAccessToken: string;
  private pageId: string;

  constructor(config: MetaSocialConfig) {
    this.pageAccessToken = config.pageAccessToken;
    this.pageId = config.pageId;
  }

  async sendText(recipientId: string, text: string): Promise<SendResult> {
    const url = `${META_GRAPH_BASE}/${this.pageId}/messages`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.pageAccessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: 'RESPONSE',
          message: { text },
        }),
      });
      const data = (await res.json()) as { message_id?: string; error?: { message?: string } };
      if (!res.ok) {
        return { success: false, error: data.error?.message ?? `HTTP ${res.status}` };
      }
      return { success: true, messageId: data.message_id };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async sendMedia(
    recipientId: string,
    mediaUrl: string,
    mediaType: string,
    caption?: string,
  ): Promise<SendResult> {
    const url = `${META_GRAPH_BASE}/${this.pageId}/messages`;
    const attachmentType = mediaType.startsWith('image')
      ? 'image'
      : mediaType.startsWith('video')
        ? 'video'
        : 'file';

    const message: Record<string, unknown> = {
      attachment: {
        type: attachmentType,
        payload: { url: mediaUrl, is_reusable: true },
      },
    };
    if (caption) {
      message.text = caption;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.pageAccessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: 'RESPONSE',
          message,
        }),
      });
      const data = (await res.json()) as { message_id?: string; error?: { message?: string } };
      if (!res.ok) {
        return { success: false, error: data.error?.message ?? `HTTP ${res.status}` };
      }
      return { success: true, messageId: data.message_id };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function getProvider(channelType: string, channelConfig: any): IMessagingProvider {
  switch (channelType) {
    case 'whatsapp':
      return new UltramsgProvider({
        instanceId: channelConfig.instanceId || channelConfig.CommunicationChannelId,
        token: channelConfig.token,
      });
    case 'facebook_messenger':
    case 'instagram':
      return new MetaSocialProvider({
        pageAccessToken: channelConfig.MetaPageAccessToken || channelConfig.metaPageAccessToken,
        pageId: channelConfig.MetaPageId || channelConfig.metaPageId,
      });
    default:
      throw new Error(`Unsupported channel type: ${channelType}`);
  }
}
