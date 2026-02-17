/**
 * HRMS module API.
 */
import { api } from '../../../shared/api/baseClient';

export interface OrgDepartment {
  id: number;
  departmentCode: string;
  departmentName: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface OrgDesignation {
  id: number;
  departmentId: number;
  name: string;
  level: number;
  isLeader: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface OrgTeam {
  id: number;
  departmentId: number;
  name: string;
  parentTeamId: number | null;
  leadUserId: number | null;
  level: number;
  createdAt: string;
  updatedAt: string | null;
}

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

export const hrmsApi = {
  getEmployees: (params?: { search?: string; departmentId?: number; isActive?: number }) => {
    const search = new URLSearchParams();
    if (params?.search) search.set('search', params.search);
    if (params?.departmentId != null) search.set('departmentId', String(params.departmentId));
    if (params?.isActive !== undefined) search.set('isActive', String(params.isActive));
    return api.get<{ success: boolean; data: unknown[]; total: number }>(`/api/hrms/employees?${search.toString()}`);
  },
  getEmployee: (userId: number) =>
    api.get<{ success: boolean; user: unknown; profile: unknown; designationName: string | null; family: unknown[]; bank: unknown; contactNumbers?: unknown[] }>(`/api/hrms/employees/${userId}`),
  updateEmployee: (userId: number, data: unknown) =>
    api.put(`/api/hrms/employees/${userId}`, data),
  getProfile: () => api.get<{ success: boolean; data: unknown }>('/api/hrms/profile'),
  updateProfile: (data: unknown) => api.put('/api/hrms/profile', data),

  listOrgDepartments: (activeOnly?: boolean) =>
    api.get<{ success: boolean; data: OrgDepartment[] }>(`/api/hrms/org/departments${activeOnly ? '?activeOnly=1' : ''}`),
  createOrgDepartment: (data: { departmentCode: string; departmentName: string; sortOrder?: number }) =>
    api.post<{ success: boolean; id: number; data: OrgDepartment }>('/api/hrms/org/departments', data),
  updateOrgDepartment: (id: number, data: Partial<{ departmentCode: string; departmentName: string; isActive: boolean; sortOrder: number }>) =>
    api.put<{ success: boolean; data: OrgDepartment }>(`/api/hrms/org/departments/${id}`, data),
  deleteOrgDepartment: (id: number) =>
    api.delete(`/api/hrms/org/departments/${id}`),

  listOrgDesignations: (departmentId: number) =>
    api.get<{ success: boolean; data: OrgDesignation[] }>(`/api/hrms/org/designations?departmentId=${departmentId}`),
  createOrgDesignation: (data: { departmentId: number; name: string; level: number; isLeader?: boolean; sortOrder?: number }) =>
    api.post<{ success: boolean; id: number }>('/api/hrms/org/designations', data),
  updateOrgDesignation: (id: number, data: Partial<{ name: string; level: number; isLeader: boolean; sortOrder: number }>) =>
    api.put(`/api/hrms/org/designations/${id}`, data),
  deleteOrgDesignation: (id: number) =>
    api.delete(`/api/hrms/org/designations/${id}`),

  listOrgTeams: (departmentId?: number) =>
    api.get<{ success: boolean; data: OrgTeam[] }>(`/api/hrms/org/teams${departmentId != null ? `?departmentId=${departmentId}` : ''}`),
  getOrgTeam: (id: number) =>
    api.get<{ success: boolean; data: OrgTeam }>(`/api/hrms/org/teams/${id}`),
  createOrgTeam: (data: { departmentId: number; name: string; parentTeamId?: number | null; leadUserId?: number | null; level: number }) =>
    api.post<{ success: boolean; id: number; data: OrgTeam }>('/api/hrms/org/teams', data),
  updateOrgTeam: (id: number, data: Partial<{ name: string; parentTeamId: number | null; leadUserId: number | null; level: number }>) =>
    api.put<{ success: boolean; data: OrgTeam }>(`/api/hrms/org/teams/${id}`, data),
  deleteOrgTeam: (id: number) =>
    api.delete(`/api/hrms/org/teams/${id}`),
  listOrgTeamMembers: (teamId: number) =>
    api.get<{ success: boolean; data: { id: number; teamId: number; userId: number; createdAt: string }[] }>(`/api/hrms/org/teams/${teamId}/members`),
  addOrgTeamMember: (teamId: number, userId: number) =>
    api.post(`/api/hrms/org/teams/${teamId}/members`, { userId }),

  moveUserToTeam: (userId: number, toTeamId: number) =>
    api.post(`/api/hrms/org/employees/${userId}/move-team`, { toTeamId }),

  getOrgTree: (departmentId?: number) =>
    api.get<{ success: boolean; nodes: OrgTreeNode[]; edges: { source: string; target: string }[] }>(`/api/hrms/org/tree${departmentId != null ? `?departmentId=${departmentId}` : ''}`),

  recordPromotion: (userId: number, data: { toOrgDesignationId: number; toTeamId: number; effectiveDate: string; changeType: 'Promotion' | 'Demotion' | 'Transfer'; notes?: string }) =>
    api.post(`/api/hrms/org/employees/${userId}/promotion`, data),
  listPromotionHistory: (userId: number) =>
    api.get<{ success: boolean; data: { id: number; userId: number; fromDesignationId: number | null; toDesignationId: number | null; fromTeamId: number | null; toTeamId: number | null; effectiveDate: string; changeType: string; notes: string | null; createdAt: string; createdBy: number | null }[] }>(`/api/hrms/org/employees/${userId}/promotion-history`),
};
