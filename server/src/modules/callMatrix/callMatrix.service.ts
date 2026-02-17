/**
 * Call Matrix service. Read-only access to Matrix_CallLogs.
 * Returns date/time as UTC ISO strings using app timezone for conversion.
 */

import { getRequest } from '../../config/db';
import { config } from '../../utils/config';
import * as appSettingsService from '../../services/appSettingsService';
import { localDatetimeStringToUtcIso } from '../../utils/dateUtils';
import type {
  CallLogRow,
  CallLogListQuery,
  CallMatrixDashboardStats,
  CallsByDay,
  CallsByDirection,
  CallsByType,
  TopCaller,
  TopCallee,
  DurationBucket,
  CallsByHour,
  HeatmapCell,
  InternalByExtension,
} from './callMatrix.types';

const SCHEMA = config.db.schema || 'dbo';
const TABLE = `[${SCHEMA}].[Matrix_CallLogs]`;

const SORT_COLUMN_MAP: Record<string, string> = {
  callDate: 'CallDate',
  callTime: 'CallTime',
  recordingStart: 'RecordingStart',
  callDirection: 'CallDirection',
  callType: 'CallType',
  callDurationSeconds: 'CallDurationSeconds',
  callFromNormalized: 'CallFromNormalized',
  callToNormalized: 'CallToNormalized',
};

function toIso(row: Record<string, unknown>, key: string, timeZone: string): string {
  const raw = row[key];
  if (raw == null) return '';
  const str = typeof raw === 'string' ? raw : (raw instanceof Date ? (raw as Date).toISOString().slice(0, 23) : String(raw));
  return localDatetimeStringToUtcIso(str.replace(' ', 'T'), timeZone) || str;
}

