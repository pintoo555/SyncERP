/**
 * Auth repository – database queries for authentication.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { UserRow } from './auth.types';

const SCHEMA = config.db.schema || 'dbo';
const USERS = `[${SCHEMA}].[rb_users]`;

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const req = await getRequest();
  const result = await req
    .input('email', email)
    .query(`
      SELECT userid, Name, DepartmentID, Email, [Password], IsActive
      FROM ${USERS} WHERE Email = @email
    `);
  const row = result.recordset[0] as UserRow | undefined;
  return row ?? null;
}

export async function getPasswordByUserId(userId: number): Promise<string | null> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT [Password] FROM ${USERS} WHERE userid = @userId
  `);
  const row = result.recordset[0] as { Password: string } | undefined;
  return row?.Password ?? null;
}

export async function updatePassword(userId: number, hash: string): Promise<void> {
  const req = await getRequest();
  await req.input('userId', userId).input('password', hash).query(`
    UPDATE ${USERS} SET [Password] = @password WHERE userid = @userId
  `);
}
