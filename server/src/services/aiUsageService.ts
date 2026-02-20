/**
 * AI usage logging and analytics.
 */

import { getRequest } from '../db/pool';

const TABLE = 'dbo.react_AIUsageLog';

export interface LogUsageInput {
  userId: number;
  configId: number | null;
  serviceCode: string | null;
  displayName: string | null;
  model: string | null;
  feature: string;
}

export async function logUsage(input: LogUsageInput): Promise<void> {
  const req = await getRequest();
  await req
    .input('userId', input.userId)
    .input('configId', input.configId)
    .input('serviceCode', input.serviceCode ?? null)
    .input('displayName', input.displayName ?? null)
    .input('model', input.model ?? null)
    .input('feature', input.feature)
    .query(`
      INSERT INTO ${TABLE} (UserID, ConfigID, ServiceCode, DisplayName, Model, Feature)
      VALUES (@userId, @configId, @serviceCode, @displayName, @model, @feature)
    `);
}

export interface UsageStats {
  totalCalls: number;
  byUser: Array<{ userId: number; userName: string; callCount: number }>;
  byModel: Array<{ serviceCode: string; displayName: string; model: string; callCount: number }>;
  byFeature: Array<{ feature: string; callCount: number }>;
  recentLogs: Array<{
    logId: number;
    userId: number;
    userName: string;
    serviceCode: string | null;
    displayName: string | null;
    model: string | null;
    feature: string;
    requestedAt: string;
  }>;
}

export interface AnalyticsFilters {
  userId?: number;
  serviceCode?: string;
  model?: string;
  feature?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

function applyFilters(req: Awaited<ReturnType<typeof getRequest>>, filters: AnalyticsFilters) {
  let r = req;
  if (filters.userId != null) r = r.input('userId', filters.userId);
  if (filters.serviceCode?.trim()) r = r.input('serviceCode', filters.serviceCode.trim());
  if (filters.model?.trim()) r = r.input('model', `%${filters.model.trim()}%`);
  if (filters.feature?.trim()) r = r.input('feature', filters.feature.trim());
  if (filters.dateFrom) r = r.input('dateFrom', filters.dateFrom);
  if (filters.dateTo) r = r.input('dateTo', filters.dateTo);
  if (filters.search?.trim()) r = r.input('search', `%${filters.search.trim()}%`);
  return r;
}

function buildWhereClause(filters: AnalyticsFilters): string {
  const conditions: string[] = ['1=1'];
  if (filters.userId != null) conditions.push('l.UserID = @userId');
  if (filters.serviceCode?.trim()) conditions.push('LOWER(LTRIM(RTRIM(l.ServiceCode))) = LOWER(LTRIM(RTRIM(@serviceCode)))');
  if (filters.model?.trim()) conditions.push('LOWER(LTRIM(RTRIM(ISNULL(l.Model,\'\')))) LIKE LOWER(LTRIM(RTRIM(@model)))');
  if (filters.feature?.trim()) conditions.push('LOWER(LTRIM(RTRIM(l.Feature))) = LOWER(LTRIM(RTRIM(@feature)))');
  if (filters.dateFrom) conditions.push('l.RequestedAt >= @dateFrom');
  if (filters.dateTo) conditions.push('l.RequestedAt <= @dateTo');
  if (filters.search?.trim()) conditions.push('(u.Name LIKE @search OR u.Email LIKE @search OR l.ServiceCode LIKE @search OR l.DisplayName LIKE @search OR ISNULL(l.Model,\'\') LIKE @search)');
  return conditions.join(' AND ');
}

export async function getAnalytics(filters: AnalyticsFilters = {}): Promise<UsageStats> {
  const whereClause = buildWhereClause(filters);

  const runQuery = async (query: string) => {
    const req = await getRequest();
    const r = applyFilters(req, filters);
    return r.query(query);
  };

  const baseFrom = `${TABLE} l LEFT JOIN dbo.utbl_Users_Master u ON u.UserId = l.UserID`;
  const [totalRes, byUserRes, byModelRes, byFeatureRes, recentRes] = await Promise.all([
    runQuery(`SELECT COUNT(*) AS total FROM ${baseFrom} WHERE ${whereClause}`),
    runQuery(`SELECT l.UserID AS userId, u.Name AS userName, COUNT(*) AS callCount FROM ${baseFrom} WHERE ${whereClause} GROUP BY l.UserID, u.Name ORDER BY callCount DESC`),
    runQuery(`SELECT l.ServiceCode AS serviceCode, l.DisplayName AS displayName, l.Model AS model, COUNT(*) AS callCount FROM ${baseFrom} WHERE ${whereClause} GROUP BY l.ServiceCode, l.DisplayName, l.Model ORDER BY callCount DESC`),
    runQuery(`SELECT l.Feature AS feature, COUNT(*) AS callCount FROM ${baseFrom} WHERE ${whereClause} GROUP BY l.Feature ORDER BY callCount DESC`),
    runQuery(`SELECT TOP 100 l.LogID AS logId, l.UserID AS userId, u.Name AS userName, l.ServiceCode AS serviceCode, l.DisplayName AS displayName, l.Model AS model, l.Feature AS feature, CONVERT(NVARCHAR(19), l.RequestedAt, 120) AS requestedAt FROM ${baseFrom} WHERE ${whereClause} ORDER BY l.RequestedAt DESC`),
  ]);

  const total = (totalRes.recordset?.[0] as { total?: number })?.total ?? 0;
  const byUser = (byUserRes.recordset ?? []) as Array<{ userId: number; userName: string; callCount: number }>;
  const byModel = (byModelRes.recordset ?? []) as Array<{ serviceCode: string; displayName: string; model: string; callCount: number }>;
  const byFeature = (byFeatureRes.recordset ?? []) as Array<{ feature: string; callCount: number }>;
  const recentLogs = (recentRes.recordset ?? []) as Array<{
    logId: number;
    userId: number;
    userName: string;
    serviceCode: string | null;
    displayName: string | null;
    model: string | null;
    feature: string;
    requestedAt: string;
  }>;

  return {
    totalCalls: total,
    byUser,
    byModel,
    byFeature,
    recentLogs,
  };
}
