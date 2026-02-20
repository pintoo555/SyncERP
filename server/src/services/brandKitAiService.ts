/**
 * Brand Kit AI: suggest colors from image (logo/brand) or website URL.
 * Uses OpenAI vision for image analysis and fetches website HTML for theme/image.
 */

import * as apiConfigService from './apiConfigService';
import * as aiUsageService from './aiUsageService';
import type { ApiConfigRow } from './apiConfigService';

const OPENAI_CODES = ['openai', 'OpenAI', 'OPENAI'];
const IMAGE_FETCH_TIMEOUT_MS = 15000;
const WEBSITE_FETCH_TIMEOUT_MS = 10000;

export interface SuggestedPalette {
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  companyName?: string | null;
}

async function getAIConfig(serviceCode?: string | null): Promise<{ config: ApiConfigRow; apiKey: string; baseUrl: string; model: string } | null> {
  const codes = serviceCode?.trim() ? [serviceCode.trim()] : OPENAI_CODES;
  for (const code of codes) {
    const config = await apiConfigService.getByServiceCode(code);
    if (config?.apiKey) {
      const baseUrl = (config.baseUrl || '').trim() || 'https://api.openai.com/v1';
      let model = 'gpt-4o-mini';
      if (config.extraConfig) {
        try {
          const extra = JSON.parse(config.extraConfig) as Record<string, unknown>;
          if (typeof extra.model === 'string') model = extra.model;
        } catch { /* */ }
      }
      return { config, apiKey: config.apiKey, baseUrl, model };
    }
  }
  return null;
}

const HEX_REGEX = /#[0-9A-Fa-f]{6}/g;

/** Fetch image from URL and return as base64 data URL. */
async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(imageUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
    const contentType = res.headers.get('content-type') || 'image/png';
    const buf = Buffer.from(await res.arrayBuffer());
    const base64 = buf.toString('base64');
    const mime = contentType.split(';')[0].trim();
    return `data:${mime};base64,${base64}`;
  } finally {
    clearTimeout(timeout);
  }
}

/** Use OpenAI vision to extract brand colors from an image. */
export async function getPaletteFromImage(
  imageInput: { imageUrl?: string; imageBase64?: string },
  opts: { serviceCode?: string | null; userId?: number } = {}
): Promise<SuggestedPalette> {
  const resolved = await getAIConfig(opts.serviceCode);
  if (!resolved) throw new Error('AI API is not configured. Add your API key in Settings > AI Config.');

  let imageDataUrl: string;
  if (imageInput.imageBase64) {
    const raw = imageInput.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    imageDataUrl = `data:image/png;base64,${raw}`;
  } else if (imageInput.imageUrl?.trim()) {
    imageDataUrl = await fetchImageAsDataUrl(imageInput.imageUrl.trim());
  } else {
    throw new Error('Provide either imageUrl or imageBase64');
  }

  const { config, apiKey, baseUrl, model } = resolved;
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const systemPrompt = `You are a brand color expert. Given an image (logo, brand asset, or marketing image), extract the main brand colors.
Return a JSON object only, no other text, with these keys: primaryColor, secondaryColor, accentColor, backgroundColor, textColor.
- Use 6-digit hex codes (e.g. "#1e40af"). Pick the most dominant/representative colors from the image.
- primaryColor: main brand color (often the darkest or most prominent)
- secondaryColor: second most visible or complementary
- accentColor: highlight or call-to-action color (can be brighter)
- backgroundColor: light neutral suitable for backgrounds (e.g. #f8fafc)
- textColor: dark color for text (e.g. #1e293b)
If the image has few colors, derive sensible complements. Always return valid hex codes.`;

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text' as const, text: 'Extract the brand color palette from this image. Return only the JSON object.' },
          { type: 'image_url' as const, image_url: { url: imageDataUrl } },
        ],
      },
    ],
    max_tokens: 400,
    temperature: 0.2,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `AI API error: ${res.status}`;
    try {
      const j = JSON.parse(errBody) as { error?: { message?: string } };
      if (j?.error?.message) msg = j.error.message;
    } catch { if (errBody.length < 200) msg = errBody; }
    throw new Error(msg);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('No response from AI');

  const norm = (s: unknown): string | null =>
    typeof s === 'string' && /^#[0-9A-Fa-f]{6}$/.test(s.trim()) ? s.trim() : null;

  let primary: string | null = null;
  let secondary: string | null = null;
  let accent: string | null = null;
  let background: string | null = '#f8fafc';
  let text: string | null = '#1e293b';

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      primary = norm(obj.primaryColor) ?? primary;
      secondary = norm(obj.secondaryColor) ?? secondary;
      accent = norm(obj.accentColor) ?? accent;
      background = norm(obj.backgroundColor) ?? background;
      text = norm(obj.textColor) ?? text;
    } catch { /* fall through to hex extraction */ }
  }
  const hexes = content.match(HEX_REGEX) || [];
  if (!primary) primary = hexes[0] ?? null;
  if (!secondary) secondary = hexes[1] ?? hexes[0] ?? null;
  if (!accent) accent = hexes[2] ?? hexes[1] ?? null;
  if (background === '#f8fafc' && hexes[3]) background = hexes[3];
  if (text === '#1e293b' && hexes[4]) text = hexes[4];

  if (opts.userId != null) {
    aiUsageService.logUsage({
      userId: opts.userId,
      configId: config.configId,
      serviceCode: config.serviceCode,
      displayName: config.displayName,
      model,
      feature: 'brand_kit_from_image',
    }).catch(() => {});
  }

  return {
    primaryColor: primary,
    secondaryColor: secondary,
    accentColor: accent,
    backgroundColor: background,
    textColor: text,
  };
}