export async function listCallLogs(query: CallLogListQuery): Promise<{ data: CallLogRow[]; total: number }> {
  const offset = (query.page - 1) * query.pageSize;
  const sortCol = SORT_COLUMN_MAP[query.sortBy] ?? 'RecordingStart';
  const sortDir = (query.sortOrder ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const timeZone = await appSettingsService.getTimeZone();

  const hasDateFrom = query.dateFrom != null && query.dateFrom !== '' ? 1 : 0;
  const hasDateTo = query.dateTo != null && query.dateTo !== '' ? 1 : 0;
  const hasDirection = query.callDirection != null && query.callDirection !== '' ? 1 : 0;
  const hasType = query.callType != null && query.callType !== '' ? 1 : 0;
  const hasFromNumber = query.fromNumber != null && query.fromNumber.trim() !== '' ? 1 : 0;
  const hasToNumber = query.toNumber != null && query.toNumber.trim() !== '' ? 1 : 0;
  const hasMinDuration = query.minDurationSeconds != null && !Number.isNaN(Number(query.minDurationSeconds)) ? 1 : 0;

  const whereClause = `
    WHERE (0 = @hasDateFrom OR CONVERT(DATE, CallDate) >= @dateFrom)
      AND (0 = @hasDateTo OR CONVERT(DATE, CallDate) <= @dateTo)
      AND (0 = @hasDirection OR CallDirection = @callDirection)
      AND (0 = @hasType OR CallType = @callType)
      AND (0 = @hasFromNumber OR CallFromNormalized LIKE '%' + @fromNumber + '%')
      AND (0 = @hasToNumber OR CallToNormalized LIKE '%' + @toNumber + '%')
      AND (0 = @hasMinDuration OR CallDurationSeconds >= @minDurationSeconds)
  `;

  const req = await getRequest();
  req.input('dateFrom', query.dateFrom ?? null);
  req.input('dateTo', query.dateTo ?? null);
  req.input('callDirection', query.callDirection ?? null);
  req.input('callType', query.callType ?? null);
  req.input('fromNumber', query.fromNumber?.trim() ?? null);
  req.input('toNumber', query.toNumber?.trim() ?? null);
  req.input('minDurationSeconds', query.minDurationSeconds ?? null);
  req.input('hasDateFrom', hasDateFrom);
  req.input('hasDateTo', hasDateTo);
  req.input('hasDirection', hasDirection);
  req.input('hasType', hasType);
  req.input('hasFromNumber', hasFromNumber);
  req.input('hasToNumber', hasToNumber);
  req.input('hasMinDuration', hasMinDuration);
  req.input('offset', offset);
  req.input('pageSize', query.pageSize);

  const listResult = await req.query(`
    ;WITH CTE AS (
      SELECT
        CallLogID, CallDate, CallTime, CallType, CallFrom, CallTo,
        CallFromNormalized, CallToNormalized, CallDurationSeconds, FileSizeBytes,
        CONVERT(VARCHAR(23), RecordingStart, 126) AS RecordingStartStr,
        CONVERT(VARCHAR(23), RecordingEnd, 126) AS RecordingEndStr,
        FolderName, FileName, FullFilePath, CallDirection,
        CONVERT(VARCHAR(23), CreatedOn, 126) AS CreatedOnStr,
        ROW_NUMBER() OVER (ORDER BY ${sortCol} ${sortDir}) AS rn
      FROM ${TABLE}
      ${whereClause}
    )
    SELECT CallLogID, CallDate, CallTime, CallType, CallFrom, CallTo,
      CallFromNormalized, CallToNormalized, CallDurationSeconds, FileSizeBytes,
      RecordingStartStr, RecordingEndStr, FolderName, FileName, FullFilePath, CallDirection, CreatedOnStr
    FROM CTE
    WHERE rn > @offset AND rn <= @offset + @pageSize
  `);

  const countReq = await getRequest();
  countReq.input('dateFrom', query.dateFrom ?? null);
  countReq.input('dateTo', query.dateTo ?? null);
  countReq.input('callDirection', query.callDirection ?? null);
  countReq.input('callType', query.callType ?? null);
  countReq.input('fromNumber', query.fromNumber?.trim() ?? null);
  countReq.input('toNumber', query.toNumber?.trim() ?? null);
  countReq.input('minDurationSeconds', query.minDurationSeconds ?? null);
  countReq.input('hasDateFrom', hasDateFrom);
  countReq.input('hasDateTo', hasDateTo);
  countReq.input('hasDirection', hasDirection);
  countReq.input('hasType', hasType);
  countReq.input('hasFromNumber', hasFromNumber);
  countReq.input('hasToNumber', hasToNumber);
  countReq.input('hasMinDuration', hasMinDuration);

  const countResult = await countReq.query(`SELECT COUNT_BIG(*) AS total FROM ${TABLE} ${whereClause}`);
  const total = (countResult.recordset?.[0] as { total: number })?.total ?? 0;

  const rows = (listResult.recordset || []) as (Record<string, unknown> & {
    RecordingStartStr: string;
    RecordingEndStr: string;
    CreatedOnStr: string;
  })[];
  const data: CallLogRow[] = rows.map((r) => ({
    callLogId: Number(r.CallLogID),
    callDate: r.CallDate != null ? String(r.CallDate).slice(0, 10) : '',
    callTime: r.CallTime != null ? String(r.CallTime) : '',
    callType: String(r.CallType ?? ''),
    callFrom: String(r.CallFrom ?? ''),
    callTo: String(r.CallTo ?? ''),
    callFromNormalized: r.CallFromNormalized != null ? String(r.CallFromNormalized) : null,
    callToNormalized: r.CallToNormalized != null ? String(r.CallToNormalized) : null,
    callDurationSeconds: r.CallDurationSeconds != null ? Number(r.CallDurationSeconds) : null,
    fileSizeBytes: Number(r.FileSizeBytes ?? 0),
    recordingStart: toIso({ ...r, RecordingStartStr: r.RecordingStartStr }, 'RecordingStartStr', timeZone),
    recordingEnd: toIso({ ...r, RecordingEndStr: r.RecordingEndStr }, 'RecordingEndStr', timeZone),
    folderName: String(r.FolderName ?? ''),
    fileName: String(r.FileName ?? ''),
    fullFilePath: String(r.FullFilePath ?? ''),
    callDirection: String(r.CallDirection ?? ''),
    createdOn: toIso({ ...r, CreatedOnStr: r.CreatedOnStr }, 'CreatedOnStr', timeZone),
  }));

  return { data, total };
}

function parseDateRange(dateFrom?: string, dateTo?: string): { useRange: boolean; dateFrom: string | null; dateTo: string | null; days: number } {
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (dateFrom && dateTo && valid(dateFrom) && valid(dateTo)) {
    return { useRange: true, dateFrom, dateTo, days: 30 };
  }
  return { useRange: false, dateFrom: null, dateTo: null, days: 30 };
}

function bindDateFilter(req: Awaited<ReturnType<typeof getRequest>>, dateFrom: string | null, dateTo: string | null, days: number, useRange: boolean): void {
  if (useRange && dateFrom && dateTo) {
    req.input('dateFrom', dateFrom);
    req.input('dateTo', dateTo);
  } else {
    req.input('days', days);
  }
}

const DATE_CLAUSE_DAYS = `CallDate >= DATEADD(DAY, -@days, CAST(GETDATE() AS DATE))`;
const DATE_CLAUSE_RANGE = `CallDate >= @dateFrom AND CallDate <= @dateTo`;

export async function getDashboardStats(daysOrOptions: number | { days?: number; dateFrom?: string; dateTo?: string }): Promise<CallMatrixDashboardStats> {
  const days = typeof daysOrOptions === 'number' ? daysOrOptions : Math.min(365, Math.max(1, daysOrOptions.days ?? 30));
  const dateFrom = typeof daysOrOptions === 'object' ? daysOrOptions.dateFrom : undefined;
  const dateTo = typeof daysOrOptions === 'object' ? daysOrOptions.dateTo : undefined;
  const { useRange, dateFrom: df, dateTo: dt, days: d } = parseDateRange(dateFrom, dateTo);
  const dateClause = useRange ? DATE_CLAUSE_RANGE : DATE_CLAUSE_DAYS;
  const daysVal = useRange ? 30 : days;

  const run = (sql: string) => {
    const req = getRequest();
    return req.then((r) => {
      bindDateFilter(r, df, dt, daysVal, useRange);
      return r.query(sql.replace('@DATE_FILTER@', dateClause));
    });
  };

  const [totalRes, incomingRes, outgoingRes, avgRes, byDayRes, byDirRes, byTypeRes, topCallersRes, topCalleesRes, durationRes, byHourRes, heatmapRes, internalCountRes, internalOutRes, internalInRes] = await Promise.all([
    run(`SELECT COUNT_BIG(*) AS total FROM ${TABLE} WHERE @DATE_FILTER@`),
    run(`SELECT COUNT_BIG(*) AS c FROM ${TABLE} WHERE @DATE_FILTER@ AND CallDirection = 'Incoming'`),
    run(`SELECT COUNT_BIG(*) AS c FROM ${TABLE} WHERE @DATE_FILTER@ AND CallDirection = 'Outgoing'`),
    run(`SELECT AVG(CAST(CallDurationSeconds AS FLOAT)) AS avgDur FROM ${TABLE} WHERE @DATE_FILTER@ AND CallDurationSeconds IS NOT NULL`),
    run(`SELECT CONVERT(DATE, CallDate) AS dt, COUNT_BIG(*) AS total, SUM(CASE WHEN CallDirection = 'Incoming' THEN 1 ELSE 0 END) AS incoming, SUM(CASE WHEN CallDirection = 'Outgoing' THEN 1 ELSE 0 END) AS outgoing FROM ${TABLE} WHERE @DATE_FILTER@ GROUP BY CONVERT(DATE, CallDate) ORDER BY dt`),
    run(`SELECT CallDirection AS direction, COUNT_BIG(*) AS count FROM ${TABLE} WHERE @DATE_FILTER@ GROUP BY CallDirection`),
    run(`SELECT CallType AS callType, COUNT_BIG(*) AS count FROM ${TABLE} WHERE @DATE_FILTER@ GROUP BY CallType`),
    run(`SELECT TOP 10 CallFromNormalized AS number, COUNT_BIG(*) AS count FROM ${TABLE} WHERE @DATE_FILTER@ AND CallFromNormalized IS NOT NULL AND LTRIM(RTRIM(CallFromNormalized)) <> '' GROUP BY CallFromNormalized ORDER BY count DESC`),
    run(`SELECT TOP 10 CallToNormalized AS number, COUNT_BIG(*) AS count FROM ${TABLE} WHERE @DATE_FILTER@ AND CallToNormalized IS NOT NULL AND LTRIM(RTRIM(CallToNormalized)) <> '' GROUP BY CallToNormalized ORDER BY count DESC`),
    run(`SELECT SUM(CASE WHEN CallDurationSeconds IS NULL OR CallDurationSeconds <= 60 THEN 1 ELSE 0 END) AS bucket0_60, SUM(CASE WHEN CallDurationSeconds > 60 AND CallDurationSeconds <= 300 THEN 1 ELSE 0 END) AS bucket61_300, SUM(CASE WHEN CallDurationSeconds > 300 AND CallDurationSeconds <= 900 THEN 1 ELSE 0 END) AS bucket301_900, SUM(CASE WHEN CallDurationSeconds > 900 THEN 1 ELSE 0 END) AS bucket901_plus FROM ${TABLE} WHERE @DATE_FILTER@`),
    run(`SELECT DATEPART(HOUR, ISNULL(RecordingStart, CAST(CallDate AS DATETIME))) AS hour, COUNT_BIG(*) AS count FROM ${TABLE} WHERE @DATE_FILTER@ GROUP BY DATEPART(HOUR, ISNULL(RecordingStart, CAST(CallDate AS DATETIME))) ORDER BY hour`),
    run(`SELECT DATEPART(WEEKDAY, CallDate) AS dayOfWeek, DATEPART(HOUR, ISNULL(RecordingStart, CAST(CallDate AS DATETIME))) AS hour, COUNT_BIG(*) AS count FROM ${TABLE} WHERE @DATE_FILTER@ GROUP BY DATEPART(WEEKDAY, CallDate), DATEPART(HOUR, ISNULL(RecordingStart, CAST(CallDate AS DATETIME)))`),
    run(`SELECT COUNT_BIG(*) AS c FROM ${TABLE} WHERE @DATE_FILTER@ AND LTRIM(RTRIM(ISNULL(CallDirection,''))) = 'Internal'`),
    run(`SELECT CallFromNormalized AS extension, COUNT_BIG(*) AS cnt FROM ${TABLE} WHERE @DATE_FILTER@ AND LTRIM(RTRIM(ISNULL(CallDirection,''))) = 'Internal' AND CallFromNormalized IS NOT NULL AND LTRIM(RTRIM(CallFromNormalized)) <> '' GROUP BY CallFromNormalized`),
    run(`SELECT CallToNormalized AS extension, COUNT_BIG(*) AS cnt FROM ${TABLE} WHERE @DATE_FILTER@ AND LTRIM(RTRIM(ISNULL(CallDirection,''))) = 'Internal' AND CallToNormalized IS NOT NULL AND LTRIM(RTRIM(CallToNormalized)) <> '' GROUP BY CallToNormalized`),
  ]);

  const total = (totalRes.recordset?.[0] as { total: number })?.total ?? 0;
  const incomingCount = (incomingRes.recordset?.[0] as { c: number })?.c ?? 0;
  const outgoingCount = (outgoingRes.recordset?.[0] as { c: number })?.c ?? 0;
  const avgDurationSeconds = (avgRes.recordset?.[0] as { avgDur: number })?.avgDur ?? 0;
  const byDayRows = (byDayRes.recordset || []) as { dt: Date; total: number; incoming: number; outgoing: number }[];
  const callsByDay: CallsByDay[] = byDayRows.map((r) => ({
    date: r.dt instanceof Date ? r.dt.toISOString().slice(0, 10) : String(r.dt).slice(0, 10),
    total: Number(r.total),
    incoming: Number(r.incoming),
    outgoing: Number(r.outgoing),
  }));
  const callsByDirection: CallsByDirection[] = ((byDirRes.recordset || []) as { direction: string; count: number }[]).map((r) => ({
    direction: String(r.direction ?? ''),
    count: Number(r.count),
  }));
  const callsByType: CallsByType[] = ((byTypeRes.recordset || []) as { callType: string; count: number }[]).map((r) => ({
    callType: String(r.callType ?? ''),
    count: Number(r.count),
  }));
  const topCallers: TopCaller[] = ((topCallersRes.recordset || []) as { number: string; count: number }[]).map((r) => ({
    number: String(r.number ?? ''),
    count: Number(r.count),
  }));
  const topCallees: TopCallee[] = ((topCalleesRes.recordset || []) as { number: string; count: number }[]).map((r) => ({
    number: String(r.number ?? ''),
    count: Number(r.count),
  }));
  const durRow = durationRes.recordset?.[0] as Record<string, number> | undefined;
  const durationDistribution: DurationBucket[] = [
    { label: '0–1 min', minSeconds: 0, maxSeconds: 60, count: durRow?.bucket0_60 ?? 0 },
    { label: '1–5 min', minSeconds: 61, maxSeconds: 300, count: durRow?.bucket61_300 ?? 0 },
    { label: '5–15 min', minSeconds: 301, maxSeconds: 900, count: durRow?.bucket301_900 ?? 0 },
    { label: '15+ min', minSeconds: 901, maxSeconds: null, count: durRow?.bucket901_plus ?? 0 },
  ];

  const byHourRows = (byHourRes.recordset || []) as { hour: number; count: number }[];
  const hourMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) hourMap.set(h, 0);
  byHourRows.forEach((r) => hourMap.set(Number(r.hour), Number(r.count)));
  const callsByHour: CallsByHour[] = Array.from(hourMap.entries()).map(([hour, count]) => ({ hour, count }));

  const heatmapRows = (heatmapRes.recordset || []) as { dayOfWeek: number; hour: number; count: number }[];
  const heatmap: HeatmapCell[] = heatmapRows.map((r) => ({
    dayOfWeek: Number(r.dayOfWeek),
    hour: Number(r.hour),
    count: Number(r.count),
  }));

  const internalCount = Number((internalCountRes.recordset?.[0] as { c: number })?.c ?? 0);
  const externalCount = Math.max(0, Number(total) - internalCount);
  const outRows = (internalOutRes.recordset || []) as { extension: string; cnt: number }[];
  const inRows = (internalInRes.recordset || []) as { extension: string; cnt: number }[];
  const extMap = new Map<string, { outgoing: number; incoming: number }>();
  outRows.forEach((r) => {
    const ext = String(r.extension ?? '').trim();
    if (!ext) return;
    const cur = extMap.get(ext) ?? { outgoing: 0, incoming: 0 };
    cur.outgoing = Number(r.cnt);
    extMap.set(ext, cur);
  });
  inRows.forEach((r) => {
    const ext = String(r.extension ?? '').trim();
    if (!ext) return;
    const cur = extMap.get(ext) ?? { outgoing: 0, incoming: 0 };
    cur.incoming = Number(r.cnt);
    extMap.set(ext, cur);
  });
  const internalByExtension: InternalByExtension[] = Array.from(extMap.entries())
    .map(([extension, { outgoing, incoming }]) => ({
      extension,
      outgoingCount: outgoing,
      incomingCount: incoming,
      totalCalls: outgoing + incoming,
    }))
    .sort((a, b) => b.totalCalls - a.totalCalls);

  return {
    totalCalls: Number(total),
    incomingCount,
    outgoingCount,
    avgDurationSeconds,
    callsByDay,
    callsByDirection,
    callsByType,
    topCallers,
    topCallees,
    durationDistribution,
    callsByHour,
    heatmap,
    internalCount,
    externalCount,
    internalByExtension,
  };
}
