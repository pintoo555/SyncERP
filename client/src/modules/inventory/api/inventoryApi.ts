/**
 * Inventory / Assets module API.
 * Covers assets, assignments, tickets, verification, masters, reports.
 */
import { api } from '../../../shared/api/baseClient';

export const inventoryApi = {
  getAssets: (params?: Record<string, string>) => {
    const search = params ? new URLSearchParams(params).toString() : '';
    return api.get<{ success: boolean; data: unknown[]; total: number }>(`/api/assets${search ? `?${search}` : ''}`);
  },
  getAsset: (id: number) => api.get<{ success: boolean; data: unknown }>(`/api/assets/${id}`),
  search: (params: Record<string, string>) =>
    api.get<{ success: boolean; data: unknown[] }>(`/api/search?${new URLSearchParams(params).toString()}`),
  getTickets: (params?: Record<string, string>) =>
    api.get<{ success: boolean; data: unknown[]; total: number }>(`/api/tickets${params ? `?${new URLSearchParams(params).toString()}` : ''}`),
  getTicket: (id: number) => api.get<{ success: boolean; data: unknown }>(`/api/tickets/${id}`),
  getMasters: (type: string) => api.get<{ success: boolean; data: unknown[] }>(`/api/masters/${type}`),
  getReports: (params: Record<string, string>) =>
    api.get<{ success: boolean; data: unknown }>(`/api/reports?${new URLSearchParams(params).toString()}`),
};
