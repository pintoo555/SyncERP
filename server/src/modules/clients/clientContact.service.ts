/**
 * Client Contact service: CRUD with replacement logic.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { ContactRow, ContactCreateData } from './clients.types';

const SCHEMA = config.db.schema || 'dbo';
const CONTACT = `[${SCHEMA}].[utbl_ClientContact]`;

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}
function dateToIsoOrNull(d: unknown): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

const CONTACT_COLUMNS = `
  c.Id AS id, c.ClientId AS clientId, c.ContactName AS contactName,
  c.Designation AS designation, c.Department AS department,
  c.MobileNumber AS mobileNumber, c.AlternateNumber AS alternateNumber,
  c.Email AS email, c.WhatsAppNumber AS whatsAppNumber,
  c.ContactRoles AS contactRoles,
  c.IsPrimary AS isPrimary, c.IsActive AS isActive,
  c.InactiveDate AS inactiveDate, c.ReplacedByContactId AS replacedByContactId,
  r.ContactName AS replacedByContactName,
  c.CreatedOn AS createdOn, c.CreatedBy AS createdBy,
  c.UpdatedOn AS updatedOn, c.UpdatedBy AS updatedBy
`;

const CONTACT_JOINS = `
  FROM ${CONTACT} c
  LEFT JOIN ${CONTACT} r ON r.Id = c.ReplacedByContactId
`;

function mapRow(r: any): ContactRow {
  return {
    ...r,
    inactiveDate: dateToIsoOrNull(r.inactiveDate),
    createdOn: dateToIso(r.createdOn),
    updatedOn: dateToIsoOrNull(r.updatedOn),
  };
}

export async function listContacts(clientId: number, activeOnly = false): Promise<ContactRow[]> {
  const req = await getRequest();
  req.input('clientId', clientId);
  req.input('activeOnly', activeOnly ? 1 : 0);
  const result = await req.query(`
    SELECT ${CONTACT_COLUMNS} ${CONTACT_JOINS}
    WHERE c.ClientId = @clientId AND (@activeOnly = 0 OR c.IsActive = 1)
    ORDER BY c.IsPrimary DESC, c.ContactName
  `);
  return (result.recordset || []).map(mapRow);
}

export async function getContact(id: number): Promise<ContactRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT ${CONTACT_COLUMNS} ${CONTACT_JOINS} WHERE c.Id = @id
  `);
  const row = result.recordset?.[0];
  return row ? mapRow(row) : null;
}

export async function createContact(clientId: number, data: ContactCreateData, userId: number | null): Promise<number> {
  if (data.isPrimary) {
    await clearPrimaryFlag(clientId, userId);
  }
  const req = await getRequest();
  req.input('clientId', clientId);
  req.input('name', (data.contactName || '').trim().slice(0, 200));
  req.input('designation', data.designation ? data.designation.trim().slice(0, 100) : null);
  req.input('department', data.department ? data.department.trim().slice(0, 100) : null);
  req.input('mobile', data.mobileNumber ? data.mobileNumber.trim().slice(0, 20) : null);
  req.input('alternate', data.alternateNumber ? data.alternateNumber.trim().slice(0, 20) : null);
  req.input('email', data.email ? data.email.trim().slice(0, 200) : null);
  req.input('whatsapp', data.whatsAppNumber ? data.whatsAppNumber.trim().slice(0, 20) : null);
  req.input('isPrimary', data.isPrimary ? 1 : 0);
  req.input('roles', data.contactRoles ? data.contactRoles.trim().slice(0, 500) : null);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${CONTACT}
      (ClientId, ContactName, Designation, Department, MobileNumber, AlternateNumber,
       Email, WhatsAppNumber, ContactRoles, IsPrimary, CreatedBy)
    OUTPUT INSERTED.Id
    VALUES (@clientId, @name, @designation, @department, @mobile, @alternate,
            @email, @whatsapp, @roles, @isPrimary, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function updateContact(id: number, data: ContactCreateData, userId: number | null): Promise<void> {
  const existing = await getContact(id);
  if (!existing) throw new Error('Contact not found');

  if (data.isPrimary && !existing.isPrimary) {
    await clearPrimaryFlag(existing.clientId, userId);
  }

  const req = await getRequest();
  req.input('id', id);
  req.input('name', (data.contactName || '').trim().slice(0, 200));
  req.input('designation', data.designation ? data.designation.trim().slice(0, 100) : null);
  req.input('department', data.department ? data.department.trim().slice(0, 100) : null);
  req.input('mobile', data.mobileNumber ? data.mobileNumber.trim().slice(0, 20) : null);
  req.input('alternate', data.alternateNumber ? data.alternateNumber.trim().slice(0, 20) : null);
  req.input('email', data.email ? data.email.trim().slice(0, 200) : null);
  req.input('whatsapp', data.whatsAppNumber ? data.whatsAppNumber.trim().slice(0, 20) : null);
  req.input('isPrimary', data.isPrimary ? 1 : 0);
  req.input('roles', data.contactRoles ? data.contactRoles.trim().slice(0, 500) : null);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${CONTACT}
    SET ContactName = @name, Designation = @designation, Department = @department,
        MobileNumber = @mobile, AlternateNumber = @alternate,
        Email = @email, WhatsAppNumber = @whatsapp, ContactRoles = @roles, IsPrimary = @isPrimary,
        UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);
}

/**
 * Deactivate a contact with optional replacement.
 * If the contact was primary, a replacement must be provided and is promoted.
 */
