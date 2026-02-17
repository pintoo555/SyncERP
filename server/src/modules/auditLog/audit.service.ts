/**
 * Audit log list/search, export, dashboard, and PDF. Read-only queries against react_AuditLog.
 * CreatedAt is returned as UTC ISO string so the client can display in app timezone correctly.
 */

import PDFDocument from 'pdfkit';
import { getRequest } from '../../config/db';
import type { AuditListQueryInput } from '../../validators/auditSchemas';
import * as appSettingsService from '../../services/appSettingsService';
import { localDatetimeStringToUtcIso } from '../../utils/dateUtils';
import type { AuditLogRecord } from './audit.types';

export type { AuditLogRecord } from './audit.types';

/** Audit log table is created by migration in default schema (dbo). Use dbo so it works when DB_SCHEMA is set for other tables. */
const AUDIT_TABLE = '[dbo].[react_AuditLog]';

export interface AuditDashboardStats {
  totalEvents: number;
  uniqueUsers: number;
  byEventType: { eventType: string; count: number }[];
  byEntityType: { entityType: string; count: number }[];
  byDay: { date: string; count: number }[];
  byHour: { hour: number; count: number }[];
  topUsers: { userEmail: string | null; userId: number | null; count: number }[];
  topEntityTypes: { entityType: string; count: number }[];
  busiestDay?: string;
  busiestHour?: number;
  mostActiveUser?: string;
}

/** Map frontend sortBy values to safe SQL column names */
const SORT_COLUMN_MAP: Record<string, string> = {
  createdAt: 'CreatedAt',
  eventType: 'EventType',
  entityType: 'EntityType',
  entityId: 'EntityID',
  userEmail: 'UserEmail',
  ipAddress: 'IPAddress',
  details: 'Details',
};

/** Build the shared WHERE clause and param-binder for list + export */
function buildWhereAndBind(query: AuditListQueryInput) {
  const hasEvent = query.eventType != null && query.eventType !== '' ? 1 : 0;
  const hasEntityType = query.entityType != null && query.entityType !== '' ? 1 : 0;
  const hasEntityId = query.entityId != null && query.entityId !== '' ? 1 : 0;
  const hasUserId = query.userId != null ? 1 : 0;
  const hasUserEmail = query.userEmail != null && query.userEmail !== '' ? 1 : 0;
  const hasDateFrom = query.dateFrom != null && query.dateFrom !== '' ? 1 : 0;
  const hasDateTo = query.dateTo != null && query.dateTo !== '' ? 1 : 0;
  const hasDetails = query.details != null && query.details !== '' ? 1 : 0;
  const hasSearch = query.search != null && query.search.trim() !== '' ? 1 : 0;

  const whereClause = `
      WHERE (0 = @hasEvent OR EventType = @eventType)
        AND (0 = @hasEntityType OR EntityType = @entityType)
        AND (0 = @hasEntityId OR EntityID = @entityId)
        AND (0 = @hasUserId OR UserID = @userId)
        AND (0 = @hasUserEmail OR UserEmail = @userEmail)
        AND (0 = @hasDateFrom OR CONVERT(DATE, CreatedAt) >= @dateFrom)
        AND (0 = @hasDateTo OR CONVERT(DATE, CreatedAt) <= @dateTo)
        AND (0 = @hasDetails OR Details LIKE '%' + @details + '%')
        AND (0 = @hasSearch OR (
          EventType LIKE '%' + @search + '%'
          OR ISNULL(EntityType,'') LIKE '%' + @search + '%'
          OR ISNULL(EntityID,'') LIKE '%' + @search + '%'
          OR ISNULL(UserEmail,'') LIKE '%' + @search + '%'
          OR ISNULL(IPAddress,'') LIKE '%' + @search + '%'
          OR ISNULL(Details,'') LIKE '%' + @search + '%'
        ))
  `;

  function bindParams(r: Awaited<ReturnType<typeof getRequest>>) {
    r.input('eventType', query.eventType ?? null);
    r.input('entityType', query.entityType ?? null);
    r.input('entityId', query.entityId ?? null);
    r.input('userId', query.userId ?? null);
    r.input('userEmail', query.userEmail ?? null);
    r.input('dateFrom', query.dateFrom ?? null);
    r.input('dateTo', query.dateTo ?? null);
    r.input('details', query.details ?? null);
    r.input('search', query.search?.trim() ?? null);
    r.input('hasEvent', hasEvent);
    r.input('hasEntityType', hasEntityType);
    r.input('hasEntityId', hasEntityId);
    r.input('hasUserId', hasUserId);
    r.input('hasUserEmail', hasUserEmail);
    r.input('hasDateFrom', hasDateFrom);
    r.input('hasDateTo', hasDateTo);
    r.input('hasDetails', hasDetails);
    r.input('hasSearch', hasSearch);
  }

  return { whereClause, bindParams };
}

