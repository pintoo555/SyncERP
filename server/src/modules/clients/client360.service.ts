/**
 * Client 360 service: combined view by client or by group.
 */

import { config } from '../../config/env';
import { getRequest } from '../../config/db';
import * as clientService from './client.service';
import * as addressService from './clientAddress.service';
import * as contactService from './clientContact.service';
import * as relationshipService from './clientRelationship.service';
import * as groupService from './clientGroup.service';
import type { Client360, Group360, ClientRow, ContactRow, AddressRow, GroupMemberRow } from './clients.types';

const SCHEMA = config.db.schema || 'dbo';
const CLIENT = `[${SCHEMA}].[utbl_Client]`;
const INDUSTRY = `[${SCHEMA}].[utbl_Industry]`;
const MEM = `[${SCHEMA}].[utbl_ClientGroupMember]`;

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}
function dateToIsoOrNull(d: unknown): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

/**
 * Get full Client 360 view.
 * If includeMerged, also includes data from clients merged into this one.
 * If includeGroup, also includes data from all group members.
 */
export async function get360ByClient(
  clientId: number,
  includeMerged = false,
  includeGroup = false
): Promise<Client360 | null> {
  const client = await clientService.getClientById(clientId);
  if (!client) return null;

  const [addresses, contacts, relationships] = await Promise.all([
    addressService.listAddresses(clientId, true),
    contactService.listContacts(clientId),
    relationshipService.getRelationships(clientId),
  ]);

  // Get group memberships
  const groupMemberships = await getGroupMembershipsForClient(clientId);

  let mergedFromClients: ClientRow[] = [];
  let allAddresses = [...addresses];
  let allContacts = [...contacts];

  // Include merged-from clients
  if (includeMerged) {
    const mergedClients = await getMergedFromClients(clientId);
    mergedFromClients = mergedClients;
    for (const mc of mergedClients) {
      const mcAddresses = await addressService.listAddresses(mc.id, true);
      const mcContacts = await contactService.listContacts(mc.id);
      allAddresses = allAddresses.concat(mcAddresses);
      allContacts = allContacts.concat(mcContacts);
    }
  }

  // Include group members data
  if (includeGroup && groupMemberships.length > 0) {
    const processedClientIds = new Set([clientId, ...mergedFromClients.map(c => c.id)]);
    for (const gm of groupMemberships) {
      const members = await groupService.getGroupMembers(gm.groupId, true);
      for (const member of members) {
        if (!processedClientIds.has(member.clientId)) {
          processedClientIds.add(member.clientId);
          const memberAddresses = await addressService.listAddresses(member.clientId, true);
          const memberContacts = await contactService.listContacts(member.clientId);
          allAddresses = allAddresses.concat(memberAddresses);
          allContacts = allContacts.concat(memberContacts);
        }
      }
    }
  }

  // Deduplicate contacts by mobile/email
  allContacts = deduplicateContacts(allContacts);

  return {
    client,
    addresses: allAddresses,
    contacts: allContacts,
    relationships,
    groupMemberships,
    mergedFromClients,
    financialHistory: [], // TODO: integrate when financial module is ready
    repairHistory: [], // TODO: integrate when repair module is ready
  };
}

/**
 * Get Client 360 view for an entire group.
 */
export async function get360ByGroup(groupId: number): Promise<Group360 | null> {
  const group = await groupService.getGroup(groupId);
  if (!group) return null;

  const memberRows = await groupService.getGroupMembers(groupId, true);

  const membersWithClients: (GroupMemberRow & { client: ClientRow })[] = [];
  let combinedAddresses: AddressRow[] = [];
  let combinedContacts: ContactRow[] = [];

  for (const memberRow of memberRows) {
    const client = await clientService.getClientById(memberRow.clientId);
    if (client) {
      membersWithClients.push({ ...memberRow, client });
      const addrs = await addressService.listAddresses(memberRow.clientId, true);
      const conts = await contactService.listContacts(memberRow.clientId);
      combinedAddresses = combinedAddresses.concat(addrs);
      combinedContacts = combinedContacts.concat(conts);
    }
  }

  combinedContacts = deduplicateContacts(combinedContacts);

  return {
    group,
    members: membersWithClients,
    combinedContacts,
    combinedAddresses,
    financialHistory: [], // TODO: integrate when financial module is ready
    repairHistory: [], // TODO: integrate when repair module is ready
  };
}

async function getMergedFromClients(targetClientId: number): Promise<ClientRow[]> {
  const req = await getRequest();
  req.input('targetId', targetClientId);
  const result = await req.query(`
    SELECT c.Id AS id, c.ClientCode AS clientCode, c.ClientName AS clientName,
           c.ClientDisplayName AS clientDisplayName, c.ClientType AS clientType,
           c.IndustryId AS industryId, i.IndustryName AS industryName,
           c.GSTNumber AS gstNumber, c.PANNumber AS panNumber,
           c.IECCode AS iecCode, c.MSMENumber AS msmeNumber,
           c.CurrencyCode AS currencyCode, c.CreditLimit AS creditLimit,
           c.CreditDays AS creditDays, c.IsBlacklisted AS isBlacklisted,
           c.IsActive AS isActive, c.IsMerged AS isMerged,
           c.MergedIntoClientId AS mergedIntoClientId, NULL AS mergedIntoClientName,
           c.CreatedOn AS createdOn, c.CreatedBy AS createdBy,
           c.UpdatedOn AS updatedOn, c.UpdatedBy AS updatedBy
    FROM ${CLIENT} c
    LEFT JOIN ${INDUSTRY} i ON i.Id = c.IndustryId
    WHERE c.MergedIntoClientId = @targetId
  `);
  return (result.recordset || []).map((r: any) => ({
    ...r,
    createdOn: dateToIso(r.createdOn),
    updatedOn: dateToIsoOrNull(r.updatedOn),
  }));
}

async function getGroupMembershipsForClient(clientId: number): Promise<GroupMemberRow[]> {
  const req = await getRequest();
  req.input('clientId', clientId);
  const result = await req.query(`
    SELECT m.Id AS id, m.GroupId AS groupId, m.ClientId AS clientId,
           c.ClientCode AS clientCode, c.ClientName AS clientName,
           m.RoleInGroup AS roleInGroup, m.IsActive AS isActive,
           m.CreatedOn AS createdOn, m.CreatedBy AS createdBy
    FROM ${MEM} m
    JOIN ${CLIENT} c ON c.Id = m.ClientId
    WHERE m.ClientId = @clientId AND m.IsActive = 1
  `);
  return (result.recordset || []).map((r: any) => ({
    ...r,
    createdOn: dateToIso(r.createdOn),
  }));
}

/**
 * Deduplicate contacts by mobile number and email.
 * Keeps the first occurrence (priority: primary first, then by id).
 */
function deduplicateContacts(contacts: ContactRow[]): ContactRow[] {
  const seen = new Map<string, boolean>();
  const result: ContactRow[] = [];

  // Sort: primary first, then active first, then by id
  const sorted = [...contacts].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return a.id - b.id;
  });

  for (const contact of sorted) {
    const mobileKey = contact.mobileNumber ? `m:${contact.mobileNumber.trim()}` : null;
    const emailKey = contact.email ? `e:${contact.email.trim().toLowerCase()}` : null;

    if (mobileKey && seen.has(mobileKey)) continue;
    if (emailKey && seen.has(emailKey)) continue;

    if (mobileKey) seen.set(mobileKey, true);
    if (emailKey) seen.set(emailKey, true);
    result.push(contact);
  }

  return result;
}
