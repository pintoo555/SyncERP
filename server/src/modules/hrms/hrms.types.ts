/**
 * HRMS module types.
 */

export interface DepartmentRow {
  departmentId: number;
  departmentName: string;
}

export interface DesignationRow {
  designationId: number;
  designationType: string;
}

export interface EmployeeProfileRow {
  userId: number;
  designationId: number | null;
  orgDesignationId: number | null;
  orgDepartmentId: number | null;
  employeeCode: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  mobile: string | null;
  whatsAppNumber: string | null;
  whatsAppVerifiedAt: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  joinDate: string | null;
  pan: string | null;
  aadhar: string | null;
  photoUrl: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type ContactNumberType = 'extension' | 'voip';

export interface EmployeeContactNumberRow {
  id: number;
  employeeUserId: number;
  type: ContactNumberType;
  number: string;
  createdAt: string | null;
}

export interface EmployeeFamilyRow {
  id: number;
  employeeUserId: number;
  relation: string;
  fullName: string;
  dateOfBirth: string | null;
  contact: string | null;
  isDependent: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EmployeeBankRow {
  id: number;
  employeeUserId: number;
  bankName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  branch: string | null;
  accountType: string | null;
  isPrimary: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EmployeeListItem {
  userId: number;
  name: string;
  email: string;
  departmentId: number | null;
  departmentName: string | null;
  designationId: number | null;
  designationType: string | null;
  employeeCode: string | null;
  mobile: string | null;
  joinDate: string | null;
  isActive: boolean;
}

/** Organization structure (utbl_Org_*) */
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

export interface OrgTeamRow {
  id: number;
  departmentId: number;
  name: string;
  parentTeamId: number | null;
  leadUserId: number | null;
  level: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface OrgTeamMemberRow {
  id: number;
  teamId: number;
  userId: number;
  createdAt: string;
}

export interface OrgPromotionHistoryRow {
  id: number;
  userId: number;
  fromDesignationId: number | null;
  toDesignationId: number | null;
  fromTeamId: number | null;
  toTeamId: number | null;
  effectiveDate: string;
  changeType: 'Promotion' | 'Demotion' | 'Transfer';
  notes: string | null;
  createdAt: string;
  createdBy: number | null;
}

/** Org tree node for React Flow */
export interface OrgTreeNode {
  id: string;
  type: 'department' | 'team' | 'user';
  parentId: string | null;
  data: Record<string, unknown>;
  departmentId?: number;
  teamId?: number;
  userId?: number;
  level?: number;
}
