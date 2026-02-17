/**
 * Audit log API: dashboard stats and export URL helpers.
 */
import { api } from '../../../shared/api/baseClient';
import { getOrCreateSessionId } from '../../../utils/sessionId';

export interface AuditDashboardStats {
  totalEvents: number;
  uniqueUsers: number;
  byEventType: { eventType: string; count: number }[];
  byEntityType: { entityType: string; count: number }[];
  byDay: { date: string; count: number }[];
  byHour: { hour: number; count: number }[];
  topUsers: { userEmail: string | null; userId: number | null; count: number }[];
  topEntityTypes: { entityType: string; count: number }[];
  busiestDay?: string;
  busiestHour?: number;
  mostActiveUser?: string;
}

export interface AuditDashboardParams {
  dateFrom?: string;
  dateTo?: string;
  days?: number;
}

/** Build query string for list/export (same filters as AuditList). */
export interface AuditExportParams {
  dateFrom?: string;
  dateTo?: string;
  eventType?: string;
  entityType?: string;
  userEmail?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

function buildExportSearchParams(params: AuditExportParams, pageSize = 10000): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set('pageSize', String(pageSize));
  sp.set('sortBy', params.sortBy ?? 'createdAt');
  sp.set('sortOrder', params.sortOrder ?? 'desc');
  if (params.dateFrom) sp.set('dateFrom', params.dateFrom);
  if (params.dateTo) sp.set('dateTo', params.dateTo);
  if (params.eventType) sp.set('eventType', params.eventType);
  if (params.entityType) sp.set('entityType', params.entityType);
  if (params.userEmail) sp.set('userEmail', params.userEmail);
  if (params.search) sp.set('search', params.search);
  return sp;
}

export const auditApi = {
  getDashboard: (params: AuditDashboardParams = {}) => {
    const search = new URLSearchParams();
    if (params.dateFrom) search.set('dateFrom', params.dateFrom);
    if (params.dateTo) search.set('dateTo', params.dateTo);
    if (params.days != null && !params.dateFrom) search.set('days', String(params.days));
    return api.get<{ success: boolean; data: AuditDashboardStats }>(
      `/api/audit/dashboard?${search.toString()}`
    );
  },

  /** Returns the URL for CSV export (same filters). Use as href for link. */
  getExportCsvUrl: (params: AuditExportParams): string => {
    const qs = buildExportSearchParams(params).toString();
    return `/api/audit/export?${qs}`;
  },

  /** Returns the URL for PDF export (same filters). Use with downloadExportPdf to send auth. */
  getExportPdfUrl: (params: AuditExportParams): string => {
    const qs = buildExportSearchParams(params).toString();
    return `/api/audit/export/pdf?${qs}`;
  },

  /** Download CSV with current session; triggers browser save. Uses fetch so API base URL and credentials work. */
  downloadExportCsv: async (params: AuditExportParams, filename?: string): Promise<void> => {
    const qs = buildExportSearchParams(params).toString();
    const path = `/api/audit/export?${qs}`;
    const base = typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL
      ? String((import.meta as { env: { VITE_API_URL: string } }).env.VITE_API_URL).replace(/\/$/, '')
      : '';
    const url = base ? `${base}${path}` : path;
    const sessionId = getOrCreateSessionId();
    const headers: Record<string, string> = {};
    if (sessionId) headers['X-Session-Id'] = sessionId;
    const res = await fetch(url, { credentials: 'include', headers });
    if (!res.ok) throw new Error(res.status === 401 ? 'Session ended' : 'Failed to download CSV');
    const blob = await res.blob();
    const name = filename ?? `audit-log-${params.dateFrom ?? 'export'}-to-${params.dateTo ?? 'export'}.csv`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  /** Download PDF with current session; triggers browser save. */
  downloadExportPdf: async (params: AuditExportParams, filename?: string): Promise<void> => {
    const qs = buildExportSearchParams(params).toString();
    const path = `/api/audit/export/pdf?${qs}`;
    const base = typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL
      ? String((import.meta as { env: { VITE_API_URL: string } }).env.VITE_API_URL).replace(/\/$/, '')
      : '';
    const url = base ? `${base}${path}` : path;
    const sessionId = getOrCreateSessionId();
    const headers: Record<string, string> = {};
    if (sessionId) headers['X-Session-Id'] = sessionId;
    const res = await fetch(url, { credentials: 'include', headers });
    if (!res.ok) throw new Error(res.status === 401 ? 'Session ended' : 'Failed to download PDF');
    const blob = await res.blob();
    const name = filename ?? `audit-log-${params.dateFrom ?? 'export'}-to-${params.dateTo ?? 'export'}.pdf`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};
