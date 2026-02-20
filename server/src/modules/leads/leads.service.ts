/**
 * Lead service: CRUD, filtering, pagination, stage transitions, and lead-to-client conversion.
 */

import sql from 'mssql';
import { getRequest, getPool } from '../../config/db';
import { config } from '../../config/env';
import type {
  LeadRow,
  LeadListFilters,
  LeadCreateData,
  LeadUpdateData,
  PaginatedResult,
} from './leads.types';

const SCHEMA = config.db.schema || 'dbo';
const LEAD       = `[${SCHEMA}].[utbl_Leads_Master]`;
const STAGE      = `[${SCHEMA}].[utbl_Leads_Stage]`;
const SOURCE     = `[${SCHEMA}].[utbl_Leads_Source]`;
const INDUSTRY   = `[${SCHEMA}].[utbl_Industry]`;
const USER       = `[${SCHEMA}].[utbl_Users_Master]`;
const CLIENT     = `[${SCHEMA}].[utbl_Client]`;
const CONTACT    = `[${SCHEMA}].[utbl_ClientContact]`;

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

const LEAD_COLUMNS = `
  l.LeadId        AS leadId,
  l.LeadCode      AS leadCode,
  l.CompanyName    AS companyName,
  l.ContactName    AS contactName,
  l.Designation    AS designation,
  l.Email          AS email,
  l.Phone          AS phone,
  l.WhatsAppNumber AS whatsAppNumber,
  l.IndustryId     AS industryId,
  ind.IndustryName AS industryName,
  l.ClientType     AS clientType,
  l.SourceId       AS sourceId,
  src.SourceName   AS sourceName,
  l.StageId        AS stageId,
  s.StageName      AS stageName,
  s.Color          AS stageColor,
  s.IsWon          AS stageIsWon,
  s.IsLost         AS stageIsLost,
  l.AssignedToUserId AS assignedToUserId,
  u.Name           AS assignedToName,
  l.EstimatedValue AS estimatedValue,
  l.Currency       AS currency,
  l.ExpectedCloseDate AS expectedCloseDate,
  l.AiScore        AS aiScore,
  l.AiScoreLabel   AS aiScoreLabel,
  l.AiScoredAt     AS aiScoredAt,
  l.ConvertedToClientId AS convertedToClientId,
  l.ConvertedAt    AS convertedAt,
  l.LostReason     AS lostReason,
  l.LostAt         AS lostAt,
  l.Tags           AS tags,
  l.Notes          AS notes,
  l.GSTNumber      AS gstNumber,
  l.City           AS city,
  l.IsActive       AS isActive,
  l.CreatedOn      AS createdOn,
  l.CreatedBy      AS createdBy,
  l.UpdatedOn      AS updatedOn,
  l.UpdatedBy      AS updatedBy
`;

const LEAD_JOINS = `
  FROM ${LEAD} l
  LEFT JOIN ${STAGE}    s   ON s.StageId   = l.StageId
  LEFT JOIN ${SOURCE}   src ON src.SourceId = l.SourceId
  LEFT JOIN ${INDUSTRY} ind ON ind.Id       = l.IndustryId
  LEFT JOIN ${USER}     u   ON u.UserId     = l.AssignedToUserId
`;

