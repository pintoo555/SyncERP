/**
 * Authentication against utbl_Users_Master. Email/Username login, PasswordHash (bcrypt) only. Only IsActive = 1.
 */

import { getRequest } from '../db/pool';
import { config } from '../utils/config';
import { AppError } from '../middleware/errorHandler';

const SCHEMA = config.db.schema || 'dbo';
const USERS = `[${SCHEMA}].[utbl_Users_Master]`;

export interface UserRow {
  userid: number;
  Name: string;
  DepartmentID: number | null;
  Email: string;
  PasswordHash: string;
  IsActive: number | boolean;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const req = await getRequest();
  const result = await req
    .input('email', email)
    .query(`
      SELECT UserId AS userid, Name, DepartmentID, Email, PasswordHash, IsActive
      FROM ${USERS} WHERE Email = @email
    `);
  const row = result.recordset[0] as UserRow | undefined;
  return row ?? null;
}

export async function validateLogin(email: string, password: string): Promise<UserRow> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new AppError(401, 'Invalid credentials');
  }
  if (!user.IsActive) {
    throw new AppError(401, 'Account is inactive');
  }
  const stored = user.PasswordHash ?? '';
  if (!isBcryptHash(stored)) {
    throw new AppError(401, 'Invalid credentials');
  }
  try {
    const bcrypt = await import('bcryptjs');
    if (!bcrypt.compareSync(password, stored)) throw new AppError(401, 'Invalid credentials');
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(401, 'Invalid credentials');
  }
  return user;
}

/** Check if a string looks like a bcrypt hash (avoid compareSync throwing on plain text). */
function isBcryptHash(s: string): boolean {
  return typeof s === 'string' && (s.startsWith('$2a$') || s.startsWith('$2b$') || s.startsWith('$2y$'));
}

/** Update password for a user (current password must match). */
export async function changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT UserId, PasswordHash FROM ${USERS} WHERE UserId = @userId
  `);
  const row = result.recordset[0] as { UserId: number; PasswordHash: string } | undefined;
  if (!row) throw new AppError(404, 'User not found');
  const stored = row.PasswordHash ?? '';
  if (!isBcryptHash(stored)) throw new AppError(400, 'Current password is incorrect');
  try {
    const bcrypt = await import('bcryptjs');
    if (!bcrypt.compareSync(currentPassword, stored)) throw new AppError(400, 'Current password is incorrect');
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(400, 'Current password is incorrect');
  }
  if (!newPassword || newPassword.length < 6) throw new AppError(400, 'New password must be at least 6 characters');
  const bcrypt = await import('bcryptjs');
  const hash = bcrypt.hashSync(newPassword, 10);
  const req2 = await getRequest();
  await req2.input('userId', userId).input('passwordHash', hash).query(`
    UPDATE ${USERS} SET PasswordHash = @passwordHash, UpdatedAt = GETDATE() WHERE UserId = @userId
  `);
}

/** Verify current user password (e.g. for lock screen unlock). Returns true if correct. */
export async function verifyPassword(userId: number, password: string): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT PasswordHash FROM ${USERS} WHERE UserId = @userId
  `);
  const row = result.recordset[0] as { PasswordHash: string } | undefined;
  if (!row || !isBcryptHash(row.PasswordHash ?? '')) return false;
  try {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compareSync(password, row.PasswordHash);
  } catch {
    return false;
  }
}
