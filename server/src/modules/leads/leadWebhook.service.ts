import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type {
  LeadWebhook,
  LeadWebhookCreate,
  LeadWebhookUpdate,
} from './leads.types';
import * as leadService from './leads.service';
import * as activityService from './leadActivity.service';

const SCHEMA   = config.db.schema || 'dbo';
const WEBHOOK  = `[${SCHEMA}].[utbl_Leads_Webhook]`;
const LOG      = `[${SCHEMA}].[utbl_Leads_WebhookLog]`;
const SOURCE   = `[${SCHEMA}].[utbl_Leads_Source]`;
const STAGE    = `[${SCHEMA}].[utbl_Leads_Stage]`;
const USER     = `[${SCHEMA}].[utbl_Users_Master]`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}
function dateToIsoOrNull(d: unknown): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function parseFieldMapping(raw: unknown): Record<string, string> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, string>;
  }
  try {
    const parsed = JSON.parse(String(raw));
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

const WEBHOOK_COLUMNS = `
  w.WebhookId               AS webhookId,
  w.WebhookName             AS webhookName,
  w.ApiKey                  AS apiKey,
  w.SourceId                AS sourceId,
  src.SourceName            AS sourceName,
  w.DefaultStageId          AS defaultStageId,
  stg.StageName             AS defaultStageName,
  w.DefaultAssignedToUserId AS defaultAssignedToUserId,
  u.Name                    AS defaultAssignedToName,
  w.FieldMapping            AS fieldMapping,
  w.IsActive                AS isActive,
  w.TotalLeadsReceived      AS totalLeadsReceived,
  w.LastReceivedAt          AS lastReceivedAt,
  w.CreatedOn               AS createdOn
`;

const WEBHOOK_JOINS = `
  FROM ${WEBHOOK} w
  LEFT JOIN ${SOURCE} src ON src.SourceId = w.SourceId
  LEFT JOIN ${STAGE}  stg ON stg.StageId  = w.DefaultStageId
  LEFT JOIN ${USER}   u   ON u.UserId     = w.DefaultAssignedToUserId
`;

function mapRow(r: any): LeadWebhook {
  return {
    webhookId:               r.webhookId,
    webhookName:             r.webhookName ?? '',
    apiKey:                  r.apiKey ?? '',
    sourceId:                r.sourceId,
    sourceName:              r.sourceName ?? '',
    defaultStageId:          r.defaultStageId ?? null,
    defaultStageName:        r.defaultStageName ?? null,
    defaultAssignedToUserId: r.defaultAssignedToUserId ?? null,
    defaultAssignedToName:   r.defaultAssignedToName ?? null,
    fieldMapping:            parseFieldMapping(r.fieldMapping),
    isActive:                !!r.isActive,
    totalLeadsReceived:      r.totalLeadsReceived ?? 0,
    lastReceivedAt:          dateToIsoOrNull(r.lastReceivedAt),
    createdOn:               dateToIso(r.createdOn),
  };
}

/* ------------------------------------------------------------------ */
/*  1. getAllWebhooks                                                   */
/* ------------------------------------------------------------------ */

export async function getAllWebhooks(): Promise<LeadWebhook[]> {
  const req = await getRequest();
  const result = await req.query(`
    SELECT ${WEBHOOK_COLUMNS}
    ${WEBHOOK_JOINS}
    ORDER BY w.CreatedOn DESC
  `);
  return (result.recordset || []).map(mapRow);
}

/* ------------------------------------------------------------------ */
/*  2. getWebhookById                                                  */
/* ------------------------------------------------------------------ */

export async function getWebhookById(id: number): Promise<LeadWebhook | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT ${WEBHOOK_COLUMNS}
    ${WEBHOOK_JOINS}
    WHERE w.WebhookId = @id
  `);
  const row = result.recordset?.[0];
  return row ? mapRow(row) : null;
}

/* ------------------------------------------------------------------ */
/*  3. getWebhookByApiKey                                              */
/* ------------------------------------------------------------------ */

export async function getWebhookByApiKey(apiKey: string): Promise<LeadWebhook | null> {
  const req = await getRequest();
  const result = await req.input('apiKey', apiKey).query(`
    SELECT ${WEBHOOK_COLUMNS}
    ${WEBHOOK_JOINS}
    WHERE w.ApiKey = @apiKey AND w.IsActive = 1
  `);
  const row = result.recordset?.[0];
  return row ? mapRow(row) : null;
}

/* ------------------------------------------------------------------ */
/*  4. createWebhook                                                   */
/* ------------------------------------------------------------------ */

export async function createWebhook(
  data: LeadWebhookCreate,
  userId: number | null,
): Promise<number> {
  const req = await getRequest();
  req.input('webhookName',             data.webhookName.trim().slice(0, 100));
  req.input('sourceId',                data.sourceId);
  req.input('defaultStageId',          data.defaultStageId ?? null);
  req.input('defaultAssignedToUserId', data.defaultAssignedToUserId ?? null);
  req.input('fieldMapping',            data.fieldMapping ? JSON.stringify(data.fieldMapping) : null);
  req.input('createdBy',               userId);

  const result = await req.query(`
    DECLARE @out TABLE (WebhookId INT);

    INSERT INTO ${WEBHOOK}
      (WebhookName, ApiKey, SourceId, DefaultStageId, DefaultAssignedToUserId,
       FieldMapping, CreatedBy)
    OUTPUT INSERTED.WebhookId INTO @out
    VALUES
      (@webhookName, NEWID(), @sourceId, @defaultStageId, @defaultAssignedToUserId,
       @fieldMapping, @createdBy);

    SELECT WebhookId FROM @out;
  `);

  return (result.recordset as { WebhookId: number }[])[0].WebhookId;
}

/* ------------------------------------------------------------------ */
/*  5. updateWebhook                                                   */
/* ------------------------------------------------------------------ */

export async function updateWebhook(
  id: number,
  data: LeadWebhookUpdate,
  userId: number | null,
): Promise<void> {
  const sets: string[] = [];
  const req = await getRequest();
  req.input('id', id);

  if (data.webhookName !== undefined) {
    req.input('webhookName', data.webhookName!.trim().slice(0, 100));
    sets.push('WebhookName = @webhookName');
  }
  if (data.sourceId !== undefined) {
    req.input('sourceId', data.sourceId);
    sets.push('SourceId = @sourceId');
  }
  if (data.defaultStageId !== undefined) {
    req.input('defaultStageId', data.defaultStageId ?? null);
    sets.push('DefaultStageId = @defaultStageId');
  }
  if (data.defaultAssignedToUserId !== undefined) {
    req.input('defaultAssignedToUserId', data.defaultAssignedToUserId ?? null);
    sets.push('DefaultAssignedToUserId = @defaultAssignedToUserId');
  }
  if (data.fieldMapping !== undefined) {
    req.input('fieldMapping', data.fieldMapping ? JSON.stringify(data.fieldMapping) : null);
    sets.push('FieldMapping = @fieldMapping');
  }
  if (data.isActive !== undefined) {
    req.input('isActive', data.isActive ? 1 : 0);
    sets.push('IsActive = @isActive');
  }

  if (sets.length === 0) return;
  sets.push('UpdatedOn = GETDATE()');

  await req.query(`UPDATE ${WEBHOOK} SET ${sets.join(', ')} WHERE WebhookId = @id`);
}

/* ------------------------------------------------------------------ */
/*  6. regenerateApiKey                                                */
/* ------------------------------------------------------------------ */

export async function regenerateApiKey(id: number): Promise<string> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    UPDATE ${WEBHOOK}
    SET ApiKey = NEWID(), UpdatedOn = GETDATE()
    OUTPUT INSERTED.ApiKey
    WHERE WebhookId = @id
  `);
  const newKey = result.recordset?.[0]?.ApiKey;
  if (!newKey) throw new Error('Webhook not found');
  return String(newKey);
}

