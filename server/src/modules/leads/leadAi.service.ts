import { getRequest } from '../../config/db';
import * as apiConfigService from '../../services/apiConfigService';
import * as aiUsageService from '../../services/aiUsageService';

/* ------------------------------------------------------------------ */
/*  Resolve OpenAI-compatible config                                    */
/* ------------------------------------------------------------------ */
const OPENAI_CODES = ['openai', 'OpenAI', 'OPENAI'];

interface AiConfig {
  configId: number;
  serviceCode: string;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

async function resolveConfig(serviceCode?: string): Promise<AiConfig> {
  const codes = serviceCode?.trim() ? [serviceCode.trim()] : OPENAI_CODES;
  for (const code of codes) {
    const cfg = await apiConfigService.getByServiceCode(code);
    if (cfg?.apiKey) {
      const baseUrl = (cfg.baseUrl || '').trim() || 'https://api.openai.com/v1';
      let model = 'gpt-4o-mini';
      if (cfg.extraConfig) {
        try {
          const extra = JSON.parse(cfg.extraConfig) as Record<string, unknown>;
          if (typeof extra.model === 'string') model = extra.model;
        } catch { /* ignore */ }
      }
      return {
        configId: cfg.configId,
        serviceCode: cfg.serviceCode,
        displayName: cfg.displayName,
        apiKey: cfg.apiKey,
        baseUrl,
        model,
      };
    }
  }
  throw new Error('No active AI configuration found. Please configure an OpenAI-compatible provider in Settings → API Configuration.');
}

/* ------------------------------------------------------------------ */
/*  Call OpenAI-compatible chat completions                             */
/* ------------------------------------------------------------------ */
interface CallAiOpts {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  userId?: number;
  feature: string;
}

async function callAi(opts: CallAiOpts): Promise<string> {
  const cfg = await resolveConfig();
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const body = {
    model: cfg.model,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
    max_tokens: opts.maxTokens ?? 1000,
    temperature: opts.temperature ?? 0.4,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `AI API error: ${res.status}`;
    try {
      const j = JSON.parse(errBody) as { error?: { message?: string } };
      if (j?.error?.message) msg = j.error.message;
    } catch {
      if (errBody.length < 200) msg = errBody;
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty response from AI');

  if (opts.userId != null) {
    aiUsageService.logUsage({
      userId: opts.userId,
      configId: cfg.configId,
      serviceCode: cfg.serviceCode,
      displayName: cfg.displayName,
      model: cfg.model,
      feature: opts.feature,
    }).catch(() => {});
  }

  return content;
}

/* ------------------------------------------------------------------ */
/*  Helper: fetch lead context for AI prompts                           */
/* ------------------------------------------------------------------ */
interface LeadContext {
  lead: Record<string, unknown>;
  activities: Array<Record<string, unknown>>;
  conversations: Array<Record<string, unknown>>;
}

async function getLeadContext(leadId: number): Promise<LeadContext> {
  const req = await getRequest();

  const leadResult = await req
    .input('leadId', leadId)
    .query(`
      SELECT l.*, s.StageName, s.IsWon, s.IsLost,
             src.SourceName,
             u.Name AS AssignedToName
      FROM dbo.utbl_Leads_Master l
      LEFT JOIN dbo.utbl_Leads_Stage  s   ON s.StageId  = l.StageId
      LEFT JOIN dbo.utbl_Leads_Source src ON src.SourceId = l.SourceId
      LEFT JOIN dbo.utbl_Users_Master u   ON u.UserId = l.AssignedToUserId
      WHERE l.LeadId = @leadId
    `);
  const lead = leadResult.recordset[0] || {};

  const req2 = await getRequest();
  const activitiesResult = await req2
    .input('leadId2', leadId)
    .query(`
      SELECT TOP 30 a.ActivityType, a.Subject, a.Description, a.CreatedOn,
             cu.Name AS CreatedByName,
             fs.StageName AS FromStageName, ts.StageName AS ToStageName
      FROM dbo.utbl_Leads_Activity a
      LEFT JOIN dbo.utbl_Users_Master cu ON cu.UserId = a.CreatedBy
      LEFT JOIN dbo.utbl_Leads_Stage fs  ON fs.StageId = a.FromStageId
      LEFT JOIN dbo.utbl_Leads_Stage ts  ON ts.StageId = a.ToStageId
      WHERE a.LeadId = @leadId2
      ORDER BY a.CreatedOn DESC
    `);

  const req3 = await getRequest();
  const convoResult = await req3
    .input('leadId3', leadId)
    .query(`
      SELECT TOP 20 m.Direction, m.MessageText AS Body, m.CreatedOn AS SentAt,
             ISNULL(u.Name, m.OriginalSenderName) AS SenderName
      FROM dbo.utbl_Leads_ConversationMessage m
      INNER JOIN dbo.utbl_Leads_Conversation c ON c.ConversationId = m.ConversationId
      LEFT JOIN dbo.utbl_Users_Master u ON u.UserId = m.SenderUserId
      WHERE c.LeadId = @leadId3
      ORDER BY m.CreatedOn DESC
    `);

  return {
    lead,
    activities: activitiesResult.recordset,
    conversations: convoResult.recordset,
  };
}

function buildLeadSummary(ctx: LeadContext): string {
  const l = ctx.lead as Record<string, any>;
  const parts: string[] = [];
  parts.push(`Lead: ${l.ContactName || 'Unknown'} at ${l.CompanyName || 'N/A'}`);
  parts.push(`Stage: ${l.StageName || 'Unknown'} | Source: ${l.SourceName || 'Unknown'}`);
  if (l.EstimatedValue) parts.push(`Estimated Value: ₹${l.EstimatedValue}`);
  if (l.City) parts.push(`City: ${l.City}`);
  if (l.ClientType) parts.push(`Type: ${l.ClientType}`);
  if (l.Tags) parts.push(`Tags: ${l.Tags}`);
  if (l.Email) parts.push(`Email: ${l.Email}`);
  if (l.Phone) parts.push(`Phone: ${l.Phone}`);

  const daysSinceCreation = l.CreatedOn
    ? Math.floor((Date.now() - new Date(l.CreatedOn).getTime()) / 86_400_000)
    : 0;
  parts.push(`Days in pipeline: ${daysSinceCreation}`);

  if (ctx.activities.length > 0) {
    parts.push(`\nRecent Activities (newest first):`);
    ctx.activities.slice(0, 15).forEach((a: any) => {
      const date = new Date(a.CreatedOn).toISOString().slice(0, 10);
      let desc = `${date} - ${a.ActivityType}`;
      if (a.Subject) desc += `: ${a.Subject}`;
      if (a.FromStageName && a.ToStageName) desc += ` (${a.FromStageName} → ${a.ToStageName})`;
      parts.push(`  • ${desc}`);
    });
  }

  if (ctx.conversations.length > 0) {
    parts.push(`\nRecent Conversations:`);
    ctx.conversations.slice(0, 10).forEach((m: any) => {
      const date = new Date(m.SentAt).toISOString().slice(0, 10);
      const body = (m.Body || '').slice(0, 150);
      parts.push(`  • ${date} [${m.Direction}] ${m.SenderName || ''}: ${body}`);
    });
  }

  return parts.join('\n');
}

/* ================================================================== */
/*  1. LEAD SCORING                                                     */
/* ================================================================== */
export interface ScoreResult {
  score: number;
  label: 'Hot' | 'Warm' | 'Cold' | 'Dead';
  reasoning: string;
}

export async function scoreLead(leadId: number, userId?: number): Promise<ScoreResult> {
  const ctx = await getLeadContext(leadId);
  const summary = buildLeadSummary(ctx);

  const systemPrompt = `You are a B2B lead scoring expert for an Indian IT services / technology company. Score the lead on a scale of 0 to 100 and classify as Hot (75-100), Warm (40-74), Cold (10-39), or Dead (0-9).

Consider these factors:
- Company fit (OEM/Dealer/EndUser, industry relevance)
- Deal value and budget signals
- Engagement level (activity count, recency, conversation quality)
- Pipeline velocity (days in current stage vs typical)
- Contact completeness (email, phone, designation)
- Buying signals from conversations
- Responsiveness

Return a valid JSON object with exactly these fields:
{ "score": <number 0-100>, "label": "<Hot|Warm|Cold|Dead>", "reasoning": "<2-3 sentence explanation>" }

Return ONLY the JSON, no markdown fences, no extra text.`;

  const raw = await callAi({
    systemPrompt,
    userPrompt: summary,
    maxTokens: 300,
    temperature: 0.3,
    userId,
    feature: 'lead_scoring',
  });

  const cleaned = raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned) as ScoreResult;

  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
  let label: ScoreResult['label'];
  if (score >= 75) label = 'Hot';
  else if (score >= 40) label = 'Warm';
  else if (score >= 10) label = 'Cold';
  else label = 'Dead';

  await saveScore(leadId, score, label, parsed.reasoning, userId);

  return { score, label, reasoning: parsed.reasoning };
}

async function saveScore(leadId: number, score: number, label: string, reasoning: string, userId?: number) {
  const req = await getRequest();
  req.input('leadId', leadId);
  req.input('score', score);
  req.input('label', label);
  req.input('reasoning', reasoning);
  req.input('model', 'gpt-4o-mini');
  req.input('userId', userId ?? null);

  await req.query(`
    INSERT INTO dbo.utbl_Leads_Score (LeadId, Score, Label, Reasoning, Model)
    VALUES (@leadId, @score, @label, @reasoning, @model);

    UPDATE dbo.utbl_Leads_Master
    SET AiScore = @score, AiScoreLabel = @label, AiScoredAt = GETDATE(), UpdatedOn = GETDATE(), UpdatedBy = @userId
    WHERE LeadId = @leadId;
  `);
}

/* ================================================================== */
/*  2. NEXT-ACTION SUGGESTIONS                                          */
/* ================================================================== */
export interface ActionSuggestion {
  priority: 'high' | 'medium' | 'low';
  action: string;
  reason: string;
  channel: string;
}

export async function suggestNextActions(leadId: number, userId?: number): Promise<ActionSuggestion[]> {
  const ctx = await getLeadContext(leadId);
  const summary = buildLeadSummary(ctx);

  const systemPrompt = `You are a B2B sales strategist for an Indian IT/technology company. Based on the lead's current state, recent activities, and conversation history, suggest the top 3 next best actions the salesperson should take.

For each action, specify:
- priority: "high", "medium", or "low"
- action: a concise instruction (1 sentence)
- reason: why this action matters (1 sentence)
- channel: "call", "email", "whatsapp", "meeting", "internal", or "other"

Return a JSON array of exactly 3 objects:
[{ "priority": "...", "action": "...", "reason": "...", "channel": "..." }, ...]

Return ONLY the JSON array, no markdown, no extra text.`;

  const raw = await callAi({
    systemPrompt,
    userPrompt: summary,
    maxTokens: 500,
    temperature: 0.5,
    userId,
    feature: 'lead_next_actions',
  });

  const cleaned = raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned) as ActionSuggestion[];
}

/* ================================================================== */
/*  3. MESSAGE DRAFTING                                                 */
/* ================================================================== */
export interface DraftResult {
  subject?: string;
  body: string;
}

export async function draftMessage(
  leadId: number,
  channel: 'email' | 'whatsapp',
  intent: string,
  userId?: number
): Promise<DraftResult> {
  const ctx = await getLeadContext(leadId);
  const summary = buildLeadSummary(ctx);

  const isEmail = channel === 'email';

  const systemPrompt = isEmail
    ? `You are a professional business development executive at an Indian IT/technology company. Draft a ${intent} email for this lead.

Requirements:
- Professional but warm Indian business tone
- Concise and action-oriented
- Include a clear call-to-action
- Use the lead's name and company where known

Return a JSON object: { "subject": "<email subject line>", "body": "<email body text>" }
Return ONLY the JSON, no markdown fences.`
    : `You are a friendly business development executive at an Indian IT/technology company. Draft a ${intent} WhatsApp message for this lead.

Requirements:
- Conversational but professional
- Keep it short (max 3-4 lines for WhatsApp)
- Appropriate for WhatsApp (no formal salutations)
- Include a clear next step or question

Return a JSON object: { "body": "<message text>" }
Return ONLY the JSON, no markdown fences.`;

  const raw = await callAi({
    systemPrompt,
    userPrompt: `Lead Context:\n${summary}\n\nIntent: ${intent}`,
    maxTokens: isEmail ? 800 : 300,
    temperature: 0.6,
    userId,
    feature: `lead_draft_${channel}`,
  });

  const cleaned = raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned) as DraftResult;
}

