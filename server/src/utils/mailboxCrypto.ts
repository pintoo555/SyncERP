/**
 * Encrypt/decrypt mailbox password with AES-256-GCM.
 * Requires MAILBOX_ENCRYPTION_KEY (32-byte key, base64 or hex).
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 16;
const SALT_LEN = 32;
const TAG_LEN = 16;

const DEV_FALLBACK = Buffer.from('synchronics-mailbox-dev-key-32bytes!!', 'utf8').subarray(0, KEY_LEN);

function getKey(): Buffer {
  const raw = process.env.MAILBOX_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) return DEV_FALLBACK;
  if (raw.length >= 44) {
    try {
      const buf = Buffer.from(raw, 'base64');
      if (buf.length >= KEY_LEN) return buf.subarray(0, KEY_LEN);
    } catch {
      // fallback to derived
    }
  }
  return scryptSync(raw, 'mailbox-salt', KEY_LEN);
}

export function encryptMailboxPassword(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptMailboxPassword(encryptedBase64: string): string {
  const key = getKey();
  const buf = Buffer.from(encryptedBase64, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) throw new Error('Invalid encrypted password');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString('utf8') + decipher.final('utf8');
}