/* ------------------------------------------------------------------ */
/*  7. incrementLeadCount                                              */
/* ------------------------------------------------------------------ */

export async function incrementLeadCount(id: number): Promise<void> {
  const req = await getRequest();
  await req.input('id', id).query(`
    UPDATE ${WEBHOOK}
    SET TotalLeadsReceived = TotalLeadsReceived + 1,
        LastReceivedAt     = GETDATE()
    WHERE WebhookId = @id
  `);
}

/* ------------------------------------------------------------------ */
/*  8. logCapture                                                      */
/* ------------------------------------------------------------------ */

export async function logCapture(
  webhookId: number,
  success: boolean,
  leadId: number | null,
  rawPayload: string,
  errorMessage: string | null,
  ipAddress: string | null,
): Promise<void> {
  const req = await getRequest();
  req.input('webhookId',    webhookId);
  req.input('success',      success ? 1 : 0);
  req.input('leadId',       leadId);
  req.input('rawPayload',   rawPayload);
  req.input('errorMessage', errorMessage ? errorMessage.slice(0, 500) : null);
  req.input('ipAddress',    ipAddress ? ipAddress.slice(0, 50) : null);

  await req.query(`
    INSERT INTO ${LOG}
      (WebhookId, Success, LeadId, RawPayload, ErrorMessage, IPAddress)
    VALUES
      (@webhookId, @success, @leadId, @rawPayload, @errorMessage, @ipAddress)
  `);
}

