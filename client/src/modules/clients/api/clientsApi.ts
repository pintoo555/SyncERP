/**
 * Client module API layer. All requests go through the base client.
 */

import { api } from '../../../shared/api/baseClient';
import type {
  Client, ClientDetail, Address, Contact, Relationship,
  ClientGroup, GroupMember, DuplicateMatch,
  Client360Data, Group360Data, Industry,
} from '../types';

const BASE = '/api/clients';
const IND_BASE = '/api/industries';

interface ApiResponse<T> { success: boolean; data: T; error?: string }
interface PaginatedResponse<T> { success: boolean; data: T[]; total: number; page: number; pageSize: number }
interface DuplicateResponse { success: boolean; error?: string; potentialDuplicates?: DuplicateMatch[] }

/* ─── Clients ─── */

export interface ClientListParams {
  search?: string;
  industryId?: number;
  clientType?: string;
  isActive?: number;
  isBlacklisted?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
}

export function listClients(params: ClientListParams = {}) {
  const sp = new URLSearchParams();
  if (params.search) sp.set('search', params.search);
  if (params.industryId) sp.set('industryId', String(params.industryId));
  if (params.clientType) sp.set('clientType', params.clientType);
  if (params.isActive !== undefined) sp.set('isActive', String(params.isActive));
  if (params.isBlacklisted !== undefined) sp.set('isBlacklisted', String(params.isBlacklisted));
  sp.set('page', String(params.page || 1));
  sp.set('pageSize', String(params.pageSize || 25));
  if (params.sortBy) sp.set('sortBy', params.sortBy);
  if (params.sortDir) sp.set('sortDir', params.sortDir);
  return api.get<PaginatedResponse<Client>>(`${BASE}?${sp.toString()}`);
}

export function createClient(body: Record<string, unknown>) {
  return api.post<ApiResponse<Client> & { potentialDuplicates?: DuplicateMatch[] }>(`${BASE}`, body);
}

export function getClient(id: number) {
  return api.get<ApiResponse<ClientDetail>>(`${BASE}/${id}`);
}

export function updateClient(id: number, body: Record<string, unknown>) {
  return api.put<ApiResponse<Client>>(`${BASE}/${id}`, body);
}

export function patchClientStatus(id: number, body: { isActive?: boolean; isBlacklisted?: boolean }) {
  return api.patch<ApiResponse<Client>>(`${BASE}/${id}/status`, body);
}

/* ─── GST Verification ─── */

export interface GstAddress { addressLine1: string; addressLine2: string; city: string; pincode: string }
export interface GstVerifyResult {
  valid: boolean;
  gstin: string;
  legalName: string | null;
  tradeName: string | null;
  pan: string | null;
  companyStatus: string | null;
  gstType: string | null;
  registrationDate: string | null;
  stateCode: string | null;
  stateName: string | null;
  principalAddress: GstAddress | null;
  additionalAddresses: GstAddress[];
}

export function verifyGst(gstin: string) {
  return api.post<ApiResponse<GstVerifyResult>>(`${BASE}/verify-gst`, { gstin });
}

export function mergeClient(id: number, body: { targetClientId: number; remarks?: string }) {
  return api.post<{ success: boolean; message: string }>(`${BASE}/${id}/merge`, body);
}

export function linkClient(id: number, body: { otherClientId: number; relationshipType: string; effectiveFrom: string; remarks?: string }) {
  return api.post<{ success: boolean; id: number }>(`${BASE}/${id}/link`, body);
}

export function getAliases(id: number) {
  return api.get<ApiResponse<Relationship[]>>(`${BASE}/${id}/aliases`);
}

/* ─── Client 360 ─── */

export function get360ByClient(id: number, params: { includeMerged?: boolean; includeGroup?: boolean } = {}) {
  const sp = new URLSearchParams();
  if (params.includeMerged) sp.set('includeMerged', '1');
  if (params.includeGroup) sp.set('includeGroup', '1');
  return api.get<ApiResponse<Client360Data>>(`${BASE}/360/by-client/${id}?${sp.toString()}`);
}

export function get360ByGroup(groupId: number) {
  return api.get<ApiResponse<Group360Data>>(`${BASE}/360/by-group/${groupId}`);
}

