/**
 * Ultramsg.com WhatsApp API provider.
 * Docs: https://docs.ultramsg.com/
 */

const ULTRAMSG_BASE = 'https://api.ultramsg.com';

export interface UltramsgConfig {
  instanceId: string;
  token: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a text message via Ultramsg.
 * to: phone with international format e.g. +14155552671 or chatID for group
 */
export async function sendText(config: UltramsgConfig, to: string, body: string): Promise<SendResult> {
  const url = `${ULTRAMSG_BASE}/${config.instanceId}/messages/chat`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: config.token,
        to: to.replace(/\s/g, ''),
        body,
      }),
    });
    const data = (await res.json()) as { id?: string; error?: string };
    if (!res.ok) {
      return { success: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { success: true, messageId: data.id };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { success: false, error: err };
  }
}
