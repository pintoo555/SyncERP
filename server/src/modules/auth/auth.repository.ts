/**
 * Auth repository – database queries for authentication.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { UserRow } from './auth.types';

const SCHEMA = config.db.schema || 'dbo';
const USERS = `[${SCHEMA}].[utbl_Users_Master]`;

/** Find user by login username (used for authentication). */
export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const req = await getRequest();
  const result = await req
    .input('username', username)
    .query(`
      SELECT UserId AS userid, Name, DepartmentID, Username, Email, PasswordHash, IsActive
      FROM ${USERS} WHERE Username = @username
    `);
  const row = result.recordset[0] as UserRow | undefined;
  return row ?? null;
}

/** Legacy: find by email (e.g. if Username not yet set). */
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const req = await getRequest();
  const result = await req
    .input('email', email)
    .query(`
      SELECT UserId AS userid, Name, DepartmentID, Username, Email, PasswordHash, IsActive
      FROM ${USERS} WHERE Email = @email
    `);
  const row = result.recordset[0] as UserRow | undefined;
  return row ?? null;
}

export async function getPasswordByUserId(userId: number): Promise<string | null> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT PasswordHash FROM ${USERS} WHERE UserId = @userId
  `);
  const row = result.recordset[0] as { PasswordHash: string } | undefined;
  return row?.PasswordHash ?? null;
}

export async function updatePassword(userId: number, hash: string): Promise<void> {
  const req = await getRequest();
  await req.input('userId', userId).input('passwordHash', hash).query(`
    UPDATE ${USERS} SET PasswordHash = @passwordHash, UpdatedAt = GETDATE() WHERE UserId = @userId
  `);
}
