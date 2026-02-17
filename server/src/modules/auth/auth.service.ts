/**
 * Auth service – business logic for authentication.
 */

import * as authRepository from './auth.repository';
import { AppError } from '../../shared/middleware/errorHandler';
import type { UserRow } from './auth.types';

function isBcryptHash(s: string): boolean {
  return typeof s === 'string' && (s.startsWith('$2a$') || s.startsWith('$2b$') || s.startsWith('$2y$'));
}

export async function validateLogin(usernameOrEmail: string, password: string): Promise<UserRow> {
  const trimmed = String(usernameOrEmail).trim();
  const user = await authRepository.findUserByUsername(trimmed) ?? await authRepository.findUserByEmail(trimmed);
  if (!user) throw new AppError(401, 'Invalid credentials');
  if (!user.IsActive) throw new AppError(401, 'Account is inactive');
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
  if (!match) throw new AppError(401, 'Invalid credentials');
  return user;
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
  const stored = await authRepository.getPasswordByUserId(userId);
  if (!stored) throw new AppError(404, 'User not found');
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
  await authRepository.updatePassword(userId, hash);
}

export async function verifyPassword(userId: number, password: string): Promise<boolean> {
  const stored = await authRepository.getPasswordByUserId(userId);
  if (!stored) return false;
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