/** Fetch HTML and extract theme-color, og:image, og:site_name. Then get palette from og:image if available. */
export async function getPaletteFromWebsite(
  websiteUrl: string,
  opts: { serviceCode?: string | null; userId?: number } = {}
): Promise<SuggestedPalette> {
  const url = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBSITE_FETCH_TIMEOUT_MS);

  let html: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SynchonicsBrandBot/1.0)' },
    });
    if (!res.ok) throw new Error(`Website fetch failed: ${res.status}`);
    html = await res.text();
  } finally {
    clearTimeout(timeout);
  }

  const themeColor = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i);
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const ogSiteName = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  const primaryFromMeta = themeColor?.[1]?.trim();
  const companyName = (ogSiteName?.[1] || title?.[1])?.trim() || null;
  let palette: SuggestedPalette = {
    primaryColor: primaryFromMeta && /^#[0-9A-Fa-f]{6}$/.test(primaryFromMeta) ? primaryFromMeta : null,
    secondaryColor: null,
    accentColor: null,
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',
    companyName,
  };

  const imageUrl = ogImage?.[1]?.trim();
  if (imageUrl) {
    try {
      const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : new URL(imageUrl, url).href;
      const fromImage = await getPaletteFromImage({ imageUrl: fullImageUrl }, opts);
      palette = {
        primaryColor: palette.primaryColor ?? fromImage.primaryColor,
        secondaryColor: fromImage.secondaryColor ?? palette.secondaryColor,
        accentColor: fromImage.accentColor ?? palette.accentColor,
        backgroundColor: fromImage.backgroundColor ?? palette.backgroundColor,
        textColor: fromImage.textColor ?? palette.textColor,
        companyName: palette.companyName ?? fromImage.companyName,
      };
    } catch {
      // keep meta theme-color only if image analysis fails
    }
  }

  if (!palette.primaryColor && !palette.secondaryColor && !palette.accentColor) {
    throw new Error('Could not detect colors from this website. Try adding an image URL or use "Suggest from image" with a logo.');
  }

  return palette;
}