/* ================================================================== */
/*  4. BANT QUALIFICATION                                               */
/* ================================================================== */
export interface BantResult {
  budget: { score: number; assessment: string };
  authority: { score: number; assessment: string };
  need: { score: number; assessment: string };
  timeline: { score: number; assessment: string };
  overallScore: number;
  overallAssessment: string;
  recommendations: string[];
}

export async function assessBant(leadId: number, userId?: number): Promise<BantResult> {
  const ctx = await getLeadContext(leadId);
  const summary = buildLeadSummary(ctx);

  const systemPrompt = `You are a sales qualification expert using the BANT framework (Budget, Authority, Need, Timeline) for an Indian B2B technology company.

Analyze the lead's data, activities, and conversations to assess their qualification level.

For each BANT dimension, provide:
- score: 0-100 (0 = no info, 100 = fully qualified)
- assessment: 1-2 sentence analysis

Also provide:
- overallScore: weighted average (Budget 30%, Authority 20%, Need 30%, Timeline 20%)
- overallAssessment: 1-2 sentence summary
- recommendations: array of 2-3 specific questions or actions to improve qualification

Return a JSON object:
{
  "budget": { "score": <0-100>, "assessment": "..." },
  "authority": { "score": <0-100>, "assessment": "..." },
  "need": { "score": <0-100>, "assessment": "..." },
  "timeline": { "score": <0-100>, "assessment": "..." },
  "overallScore": <0-100>,
  "overallAssessment": "...",
  "recommendations": ["...", "...", "..."]
}

Return ONLY the JSON, no markdown fences.`;

  const raw = await callAi({
    systemPrompt,
    userPrompt: summary,
    maxTokens: 800,
    temperature: 0.3,
    userId,
    feature: 'lead_bant_assessment',
  });

  const cleaned = raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned) as BantResult;
}
