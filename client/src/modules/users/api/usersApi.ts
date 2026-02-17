/**
 * Users / RBAC module API.
 */
import { api } from '../../../shared/api/baseClient';

export const usersApi = {
  getRoles: () => api.get<{ success: boolean; data: unknown[] }>('/api/rbac/roles'),
  getUsers: (search?: string) =>
    api.get<{ success: boolean; data: unknown[]; total: number }>(`/api/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  assignRoles: (userId: number, roleIds: number[]) =>
    api.put(`/api/rbac/users/${userId}/roles`, { roleIds }),
  getPermissions: () => api.get<{ success: boolean; data: string[] }>('/api/rbac/permissions'),
};
