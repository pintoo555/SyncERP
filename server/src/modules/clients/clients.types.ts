/**
 * Type definitions for the Client module.
 */

/* ─── Industry ─── */
export interface IndustryRow {
  id: number;
  industryName: string;
  industryCategory: string;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface IndustryCreateData {
  industryName: string;
  industryCategory: string;
}

/* ─── Client ─── */
export interface ClientRow {
  id: number;
  clientCode: string;
  clientName: string;
  clientDisplayName: string | null;
  clientType: string;
  industryId: number | null;
  industryName: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  iecCode: string | null;
  msmeNumber: string | null;
  currencyCode: string;
  creditLimit: number;
  creditDays: number;
  tradeName: string | null;
  gstType: string | null;
  gstRegistrationDate: string | null;
  companyStatus: string | null;
  gstVerified: boolean;
  gstVerifiedOn: string | null;
  isBlacklisted: boolean;
  isActive: boolean;
  isMerged: boolean;
  mergedIntoClientId: number | null;
  mergedIntoClientName: string | null;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface ClientListFilters {
  search?: string;
  industryId?: number;
  clientType?: string;
  isActive?: number;
  isBlacklisted?: number;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

export interface ClientCreateData {
  clientName: string;
  clientDisplayName?: string;
  clientType: string;
  industryId?: number;
  gstNumber?: string;
  panNumber?: string;
  iecCode?: string;
  msmeNumber?: string;
  currencyCode?: string;
  creditLimit?: number;
  creditDays?: number;
  tradeName?: string;
  gstType?: string;
  gstRegistrationDate?: string;
  companyStatus?: string;
  gstVerified?: boolean;
  defaultAddress?: AddressCreateData;
  addresses?: AddressCreateData[];
  primaryContact?: ContactCreateData;
  confirmDuplicate?: boolean;
}

export interface ClientUpdateData {
  clientName?: string;
  clientDisplayName?: string;
  clientType?: string;
  industryId?: number;
  gstNumber?: string;
  panNumber?: string;
  iecCode?: string;
  msmeNumber?: string;
  currencyCode?: string;
  creditLimit?: number;
  creditDays?: number;
}

export interface ClientStatusPatch {
  isActive?: boolean;
  isBlacklisted?: boolean;
}

/* ─── Address ─── */
export interface AddressRow {
  id: number;
  clientId: number;
  addressType: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  stateId: number | null;
  stateName: string | null;
  countryId: number | null;
  countryName: string | null;
  pincode: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface AddressCreateData {
  addressType: string;
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  stateId?: number;
  countryId?: number;
  pincode?: string;
  isDefault?: boolean;
}

/* ─── Contact ─── */
export interface ContactRow {
  id: number;
  clientId: number;
  contactName: string;
  designation: string | null;
  department: string | null;
  mobileNumber: string | null;
  alternateNumber: string | null;
  email: string | null;
  whatsAppNumber: string | null;
  contactRoles: string | null;
  isPrimary: boolean;
  isActive: boolean;
  inactiveDate: string | null;
  replacedByContactId: number | null;
  replacedByContactName: string | null;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface ContactCreateData {
  contactName: string;
  designation?: string;
  department?: string;
  mobileNumber?: string;
  alternateNumber?: string;
  email?: string;
  whatsAppNumber?: string;
  contactRoles?: string;
  isPrimary?: boolean;
}

export interface ContactDeactivateData {
  replacedByContactId?: number;
}

/* ─── Contact Remarks ─── */
export interface ContactRemarkRow {
  id: number;
  contactId: number;
  clientId: number;
  remarkText: string;
  behaviorTags: string | null;
  isFlagged: boolean;
  isActive: boolean;
  createdBy: number | null;
  createdByName: string | null;
  createdOn: string;
  updatedBy: number | null;
  updatedOn: string | null;
}

export interface ContactRemarkCreateData {
  remarkText: string;
  behaviorTags?: string;
  isFlagged?: boolean;
}

/* ─── Groups ─── */
export interface GroupRow {
  id: number;
  groupCode: string;
  groupName: string;
  industryId: number | null;
  industryName: string | null;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface GroupCreateData {
  groupName: string;
  industryId?: number;
}

export interface GroupMemberRow {
  id: number;
  groupId: number;
  clientId: number;
  clientCode: string;
  clientName: string;
  roleInGroup: string;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
}

export interface GroupMemberAddData {
  clientId: number;
  roleInGroup: string;
}

/* ─── Relationships ─── */
export interface RelationshipRow {
  id: number;
  parentClientId: number;
  parentClientName: string;
  childClientId: number;
  childClientName: string;
  relationshipType: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  remarks: string | null;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
}

export interface LinkData {
  otherClientId: number;
  relationshipType: string;
  effectiveFrom: string;
  remarks?: string;
}

export interface MergeData {
  targetClientId: number;
  remarks?: string;
}

/* ─── Duplicate Detection ─── */
export interface DuplicateMatch {
  clientId: number;
  clientCode: string;
  clientName: string;
  matchType: 'GST' | 'NAME' | 'CONTACT';
  matchDetail: string;
}

/* ─── Client 360 ─── */
export interface Client360 {
  client: ClientRow;
  addresses: AddressRow[];
  contacts: ContactRow[];
  relationships: RelationshipRow[];
  groupMemberships: GroupMemberRow[];
  mergedFromClients: ClientRow[];
  financialHistory: unknown[];
  repairHistory: unknown[];
}

export interface Group360 {
  group: GroupRow;
  members: (GroupMemberRow & { client: ClientRow })[];
  combinedContacts: ContactRow[];
  combinedAddresses: AddressRow[];
  financialHistory: unknown[];
  repairHistory: unknown[];
}

/* ─── Paginated response ─── */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
