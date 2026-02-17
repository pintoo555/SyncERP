/**
 * HRMS validations: Indian phone, pincode, PAN, Aadhar.
 */

/** Indian 10-digit mobile: digits only, length 10, optional leading 6-9 */
const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;
/** Strip spaces and optional leading 0; then must be 10 digits starting with 6-9 */
export function validateIndianPhone(value: string | null | undefined): { valid: boolean; message?: string } {
  if (value == null) return { valid: true };
  const s = String(value).replace(/\s/g, '').replace(/^0+/, '');
  if (s.length === 0) return { valid: true };
  if (!/^\d+$/.test(s)) return { valid: false, message: 'Only digits allowed' };
  if (s.length !== 10) return { valid: false, message: 'Must be 10 digits' };
  if (!INDIAN_PHONE_REGEX.test(s)) return { valid: false, message: 'Must start with 6, 7, 8 or 9' };
  return { valid: true };
}

/** Normalize to digits only for storage/display (first 10 digits from valid input) */
export function normalizeIndianPhone(value: string | null | undefined): string {
  if (value == null) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length > 10) return digits.slice(0, 10);
  return digits;
}

/** Indian pincode: exactly 6 digits */
const PINCODE_REGEX = /^\d{6}$/;
export function validatePincode(value: string | null | undefined): { valid: boolean; message?: string } {
  if (value == null) return { valid: true };
  const s = String(value).replace(/\s/g, '');
  if (s.length === 0) return { valid: true };
  if (!PINCODE_REGEX.test(s)) return { valid: false, message: 'Must be exactly 6 digits' };
  return { valid: true };
}

export function normalizePincode(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/\D/g, '').slice(0, 6);
}

/** Indian PAN: AAAAA9999A (5 letters, 4 digits, 1 letter) */
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;
export function validatePAN(value: string | null | undefined): { valid: boolean; message?: string } {
  if (value == null) return { valid: true };
  const s = String(value).replace(/\s/g, '').toUpperCase();
  if (s.length === 0) return { valid: true };
  if (s.length !== 10) return { valid: false, message: 'PAN must be 10 characters (e.g. ABCDE1234F)' };
  if (!PAN_REGEX.test(s)) return { valid: false, message: 'Invalid PAN format: 5 letters, 4 digits, 1 letter' };
  return { valid: true };
}

export function normalizePAN(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/\s/g, '').toUpperCase().slice(0, 10);
}

/** Aadhar: 12 digits (no spaces in validation; allow 12 digits only) */
const AADHAR_REGEX = /^\d{12}$/;
export function validateAadhar(value: string | null | undefined): { valid: boolean; message?: string } {
  if (value == null) return { valid: true };
  const s = String(value).replace(/\s/g, '');
  if (s.length === 0) return { valid: true };
  if (!/^\d+$/.test(s)) return { valid: false, message: 'Only digits allowed' };
  if (s.length !== 12) return { valid: false, message: 'Aadhar must be 12 digits' };
  if (!AADHAR_REGEX.test(s)) return { valid: false, message: 'Invalid Aadhar' };
  return { valid: true };
}

export function normalizeAadhar(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/\D/g, '').slice(0, 12);
}

/** WhatsApp: Country code + 10 digits (e.g. +919876543210). Default India +91. */
const WHATSAPP_REGEX = /^\+[1-9]\d{10,13}$/;
export function validateWhatsAppNumber(value: string | null | undefined): { valid: boolean; message?: string } {
  if (value == null) return { valid: true };
  const s = String(value).replace(/\s/g, '').trim();
  if (s.length === 0) return { valid: true };
  const normalized = normalizeWhatsAppNumber(s);
  if (!normalized) return { valid: false, message: 'Invalid format. Use country code + 10 digits (e.g. +919876543210)' };
  if (!WHATSAPP_REGEX.test(normalized)) return { valid: false, message: 'Must be country code + 10 digits (e.g. +919876543210)' };
  return { valid: true };
}

/** Normalize to +[country][10 digits]. Indian 10-digit defaults to +91. */
export function normalizeWhatsAppNumber(value: string | null | undefined): string {
  if (value == null) return '';
  let s = String(value).replace(/\s/g, '').replace(/^0+/, '');
  if (!s) return '';
  if (s.startsWith('+')) {
    const digits = s.slice(1).replace(/\D/g, '');
    return digits.length >= 10 ? '+' + digits.slice(0, 13) : '';
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return '+91' + digits;
  if (digits.length >= 11) return '+' + digits.slice(0, 13);
  return '';
}