/* ------------------------------------------------------------------ */
/*  9. getCaptureLogs                                                  */
/* ------------------------------------------------------------------ */

export async function getCaptureLogs(
  webhookId: number,
  limit: number = 50,
): Promise<any[]> {
  const req = await getRequest();
  req.input('webhookId', webhookId);
  req.input('limit', limit);

  const result = await req.query(`
    SELECT TOP (@limit)
      LogId        AS logId,
      WebhookId    AS webhookId,
      Success      AS success,
      LeadId       AS leadId,
      RawPayload   AS rawPayload,
      ErrorMessage AS errorMessage,
      IPAddress    AS ipAddress,
      CreatedOn    AS createdOn
    FROM ${LOG}
    WHERE WebhookId = @webhookId
    ORDER BY CreatedOn DESC
  `);

  return (result.recordset || []).map((r: any) => ({
    ...r,
    success:   !!r.success,
    createdOn: dateToIso(r.createdOn),
  }));
}

/* ------------------------------------------------------------------ */
/*  10. applyFieldMapping                                              */
/* ------------------------------------------------------------------ */

export function applyFieldMapping(
  rawData: Record<string, any>,
  fieldMapping: Record<string, string> | null,
): Record<string, any> {
  if (!fieldMapping) return rawData;

  const mapped: Record<string, any> = {};
  for (const [externalKey, internalKey] of Object.entries(fieldMapping)) {
    if (externalKey in rawData) {
      mapped[internalKey] = rawData[externalKey];
    }
  }

  for (const [key, value] of Object.entries(rawData)) {
    if (!(key in fieldMapping) && !(key in mapped)) {
      mapped[key] = value;
    }
  }

  return mapped;
}

/* ------------------------------------------------------------------ */
/*  11. processWebhookCapture                                          */
/* ------------------------------------------------------------------ */

export async function processWebhookCapture(
  webhookId: number,
  rawData: Record<string, any>,
  ipAddress: string | null,
): Promise<{ leadId: number; leadCode: string; isDuplicate: boolean }> {
  const rawPayload = JSON.stringify(rawData);

  try {
    const webhook = await getWebhookById(webhookId);
    if (!webhook) throw new Error('Webhook not found');

    const mapped = applyFieldMapping(rawData, webhook.fieldMapping);

    const duplicates = await leadService.checkDuplicates(
      mapped.email,
      mapped.phone,
    );

    if (duplicates.length > 0) {
      const existing = duplicates[0];

      await activityService.createActivity(existing.leadId, {
        activityType: 'NOTE',
        subject: `Duplicate webhook capture (${webhook.webhookName})`,
        description: `Received duplicate submission via webhook "${webhook.webhookName}". Raw payload: ${rawPayload}`,
      }, null);

      await incrementLeadCount(webhookId);
      await logCapture(webhookId, true, existing.leadId, rawPayload, null, ipAddress);

      return {
        leadId:      existing.leadId,
        leadCode:    existing.leadCode,
        isDuplicate: true,
      };
    }

    const leadId = await leadService.createLead({
      contactName:      mapped.contactName || mapped.name || 'Unknown',
      companyName:      mapped.companyName || mapped.company,
      email:            mapped.email,
      phone:            mapped.phone,
      whatsAppNumber:   mapped.whatsAppNumber,
      designation:      mapped.designation,
      city:             mapped.city,
      gstNumber:        mapped.gstNumber,
      notes:            mapped.notes || mapped.message,
      sourceId:         webhook.sourceId,
      stageId:          webhook.defaultStageId ?? undefined,
      assignedToUserId: webhook.defaultAssignedToUserId ?? undefined,
    }, null);

    const lead = await leadService.getLeadById(leadId);
    const leadCode = lead?.leadCode ?? '';

    await activityService.createActivity(leadId, {
      activityType: 'WEBHOOK_CAPTURE',
      subject: `Lead captured via ${webhook.webhookName}`,
      description: `New lead created from webhook "${webhook.webhookName}". Source: ${webhook.sourceName}.`,
    }, null);

    await incrementLeadCount(webhookId);
    await logCapture(webhookId, true, leadId, rawPayload, null, ipAddress);

    return { leadId, leadCode, isDuplicate: false };
  } catch (err: any) {
    await logCapture(
      webhookId,
      false,
      null,
      rawPayload,
      err?.message || 'Unknown error',
      ipAddress,
    );
    throw err;
  }
}
