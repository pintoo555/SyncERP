/**
 * API / AI config: CRUD for external service keys (OpenAI, Claude, etc.)
 */

import { getRequest } from '../db/pool';

const TABLE = 'dbo.react_ApiConfig';

export interface ApiConfigRow {
  configId: number;
  serviceCode: string;
  displayName: string;
  apiKey: string | null;
  baseUrl: string | null;
  extraConfig: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Service codes that are NOT AI (excluded from Chat Improve / AI dropdowns). */
const NON_AI_SERVICE_CODES = new Set(['GSTZEN', 'GSTZEN.']);

/** List active configs for dropdown (serviceCode, displayName only) - no permission check, used by Chat. */
export async function listActiveForDropdown(): Promise<Array<{ serviceCode: string; displayName: string }>> {
  const req = await getRequest();
  const result = await req.query(`
    SELECT ServiceCode AS serviceCode, DisplayName AS displayName
    FROM ${TABLE}
    WHERE IsActive = 1 AND ApiKey IS NOT NULL AND LEN(LTRIM(RTRIM(ApiKey))) > 0
    ORDER BY DisplayName
  `);
  return (result.recordset ?? []) as Array<{ serviceCode: string; displayName: string }>;
}

/** List active AI-only configs for Chat Improve dropdown (excludes GSTZEN and other non-AI APIs). */
export async function listActiveAiForDropdown(): Promise<Array<{ serviceCode: string; displayName: string }>> {
  const all = await listActiveForDropdown();
  return all.filter(
    (row) => !NON_AI_SERVICE_CODES.has((row.serviceCode || '').trim().toUpperCase())
  );
}

/** List all configs; mask API key with last 4 chars only for list view */
export async function list(maskSecrets: boolean = true): Promise<ApiConfigRow[]> {
  const req = await getRequest();
  const result = await req.query(`
    SELECT ConfigID AS configId, ServiceCode AS serviceCode, DisplayName AS displayName,
           ${maskSecrets ? `CASE WHEN ApiKey IS NOT NULL AND LEN(ApiKey) > 4 THEN '••••••••' + RIGHT(ApiKey, 4) ELSE ApiKey END` : 'ApiKey'} AS apiKey,
           BaseUrl AS baseUrl, ExtraConfig AS extraConfig, IsActive AS isActive,
           CONVERT(NVARCHAR(19), CreatedAt, 120) AS createdAt,
           CONVERT(NVARCHAR(19), UpdatedAt, 120) AS updatedAt
    FROM ${TABLE}
    ORDER BY DisplayName
  `);
  return (result.recordset || []) as ApiConfigRow[];
}

/** Get one by id; full API key only for edit */
export async function getById(configId: number, maskSecret: boolean = false): Promise<ApiConfigRow | null> {
  const req = await getRequest();
  const result = await req
    .input('configId', configId)
    .query(`
    SELECT ConfigID AS configId, ServiceCode AS serviceCode, DisplayName AS displayName,
           ${maskSecret ? `CASE WHEN ApiKey IS NOT NULL AND LEN(ApiKey) > 4 THEN '••••••••' + RIGHT(ApiKey, 4) ELSE ApiKey END` : 'ApiKey'} AS apiKey,
           BaseUrl AS baseUrl, ExtraConfig AS extraConfig, IsActive AS isActive,
           CONVERT(NVARCHAR(19), CreatedAt, 120) AS createdAt,
           CONVERT(NVARCHAR(19), UpdatedAt, 120) AS updatedAt
    FROM ${TABLE}
    WHERE ConfigID = @configId
  `);
  return (result.recordset?.[0] as ApiConfigRow) ?? null;
}

/** Case-insensitive lookup by service code (SQL Server default collation is usually case-insensitive). */
export async function getByServiceCode(serviceCode: string): Promise<ApiConfigRow | null> {
  const req = await getRequest();
  const result = await req
    .input('serviceCode', serviceCode)
    .query(`
    SELECT ConfigID AS configId, ServiceCode AS serviceCode, DisplayName AS displayName,
           ApiKey AS apiKey, BaseUrl AS baseUrl, ExtraConfig AS extraConfig, IsActive AS isActive,
           CONVERT(NVARCHAR(19), CreatedAt, 120) AS createdAt,
           CONVERT(NVARCHAR(19), UpdatedAt, 120) AS updatedAt
    FROM ${TABLE}
    WHERE LOWER(LTRIM(RTRIM(ServiceCode))) = LOWER(LTRIM(RTRIM(@serviceCode))) AND IsActive = 1
  `);
  return (result.recordset?.[0] as ApiConfigRow) ?? null;
}

export interface CreateInput {
  serviceCode: string;
  displayName: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  extraConfig?: string | null;
  isActive?: boolean;
}

export async function create(input: CreateInput): Promise<ApiConfigRow> {
  const req = await getRequest();
  const result = await req
    .input('serviceCode', (input.serviceCode || '').trim().slice(0, 50))
    .input('displayName', (input.displayName || '').trim().slice(0, 200))
    .input('apiKey', input.apiKey ?? null)
    .input('baseUrl', (input.baseUrl || '').trim().slice(0, 500) || null)
    .input('extraConfig', input.extraConfig ?? null)
    .input('isActive', input.isActive !== false ? 1 : 0)
    .query(`
    INSERT INTO ${TABLE} (ServiceCode, DisplayName, ApiKey, BaseUrl, ExtraConfig, IsActive)
    OUTPUT INSERTED.ConfigID AS configId, CONVERT(NVARCHAR(19), INSERTED.CreatedAt, 120) AS createdAt, CONVERT(NVARCHAR(19), INSERTED.UpdatedAt, 120) AS updatedAt
    VALUES (@serviceCode, @displayName, @apiKey, @baseUrl, @extraConfig, @isActive)
  `);
  const row = result.recordset?.[0] as { configId: number; createdAt: string; updatedAt: string };
  if (!row?.configId) throw new Error('Failed to create config');
  const created = await getById(row.configId, false);
  if (!created) throw new Error('Failed to read created config');
  return created;
}

export interface UpdateInput {
  displayName?: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  extraConfig?: string | null;
  isActive?: boolean;
}

/** True if value looks like a masked key (e.g. ••••••••sk-xxxx) or empty (keep existing) */
function shouldKeepExistingKey(inputKey: string | null | undefined, existing: ApiConfigRow): boolean {
  if (inputKey === undefined) return true;
  if (inputKey === null || inputKey === '') return true;
  return typeof inputKey === 'string' && /^••••/.test(inputKey);
}

export async function update(configId: number, input: UpdateInput): Promise<ApiConfigRow | null> {
  const existing = await getById(configId, false);
  if (!existing) return null;
  const apiKey = !shouldKeepExistingKey(input.apiKey, existing) ? input.apiKey! : existing.apiKey;
  const req = await getRequest();
  await req
    .input('configId', configId)
    .input('displayName', input.displayName !== undefined ? (input.displayName || '').trim().slice(0, 200) : existing.displayName)
    .input('apiKey', apiKey)
    .input('baseUrl', input.baseUrl !== undefined ? ((input.baseUrl || '').trim().slice(0, 500) || null) : existing.baseUrl)
    .input('extraConfig', input.extraConfig !== undefined ? input.extraConfig : existing.extraConfig)
    .input('isActive', input.isActive !== undefined ? (input.isActive ? 1 : 0) : (existing.isActive ? 1 : 0))
    .query(`
    UPDATE ${TABLE}
    SET DisplayName = @displayName, ApiKey = @apiKey, BaseUrl = @baseUrl, ExtraConfig = @extraConfig, IsActive = @isActive, UpdatedAt = GETDATE()
    WHERE ConfigID = @configId
  `);
  return getById(configId, false);
}

export async function remove(configId: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('configId', configId).query(`DELETE FROM ${TABLE} WHERE ConfigID = @configId`);
  return (result.rowsAffected as number[])?.[0] > 0;
}