export async function deactivateContact(
  contactId: number,
  replacedByContactId: number | null,
  userId: number | null
): Promise<void> {
  const contact = await getContact(contactId);
  if (!contact) throw new Error('Contact not found');

  if (contact.isPrimary && !replacedByContactId) {
    throw new Error('Primary contact requires a replacement when deactivating');
  }

  const req = await getRequest();
  req.input('id', contactId);
  req.input('replacedBy', replacedByContactId ?? null);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${CONTACT}
    SET IsActive = 0, InactiveDate = GETDATE(), ReplacedByContactId = @replacedBy,
        IsPrimary = 0, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);

  if (contact.isPrimary && replacedByContactId) {
    const req2 = await getRequest();
    req2.input('newPrimaryId', replacedByContactId);
    req2.input('updatedBy', userId);
    await req2.query(`
      UPDATE ${CONTACT}
      SET IsPrimary = 1, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
      WHERE Id = @newPrimaryId AND IsActive = 1
    `);
  }
}

/**
 * Suggest a replacement contact from the same client with matching department/designation.
 */
export async function suggestReplacement(contactId: number): Promise<ContactRow[]> {
  const contact = await getContact(contactId);
  if (!contact) return [];

  const req = await getRequest();
  req.input('clientId', contact.clientId);
  req.input('contactId', contactId);
  req.input('department', contact.department ?? '');
  req.input('designation', contact.designation ?? '');

  const result = await req.query(`
    SELECT ${CONTACT_COLUMNS} ${CONTACT_JOINS}
    WHERE c.ClientId = @clientId AND c.Id <> @contactId AND c.IsActive = 1
    ORDER BY
      CASE WHEN c.Department = @department AND c.Designation = @designation THEN 0
           WHEN c.Department = @department THEN 1
           WHEN c.Designation = @designation THEN 2
           ELSE 3 END,
      c.ContactName
  `);
  return (result.recordset || []).map(mapRow);
}

async function clearPrimaryFlag(clientId: number, userId: number | null): Promise<void> {
  const req = await getRequest();
  req.input('clientId', clientId);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${CONTACT}
    SET IsPrimary = 0, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE ClientId = @clientId AND IsPrimary = 1 AND IsActive = 1
  `);
}
