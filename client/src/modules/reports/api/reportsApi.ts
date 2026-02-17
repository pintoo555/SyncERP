/**
 * Reports module API.
 */
import { api } from '../../../shared/api/baseClient';

export const reportsApi = {
  exportReport: (params: Record<string, string>) =>
    api.get<Blob>(`/api/reports/export?${new URLSearchParams(params).toString()}`, {
      headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    } as RequestInit),
  getReportData: (params: Record<string, string>) =>
    api.get<{ success: boolean; data: unknown }>(`/api/reports?${new URLSearchParams(params).toString()}`),
};
