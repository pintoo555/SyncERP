/**
 * Cron Jobs API. Settings → Cron Jobs.
 */
import { api } from '../../../shared/api/baseClient';

export type TaskType = 'send_report' | 'send_whatsapp' | 'send_audit_report';

export interface SendReportConfig {
  reportType: 'summary' | 'warranty' | 'assignments';
  recipientEmails: string[];
  days?: number;
}

export interface SendWhatsAppConfig {
  to: string;
  message: string;
}

export interface SendAuditReportConfig {
  dateRange: 'last7' | 'last30' | 'custom';
  dateFrom?: string;
  dateTo?: string;
  recipientEmails: string[];
  format: 'pdf' | 'csv' | 'both';
}

export type CronJobConfig = SendReportConfig | SendWhatsAppConfig | SendAuditReportConfig;

export interface CronJob {
  id: number;
  name: string;
  taskType: TaskType;
  cronExpression: string;
  config: CronJobConfig;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Flat body for create: same fields as config spread. */
export type CreateCronJobPayload =
  | { name: string; taskType: 'send_report'; cronExpression: string; isActive?: boolean; reportType: 'summary' | 'warranty' | 'assignments'; recipientEmails: string[]; days?: number }
  | { name: string; taskType: 'send_whatsapp'; cronExpression: string; isActive?: boolean; to: string; message: string }
  | { name: string; taskType: 'send_audit_report'; cronExpression: string; isActive?: boolean; dateRange: 'last7' | 'last30' | 'custom'; dateFrom?: string; dateTo?: string; recipientEmails: string[]; format: 'pdf' | 'csv' | 'both' };

/** Flat body for update: optional fields. */
export type UpdateCronJobPayload = Partial<
  { name: string; taskType: TaskType; cronExpression: string; isActive: boolean; reportType: string; recipientEmails: string[]; days: number; to: string; message: string; dateRange: string; dateFrom: string; dateTo: string; format: string }
>;

export type RunStatus = 'success' | 'failed';

export interface CronJobRun {
  id: number;
  cronJobId: number;
  jobName?: string;
  runAt: string;
  status: RunStatus;
  errorMessage: string | null;
  durationMs: number | null;
}

export interface CronJobDashboardStats {
  totalJobs: number;
  activeJobs: number;
  totalRuns: number;
  successCount: number;
  failedCount: number;
  runsLast24h: number;
  runsLast7d: number;
  runsByJob: { jobId: number; jobName: string; runCount: number; lastRunAt: string | null; lastStatus: RunStatus | null }[];
  recentRuns: CronJobRun[];
}

export interface CronJobHistoryParams {
  jobId?: number;
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
}

export const cronJobsApi = {
  getList: () =>
    api.get<{ success: boolean; data: CronJob[] }>('/api/cron-jobs'),
  getById: (id: number) =>
    api.get<{ success: boolean; data: CronJob }>(`/api/cron-jobs/${id}`),
  getDashboard: () =>
    api.get<{ success: boolean; data: CronJobDashboardStats }>('/api/cron-jobs/dashboard'),
  getHistory: (params?: CronJobHistoryParams) =>
    api.get<{ success: boolean; data: CronJobRun[]; total: number }>('/api/cron-jobs/history', { params }),
  create: (payload: CreateCronJobPayload) =>
    api.post<{ success: boolean; data: CronJob }>('/api/cron-jobs', payload),
  update: (id: number, payload: UpdateCronJobPayload) =>
    api.put<{ success: boolean; data: CronJob }>(`/api/cron-jobs/${id}`, payload),
  delete: (id: number) =>
    api.delete<{ success: boolean; message?: string }>(`/api/cron-jobs/${id}`),
  runNow: (id: number) =>
    api.post<{ success: boolean; message?: string }>(`/api/cron-jobs/${id}/run-now`),
};
