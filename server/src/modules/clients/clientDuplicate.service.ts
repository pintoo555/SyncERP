/**
 * Client Duplicate Detection service.
 * Checks: GST exact match, ClientName token similarity, Mobile/Email across contacts.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { DuplicateMatch } from './clients.types';

const SCHEMA = config.db.schema || 'dbo';
const CLIENT = `[${SCHEMA}].[utbl_Client]`;
const CONTACT = `[${SCHEMA}].[utbl_ClientContact]`;

/**
 * Tokenize and normalize a name for comparison.
 */
function normalizeTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Compute token overlap ratio (Jaccard-like similarity).
 */
function tokenSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

export interface DuplicateCheckInput {
  clientName: string;
  gstNumber?: string;
  contacts?: Array<{ mobileNumber?: string; email?: string }>;
  excludeClientId?: number;
}

export async function checkDuplicates(input: DuplicateCheckInput): Promise<DuplicateMatch[]> {
  const duplicates: DuplicateMatch[] = [];

  // 1. Exact GST match
  if (input.gstNumber && input.gstNumber.trim()) {
    const req = await getRequest();
    req.input('gst', input.gstNumber.trim());
    if (input.excludeClientId) req.input('excludeId', input.excludeClientId);
    const gstResult = await req.query(`
      SELECT Id AS clientId, ClientCode AS clientCode, ClientName AS clientName, GSTNumber AS gstNumber
      FROM ${CLIENT}
      WHERE GSTNumber = @gst AND IsActive = 1
      ${input.excludeClientId ? 'AND Id <> @excludeId' : ''}
    `);
    for (const row of gstResult.recordset || []) {
      duplicates.push({
        clientId: row.clientId,
        clientCode: row.clientCode,
        clientName: row.clientName,
        matchType: 'GST',
        matchDetail: `GST Number: ${row.gstNumber}`,
      });
    }
  }

  // 2. ClientName token similarity (threshold 0.7)
  if (input.clientName && input.clientName.trim()) {
    const inputTokens = normalizeTokens(input.clientName);
    if (inputTokens.length > 0) {
      const req = await getRequest();
      req.input('searchTerm', `%${inputTokens[0]}%`);
      if (input.excludeClientId) req.input('excludeId', input.excludeClientId);
      const nameResult = await req.query(`
        SELECT TOP 50 Id AS clientId, ClientCode AS clientCode, ClientName AS clientName
        FROM ${CLIENT}
        WHERE IsActive = 1 AND ClientName LIKE @searchTerm
        ${input.excludeClientId ? 'AND Id <> @excludeId' : ''}
      `);
      for (const row of nameResult.recordset || []) {
        const candidateTokens = normalizeTokens(row.clientName);
        const similarity = tokenSimilarity(inputTokens, candidateTokens);
        if (similarity >= 0.7) {
          const alreadyExists = duplicates.some(d => d.clientId === row.clientId);
          if (!alreadyExists) {
            duplicates.push({
              clientId: row.clientId,
              clientCode: row.clientCode,
              clientName: row.clientName,
              matchType: 'NAME',
              matchDetail: `Name similarity: ${Math.round(similarity * 100)}%`,
            });
          }
        }
      }
    }
  }

  // 3. Mobile/Email match across contacts
  const contactInputs = input.contacts || [];
  for (const contact of contactInputs) {
    if (contact.mobileNumber && contact.mobileNumber.trim()) {
      const req = await getRequest();
      req.input('mobile', contact.mobileNumber.trim());
      if (input.excludeClientId) req.input('excludeId', input.excludeClientId);
      const mobileResult = await req.query(`
        SELECT DISTINCT cl.Id AS clientId, cl.ClientCode AS clientCode, cl.ClientName AS clientName,
               ct.MobileNumber AS mobileNumber
        FROM ${CONTACT} ct
        JOIN ${CLIENT} cl ON cl.Id = ct.ClientId
        WHERE ct.MobileNumber = @mobile AND ct.IsActive = 1 AND cl.IsActive = 1
        ${input.excludeClientId ? 'AND cl.Id <> @excludeId' : ''}
      `);
      for (const row of mobileResult.recordset || []) {
        const alreadyExists = duplicates.some(d => d.clientId === row.clientId);
        if (!alreadyExists) {
          duplicates.push({
            clientId: row.clientId,
            clientCode: row.clientCode,
            clientName: row.clientName,
            matchType: 'CONTACT',
            matchDetail: `Mobile: ${row.mobileNumber}`,
          });
        }
      }
    }
    if (contact.email && contact.email.trim()) {
      const req = await getRequest();
      req.input('email', contact.email.trim().toLowerCase());
      if (input.excludeClientId) req.input('excludeId', input.excludeClientId);
      const emailResult = await req.query(`
        SELECT DISTINCT cl.Id AS clientId, cl.ClientCode AS clientCode, cl.ClientName AS clientName,
               ct.Email AS email
        FROM ${CONTACT} ct
        JOIN ${CLIENT} cl ON cl.Id = ct.ClientId
        WHERE LOWER(ct.Email) = @email AND ct.IsActive = 1 AND cl.IsActive = 1
        ${input.excludeClientId ? 'AND cl.Id <> @excludeId' : ''}
      `);
      for (const row of emailResult.recordset || []) {
        const alreadyExists = duplicates.some(d => d.clientId === row.clientId);
        if (!alreadyExists) {
          duplicates.push({
            clientId: row.clientId,
            clientCode: row.clientCode,
            clientName: row.clientName,
            matchType: 'CONTACT',
            matchDetail: `Email: ${row.email}`,
          });
        }
      }
    }
  }

  return duplicates;
}
