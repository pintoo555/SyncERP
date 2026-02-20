import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { LeadActivity, LeadActivityCreate } from './leads.types';

const SCHEMA = config.db.schema || 'dbo';
const ACTIVITY = `[${SCHEMA}].[utbl_Leads_Activity]`;
const STAGE = `[${SCHEMA}].[utbl_Leads_Stage]`;
const USERS = `[${SCHEMA}].[utbl_Users_Master]`;

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}

function mapRow(r: any): LeadActivity {
  return {
    activityId: r.activityId,
    leadId: r.leadId,
    activityType: r.activityType,
    subject: r.subject ?? null,
    description: r.description ?? null,
    fromStageId: r.fromStageId ?? null,
    fromStageName: r.fromStageName ?? null,
    toStageId: r.toStageId ?? null,
    toStageName: r.toStageName ?? null,
    conversationId: r.conversationId ?? null,
    createdOn: dateToIso(r.createdOn),
    createdBy: r.createdBy ?? null,
    createdByName: r.createdByName ?? null,
  };
}

const BASE_COLUMNS = `
  a.ActivityId   AS activityId,
  a.LeadId       AS leadId,
  a.ActivityType AS activityType,
  a.Subject      AS subject,
  a.[Description] AS description,
  a.FromStageId  AS fromStageId,
  fs.StageName   AS fromStageName,
  a.ToStageId    AS toStageId,
  ts.StageName   AS toStageName,
  a.ConversationId AS conversationId,
  a.CreatedOn    AS createdOn,
  a.CreatedBy    AS createdBy,
  u.Name         AS createdByName`;

const BASE_FROM = `
  FROM ${ACTIVITY} a
  LEFT JOIN ${STAGE} fs ON fs.StageId = a.FromStageId
  LEFT JOIN ${STAGE} ts ON ts.StageId = a.ToStageId
  LEFT JOIN ${USERS} u  ON u.UserId   = a.CreatedBy`;

export async function getActivities(
  leadId: number,
  page: number = 1,
  pageSize: number = 50,
): Promise<{ data: LeadActivity[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const countReq = await getRequest();
  countReq.input('leadId', leadId);
  const countResult = await countReq.query(`
    SELECT COUNT(*) AS total FROM ${ACTIVITY} a WHERE a.LeadId = @leadId
  `);
  const total: number = countResult.recordset[0]?.total || 0;

  const dataReq = await getRequest();
  dataReq.input('leadId', leadId);
  dataReq.input('offset', offset);
  dataReq.input('pageSize', pageSize);
  const dataResult = await dataReq.query(`
    ;WITH CTE AS (
      SELECT ${BASE_COLUMNS},
             ROW_NUMBER() OVER (ORDER BY a.CreatedOn DESC) AS rn
      ${BASE_FROM}
      WHERE a.LeadId = @leadId
    )
    SELECT * FROM CTE WHERE rn > @offset AND rn <= @offset + @pageSize
  `);

  return { data: (dataResult.recordset as any[]).map(mapRow), total };
}

export async function createActivity(
  leadId: number,
  data: LeadActivityCreate,
  userId: number | null,
): Promise<number> {
  const req = await getRequest();
  req.input('leadId', leadId);
  req.input('activityType', data.activityType);
  req.input('subject', data.subject?.trim().slice(0, 300) ?? null);
  req.input('description', data.description?.trim() ?? null);
  req.input('fromStageId', data.fromStageId ?? null);
  req.input('toStageId', data.toStageId ?? null);
  req.input('communicationRef', data.communicationRef?.trim().slice(0, 100) ?? null);
  req.input('conversationId', data.conversationId ?? null);
  req.input('createdBy', userId);

  const result = await req.query(`
    DECLARE @out TABLE (ActivityId BIGINT);

    INSERT INTO ${ACTIVITY}
      (LeadId, ActivityType, Subject, [Description], FromStageId, ToStageId,
       CommunicationRef, ConversationId, CreatedBy)
    OUTPUT INSERTED.ActivityId INTO @out
    VALUES
      (@leadId, @activityType, @subject, @description, @fromStageId, @toStageId,
       @communicationRef, @conversationId, @createdBy);

    SELECT ActivityId FROM @out;
  `);

  return (result.recordset as { ActivityId: number }[])[0].ActivityId;
}

export async function getActivitiesByConversation(
  conversationId: number,
): Promise<LeadActivity[]> {
  const req = await getRequest();
  req.input('conversationId', conversationId);
  const result = await req.query(`
    SELECT ${BASE_COLUMNS}
    ${BASE_FROM}
    WHERE a.ConversationId = @conversationId
    ORDER BY a.CreatedOn DESC
  `);
  return (result.recordset as any[]).map(mapRow);
}
