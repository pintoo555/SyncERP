/**
 * Parse stored credentials for lead inbox email channels.
 * Supports plain JSON (legacy) and AES-encrypted format.
 */

import { decryptMailboxPassword } from './mailboxCrypto';

export interface ParsedCredentials {
  imapUser?: string;
  imapPassword: string;
  smtpUser?: string;
  smtpPassword?: string;
}

/** Parse stored credentials - supports plain JSON (legacy) and AES-encrypted. */
export function parseStoredCredentials(stored: string | null): ParsedCredentials | null {
  if (!stored || typeof stored !== 'string') return null;
  const s = stored.trim();
  if (!s) return null;

  try {
    if (s.startsWith('{')) {
      const parsed = JSON.parse(s) as { imapUser?: string; imapPassword?: string; smtpUser?: string; smtpPassword?: string };
      const pass = (parsed.imapPassword ?? parsed.smtpPassword ?? '').toString();
      if (pass) return { imapUser: parsed.imapUser, imapPassword: pass, smtpUser: parsed.smtpUser, smtpPassword: parsed.smtpPassword ?? pass };
      return null;
    }
    const decrypted = decryptMailboxPassword(s);
    if (decrypted.startsWith('{')) {
      const parsed = JSON.parse(decrypted) as { imapUser?: string; imapPassword?: string; smtpUser?: string; smtpPassword?: string };
      const pass = (parsed.imapPassword ?? parsed.smtpPassword ?? '').toString();
      if (pass) return { imapUser: parsed.imapUser, imapPassword: pass, smtpUser: parsed.smtpUser, smtpPassword: parsed.smtpPassword ?? pass };
      return null;
    }
    return { imapPassword: decrypted, smtpPassword: decrypted };
  } catch {
    return null;
  }
}

/** Extract only usernames (never passwords) for edit form display. */
export function extractUsernames(stored: string | null): { imapUser?: string; smtpUser?: string } | null {
  const creds = parseStoredCredentials(stored);
  if (!creds) return null;
  if (!creds.imapUser && !creds.smtpUser) return null;
  return { imapUser: creds.imapUser, smtpUser: creds.smtpUser };
}