/* ─── Addresses ─── */

export function listAddresses(clientId: number) {
  return api.get<ApiResponse<Address[]>>(`${BASE}/${clientId}/addresses`);
}

export function createAddress(clientId: number, body: Record<string, unknown>) {
  return api.post<ApiResponse<Address>>(`${BASE}/${clientId}/addresses`, body);
}

export function updateAddress(clientId: number, addrId: number, body: Record<string, unknown>) {
  return api.put<ApiResponse<Address>>(`${BASE}/${clientId}/addresses/${addrId}`, body);
}

export function toggleAddressStatus(clientId: number, addrId: number, isActive: boolean) {
  return api.patch<{ success: boolean }>(`${BASE}/${clientId}/addresses/${addrId}/status`, { isActive });
}

/* ─── Contacts ─── */

export function listContacts(clientId: number) {
  return api.get<ApiResponse<Contact[]>>(`${BASE}/${clientId}/contacts`);
}

export function createContact(clientId: number, body: Record<string, unknown>) {
  return api.post<ApiResponse<Contact>>(`${BASE}/${clientId}/contacts`, body);
}

export function updateContact(clientId: number, contactId: number, body: Record<string, unknown>) {
  return api.put<ApiResponse<Contact>>(`${BASE}/${clientId}/contacts/${contactId}`, body);
}

export function deactivateContact(clientId: number, contactId: number, body: { replacedByContactId?: number }) {
  return api.post<{ success: boolean }>(`${BASE}/${clientId}/contacts/${contactId}/deactivate`, body);
}

export function suggestReplacement(clientId: number, contactId: number) {
  return api.get<ApiResponse<Contact[]>>(`${BASE}/${clientId}/contacts/suggest-replacement/${contactId}`);
}

/* ─── Contact Remarks ─── */

import type { ContactRemark } from '../types';

export function listContactRemarks(clientId: number, contactId: number) {
  return api.get<ApiResponse<ContactRemark[]>>(`${BASE}/${clientId}/contacts/${contactId}/remarks`);
}

export function createContactRemark(clientId: number, contactId: number, body: { remarkText: string; behaviorTags?: string; isFlagged?: boolean }) {
  return api.post<{ success: boolean; id: number }>(`${BASE}/${clientId}/contacts/${contactId}/remarks`, body);
}

export function deleteContactRemark(clientId: number, contactId: number, remarkId: number) {
  return api.delete<{ success: boolean }>(`${BASE}/${clientId}/contacts/${contactId}/remarks/${remarkId}`);
}

/* ─── Groups ─── */

export function listGroups() {
  return api.get<ApiResponse<ClientGroup[]>>(`${BASE}/groups`);
}

export function createGroup(body: { groupName: string; industryId?: number }) {
  return api.post<ApiResponse<ClientGroup>>(`${BASE}/groups`, body);
}

export function getGroup(groupId: number) {
  return api.get<ApiResponse<ClientGroup & { members: GroupMember[] }>>(`${BASE}/groups/${groupId}`);
}

export function addGroupMember(groupId: number, body: { clientId: number; roleInGroup: string }) {
  return api.post<{ success: boolean; id: number }>(`${BASE}/groups/${groupId}/members`, body);
}

export function toggleMemberStatus(groupId: number, memberId: number, isActive: boolean) {
  return api.patch<{ success: boolean }>(`${BASE}/groups/${groupId}/members/${memberId}/status`, { isActive });
}

/* ─── Industries ─── */

export function listIndustries() {
  return api.get<ApiResponse<Industry[]>>(`${IND_BASE}`);
}

export function createIndustry(body: { industryName: string; industryCategory: string }) {
  return api.post<ApiResponse<Industry>>(`${IND_BASE}`, body);
}

export function updateIndustry(id: number, body: { industryName: string; industryCategory: string }) {
  return api.put<ApiResponse<Industry>>(`${IND_BASE}/${id}`, body);
}

export function toggleIndustryStatus(id: number, isActive: boolean) {
  return api.patch<{ success: boolean }>(`${IND_BASE}/${id}/status`, { isActive });
}
