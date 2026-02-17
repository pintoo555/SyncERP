/**
 * Organization module frontend types.
 */

// Geography
export interface Country {
  id: number;
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencySymbol: string | null;
  phoneCode: string | null;
  isActive: boolean;
}

export interface State {
  id: number;
  countryId: number;
  stateCode: string;
  stateName: string;
  isActive: boolean;
}

export interface TaxJurisdiction {
  id: number;
  countryId: number;
  stateId: number | null;
  jurisdictionCode: string;
  jurisdictionName: string;
  taxType: string;
  defaultTaxRate: number;
  isActive: boolean;
}

// Company
export interface Company {
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
}

// Branch
export type BranchType = 'HO' | 'WORKSHOP' | 'COLLECTION' | 'SALES' | 'ADMIN' | 'FULL';

export interface Branch {
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
}

export interface BranchCompany {
  id: number;
  branchId: number;
  companyId: number;
  isDefault: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

export interface BranchDepartment {
  id: number;
  branchId: number;
  departmentId: number;
  departmentName: string;
  isActive: boolean;
}

export interface BranchCapability {
  id: number;
  capabilityCode: string;
  capabilityName: string;
  description: string | null;
  isActive: boolean;
}

export interface BranchCapabilityMap {
  id: number;
  branchId: number;
  capabilityId: number;
  capabilityCode: string;
  capabilityName: string;
  isActive: boolean;
}

export interface BranchLocation {
  id: number;
  branchId: number;
  locationCode: string;
  locationName: string;
  locationType: string;
  parentLocationId: number | null;
  sortOrder: number;
  isActive: boolean;
}

// Permissions
export interface UserBranchAccess {
  id: number;
  userId: number;
  branchId: number;
  branchName: string;
  branchCode: string;
  isDefault: boolean;
  isActive: boolean;
}

// Transfers
export type TransferType = 'JOB' | 'INVENTORY' | 'ASSET' | 'USER';
export type TransferStatus = 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';

export interface Transfer {
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
}

export interface TransferLog {
  id: number;
  transferId: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  remarks: string | null;
  actionBy: number;
  actionAt: string;
}

// Org Department/Designation (shared with HRMS)
export interface OrgDepartment {
  id: number;
  departmentCode: string;
  departmentName: string;
  isActive: boolean;
  sortOrder: number;
}

export interface OrgDesignation {
  id: number;
  departmentId: number;
  name: string;
  level: number;
  isLeader: boolean;
  sortOrder: number;
}
