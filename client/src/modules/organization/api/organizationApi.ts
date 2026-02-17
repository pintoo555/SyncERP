/**
 * Organization module API client.
 */

import { api } from '../../../shared/api/baseClient';
import type {
  Country, State, TaxJurisdiction, Company, Branch,
  BranchCompany, BranchDepartment, BranchCapability, BranchCapabilityMap,
  BranchLocation, UserBranchAccess, Transfer, TransferLog, OrgDepartment, OrgDesignation,
} from '../types';

type R<T> = { success: boolean; data: T };

const BASE = '/api/organization';

// ─── Geography ───
export const organizationApi = {
  // Countries
  listCountries: (activeOnly = false) => api.get<R<Country[]>>(`${BASE}/countries?activeOnly=${activeOnly ? '1' : '0'}`),
  createCountry: (data: Partial<Country>) => api.post<R<Country> & { id: number }>(`${BASE}/countries`, data),
  updateCountry: (id: number, data: Partial<Country>) => api.put<R<Country>>(`${BASE}/countries/${id}`, data),

  // States
  listStates: (countryId?: number, activeOnly = false) => api.get<R<State[]>>(`${BASE}/states?countryId=${countryId ?? ''}&activeOnly=${activeOnly ? '1' : '0'}`),
  createState: (data: Partial<State>) => api.post<{ success: boolean; id: number }>(`${BASE}/states`, data),
  updateState: (id: number, data: Partial<State>) => api.put<{ success: boolean }>(`${BASE}/states/${id}`, data),

  // Tax Jurisdictions
  listTaxJurisdictions: (countryId?: number, activeOnly = false) => api.get<R<TaxJurisdiction[]>>(`${BASE}/tax-jurisdictions?countryId=${countryId ?? ''}&activeOnly=${activeOnly ? '1' : '0'}`),
  createTaxJurisdiction: (data: Partial<TaxJurisdiction>) => api.post<{ success: boolean; id: number }>(`${BASE}/tax-jurisdictions`, data),
  updateTaxJurisdiction: (id: number, data: Partial<TaxJurisdiction>) => api.put<{ success: boolean }>(`${BASE}/tax-jurisdictions/${id}`, data),

  // ─── Companies ───
  listCompanies: (activeOnly = false) => api.get<R<Company[]>>(`${BASE}/companies?activeOnly=${activeOnly ? '1' : '0'}`),
  getCompany: (id: number) => api.get<R<Company>>(`${BASE}/companies/${id}`),
  createCompany: (data: Partial<Company>) => api.post<R<Company> & { id: number }>(`${BASE}/companies`, data),
  updateCompany: (id: number, data: Partial<Company>) => api.put<R<Company>>(`${BASE}/companies/${id}`, data),

  // ─── Branches ───
  listBranches: (activeOnly = false) => api.get<R<Branch[]>>(`${BASE}/branches?activeOnly=${activeOnly ? '1' : '0'}`),
  getBranch: (id: number) => api.get<R<Branch>>(`${BASE}/branches/${id}`),
  createBranch: (data: Partial<Branch>) => api.post<R<Branch> & { id: number }>(`${BASE}/branches`, data),
  updateBranch: (id: number, data: Partial<Branch>) => api.put<R<Branch>>(`${BASE}/branches/${id}`, data),

  // ─── Branch sub-resources ───
  listBranchCompanies: (branchId: number) => api.get<R<BranchCompany[]>>(`${BASE}/branches/${branchId}/companies`),
  addBranchCompany: (branchId: number, data: { companyId: number; isDefault?: boolean; effectiveFrom: string; effectiveTo?: string }) => api.post<{ success: boolean; id: number }>(`${BASE}/branches/${branchId}/companies`, data),
  removeBranchCompany: (branchId: number, mapId: number) => api.delete<{ success: boolean }>(`${BASE}/branches/${branchId}/companies/${mapId}`),

  listBranchDepartments: (branchId: number) => api.get<R<BranchDepartment[]>>(`${BASE}/branches/${branchId}/departments`),
  addBranchDepartment: (branchId: number, departmentId: number) => api.post<{ success: boolean; id: number }>(`${BASE}/branches/${branchId}/departments`, { departmentId }),
  removeBranchDepartment: (branchId: number, mapId: number) => api.delete<{ success: boolean }>(`${BASE}/branches/${branchId}/departments/${mapId}`),

  listCapabilities: () => api.get<R<BranchCapability[]>>(`${BASE}/capabilities`),
  listBranchCapabilities: (branchId: number) => api.get<R<BranchCapabilityMap[]>>(`${BASE}/branches/${branchId}/capabilities`),
  addBranchCapability: (branchId: number, capabilityId: number) => api.post<{ success: boolean; id: number }>(`${BASE}/branches/${branchId}/capabilities`, { capabilityId }),
  removeBranchCapability: (branchId: number, mapId: number) => api.delete<{ success: boolean }>(`${BASE}/branches/${branchId}/capabilities/${mapId}`),

  listBranchLocations: (branchId: number) => api.get<R<BranchLocation[]>>(`${BASE}/branches/${branchId}/locations`),
  createBranchLocation: (branchId: number, data: Partial<BranchLocation>) => api.post<{ success: boolean; id: number }>(`${BASE}/branches/${branchId}/locations`, data),
  updateBranchLocation: (branchId: number, locId: number, data: Partial<BranchLocation>) => api.put<{ success: boolean }>(`${BASE}/branches/${branchId}/locations/${locId}`, data),
  deleteBranchLocation: (branchId: number, locId: number) => api.delete<{ success: boolean }>(`${BASE}/branches/${branchId}/locations/${locId}`),

  // ─── Departments & Designations ───
  listDepartments: (activeOnly = false) => api.get<R<OrgDepartment[]>>(`${BASE}/departments?activeOnly=${activeOnly ? '1' : '0'}`),
  createDepartment: (data: { departmentCode: string; departmentName: string; sortOrder?: number }) => api.post<R<OrgDepartment> & { id: number }>(`${BASE}/departments`, data),
  updateDepartment: (id: number, data: Partial<OrgDepartment>) => api.put<R<OrgDepartment>>(`${BASE}/departments/${id}`, data),
  deleteDepartment: (id: number) => api.delete<{ success: boolean }>(`${BASE}/departments/${id}`),

  listDesignations: (departmentId: number) => api.get<R<OrgDesignation[]>>(`${BASE}/designations?departmentId=${departmentId}`),
  createDesignation: (data: { departmentId: number; name: string; level: number; isLeader?: boolean; sortOrder?: number }) => api.post<{ success: boolean; id: number }>(`${BASE}/designations`, data),
  updateDesignation: (id: number, data: Partial<OrgDesignation>) => api.put<{ success: boolean }>(`${BASE}/designations/${id}`, data),
  deleteDesignation: (id: number) => api.delete<{ success: boolean }>(`${BASE}/designations/${id}`),

  // ─── Branch Permissions ───
  listUserBranchAccess: (userId: number) => api.get<R<UserBranchAccess[]>>(`${BASE}/branch-access/users/${userId}`),
  addUserBranchAccess: (userId: number, data: { branchId: number; isDefault?: boolean }) => api.post<{ success: boolean; id: number }>(`${BASE}/branch-access/users/${userId}`, data),
  removeUserBranchAccess: (userId: number, accessId: number) => api.delete<{ success: boolean }>(`${BASE}/branch-access/users/${userId}/${accessId}`),
  getMyBranches: () => api.get<R<Branch[]>>(`${BASE}/my-branches`),

  // ─── Transfers ───
  listTransfers: (params?: { branchId?: number; type?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.branchId) q.set('branchId', String(params.branchId));
    if (params?.type) q.set('type', params.type);
    if (params?.status) q.set('status', params.status);
    return api.get<R<Transfer[]>>(`${BASE}/transfers?${q.toString()}`);
  },
  getTransfer: (id: number) => api.get<{ success: boolean; data: Transfer; logs: TransferLog[]; jobs: any[] }>(`${BASE}/transfers/${id}`),
  createTransfer: (data: any) => api.post<{ success: boolean; id: number; data: Transfer }>(`${BASE}/transfers`, data),
  approveTransfer: (id: number, remarks?: string) => api.post<{ success: boolean }>(`${BASE}/transfers/${id}/approve`, { remarks }),
  dispatchTransfer: (id: number, remarks?: string) => api.post<{ success: boolean }>(`${BASE}/transfers/${id}/dispatch`, { remarks }),
  receiveTransfer: (id: number, remarks?: string) => api.post<{ success: boolean }>(`${BASE}/transfers/${id}/receive`, { remarks }),
  rejectTransfer: (id: number, remarks?: string) => api.post<{ success: boolean }>(`${BASE}/transfers/${id}/reject`, { remarks }),
};