function mapRow(r: any): LeadRow {
  return {
    leadId:              r.leadId,
    leadCode:            r.leadCode ?? '',
    companyName:         r.companyName ?? null,
    contactName:         r.contactName ?? '',
    designation:         r.designation ?? null,
    email:               r.email ?? null,
    phone:               r.phone ?? null,
    whatsAppNumber:      r.whatsAppNumber ?? null,
    industryId:          r.industryId ?? null,
    industryName:        r.industryName ?? null,
    clientType:          r.clientType ?? null,
    sourceId:            r.sourceId ?? null,
    sourceName:          r.sourceName ?? null,
    stageId:             r.stageId,
    stageName:           r.stageName ?? '',
    stageColor:          r.stageColor ?? '#888888',
    stageIsWon:          !!r.stageIsWon,
    stageIsLost:         !!r.stageIsLost,
    assignedToUserId:    r.assignedToUserId ?? null,
    assignedToName:      r.assignedToName ?? null,
    estimatedValue:      r.estimatedValue ?? null,
    currency:            r.currency ?? 'INR',
    expectedCloseDate:   dateToIsoOrNull(r.expectedCloseDate),
    aiScore:             r.aiScore ?? null,
    aiScoreLabel:        r.aiScoreLabel ?? null,
    aiScoredAt:          dateToIsoOrNull(r.aiScoredAt),
    convertedToClientId: r.convertedToClientId ?? null,
    convertedAt:         dateToIsoOrNull(r.convertedAt),
    lostReason:          r.lostReason ?? null,
    lostAt:              dateToIsoOrNull(r.lostAt),
    tags:                r.tags ?? null,
    notes:               r.notes ?? null,
    gstNumber:           r.gstNumber ?? null,
    city:                r.city ?? null,
    isActive:            !!r.isActive,
    createdOn:           dateToIso(r.createdOn),
    createdBy:           r.createdBy ?? null,
    updatedOn:           dateToIsoOrNull(r.updatedOn),
    updatedBy:           r.updatedBy ?? null,
  };
}

const ALLOWED_SORT_COLS: Record<string, string> = {
  companyName:    'l.CompanyName',
  contactName:    'l.ContactName',
  createdOn:      'l.CreatedOn',
  estimatedValue: 'l.EstimatedValue',
  aiScore:        'l.AiScore',
  stageName:      's.StageName',
  sourceName:     'src.SourceName',
};

/* ------------------------------------------------------------------ */
/*  Build WHERE clause + bind params on a request                      */
/* ------------------------------------------------------------------ */

function applyFilters(req: sql.Request, filters: LeadListFilters): string {
  const where: string[] = [];

  if (filters.search) {
    req.input('search', `%${filters.search}%`);
    where.push(
      `(l.CompanyName LIKE @search OR l.ContactName LIKE @search OR l.Email LIKE @search OR l.Phone LIKE @search)`
    );
  }
  if (filters.stageId != null) {
    req.input('stageId', filters.stageId);
    where.push('l.StageId = @stageId');
  }
  if (filters.sourceId != null) {
    req.input('sourceId', filters.sourceId);
    where.push('l.SourceId = @sourceId');
  }
  if (filters.assignedToUserId != null) {
    req.input('assignedToUserId', filters.assignedToUserId);
    where.push('l.AssignedToUserId = @assignedToUserId');
  }
  if (filters.aiScoreLabel) {
    req.input('aiScoreLabel', filters.aiScoreLabel);
    where.push('l.AiScoreLabel = @aiScoreLabel');
  }
  if (filters.clientType) {
    req.input('clientType', filters.clientType);
    where.push('l.ClientType = @clientType');
  }
  if (filters.isActive !== undefined) {
    req.input('isActive', filters.isActive ? 1 : 0);
    where.push('l.IsActive = @isActive');
  }
  if (filters.hasConversion === true) {
    where.push('l.ConvertedToClientId IS NOT NULL');
  } else if (filters.hasConversion === false) {
    where.push('l.ConvertedToClientId IS NULL');
  }
  if (filters.dateFrom) {
    req.input('dateFrom', filters.dateFrom);
    where.push('l.CreatedOn >= @dateFrom');
  }
  if (filters.dateTo) {
    req.input('dateTo', filters.dateTo);
    where.push('l.CreatedOn <= @dateTo');
  }

  return where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
}

/* ------------------------------------------------------------------ */
/*  1. listLeads                                                       */
/* ------------------------------------------------------------------ */

