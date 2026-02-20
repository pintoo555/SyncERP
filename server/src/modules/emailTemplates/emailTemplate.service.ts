/**
 * Email Template service – CRUD operations + AI generation.
 */

import { getRequest } from '../../config/db';
import * as apiConfigService from '../../services/apiConfigService';
import * as aiUsageService from '../../services/aiUsageService';
import * as brandKitService from '../../services/brandKitService';
import type { ApiConfigRow } from '../../services/apiConfigService';

const TABLE = 'react_EmailTemplates';

/** Map DB row (PascalCase) to camelCase for API */
function toCamelRow(r: Record<string, unknown>): EmailTemplateRow {
  return {
    id: Number(r.Id ?? r.id),
    name: String(r.Name ?? r.name ?? ''),
    subject: String(r.Subject ?? r.subject ?? ''),
    bodyHtml: String(r.BodyHtml ?? r.bodyHtml ?? ''),
    bodyText: r.BodyText != null || r.bodyText != null ? String(r.BodyText ?? r.bodyText) : null,
    category: r.Category != null || r.category != null ? String(r.Category ?? r.category) : null,
    description: r.Description != null || r.description != null ? String(r.Description ?? r.description) : null,
    variables: r.Variables != null || r.variables != null ? String(r.Variables ?? r.variables) : null,
    thumbnailUrl: r.ThumbnailUrl != null || r.thumbnailUrl != null ? String(r.ThumbnailUrl ?? r.thumbnailUrl) : null,
    isActive: Boolean(r.IsActive ?? r.isActive ?? true),
    isDefault: Boolean(r.IsDefault ?? r.isDefault ?? false),
    createdBy: r.CreatedBy != null || r.createdBy != null ? Number(r.CreatedBy ?? r.createdBy) : null,
    updatedBy: r.UpdatedBy != null || r.updatedBy != null ? Number(r.UpdatedBy ?? r.updatedBy) : null,
    createdAt: String(r.CreatedAt ?? r.createdAt ?? ''),
    updatedAt: String(r.UpdatedAt ?? r.updatedAt ?? ''),
  };
}

