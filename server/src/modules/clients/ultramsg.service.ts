/**
 * ultramsg.com API: check if a phone number is on WhatsApp.
 * Uses the default WhatsApp channel from Communication → Channels.
 */

import * as communicationService from '../../services/communicationService';

/**
 * Normalize phone to ultramsg chatId: digits only + @c.us.
 * E.g. +91 98765 43210 -> 919876543210@c.us
 * 10-digit Indian number -> 91 prefix assumed.
 */
export function phoneToChatId(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  let num = digits;
  if (num.length === 10 && /^[6-9]/.test(num)) num = '91' + num;
  return num + '@c.us';
}

export interface CheckResult {
  valid: boolean;
  error?: string;
}

/**
 * Check if the given chatId (e.g. 919876543210@c.us) is registered on WhatsApp.
 * Uses the default WhatsApp channel from Communication Channels (ultramsg).
 */
export async function checkWhatsAppNumber(chatId: string): Promise<CheckResult> {
  if (!chatId || !chatId.includes('@')) {
    return { valid: false, error: 'Invalid phone number for WhatsApp check.' };
  }

  const channel = await communicationService.getDefaultChannel('whatsapp');
  if (!channel || !channel.IsActive) {
    return { valid: false, error: 'No active WhatsApp channel configured. Add one in Communication → Channels.' };
  }
  if (channel.ProviderCode !== 'ultramsg' || !channel.InstanceId || !channel.Token) {
    return { valid: false, error: 'WhatsApp channel is missing Instance ID or Token. Configure it in Communication → Channels.' };
  }

  const instanceId = String(channel.InstanceId).trim();
  const token = String(channel.Token).trim();
  const url = new URL(`https://api.ultramsg.com/${instanceId}/contacts/check`);
  url.searchParams.set('token', token);
  url.searchParams.set('chatId', chatId);
  url.searchParams.set('nocache', 'true');

  try {
    const res = await fetch(url.toString());
    const rawText = await res.text();
    let data: { status?: string; error?: string; chatId?: string };
    try { data = JSON.parse(rawText); } catch { data = {}; }

    console.log(`[Ultramsg Check] chatId="${chatId}" HTTP=${res.status} response=${rawText}`);

    if (!res.ok) {
      return { valid: false, error: data?.error || `Ultramsg API error (HTTP ${res.status})` };
    }

    const status = (data?.status || '').toLowerCase();
    if (status === 'valid') {
      return { valid: true };
    }
    return { valid: false, error: status === 'invalid' ? 'This number is not registered on WhatsApp' : (data?.error || `Unexpected status: ${data?.status}`) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { valid: false, error: `Failed to reach Ultramsg API: ${msg}` };
  }
}