export async function listLeads(filters: LeadListFilters): Promise<PaginatedResult<LeadRow>> {
  const sortCol = ALLOWED_SORT_COLS[filters.sortBy || ''] || 'l.CreatedOn';
  const sortDir = filters.sortDir === 'ASC' ? 'ASC' : 'DESC';
  const offset  = (filters.page - 1) * filters.pageSize;

  const countReq    = await getRequest();
  const whereClause = applyFilters(countReq, filters);
  const countResult = await countReq.query(
    `SELECT COUNT(*) AS total ${LEAD_JOINS} ${whereClause}`
  );
  const total = countResult.recordset[0]?.total || 0;

  const dataReq = await getRequest();
  const whereClause2 = applyFilters(dataReq, filters);
  dataReq.input('offset', offset);
  dataReq.input('pageSize', filters.pageSize);

  const dataResult = await dataReq.query(`
    ;WITH CTE AS (
      SELECT ${LEAD_COLUMNS},
             ROW_NUMBER() OVER (ORDER BY ${sortCol} ${sortDir}) AS rn
      ${LEAD_JOINS}
      ${whereClause2}
    )
    SELECT * FROM CTE WHERE rn > @offset AND rn <= @offset + @pageSize
  `);

  return {
    data: (dataResult.recordset || []).map(mapRow),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

/* ------------------------------------------------------------------ */
/*  2. getLeadById                                                     */
/* ------------------------------------------------------------------ */

export async function getLeadById(id: number): Promise<LeadRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(
    `SELECT ${LEAD_COLUMNS} ${LEAD_JOINS} WHERE l.LeadId = @id`
  );
  const row = result.recordset?.[0];
  return row ? mapRow(row) : null;
}

/* ------------------------------------------------------------------ */
/*  3. createLead                                                      */
/* ------------------------------------------------------------------ */

export async function createLead(data: LeadCreateData, userId: number | null): Promise<number> {
  let stageId = data.stageId;

  if (!stageId) {
    const stageReq = await getRequest();
    const stageRes = await stageReq.query(
      `SELECT TOP 1 StageId FROM ${STAGE} WHERE IsDefault = 1 AND IsActive = 1`
    );
    stageId = stageRes.recordset?.[0]?.StageId;
    if (!stageId) throw new Error('No default lead stage configured');
  }

  const req = await getRequest();
  req.input('companyName',      data.companyName ? data.companyName.trim().slice(0, 200) : null);
  req.input('contactName',      (data.contactName || '').trim().slice(0, 200));
  req.input('designation',      data.designation ? data.designation.trim().slice(0, 100) : null);
  req.input('email',            data.email ? data.email.trim().slice(0, 256) : null);
  req.input('phone',            data.phone ? data.phone.trim().slice(0, 30) : null);
  req.input('whatsAppNumber',   data.whatsAppNumber ? data.whatsAppNumber.trim().slice(0, 30) : null);
  req.input('industryId',       data.industryId ?? null);
  req.input('clientType',       data.clientType ? data.clientType.trim().slice(0, 50) : null);
  req.input('sourceId',         data.sourceId ?? null);
  req.input('stageId',          stageId);
  req.input('assignedToUserId', data.assignedToUserId ?? null);
  req.input('estimatedValue',   data.estimatedValue ?? null);
  req.input('currency',         (data.currency || 'INR').trim().slice(0, 10));
  req.input('expectedCloseDate', data.expectedCloseDate || null);
  req.input('tags',             data.tags ? data.tags.trim().slice(0, 500) : null);
  req.input('notes',            data.notes || null);
  req.input('gstNumber',        data.gstNumber ? data.gstNumber.trim().slice(0, 20) : null);
  req.input('city',             data.city ? data.city.trim().slice(0, 100) : null);
  req.input('stateId',          data.stateId ?? null);
  req.input('countryId',        data.countryId ?? null);
  req.input('createdBy',        userId);

  const result = await req.query(`
    DECLARE @out TABLE (LeadId BIGINT);

    INSERT INTO ${LEAD}
      (LeadCode, CompanyName, ContactName, Designation, Email, Phone, WhatsAppNumber,
       IndustryId, ClientType, SourceId, StageId, AssignedToUserId,
       EstimatedValue, Currency, ExpectedCloseDate,
       Tags, Notes, GSTNumber, City, StateId, CountryId, CreatedBy)
    OUTPUT INSERTED.LeadId INTO @out
    VALUES
      ('', @companyName, @contactName, @designation, @email, @phone, @whatsAppNumber,
       @industryId, @clientType, @sourceId, @stageId, @assignedToUserId,
       @estimatedValue, @currency, @expectedCloseDate,
       @tags, @notes, @gstNumber, @city, @stateId, @countryId, @createdBy);

    DECLARE @newId BIGINT = (SELECT LeadId FROM @out);

    UPDATE ${LEAD}
    SET LeadCode = 'LD' + RIGHT('000000' + CAST(@newId AS VARCHAR(20)), 6)
    WHERE LeadId = @newId;

    SELECT @newId AS LeadId;
  `);

  return (result.recordset as { LeadId: number }[])[0].LeadId;
}

/* ------------------------------------------------------------------ */
/*  4. updateLead                                                      */
/* ------------------------------------------------------------------ */

export async function updateLead(id: number, data: LeadUpdateData, userId: number | null): Promise<void> {
  const sets: string[] = [];
  const req = await getRequest();
  req.input('id', id);
  req.input('updatedBy', userId);

  if (data.companyName !== undefined) {
    req.input('companyName', data.companyName ? data.companyName.trim().slice(0, 200) : null);
    sets.push('CompanyName = @companyName');
  }
  if (data.contactName !== undefined) {
    req.input('contactName', data.contactName!.trim().slice(0, 200));
    sets.push('ContactName = @contactName');
  }
  if (data.designation !== undefined) {
    req.input('designation', data.designation ? data.designation.trim().slice(0, 100) : null);
    sets.push('Designation = @designation');
  }
  if (data.email !== undefined) {
    req.input('email', data.email ? data.email.trim().slice(0, 256) : null);
    sets.push('Email = @email');
  }
  if (data.phone !== undefined) {
    req.input('phone', data.phone ? data.phone.trim().slice(0, 30) : null);
    sets.push('Phone = @phone');
  }
  if (data.whatsAppNumber !== undefined) {
    req.input('whatsAppNumber', data.whatsAppNumber ? data.whatsAppNumber.trim().slice(0, 30) : null);
    sets.push('WhatsAppNumber = @whatsAppNumber');
  }
  if (data.industryId !== undefined) {
    req.input('industryId', data.industryId ?? null);
    sets.push('IndustryId = @industryId');
  }
  if (data.clientType !== undefined) {
    req.input('clientType', data.clientType ? data.clientType.trim().slice(0, 50) : null);
    sets.push('ClientType = @clientType');
  }
  if (data.sourceId !== undefined) {
    req.input('sourceId', data.sourceId ?? null);
    sets.push('SourceId = @sourceId');
  }
  if (data.assignedToUserId !== undefined) {
    req.input('assignedToUserId', data.assignedToUserId ?? null);
    sets.push('AssignedToUserId = @assignedToUserId');
  }
  if (data.estimatedValue !== undefined) {
    req.input('estimatedValue', data.estimatedValue ?? null);
    sets.push('EstimatedValue = @estimatedValue');
  }
  if (data.currency !== undefined) {
    req.input('currency', data.currency!.trim().slice(0, 10));
    sets.push('Currency = @currency');
  }
  if (data.expectedCloseDate !== undefined) {
    req.input('expectedCloseDate', data.expectedCloseDate || null);
    sets.push('ExpectedCloseDate = @expectedCloseDate');
  }
  if (data.tags !== undefined) {
    req.input('tags', data.tags ? data.tags.trim().slice(0, 500) : null);
    sets.push('Tags = @tags');
  }
  if (data.notes !== undefined) {
    req.input('notes', data.notes || null);
    sets.push('Notes = @notes');
  }
  if (data.gstNumber !== undefined) {
    req.input('gstNumber', data.gstNumber ? data.gstNumber.trim().slice(0, 20) : null);
    sets.push('GSTNumber = @gstNumber');
  }
  if (data.city !== undefined) {
    req.input('city', data.city ? data.city.trim().slice(0, 100) : null);
    sets.push('City = @city');
  }
  if (data.stateId !== undefined) {
    req.input('stateId', data.stateId ?? null);
    sets.push('StateId = @stateId');
  }
  if (data.countryId !== undefined) {
    req.input('countryId', data.countryId ?? null);
    sets.push('CountryId = @countryId');
  }

  if (sets.length === 0) return;
  sets.push('UpdatedOn = GETDATE()', 'UpdatedBy = @updatedBy');

  await req.query(`UPDATE ${LEAD} SET ${sets.join(', ')} WHERE LeadId = @id`);
}

/* ------------------------------------------------------------------ */
/*  5. changeStage                                                     */
/* ------------------------------------------------------------------ */

export async function changeStage(
  id: number,
  newStageId: number,
  userId: number | null
): Promise<{ fromStageId: number; toStageId: number }> {
  const curReq = await getRequest();
  const curRes = await curReq.input('id', id).query(
    `SELECT StageId FROM ${LEAD} WHERE LeadId = @id`
  );
  const fromStageId = curRes.recordset?.[0]?.StageId;
  if (fromStageId == null) throw new Error('Lead not found');

  const stageReq = await getRequest();
  const stageRes = await stageReq.input('newStageId', newStageId).query(
    `SELECT IsWon, IsLost FROM ${STAGE} WHERE StageId = @newStageId`
  );
  const stageRow = stageRes.recordset?.[0];
  if (!stageRow) throw new Error('Target stage not found');

  const req = await getRequest();
  req.input('id', id);
  req.input('newStageId', newStageId);
  req.input('updatedBy', userId);
  req.input('isLost', stageRow.IsLost ? 1 : 0);

  await req.query(`
    UPDATE ${LEAD}
    SET StageId    = @newStageId,
        LostAt     = CASE WHEN @isLost = 1 THEN GETDATE() ELSE LostAt END,
        UpdatedOn  = GETDATE(),
        UpdatedBy  = @updatedBy
    WHERE LeadId = @id
  `);

  return { fromStageId, toStageId: newStageId };
}

/* ------------------------------------------------------------------ */
/*  6. assignLead                                                      */
/* ------------------------------------------------------------------ */

export async function assignLead(
  id: number,
  assignedToUserId: number | null,
  userId: number | null
): Promise<void> {
  const req = await getRequest();
  req.input('id', id);
  req.input('assignedToUserId', assignedToUserId);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${LEAD}
    SET AssignedToUserId = @assignedToUserId, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE LeadId = @id
  `);
}

/* ------------------------------------------------------------------ */
/*  7. convertToClient                                                 */
/* ------------------------------------------------------------------ */

export async function convertToClient(leadId: number, userId: number): Promise<number> {
  const lead = await getLeadById(leadId);
  if (!lead) throw new Error('Lead not found');
  if (lead.convertedToClientId) throw new Error('Lead already converted');

  const pool = await getPool();
  const tx   = new sql.Transaction(pool);
  await tx.begin();

  try {
    const clientReq = new sql.Request(tx);
    clientReq.input('clientName',  (lead.companyName || lead.contactName).trim().slice(0, 200));
    clientReq.input('clientType',  lead.clientType ? lead.clientType.trim().slice(0, 50) : 'EndUser');
    clientReq.input('industryId',  lead.industryId ?? null);
    clientReq.input('gstNumber',   lead.gstNumber ? lead.gstNumber.trim().slice(0, 20) : null);
    clientReq.input('createdBy',   userId);

    const clientResult = await clientReq.query(`
      DECLARE @out TABLE (Id BIGINT);

      INSERT INTO ${CLIENT}
        (ClientCode, ClientName, ClientType, IndustryId, GSTNumber, CreatedBy)
      OUTPUT INSERTED.Id INTO @out
      VALUES
        ('', @clientName, @clientType, @industryId, @gstNumber, @createdBy);

      DECLARE @newId BIGINT = (SELECT Id FROM @out);

      UPDATE ${CLIENT}
      SET ClientCode = 'CL' + RIGHT('000000' + CAST(@newId AS VARCHAR(20)), 6)
      WHERE Id = @newId;

      SELECT @newId AS Id;
    `);
    const clientId = (clientResult.recordset as { Id: number }[])[0].Id;

    const contactReq = new sql.Request(tx);
    contactReq.input('clientId',      clientId);
    contactReq.input('contactName',   lead.contactName.trim().slice(0, 200));
    contactReq.input('email',         lead.email ? lead.email.trim().slice(0, 200) : null);
    contactReq.input('phone',         lead.phone ? lead.phone.trim().slice(0, 20) : null);
    contactReq.input('whatsApp',      lead.whatsAppNumber ? lead.whatsAppNumber.trim().slice(0, 20) : null);
    contactReq.input('designation',   lead.designation ? lead.designation.trim().slice(0, 100) : null);
    contactReq.input('createdBy',     userId);

    await contactReq.query(`
      INSERT INTO ${CONTACT}
        (ClientId, ContactName, Email, MobileNumber, WhatsAppNumber, Designation, IsPrimary, CreatedBy)
      VALUES
        (@clientId, @contactName, @email, @phone, @whatsApp, @designation, 1, @createdBy)
    `);

    const leadReq = new sql.Request(tx);
    leadReq.input('leadId',     leadId);
    leadReq.input('clientId',   clientId);
    leadReq.input('convertedBy', userId);

    await leadReq.query(`
      UPDATE ${LEAD}
      SET ConvertedToClientId = @clientId,
          ConvertedAt         = GETDATE(),
          ConvertedByUserId   = @convertedBy,
          UpdatedOn           = GETDATE(),
          UpdatedBy           = @convertedBy
      WHERE LeadId = @leadId
    `);

    await tx.commit();
    return clientId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  8. deleteLead                                                      */
/* ------------------------------------------------------------------ */

export async function deleteLead(id: number): Promise<void> {
  const req = await getRequest();
  await req.input('id', id).query(`DELETE FROM ${LEAD} WHERE LeadId = @id`);
}

/* ------------------------------------------------------------------ */
/*  9. getLeadsByStage (Kanban)                                        */
/* ------------------------------------------------------------------ */

export async function getLeadsByStage(): Promise<
  { stageId: number; stageName: string; stageOrder: number; color: string; leads: LeadRow[] }[]
> {
  const stageReq = await getRequest();
  const stageRes = await stageReq.query(`
    SELECT StageId AS stageId, StageName AS stageName, StageOrder AS stageOrder, Color AS color
    FROM ${STAGE}
    WHERE IsActive = 1
    ORDER BY StageOrder
  `);
  const stages = stageRes.recordset || [];

  const leadsReq = await getRequest();
  const leadsRes = await leadsReq.query(`
    SELECT ${LEAD_COLUMNS}
    ${LEAD_JOINS}
    WHERE l.IsActive = 1 AND l.ConvertedToClientId IS NULL
    ORDER BY s.StageOrder, l.CreatedOn DESC
  `);
  const allLeads = (leadsRes.recordset || []).map(mapRow);

  const leadsByStageId = new Map<number, LeadRow[]>();
  for (const lead of allLeads) {
    const arr = leadsByStageId.get(lead.stageId);
    if (arr) arr.push(lead);
    else leadsByStageId.set(lead.stageId, [lead]);
  }

  return stages.map((s: any) => ({
    stageId:    s.stageId,
    stageName:  s.stageName,
    stageOrder: s.stageOrder,
    color:      s.color ?? '#888888',
    leads:      leadsByStageId.get(s.stageId) || [],
  }));
}

/* ------------------------------------------------------------------ */
/*  10. checkDuplicates                                                */
/* ------------------------------------------------------------------ */

export async function checkDuplicates(
  email?: string,
  phone?: string,
  gstNumber?: string
): Promise<LeadRow[]> {
  const conditions: string[] = [];
  const req = await getRequest();

  if (email) {
    req.input('email', email.trim());
    conditions.push('l.Email = @email');
  }
  if (phone) {
    req.input('phone', phone.trim());
    conditions.push('l.Phone = @phone');
  }
  if (gstNumber) {
    req.input('gstNumber', gstNumber.trim());
    conditions.push('l.GSTNumber = @gstNumber');
  }

  if (conditions.length === 0) return [];

  const result = await req.query(`
    SELECT ${LEAD_COLUMNS}
    ${LEAD_JOINS}
    WHERE (${conditions.join(' OR ')})
    ORDER BY l.CreatedOn DESC
  `);

  return (result.recordset || []).map(mapRow);
}
