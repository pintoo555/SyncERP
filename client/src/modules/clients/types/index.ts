/**
 * Client module frontend types.
 */

export interface Industry {
  id: number;
  industryName: string;
  industryCategory: string;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface Client {
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

export interface ClientDetail extends Client {
  addresses: Address[];
  contacts: Contact[];
  relationships: Relationship[];
}

export interface Address {
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

export interface Contact {
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

export interface ContactRemark {
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

export interface Relationship {
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

export interface ClientGroup {
  id: number;
  groupCode: string;
  groupName: string;
  industryId: number | null;
  industryName: string | null;
  isActive: boolean;
  createdOn: string;
  members?: GroupMember[];
}

export interface GroupMember {
  id: number;
  groupId: number;
  clientId: number;
  clientCode: string;
  clientName: string;
  roleInGroup: string;
  isActive: boolean;
  createdOn: string;
}

export interface DuplicateMatch {
  clientId: number;
  clientCode: string;
  clientName: string;
  matchType: 'GST' | 'NAME' | 'CONTACT';
  matchDetail: string;
}

export interface Client360Data {
  client: Client;
  addresses: Address[];
  contacts: Contact[];
  relationships: Relationship[];
  groupMemberships: GroupMember[];
  mergedFromClients: Client[];
  financialHistory: unknown[];
  repairHistory: unknown[];
}

export interface Group360Data {
  group: ClientGroup;
  members: (GroupMember & { client: Client })[];
  combinedContacts: Contact[];
  combinedAddresses: Address[];
  financialHistory: unknown[];
  repairHistory: unknown[];
}

export const CONTACT_ROLE_OPTIONS = [
  'Commercial', 'Technical', 'Dispatch', 'Accounting', 'Purchase',
  'Sales', 'Management', 'Legal', 'Quality', 'HR', 'IT', 'Operations',
] as const;

export const BEHAVIOR_TAG_OPTIONS = [
  'Hard Negotiator', 'Cooperative', 'Responsive', 'Unresponsive',
  'Decision Maker', 'Influencer', 'Gatekeeper', 'Difficult',
  'Friendly', 'Professional', 'Price Sensitive', 'Quality Focused',
  'Long-term Thinker', 'Requires Follow-up',
] as const;

export const CLIENT_TYPES = ['OEM', 'Dealer', 'EndUser', 'Govt', 'Export'] as const;
export const ADDRESS_TYPES = ['Billing', 'Shipping', 'HO', 'Factory', 'Other'] as const;
export const RELATIONSHIP_TYPES = ['RenamedTo', 'RenamedFrom', 'MergedWith', 'SubsidiaryOf', 'DivisionOf', 'SisterCompany'] as const;
export const GROUP_ROLES = ['Parent', 'Subsidiary', 'Branch', 'Other'] as const;
export const INDUSTRY_CATEGORIES = ['Process', 'Heavy', 'Manufacturing', 'Govt', 'Other'] as const;
