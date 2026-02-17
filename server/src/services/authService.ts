/**
 * Authentication against rb_users. Email = username, Password = password. Only IsActive = 1.
 */

import { getRequest } from '../db/pool';
import { config } from '../utils/config';
import { AppError } from '../middleware/errorHandler';

const SCHEMA = config.db.schema || 'dbo';
const USERS = `[${SCHEMA}].[rb_users]`;

export interface UserRow {
  userid: number;
  Name: string;
  DepartmentID: number | null;
  Email: string;
  Password: string;
  /** BIT: driver may return 1/0 or true/false */
  IsActive: number | boolean;
}

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

export async function validateLogin(email: string, password: string): Promise<UserRow> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new AppError(401, 'Invalid credentials');
  }
  // BIT columns can come back as 1/0 or true/false from the driver
  if (!user.IsActive) {
    throw new AppError(401, 'Account is inactive');
  }
  // Compare password (DB may store plain or bcrypt; bcrypt.compareSync throws if hash is invalid)
  const stored = user.Password ?? '';
  let match = false;
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    try {
      const bcrypt = await import('bcryptjs');
      match = bcrypt.compareSync(password, stored);
    } catch {
      match = stored === password;
    }
  } else {
    match = stored === password;
  }
  if (!match) {
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
    SELECT userid, [Password] FROM ${USERS} WHERE userid = @userId
  `);
  const row = result.recordset[0] as { userid: number; Password: string } | undefined;
  if (!row) throw new AppError(404, 'User not found');
  const stored = row.Password ?? '';
  let match = false;
  if (isBcryptHash(stored)) {
    try {
      const bcrypt = await import('bcryptjs');
      match = bcrypt.compareSync(currentPassword, stored);
    } catch {
      match = stored === currentPassword;
    }
  } else {
    match = stored === currentPassword;
  }
  if (!match) throw new AppError(400, 'Current password is incorrect');
  if (!newPassword || newPassword.length < 6) throw new AppError(400, 'New password must be at least 6 characters');
  const bcrypt = await import('bcryptjs');
  const hash = bcrypt.hashSync(newPassword, 10);
  const req2 = await getRequest();
  await req2.input('userId', userId).input('password', hash).query(`
    UPDATE ${USERS} SET [Password] = @password WHERE userid = @userId
  `);
}

/** Verify current user password (e.g. for lock screen unlock). Returns true if correct. */
export async function verifyPassword(userId: number, password: string): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT userid, [Password] FROM ${USERS} WHERE userid = @userId
  `);
  const row = result.recordset[0] as { userid: number; Password: string } | undefined;
  if (!row) return false;
  const stored = row.Password ?? '';
  if (isBcryptHash(stored)) {
    try {
      const bcrypt = await import('bcryptjs');
      return bcrypt.compareSync(password, stored);
    } catch {
      return stored === password;
    }
  }
  return stored === password;
}