export async function listAuditLog(query: AuditListQueryInput): Promise<{ data: AuditLogRecord[]; total: number }> {
  const offset = (query.page - 1) * query.pageSize;
  const sortCol = SORT_COLUMN_MAP[query.sortBy ?? 'createdAt'] ?? 'CreatedAt';
  const sortDir = (query.sortOrder ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const { whereClause, bindParams } = buildWhereAndBind(query);

  const appTimeZone = await appSettingsService.getTimeZone();

  const req = await getRequest();
  bindParams(req);
  req.input('offset', offset);
  req.input('pageSize', query.pageSize);

  const result = await req.query(`
    ;WITH CTE AS (
      SELECT AuditID, EventType, EntityType, EntityID, UserID, UserEmail, IPAddress, UserAgent, Details,
             RequestMethod, RequestPath,
             CONVERT(VARCHAR(23), CreatedAt, 126) AS createdAtStr,
             ROW_NUMBER() OVER (ORDER BY ${sortCol} ${sortDir}) AS rn
      FROM ${AUDIT_TABLE}
      ${whereClause}
    )
    SELECT auditId, eventType, entityType, entityId, userId, userEmail, ipAddress, userAgent, details, requestMethod, requestPath, createdAtStr
    FROM CTE WHERE rn > @offset AND rn <= @offset + @pageSize
  `);

  const countReq = await getRequest();
  bindParams(countReq);

  const countResult = await countReq.query(`
    SELECT COUNT_BIG(*) AS total
    FROM ${AUDIT_TABLE}
    ${whereClause}
  `);

  const rows = (result.recordset || []) as (Omit<AuditLogRecord, 'createdAt'> & { createdAtStr: string })[];
  const data: AuditLogRecord[] = rows.map((r) => ({
    ...r,
    createdAt: localDatetimeStringToUtcIso(r.createdAtStr, appTimeZone) || r.createdAtStr,
  }));
  const total = (countResult.recordset?.[0] as { total: number })?.total ?? 0;
  return { data, total };
}

const EXPORT_MAX_ROWS = 10000;

export async function exportAuditLog(query: AuditListQueryInput): Promise<AuditLogRecord[]> {
  const sortCol = SORT_COLUMN_MAP[query.sortBy ?? 'createdAt'] ?? 'CreatedAt';
  const sortDir = (query.sortOrder ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const { whereClause, bindParams } = buildWhereAndBind(query);

  const appTimeZone = await appSettingsService.getTimeZone();

  const req = await getRequest();
  bindParams(req);
  req.input('maxRows', EXPORT_MAX_ROWS);

  const result = await req.query(`
    SELECT TOP (@maxRows) AuditID AS auditId, EventType AS eventType, EntityType AS entityType, EntityID AS entityId,
           UserID AS userId, UserEmail AS userEmail, IPAddress AS ipAddress, UserAgent AS userAgent,
           Details AS details, RequestMethod AS requestMethod, RequestPath AS requestPath,
           CONVERT(VARCHAR(23), CreatedAt, 126) AS createdAtStr
    FROM ${AUDIT_TABLE}
    ${whereClause}
    ORDER BY ${sortCol} ${sortDir}
  `);
  const rows = (result.recordset || []) as (Omit<AuditLogRecord, 'createdAt'> & { createdAtStr: string })[];
  return rows.map((r) => ({
    ...r,
    createdAt: localDatetimeStringToUtcIso(r.createdAtStr, appTimeZone) || r.createdAtStr,
  }));
}

/** Date filter for dashboard: require both dateFrom and dateTo (YYYY-MM-DD). */
function dashboardDateFilter(dateFrom: string, dateTo: string): string {
  return `CONVERT(DATE, CreatedAt) >= @dateFrom AND CONVERT(DATE, CreatedAt) <= @dateTo`;
}

export async function getAuditDashboardStats(dateFrom: string, dateTo: string): Promise<AuditDashboardStats> {
  const req = await getRequest();
  req.input('dateFrom', dateFrom);
  req.input('dateTo', dateTo);
  const dateClause = dashboardDateFilter(dateFrom, dateTo);

  const [totalRes, uniqueRes, byEventRes, byEntityRes, byDayRes, byHourRes, topUsersRes, topEntityRes] = await Promise.all([
    req.query(`SELECT COUNT_BIG(*) AS total FROM ${AUDIT_TABLE} WHERE ${dateClause}`),
    getRequest().then((r) => {
      r.input('dateFrom', dateFrom);
      r.input('dateTo', dateTo);
      return r.query(`SELECT COUNT_BIG(DISTINCT UserID) AS c FROM ${AUDIT_TABLE} WHERE ${dateClause} AND UserID IS NOT NULL`);
    }),
    getRequest().then((r) => {
      r.input('dateFrom', dateFrom);
      r.input('dateTo', dateTo);
      return r.query(`SELECT EventType AS eventType, COUNT_BIG(*) AS count FROM ${AUDIT_TABLE} WHERE ${dateClause} GROUP BY EventType ORDER BY count DESC`);
    }),
    getRequest().then((r) => {
      r.input('dateFrom', dateFrom);
      r.input('dateTo', dateTo);
      return r.query(`SELECT EntityType AS entityType, COUNT_BIG(*) AS count FROM ${AUDIT_TABLE} WHERE ${dateClause} AND EntityType IS NOT NULL AND LTRIM(RTRIM(EntityType)) <> '' GROUP BY EntityType ORDER BY count DESC`);
    }),
    getRequest().then((r) => {
      r.input('dateFrom', dateFrom);
      r.input('dateTo', dateTo);
      return r.query(`SELECT CONVERT(VARCHAR(10), CONVERT(DATE, CreatedAt), 120) AS dt, COUNT_BIG(*) AS count FROM ${AUDIT_TABLE} WHERE ${dateClause} GROUP BY CONVERT(DATE, CreatedAt) ORDER BY dt`);
    }),
    getRequest().then((r) => {
      r.input('dateFrom', dateFrom);
      r.input('dateTo', dateTo);
      return r.query(`SELECT DATEPART(HOUR, CreatedAt) AS hour, COUNT_BIG(*) AS count FROM ${AUDIT_TABLE} WHERE ${dateClause} GROUP BY DATEPART(HOUR, CreatedAt) ORDER BY hour`);
    }),
    getRequest().then((r) => {
      r.input('dateFrom', dateFrom);
      r.input('dateTo', dateTo);
      return r.query(`SELECT TOP 10 UserEmail AS userEmail, UserID AS userId, COUNT_BIG(*) AS count FROM ${AUDIT_TABLE} WHERE ${dateClause} GROUP BY UserID, UserEmail ORDER BY count DESC`);
    }),
    getRequest().then((r) => {
      r.input('dateFrom', dateFrom);
      r.input('dateTo', dateTo);
      return r.query(`SELECT TOP 10 EntityType AS entityType, COUNT_BIG(*) AS count FROM ${AUDIT_TABLE} WHERE ${dateClause} AND EntityType IS NOT NULL AND LTRIM(RTRIM(EntityType)) <> '' GROUP BY EntityType ORDER BY count DESC`);
    }),
  ]);

  const totalEvents = (totalRes.recordset?.[0] as { total: number })?.total ?? 0;
  const uniqueUsers = (uniqueRes.recordset?.[0] as { c: number })?.c ?? 0;
  const byEventType = ((byEventRes.recordset || []) as { eventType: string; count: number }[]).map((r) => ({ eventType: String(r.eventType ?? ''), count: Number(r.count) }));
  const byEntityType = ((byEntityRes.recordset || []) as { entityType: string; count: number }[]).map((r) => ({ entityType: String(r.entityType ?? ''), count: Number(r.count) }));
  const byDayRows = (byDayRes.recordset || []) as { dt: string; count: number }[];
  const byDay = byDayRows.map((r) => ({ date: String(r.dt ?? '').slice(0, 10), count: Number(r.count) }));
  const byHourRows = (byHourRes.recordset || []) as { hour: number; count: number }[];
  const hourMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) hourMap.set(h, 0);
  byHourRows.forEach((r) => hourMap.set(Number(r.hour), Number(r.count)));
  const byHour = Array.from(hourMap.entries()).map(([hour, count]) => ({ hour, count }));
  const topUsers = ((topUsersRes.recordset || []) as { userEmail: string | null; userId: number | null; count: number }[]).map((r) => ({
    userEmail: r.userEmail ?? null,
    userId: r.userId ?? null,
    count: Number(r.count),
  }));
  const topEntityTypes = ((topEntityRes.recordset || []) as { entityType: string; count: number }[]).map((r) => ({ entityType: String(r.entityType ?? ''), count: Number(r.count) }));

  const busiestDay = byDay.length ? byDay.reduce((a, b) => (a.count >= b.count ? a : b)).date : undefined;
  const busiestHour = byHour.length ? byHour.reduce((a, b) => (a.count >= b.count ? a : b)).hour : undefined;
  const mostActiveUser = topUsers.length ? (topUsers[0].userEmail || `User #${topUsers[0].userId}`) : undefined;

  return {
    totalEvents,
    uniqueUsers,
    byEventType,
    byEntityType,
    byDay,
    byHour,
    topUsers,
    topEntityTypes,
    busiestDay,
    busiestHour,
    mostActiveUser,
  };
}

/** Generate PDF buffer for audit log export. Uses same query as exportAuditLog; cap at EXPORT_MAX_ROWS. */
export async function exportAuditLogPdf(query: AuditListQueryInput): Promise<Buffer> {
  const rows = await exportAuditLog(query);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const appName = 'Synchronics ERP';
    doc.fontSize(18).font('Helvetica-Bold').text('Audit Log Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(appName, { align: 'center' });
    doc.text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    if (query.dateFrom || query.dateTo) {
      doc.text(`Date range: ${query.dateFrom ?? '—'} to ${query.dateTo ?? '—'}`, { align: 'center' });
    }
    if (query.eventType) doc.text(`Event type: ${query.eventType}`, { align: 'center' });
    if (query.entityType) doc.text(`Entity type: ${query.entityType}`, { align: 'center' });
    doc.moveDown(1);

    const colWidths = [55, 42, 50, 40, 65, 45, 95, 58];
    const headers = ['Time', 'Event', 'Entity', 'Entity ID', 'User', 'IP', 'Details', 'Request'];
    const rowHeight = 14;
    const startY = doc.y;
    let y = startY;
    const pageHeight = 750;
    const left = 40;

    function drawHeader() {
      doc.fontSize(8).font('Helvetica-Bold');
      doc.rect(left, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#e8e8e8');
      let x = left;
      headers.forEach((h, i) => {
        doc.fillColor('black').text(h, x + 2, y + 3, { width: colWidths[i] - 2, overflow: 'ellipsis' });
        x += colWidths[i];
      });
      y += rowHeight;
    }

    function drawRow(r: AuditLogRecord, fill: boolean) {
      if (y + rowHeight > pageHeight) {
        doc.addPage();
        y = 40;
        drawHeader();
      }
      if (fill) doc.rect(left, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#f5f5f5');
      doc.font('Helvetica').fillColor('black');
      const timeStr = typeof r.createdAt === 'string' ? r.createdAt.slice(0, 19).replace('T', ' ') : String(r.createdAt);
      const cells = [
        timeStr,
        (r.eventType ?? '').slice(0, 12),
        (r.entityType ?? '').slice(0, 12),
        (r.entityId ?? '').slice(0, 10),
        (r.userEmail ?? r.userId != null ? `#${r.userId}` : '').slice(0, 18),
        (r.ipAddress ?? '').slice(0, 14),
        (r.details ?? '').slice(0, 35),
        (r.requestMethod && r.requestPath ? `${r.requestMethod} ${r.requestPath}` : r.requestPath ?? '').slice(0, 20),
      ];
      let x = left;
      cells.forEach((cell, i) => {
        doc.fontSize(7).text(cell, x + 2, y + 3, { width: colWidths[i] - 2, overflow: 'ellipsis' });
        x += colWidths[i];
      });
      y += rowHeight;
    }

    drawHeader();
    rows.forEach((r, i) => drawRow(r, i % 2 === 1));
    doc.fontSize(8).font('Helvetica').text(`Total rows: ${rows.length}${rows.length >= EXPORT_MAX_ROWS ? ' (capped)' : ''}`, left, y + 10);
    doc.text(`Generated at ${new Date().toISOString()}`, left, doc.page.height - 30, { width: 400 });
    doc.end();
  });
}
