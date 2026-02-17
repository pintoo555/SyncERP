/**
 * Universal app settings (react_AppSettings). Timezone and other app-wide config.
 */

import { getRequest } from '../db/pool';
import { config } from '../utils/config';

const SCHEMA = config.db.schema || 'dbo';
const TABLE = `[${SCHEMA}].[react_AppSettings]`;

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export async function getValue(key: string): Promise<string | null> {
  const req = await getRequest();
  const result = await req
    .input('key', key)
    .query(`SELECT [Value] FROM ${TABLE} WHERE [Key] = @key`);
  const row = (result.recordset as { Value: string }[])?.[0];
  return row?.Value ?? null;
}

export async function getTimeZone(): Promise<string> {
  const value = await getValue('TimeZone');
  return value?.trim() || DEFAULT_TIMEZONE;
}

export async function getAll(): Promise<Record<string, string>> {
  const req = await getRequest();
  const result = await req.query(`SELECT [Key], [Value] FROM ${TABLE}`);
  const rows = (result.recordset || []) as { Key: string; Value: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.Key] = r.Value;
  return out;
}

export async function setValue(key: string, value: string): Promise<void> {
  const req = await getRequest();
  await req
    .input('key', key.trim().slice(0, 128))
    .input('value', value.trim().slice(0, 500))
    .query(`
      MERGE ${TABLE} AS t
      USING (SELECT @key AS [Key], @value AS [Value]) AS s
      ON t.[Key] = s.[Key]
      WHEN MATCHED THEN UPDATE SET [Value] = s.[Value], UpdatedAt = SYSDATETIME()
      WHEN NOT MATCHED THEN INSERT ([Key], [Value]) VALUES (s.[Key], s.[Value]);
    `);
}
