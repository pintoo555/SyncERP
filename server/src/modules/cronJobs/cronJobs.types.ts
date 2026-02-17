/**
 * Cron Jobs module types.
 */

export type TaskType = 'send_report' | 'send_whatsapp' | 'send_audit_report';

export interface SendReportConfig {
  reportType: 'summary' | 'warranty' | 'assignments';
  recipientEmails: string[];
  days?: number; // for assignments report: last N days
}

export interface SendWhatsAppConfig {
  to: string;
  message: string;
}

export type AuditReportDateRange = 'last7' | 'last30' | 'custom';

export interface SendAuditReportConfig {
  dateRange: AuditReportDateRange;
  dateFrom?: string;
  dateTo?: string;
  recipientEmails: string[];
  format: 'pdf' | 'csv' | 'both';
}

export type CronJobConfig = SendReportConfig | SendWhatsAppConfig | SendAuditReportConfig;

export interface CronJobRow {
  Id: number;
  Name: string;
  TaskType: string;
  CronExpression: string;
  ConfigJson: string | null;
  IsActive: boolean;
  LastRunAt: Date | null;
  NextRunAt: Date | null;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface CronJobPayload {
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

export interface CreateCronJobInput {
  name: string;
  taskType: TaskType;
  cronExpression: string;
  config: CronJobConfig;
  isActive?: boolean;
}

export interface UpdateCronJobInput {
  name?: string;
  taskType?: TaskType;
  cronExpression?: string;
  config?: CronJobConfig;
  isActive?: boolean;
}

// --- Run history ---

export type RunStatus = 'success' | 'failed';

export interface CronJobRunRow {
  Id: number;
  CronJobId: number;
  RunAt: Date;
  Status: string;
  ErrorMessage: string | null;
  DurationMs: number | null;
}

export interface CronJobRunPayload {
  id: number;
  cronJobId: number;
  jobName?: string;
  runAt: string;
  status: RunStatus;
  errorMessage: string | null;
  durationMs: number | null;
}

export interface CronJobHistoryQuery {
  jobId?: number;
  page: number;
  pageSize: number;
  dateFrom?: string;
  dateTo?: string;
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
  recentRuns: CronJobRunPayload[];
}
