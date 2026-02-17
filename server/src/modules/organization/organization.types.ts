/**
 * Organization module types: Geography, Company, Branch, Capabilities, Locations, Permissions, Transfers.
 */

// --- Geography ---

export interface CountryRow {
  id: number;
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencySymbol: string | null;
  phoneCode: string | null;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface StateRow {
  id: number;
  countryId: number;
  stateCode: string;
  stateName: string;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface TaxJurisdictionRow {
  id: number;
  countryId: number;
  stateId: number | null;
  jurisdictionCode: string;
  jurisdictionName: string;
  taxType: 'GST' | 'VAT' | 'SALES_TAX' | 'NONE';
  defaultTaxRate: number;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

// --- Company ---

export interface CompanyRow {
  id: number;
  companyCode: string;
  legalName: string;
  tradeName: string | null;
  taxRegistrationNumber: string | null;
  taxRegistrationType: string | null;
  pan: string | null;
  cin: string | null;
  defaultJurisdictionId: number | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIFSC: string | null;
  bankBranch: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateId: number | null;
  countryId: number | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

// --- Branch ---

export type BranchType = 'HO' | 'WORKSHOP' | 'COLLECTION' | 'SALES' | 'ADMIN' | 'FULL';

export interface BranchRow {
  id: number;
  branchCode: string;
  branchName: string;
  branchType: BranchType;
  countryId: number | null;
  stateId: number | null;
  city: string | null;
  timezone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface BranchCompanyRow {
  id: number;
  branchId: number;
  companyId: number;
  isDefault: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface BranchDepartmentRow {
  id: number;
  branchId: number;
  departmentId: number;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

// --- Capabilities ---

export interface BranchCapabilityRow {
  id: number;
  capabilityCode: string;
  capabilityName: string;
  description: string | null;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface BranchCapabilityMapRow {
  id: number;
  branchId: number;
  capabilityId: number;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

// --- Locations ---

export type LocationType = 'FLOOR' | 'WORKSHOP' | 'WAREHOUSE' | 'QC_ROOM' | 'RECEPTION' | 'OFFICE' | 'OTHER';

export interface BranchLocationRow {
  id: number;
  branchId: number;
  locationCode: string;
  locationName: string;
  locationType: LocationType;
  parentLocationId: number | null;
  sortOrder: number;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

// --- Permissions ---

export type ScopeType = 'ALL' | 'MULTI' | 'SINGLE';

export interface RoleBranchScopeRow {
  id: number;
  roleId: number;
  scopeType: ScopeType;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface UserBranchAccessRow {
  id: number;
  userId: number;
  branchId: number;
  isDefault: boolean;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface UserCompanyAccessRow {
  id: number;
  userId: number;
  companyId: number;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

// --- Transfers ---

export type TransferType = 'JOB' | 'INVENTORY' | 'ASSET' | 'USER';
export type TransferStatus = 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';

export interface TransferRow {
  id: number;
  transferCode: string;
  transferType: TransferType;
  fromBranchId: number;
  toBranchId: number;
  fromLocationId: number | null;
  toLocationId: number | null;
  status: TransferStatus;
  reason: string | null;
  requestedBy: number;
  approvedBy: number | null;
  dispatchedBy: number | null;
  receivedBy: number | null;
  requestedAt: string;
  approvedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface TransferLogRow {
  id: number;
  transferId: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  remarks: string | null;
  actionBy: number;
  actionAt: string;
}

export interface TransferJobRow {
  id: number;
  transferId: number;
  jobId: number;
  notes: string | null;
}

export interface TransferInventoryRow {
  id: number;
  transferId: number;
  notes: string | null;
}

export interface TransferInventoryItemRow {
  id: number;
  transferInventoryId: number;
  itemName: string;
  sku: string | null;
  quantity: number;
  unit: string | null;
}

export interface TransferAssetRow {
  id: number;
  transferId: number;
  assetId: number;
  notes: string | null;
}

export interface TransferUserRow {
  id: number;
  transferId: number;
  userId: number;
  newRoleId: number | null;
  notes: string | null;
}

// --- Department / Designation (moved from HRMS) ---

export interface OrgDepartmentRow {
  id: number;
  departmentCode: string;
  departmentName: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface OrgDesignationRow {
  id: number;
  departmentId: number;
  name: string;
  level: number;
  isLeader: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}
