/**
 * Per-user preferences (e.g. idle lock minutes). Stored in react_UserPreferences.
 */

import { getRequest } from '../db/pool';
import { config } from '../utils/config';

const SCHEMA = config.db.schema || 'dbo';
const TABLE = `[${SCHEMA}].[react_UserPreferences]`;

const KEY_IDLE_LOCK_MINUTES = 'IdleLockMinutes';
const KEY_THEME = 'Theme';

export async function getValue(userId: number, key: string): Promise<string | null> {
  const req = await getRequest();
  const result = await req
    .input('userId', userId)
    .input('key', key)
    .query(`SELECT [Value] FROM ${TABLE} WHERE UserId = @userId AND [Key] = @key`);
  const row = (result.recordset as { Value: string }[])?.[0];
  return row?.Value ?? null;
}

export async function setValue(userId: number, key: string, value: string): Promise<void> {
  const req = await getRequest();
  await req
    .input('userId', userId)
    .input('key', key.trim().slice(0, 128))
    .input('value', value.trim().slice(0, 500))
    .query(`
      MERGE ${TABLE} AS t
      USING (SELECT @userId AS UserId, @key AS [Key], @value AS [Value]) AS s
      ON t.UserId = s.UserId AND t.[Key] = s.[Key]
      WHEN MATCHED THEN UPDATE SET [Value] = s.[Value], UpdatedAt = SYSDATETIME()
      WHEN NOT MATCHED THEN INSERT (UserId, [Key], [Value]) VALUES (s.UserId, s.[Key], s.[Value]);
    `);
}

/** Idle lock minutes: 0 = disabled; otherwise lock after this many minutes of inactivity. */
export async function getIdleLockMinutes(userId: number): Promise<number> {
  const raw = await getValue(userId, KEY_IDLE_LOCK_MINUTES);
  if (raw === null || raw === '') return 0;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) || n < 0 ? 0 : Math.min(n, 1440);
}

export async function setIdleLockMinutes(userId: number, minutes: number): Promise<void> {
  const value = Math.max(0, Math.min(1440, Math.floor(minutes))).toString();
  await setValue(userId, KEY_IDLE_LOCK_MINUTES, value);
}

/** User theme: 'light' or 'dark'. Default 'light' if not set. */
export async function getTheme(userId: number): Promise<'light' | 'dark'> {
  const raw = await getValue(userId, KEY_THEME);
  if (raw === 'dark' || raw === 'light') return raw;
  return 'light';
}

export async function setTheme(userId: number, theme: 'light' | 'dark'): Promise<void> {
  await setValue(userId, KEY_THEME, theme);
}