/* ─── types ─── */
export interface EmailTemplateRow {
  id: number;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  category: string | null;
  description: string | null;
  variables: string | null;
  thumbnailUrl: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListFilters {
  category?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

/* ─── CRUD ─── */

export async function list(filters: ListFilters = {}): Promise<{ data: EmailTemplateRow[]; total: number }> {
  const req = await getRequest();
  const conditions: string[] = [];

  if (filters.category) {
    req.input('category', filters.category);
    conditions.push('Category = @category');
  }
  if (filters.isActive !== undefined) {
    req.input('isActive', filters.isActive ? 1 : 0);
    conditions.push('IsActive = @isActive');
  }
  if (filters.search?.trim()) {
    req.input('search', `%${filters.search.trim()}%`);
    conditions.push('(Name LIKE @search OR Subject LIKE @search OR Description LIKE @search OR Category LIKE @search)');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const rowStart = offset + 1;
  const rowEnd = offset + pageSize;

  req.input('rowStart', rowStart);
  req.input('rowEnd', rowEnd);

  const result = await req.query(`
    WITH numbered AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY IsDefault DESC, UpdatedAt DESC) AS rn,
             COUNT(*) OVER() AS __total
      FROM ${TABLE} ${where}
    )
    SELECT * FROM numbered WHERE rn >= @rowStart AND rn <= @rowEnd
  `);
  const rows = (result.recordset ?? []) as (Record<string, unknown> & { __total?: number })[];
  const total = Number(rows[0]?.__total ?? 0);
  const data = rows.map(r => { const { __total, rn, ...rest } = r; return toCamelRow(rest); });
  return { data, total };
}

export async function getById(id: number): Promise<EmailTemplateRow | null> {
  const req = await getRequest();
  req.input('id', id);
  const result = await req.query(`SELECT * FROM ${TABLE} WHERE Id = @id`);
  const row = result.recordset?.[0] as Record<string, unknown> | undefined;
  return row ? toCamelRow(row) : null;
}

export async function create(data: {
  name: string; subject: string; bodyHtml: string; bodyText?: string | null;
  category?: string | null; description?: string | null; variables?: string | null;
  isActive?: boolean; isDefault?: boolean;
}, userId: number): Promise<number> {
  const req = await getRequest();
  req.input('name', data.name);
  req.input('subject', data.subject);
  req.input('bodyHtml', data.bodyHtml);
  req.input('bodyText', data.bodyText ?? null);
  req.input('category', data.category ?? null);
  req.input('description', data.description ?? null);
  req.input('variables', data.variables ?? null);
  req.input('isActive', data.isActive !== false ? 1 : 0);
  req.input('isDefault', data.isDefault ? 1 : 0);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${TABLE} (Name, Subject, BodyHtml, BodyText, Category, Description, Variables, IsActive, IsDefault, CreatedBy, UpdatedBy)
    OUTPUT INSERTED.Id
    VALUES (@name, @subject, @bodyHtml, @bodyText, @category, @description, @variables, @isActive, @isDefault, @createdBy, @createdBy)
  `);
  return (result.recordset[0] as { Id: number }).Id;
}

export async function update(id: number, data: {
  name?: string; subject?: string; bodyHtml?: string; bodyText?: string | null;
  category?: string | null; description?: string | null; variables?: string | null;
  isActive?: boolean; isDefault?: boolean;
}, userId: number): Promise<boolean> {
  const sets: string[] = ['UpdatedAt = GETDATE()', 'UpdatedBy = @updatedBy'];
  const req = await getRequest();
  req.input('id', id);
  req.input('updatedBy', userId);

  if (data.name !== undefined) { req.input('name', data.name); sets.push('Name = @name'); }
  if (data.subject !== undefined) { req.input('subject', data.subject); sets.push('Subject = @subject'); }
  if (data.bodyHtml !== undefined) { req.input('bodyHtml', data.bodyHtml); sets.push('BodyHtml = @bodyHtml'); }
  if (data.bodyText !== undefined) { req.input('bodyText', data.bodyText); sets.push('BodyText = @bodyText'); }
  if (data.category !== undefined) { req.input('category', data.category); sets.push('Category = @category'); }
  if (data.description !== undefined) { req.input('description', data.description); sets.push('Description = @description'); }
  if (data.variables !== undefined) { req.input('variables', data.variables); sets.push('Variables = @variables'); }
  if (data.isActive !== undefined) { req.input('isActive', data.isActive ? 1 : 0); sets.push('IsActive = @isActive'); }
  if (data.isDefault !== undefined) { req.input('isDefault', data.isDefault ? 1 : 0); sets.push('IsDefault = @isDefault'); }

  const result = await req.query(`UPDATE ${TABLE} SET ${sets.join(', ')} WHERE Id = @id`);
  return (result.rowsAffected[0] ?? 0) > 0;
}

export async function remove(id: number): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  const result = await req.query(`DELETE FROM ${TABLE} WHERE Id = @id`);
  return (result.rowsAffected[0] ?? 0) > 0;
}

export async function duplicate(id: number, userId: number): Promise<number | null> {
  const original = await getById(id);
  if (!original) return null;
  return create({
    name: `${original.name} (Copy)`,
    subject: original.subject,
    bodyHtml: original.bodyHtml,
    bodyText: original.bodyText,
    category: original.category,
    description: original.description,
    variables: original.variables,
    isActive: false,
    isDefault: false,
  }, userId);
}

export async function listCategories(): Promise<string[]> {
  const req = await getRequest();
  const result = await req.query(`SELECT DISTINCT Category FROM ${TABLE} WHERE Category IS NOT NULL ORDER BY Category`);
  return (result.recordset ?? []).map((r: { Category: string }) => r.Category);
}

/* ═══════════════ AI FEATURES ═══════════════ */

const OPENAI_CODES = ['openai', 'OpenAI', 'OPENAI'];

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

async function callAI(systemPrompt: string, userPrompt: string, opts: { serviceCode?: string | null; userId?: number; feature: string; maxTokens?: number }): Promise<{ content: string; model: string }> {
  const resolved = await getAIConfig(opts.serviceCode);
  if (!resolved) throw new Error('AI API is not configured. Add your API key in Settings > AI Config.');
  const { config, apiKey, baseUrl, model } = resolved;

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: opts.maxTokens ?? 2000,
    temperature: 0.7,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `AI API error: ${res.status}`;
    try { const j = JSON.parse(errBody) as { error?: { message?: string } }; if (j?.error?.message) msg = j.error.message; } catch { if (errBody.length < 200) msg = errBody; }
    throw new Error(msg);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('No response from AI');

  if (opts.userId != null) {
    aiUsageService.logUsage({ userId: opts.userId, configId: config.configId, serviceCode: config.serviceCode, displayName: config.displayName, model, feature: opts.feature }).catch(() => {});
  }

  return { content, model };
}

const GENERATE_SYSTEM = `You are an expert email template designer. You create beautiful, responsive HTML email templates with inline CSS.

Rules:
- Use inline CSS only (no <style> blocks, no external stylesheets)
- Use table-based layout for maximum email client compatibility
- Prefer the brand's fonts when provided; otherwise use web-safe fonts (Arial, Helvetica, Georgia, Tahoma, Verdana)
- Max width 600px, centered
- Use {{variableName}} syntax for dynamic placeholders
- Include a professional header, body, and footer
- When a brand kit is provided, use its company name in header/footer, its colors (primary for headers/buttons, secondary for links, accent for highlights, background and text as given), and logo URL if provided
- Make the design modern, clean, and visually appealing with colors and spacing
- Ensure the template works well in Outlook, Gmail, and Apple Mail
- Return ONLY the HTML code, no explanations or markdown fences

When providing the response, use this JSON format:
{
  "name": "Template Name",
  "subject": "Email subject with {{placeholders}}",
  "bodyHtml": "<the full HTML email template>",
  "description": "Brief description of the template",
  "variables": ["{{variable1}}", "{{variable2}}"],
  "category": "Suggested category"
}`;

const IMPROVE_SYSTEM = `You are an expert email template designer. Your task is to improve an existing HTML email template.

Rules:
- Improve the visual design, layout, and readability
- Fix any HTML/CSS issues for email client compatibility
- Use inline CSS only (no <style> blocks)
- Keep all existing {{variableName}} placeholders
- When a brand kit is provided, align colors and company name with it (primary, secondary, accent, background, text; use company name in header/footer and logo URL if given)
- Preserve the original intent and content
- Make it more professional and modern
- Return ONLY the improved HTML, no explanations`;

const SUBJECT_SYSTEM = `You are a marketing copywriter specializing in email subject lines.
Generate 5 compelling subject line variations for the given email purpose.
Return as a JSON array of strings, nothing else.
Example: ["Subject 1", "Subject 2", "Subject 3", "Subject 4", "Subject 5"]`;

/** Build brand context string for AI prompts from Brand Kit (Settings > Brand Kit). */
async function getBrandContextForPrompt(): Promise<string> {
  const kit = await brandKitService.getBrandKit();
  if (!kit) return '';
  const lines: string[] = ['Use this company brand in the template:'];
  if (kit.companyName?.trim()) lines.push(`- Company name: ${kit.companyName.trim()}`);
  if (kit.logoUrl?.trim()) lines.push(`- Logo URL (use in header): ${kit.logoUrl.trim()}`);
  if (kit.primaryColor?.trim()) lines.push(`- Primary color (headers, main buttons): ${kit.primaryColor.trim()}`);
  if (kit.secondaryColor?.trim()) lines.push(`- Secondary color (links, secondary buttons): ${kit.secondaryColor.trim()}`);
  if (kit.accentColor?.trim()) lines.push(`- Accent color (highlights, CTAs): ${kit.accentColor.trim()}`);
  if (kit.backgroundColor?.trim()) lines.push(`- Background color: ${kit.backgroundColor.trim()}`);
  if (kit.textColor?.trim()) lines.push(`- Text color: ${kit.textColor.trim()}`);
  if (kit.fontHeading?.trim()) lines.push(`- Heading font: ${kit.fontHeading.trim()}`);
  if (kit.fontBody?.trim()) lines.push(`- Body font: ${kit.fontBody.trim()}`);
  if (lines.length <= 1) return '';
  return '\n\n' + lines.join('\n');
}

export interface GenerateResult {
  name: string;
  subject: string;
  bodyHtml: string;
  description: string;
  variables: string[];
  category: string;
  model: string;
}

export async function aiGenerate(prompt: string, opts: { serviceCode?: string | null; userId?: number }): Promise<GenerateResult> {
  const brandContext = await getBrandContextForPrompt();
  const userPrompt = `Create an email template for: ${prompt}${brandContext}`;
  const { content, model } = await callAI(GENERATE_SYSTEM, userPrompt, { ...opts, feature: 'email_template_generate', maxTokens: 3000 });

  try {
    const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return {
      name: String(parsed.name ?? 'AI Generated Template'),
      subject: String(parsed.subject ?? ''),
      bodyHtml: String(parsed.bodyHtml ?? ''),
      description: String(parsed.description ?? ''),
      variables: Array.isArray(parsed.variables) ? parsed.variables.map(String) : [],
      category: String(parsed.category ?? 'General'),
      model,
    };
  } catch {
    if (content.includes('<') && content.includes('>')) {
      return { name: 'AI Generated Template', subject: '', bodyHtml: content, description: '', variables: [], category: 'General', model };
    }
    throw new Error('AI returned an unexpected format. Please try again.');
  }
}

export async function aiImprove(bodyHtml: string, instructions: string, opts: { serviceCode?: string | null; userId?: number }): Promise<{ improved: string; model: string }> {
  const brandContext = await getBrandContextForPrompt();
  const userPrompt = (instructions?.trim()
    ? `Improve this email template. Additional instructions: ${instructions}`
    : `Improve this email template`) + `${brandContext}\n\nCurrent HTML:\n${bodyHtml}`;
  const { content, model } = await callAI(IMPROVE_SYSTEM, userPrompt, { ...opts, feature: 'email_template_improve', maxTokens: 3000 });
  const cleaned = content.replace(/```html\s*/gi, '').replace(/```\s*/g, '').trim();
  return { improved: cleaned, model };
}

export async function aiSuggestSubjects(purpose: string, opts: { serviceCode?: string | null; userId?: number }): Promise<{ subjects: string[]; model: string }> {
  const { content, model } = await callAI(SUBJECT_SYSTEM, `Email purpose: ${purpose}`, { ...opts, feature: 'email_template_subjects', maxTokens: 500 });
  try {
    const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) return { subjects: arr.map(String).slice(0, 10), model };
  } catch { /* */ }
  return { subjects: [content], model };
}
