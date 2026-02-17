/**
 * Chat message improvement via OpenAI (or compatible API).
 * Uses API key from react_ApiConfig (serviceCode: openai or OpenAI).
 */

import * as apiConfigService from '../../services/apiConfigService';
import * as aiUsageService from '../../services/aiUsageService';
import type { ApiConfigRow } from '../../services/apiConfigService';

const OPENAI_SERVICE_CODES = ['openai', 'OpenAI', 'OPENAI'];

const IMPROVE_SYSTEM_CHAT = `You are a professional writing assistant. Your task is to improve chat messages to be clearer, more professional, and polite while keeping the original intent and tone. 
- Fix grammar and spelling
- Improve clarity and conciseness
- Make the message sound professional and courteous
- Keep it concise (chat messages should be brief, not lengthy)
- Do NOT add greetings, sign-offs, or extra fluff unless the original had them
- Return ONLY the improved message text, nothing else`;

const IMPROVE_SYSTEM_EMAIL = `You are a professional writing assistant. Your task is to improve email body text to be clearer, more professional, and polite while keeping the original intent and tone.
- Fix grammar and spelling
- Improve clarity and conciseness
- Make the message sound professional and appropriate for email
- Keep a suitable length for email (can be longer than chat if needed)
- Do NOT add greetings or sign-offs unless the original had them
- Return ONLY the improved message text, nothing else`;

export interface ImproveResult {
  improved: string;
  model?: string;
}

/** Get config by service code or try common OpenAI codes. */
async function getAIConfig(serviceCode?: string | null): Promise<{ config: ApiConfigRow; apiKey: string; baseUrl: string; model: string } | null> {
  const codes = serviceCode?.trim()
    ? [serviceCode.trim()]
    : OPENAI_SERVICE_CODES;
  for (const code of codes) {
    const config = await apiConfigService.getByServiceCode(code);
    if (config?.apiKey) {
      const baseUrl = (config.baseUrl || '').trim() || 'https://api.openai.com/v1';
      let model = 'gpt-3.5-turbo';
      if (config.extraConfig) {
        try {
          const extra = JSON.parse(config.extraConfig) as Record<string, unknown>;
          if (typeof extra.model === 'string') model = extra.model;
        } catch {
          /* ignore */
        }
      }
      return { config, apiKey: config.apiKey, baseUrl, model };
    }
  }
  return null;
}

export interface ImproveOptions {
  serviceCode?: string | null;
  userId?: number;
  /** For logging: chat_improve, email_compose, etc. */
  feature?: string;
  /** Context for prompt: 'chat' | 'email'. Default: chat. */
  context?: 'chat' | 'email';
}

/** Call OpenAI Chat Completions to improve the given text. Returns improved text or throws. */
export async function improveMessage(text: string, variant?: 'professional' | 'friendly' | 'concise', options?: ImproveOptions): Promise<ImproveResult> {
  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('Text is required');

  const resolved = await getAIConfig(options?.serviceCode ?? null);
  if (!resolved) throw new Error('AI API is not configured. Please add your API key in Project Settings > AI Config.');

  const { config, apiKey, baseUrl, model } = resolved;

  const variantHint = variant === 'professional'
    ? 'Keep it formal and professional.'
    : variant === 'friendly'
      ? 'Keep it warm and approachable.'
      : 'Keep it brief and to the point.';

  const isEmail = options?.context === 'email';
  const systemPrompt = isEmail ? IMPROVE_SYSTEM_EMAIL : IMPROVE_SYSTEM_CHAT;
  const userPrompt = isEmail ? `Improve this email:\n\n"${trimmed}"` : `Improve this chat message:\n\n"${trimmed}"`;

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model,
    messages: [
      { role: 'system', content: `${systemPrompt} ${variantHint}` },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 300,
    temperature: 0.5,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `AI API error: ${res.status}`;
    try {
      const errJson = JSON.parse(errBody) as { error?: { message?: string } };
      if (errJson?.error?.message) msg = errJson.error.message;
    } catch {
      if (errBody.length < 200) msg = errBody;
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('No response from AI');

  if (options?.userId != null) {
    aiUsageService.logUsage({
      userId: options.userId,
      configId: config.configId,
      serviceCode: config.serviceCode,
      displayName: config.displayName,
      model,
      feature: options.feature ?? 'chat_improve',
    }).catch(() => {});
  }

  return { improved: content, model };
}

/** Test an OpenAI-compatible config with a minimal chat completion. Returns { ok, message?, error? }. */
export async function testOpenAIConfig(config: ApiConfigRow): Promise<{ ok: boolean; message?: string; error?: string }> {
  const apiKey = (config.apiKey || '').trim();
  if (!apiKey) return { ok: false, error: 'No API key configured' };

  const baseUrl = (config.baseUrl || '').trim() || 'https://api.openai.com/v1';
  let model = 'gpt-3.5-turbo';
  if (config.extraConfig) {
    try {
      const extra = JSON.parse(config.extraConfig) as Record<string, unknown>;
      if (typeof extra.model === 'string') model = extra.model;
    } catch {
      /* ignore */
    }
  }

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model,
    messages: [
      { role: 'user', content: 'Reply with exactly: OK' },
    ],
    max_tokens: 10,
    temperature: 0,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      let msg = `API error: ${res.status}`;
      try {
        const errJson = JSON.parse(errBody) as { error?: { message?: string } };
        if (errJson?.error?.message) msg = errJson.error.message;
      } catch {
        if (errBody.length < 200) msg = errBody;
      }
      return { ok: false, error: msg };
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return { ok: false, error: 'No response from API' };

    return { ok: true, message: `Connected successfully (model: ${model})` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
