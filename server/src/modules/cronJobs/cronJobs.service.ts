/**
 * Cron Jobs service: CRUD, scheduler (node-cron), and task executor.
 */

import cron from 'node-cron';
import parser from 'cron-parser';
import { getRequest } from '../../config/db';
import { config } from '../../utils/config';
import * as reportService from '../../services/reportService';
import type { AdminDashboard } from '../../services/dashboardService';
import type { WarrantyReportRow, AssignmentReportRow } from '../../services/reportService';
import * as emailSettingsService from '../../services/emailSettingsService';
import * as emailSender from '../../services/emailSender';
import * as communicationService from '../../services/communicationService';
import * as auditListService from '../../modules/auditLog/audit.service';
import type { AuditListQueryInput } from '../../validators/auditSchemas';
import type {
  CronJobRow,
  CronJobPayload,
  CronJobConfig,
  SendReportConfig,
  SendWhatsAppConfig,
  SendAuditReportConfig,
  CreateCronJobInput,
  UpdateCronJobInput,
  TaskType,
  CronJobRunRow,
  CronJobRunPayload,
  CronJobHistoryQuery,
  CronJobDashboardStats,
  RunStatus,
} from './cronJobs.types';

const SCHEMA = config.db.schema || 'dbo';
const TABLE = `[${SCHEMA}].[react_CronJobs]`;
const RUNS_TABLE = `[${SCHEMA}].[react_CronJobRuns]`;

const TASK_TYPES: TaskType[] = ['send_report', 'send_whatsapp', 'send_audit_report'];

const runningJobs = new Set<number>();

function parseConfig(taskType: TaskType, configJson: string | null): CronJobConfig | null {
  if (!configJson || configJson.trim() === '') return null;
  try {
    const raw = JSON.parse(configJson) as Record<string, unknown>;
    if (taskType === 'send_report') {
      const reportType = (raw.reportType as string) || 'summary';
      const recipientEmails = Array.isArray(raw.recipientEmails)
        ? (raw.recipientEmails as string[]).filter((e) => typeof e === 'string' && e.trim())
        : [];
      const days = typeof raw.days === 'number' ? raw.days : 30;
      return { reportType: reportType as 'summary' | 'warranty' | 'assignments', recipientEmails, days };
    }
    if (taskType === 'send_whatsapp') {
      const to = typeof raw.to === 'string' ? raw.to.trim() : '';
      const message = typeof raw.message === 'string' ? raw.message : '';
      return { to, message };
    }
    if (taskType === 'send_audit_report') {
      const dateRange = (raw.dateRange === 'last30' || raw.dateRange === 'custom' ? raw.dateRange : 'last7') as 'last7' | 'last30' | 'custom';
      const dateFrom = typeof raw.dateFrom === 'string' ? raw.dateFrom : undefined;
      const dateTo = typeof raw.dateTo === 'string' ? raw.dateTo : undefined;
      const recipientEmails = Array.isArray(raw.recipientEmails)
        ? (raw.recipientEmails as string[]).filter((e) => typeof e === 'string' && e.trim())
        : [];
      const format = (raw.format === 'csv' || raw.format === 'both' ? raw.format : 'pdf') as 'pdf' | 'csv' | 'both';
      return { dateRange, dateFrom, dateTo, recipientEmails, format };
    }
  } catch {
    // ignore
  }
  return null;
}

function toPayload(row: CronJobRow): CronJobPayload {
  const configObj = parseConfig(row.TaskType as TaskType, row.ConfigJson);
  return {
    id: row.Id,
    name: row.Name,
    taskType: row.TaskType as TaskType,
    cronExpression: row.CronExpression,
    config: configObj ?? (row.TaskType === 'send_report' ? { reportType: 'summary', recipientEmails: [], days: 30 } : row.TaskType === 'send_audit_report' ? { dateRange: 'last7', recipientEmails: [], format: 'pdf' } : { to: '', message: '' }),
    isActive: Boolean(row.IsActive),
    lastRunAt: row.LastRunAt ? (row.LastRunAt instanceof Date ? row.LastRunAt.toISOString() : String(row.LastRunAt)) : null,
    nextRunAt: row.NextRunAt ? (row.NextRunAt instanceof Date ? row.NextRunAt.toISOString() : String(row.NextRunAt)) : null,
    createdAt: row.CreatedAt instanceof Date ? row.CreatedAt.toISOString() : String(row.CreatedAt),
    updatedAt: row.UpdatedAt instanceof Date ? row.UpdatedAt.toISOString() : String(row.UpdatedAt),
  };
}

function getNextRun(cronExpression: string): Date | null {
  try {
    const interval = parser.parseExpression(cronExpression);
    const next = interval.next();
    return next.toDate();
  } catch {
    return null;
  }
}

export async function list(): Promise<CronJobPayload[]> {
  const req = await getRequest();
  const result = await req.query(`
    SELECT Id, Name, TaskType, CronExpression, ConfigJson, IsActive, LastRunAt, NextRunAt, CreatedAt, UpdatedAt
    FROM ${TABLE}
    ORDER BY Name
  `);
  const rows = (result.recordset || []) as CronJobRow[];
  return rows.map(toPayload);
}

export async function getById(id: number): Promise<CronJobPayload | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT Id, Name, TaskType, CronExpression, ConfigJson, IsActive, LastRunAt, NextRunAt, CreatedAt, UpdatedAt
    FROM ${TABLE}
    WHERE Id = @id
  `);
  const row = (result.recordset as CronJobRow[])?.[0];
  return row ? toPayload(row) : null;
}

function validateCronExpression(expr: string): boolean {
  return cron.validate(expr);
}

function configToJson(taskType: TaskType, config: CronJobConfig): string {
  return JSON.stringify(config);
}

export async function create(input: CreateCronJobInput): Promise<CronJobPayload> {
  if (!input.name?.trim()) throw new Error('Name is required');
  if (!TASK_TYPES.includes(input.taskType)) throw new Error('Invalid task type');
  if (!validateCronExpression(input.cronExpression)) throw new Error('Invalid cron expression');
  const configJson = configToJson(input.taskType, input.config);
  const nextRunAt = getNextRun(input.cronExpression);

  const req = await getRequest();
  const result = await req
    .input('name', input.name.trim().slice(0, 200))
    .input('taskType', input.taskType)
    .input('cronExpression', input.cronExpression.slice(0, 100))
    .input('configJson', configJson)
    .input('isActive', input.isActive !== false ? 1 : 0)
    .input('nextRunAt', nextRunAt)
    .query(`
      INSERT INTO ${TABLE} (Name, TaskType, CronExpression, ConfigJson, IsActive, NextRunAt, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.TaskType, INSERTED.CronExpression, INSERTED.ConfigJson,
        INSERTED.IsActive, INSERTED.LastRunAt, INSERTED.NextRunAt, INSERTED.CreatedAt, INSERTED.UpdatedAt
      VALUES (@name, @taskType, @cronExpression, @configJson, @isActive, @nextRunAt, GETDATE(), GETDATE())
    `);
  const row = (result.recordset as CronJobRow[])?.[0];
  if (!row) throw new Error('Insert failed');
  await rescheduleAll();
  return toPayload(row);
}

export async function update(id: number, input: UpdateCronJobInput): Promise<CronJobPayload | null> {
  const existing = await getById(id);
  if (!existing) return null;
  const name = input.name !== undefined ? input.name.trim().slice(0, 200) : existing.name;
  const taskType = (input.taskType ?? existing.taskType) as TaskType;
  const cronExpression = input.cronExpression ?? existing.cronExpression;
  const config = input.config ?? existing.config;
  const isActive = input.isActive !== undefined ? input.isActive : existing.isActive;

  if (!validateCronExpression(cronExpression)) throw new Error('Invalid cron expression');
  const configJson = configToJson(taskType, config);
  const nextRunAt = isActive ? getNextRun(cronExpression) : null;

  const req = await getRequest();
  await req
    .input('id', id)
    .input('name', name)
    .input('taskType', taskType)
    .input('cronExpression', cronExpression.slice(0, 100))
    .input('configJson', configJson)
    .input('isActive', isActive ? 1 : 0)
    .input('nextRunAt', nextRunAt)
    .query(`
      UPDATE ${TABLE}
      SET Name = @name, TaskType = @taskType, CronExpression = @cronExpression, ConfigJson = @configJson,
          IsActive = @isActive, NextRunAt = @nextRunAt, UpdatedAt = GETDATE()
      WHERE Id = @id
    `);
  await rescheduleAll();
  return getById(id);
}

export async function remove(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${TABLE} WHERE Id = @id`);
  const deleted = (result.rowsAffected?.[0] ?? 0) > 0;
  if (deleted) await rescheduleAll();
  return deleted;
}

// --- Task executor ---

async function executeSendReport(cfg: SendReportConfig): Promise<void> {
  const emailConfig = await emailSettingsService.getDefault();
  if (!emailConfig) throw new Error('No default email settings configured. Configure in Settings → Email Settings.');
  const recipients = (cfg.recipientEmails || []).filter((e) => e && e.trim());
  if (recipients.length === 0) throw new Error('No recipient emails configured for report.');

  let subject: string;
  let html: string;

  if (cfg.reportType === 'summary') {
    const data = await reportService.getReportSummary();
    subject = 'Asset Report – Summary';
    html = buildSummaryReportHtml(data);
  } else if (cfg.reportType === 'warranty') {
    const data = await reportService.getReportWarranty();
    subject = 'Asset Report – Warranty';
    html = buildWarrantyReportHtml(data);
  } else {
    const days = typeof cfg.days === 'number' ? cfg.days : 30;
    const data = await reportService.getReportAssignments(days);
    subject = `Asset Report – Assignments (last ${days} days)`;
    html = buildAssignmentsReportHtml(data);
  }

  await emailSender.sendMail(emailConfig, { to: recipients, subject, html });
}

function buildSummaryReportHtml(data: AdminDashboard): string {
  const k = data.kpis;
  const rows = [
    ['Total assets', String(k.totalAssets)],
    ['Available', String(k.availableAssets)],
    ['Issued', String(k.issuedAssets)],
    ['Under repair', String(k.underRepairAssets)],
    ['Scrapped', String(k.scrappedAssets)],
    ['Total purchase value', String(k.totalPurchaseValue)],
    ['Open tickets', String(k.openTickets)],
    ['Total users', String(k.totalUsers)],
  ];
  let table = '<table border="1" cellpadding="6" style="border-collapse:collapse"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>';
  for (const [label, value] of rows) {
    table += `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
  }
  table += '</tbody></table>';
  if (data.assetsByStatus?.length) {
    table += '<h3>Assets by status</h3><table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Status</th><th>Count</th></tr>';
    for (const r of data.assetsByStatus) {
      table += `<tr><td>${escapeHtml(r.status)}</td><td>${r.count}</td></tr>`;
    }
    table += '</table>';
  }
  return `<html><body><h2>Asset Summary Report</h2><p>Generated at ${new Date().toISOString()}</p>${table}</body></html>`;
}

function buildWarrantyReportHtml(data: WarrantyReportRow[]): string {
  let table = '<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Asset Tag</th><th>Category</th><th>Status</th><th>Warranty Expiry</th><th>Status</th><th>Assigned To</th></tr>';
  for (const r of data) {
    table += `<tr><td>${escapeHtml(r.assetTag)}</td><td>${escapeHtml(r.categoryName ?? '')}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.warrantyExpiry ?? '')}</td><td>${escapeHtml(r.warrantyStatus)}</td><td>${escapeHtml(r.assignedToUserName ?? '')}</td></tr>`;
  }
  table += '</table>';
  return `<html><body><h2>Warranty Report</h2><p>Generated at ${new Date().toISOString()} (${data.length} items)</p>${table}</body></html>`;
}

function buildAssignmentsReportHtml(data: AssignmentReportRow[]): string {
  let table = '<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Asset Tag</th><th>Category</th><th>Assigned To</th><th>Assigned By</th><th>Assigned At</th><th>Returned At</th><th>Type</th></tr>';
  for (const r of data) {
    table += `<tr><td>${escapeHtml(r.assetTag)}</td><td>${escapeHtml(r.categoryName ?? '')}</td><td>${escapeHtml(r.assignedToUserName)}</td><td>${escapeHtml(r.assignedByUserName)}</td><td>${escapeHtml(r.assignedAt)}</td><td>${escapeHtml(r.returnedAt ?? '')}</td><td>${escapeHtml(r.assignmentType)}</td></tr>`;
  }
  table += '</table>';
  return `<html><body><h2>Assignments Report</h2><p>Generated at ${new Date().toISOString()} (${data.length} items)</p>${table}</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function executeSendWhatsApp(cfg: SendWhatsAppConfig): Promise<void> {
  const to = (cfg.to || '').trim();
  const message = (cfg.message || '').trim();
  if (!to) throw new Error('WhatsApp "to" number is required');
  if (!message) throw new Error('WhatsApp message is required');
  const result = await communicationService.sendWhatsAppText(to, message, null);
  if (!result.success) throw new Error(result.error ?? 'Failed to send WhatsApp');
}

function auditReportDateRange(cfg: SendAuditReportConfig): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const dateTo = `${y}-${m}-${d}`;
  if (cfg.dateRange === 'custom' && cfg.dateFrom && cfg.dateTo) return { dateFrom: cfg.dateFrom, dateTo: cfg.dateTo };
  const n = cfg.dateRange === 'last30' ? 30 : 7;
  const from = new Date(today);
  from.setDate(from.getDate() - n + 1);
  const dateFrom = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  return { dateFrom, dateTo };
}

async function executeSendAuditReport(cfg: SendAuditReportConfig): Promise<void> {
  const emailConfig = await emailSettingsService.getDefault();
  if (!emailConfig) throw new Error('No default email settings configured. Configure in Settings → Email Settings.');
  const recipients = (cfg.recipientEmails || []).filter((e) => e && e.trim());
  if (recipients.length === 0) throw new Error('No recipient emails configured for audit report.');
  const { dateFrom, dateTo } = auditReportDateRange(cfg);
  const query: AuditListQueryInput = {
    page: 1,
    pageSize: 10000,
    dateFrom,
    dateTo,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };
  const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];
  if (cfg.format === 'pdf' || cfg.format === 'both') {
    const pdfBuffer = await auditListService.exportAuditLogPdf(query);
    attachments.push({ filename: `audit-log-${dateFrom}-to-${dateTo}.pdf`, content: pdfBuffer, contentType: 'application/pdf' });
  }
  if (cfg.format === 'csv' || cfg.format === 'both') {
    const rows = await auditListService.exportAuditLog(query);
    const escapeCsv = (s: string | null | undefined) => {
      if (s == null) return '';
      const t = String(s);
      if (t.includes('"') || t.includes(',') || t.includes('\n') || t.includes('\r')) return '"' + t.replace(/"/g, '""') + '"';
      return t;
    };
    const header = 'AuditID,EventType,EntityType,EntityID,UserID,UserEmail,IPAddress,UserAgent,Details,RequestMethod,RequestPath,CreatedAt\n';
    const body = rows
      .map((r) =>
        [
          r.auditId,
          escapeCsv(r.eventType),
          escapeCsv(r.entityType),
          escapeCsv(r.entityId),
          r.userId ?? '',
          escapeCsv(r.userEmail),
          escapeCsv(r.ipAddress),
          escapeCsv(r.userAgent),
          escapeCsv(r.details),
          escapeCsv(r.requestMethod ?? ''),
          escapeCsv(r.requestPath ?? ''),
          escapeCsv(typeof r.createdAt === 'string' ? r.createdAt : String(r.createdAt)),
        ].join(',')
      )
      .join('\n');
    attachments.push({ filename: `audit-log-${dateFrom}-to-${dateTo}.csv`, content: Buffer.from(header + body, 'utf-8'), contentType: 'text/csv' });
  }
  await emailSender.sendMail(emailConfig, {
    to: recipients,
    subject: `Audit Log Report – ${dateFrom} to ${dateTo}`,
    text: `Please find the audit log report for ${dateFrom} to ${dateTo} attached.`,
    attachments,
  });
}

async function insertRun(cronJobId: number, status: RunStatus, errorMessage: string | null, durationMs: number | null): Promise<void> {
  const req = await getRequest();
  await req
    .input('cronJobId', cronJobId)
    .input('status', status)
    .input('errorMessage', errorMessage)
    .input('durationMs', durationMs)
    .query(`
      INSERT INTO ${RUNS_TABLE} (CronJobId, RunAt, Status, ErrorMessage, DurationMs)
      VALUES (@cronJobId, GETDATE(), @status, @errorMessage, @durationMs)
    `);
}

export async function runJob(id: number): Promise<void> {
  if (runningJobs.has(id)) return;
  const job = await getById(id);
  if (!job) throw new Error('Cron job not found');
  runningJobs.add(id);
  const startAt = Date.now();
  let status: RunStatus = 'success';
  let errorMessage: string | null = null;
  try {
    if (job.taskType === 'send_report') {
      await executeSendReport(job.config as SendReportConfig);
    } else if (job.taskType === 'send_whatsapp') {
      await executeSendWhatsApp(job.config as SendWhatsAppConfig);
    } else if (job.taskType === 'send_audit_report') {
      await executeSendAuditReport(job.config as SendAuditReportConfig);
    } else {
      throw new Error('Unknown task type: ' + job.taskType);
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
    await insertRun(id, 'failed', errorMessage, Math.round(Date.now() - startAt));
    runningJobs.delete(id);
    throw err;
  } finally {
    if (status === 'success') {
      runningJobs.delete(id);
    }
  }
  const durationMs = Math.round(Date.now() - startAt);
  await insertRun(id, 'success', null, durationMs);
  const now = new Date();
  const nextRunAt = job.isActive ? getNextRun(job.cronExpression) : null;
  const req = await getRequest();
  await req
    .input('id', id)
    .input('lastRunAt', now)
    .input('nextRunAt', nextRunAt)
    .query(`
      UPDATE ${TABLE}
      SET LastRunAt = @lastRunAt, NextRunAt = @nextRunAt, UpdatedAt = GETDATE()
      WHERE Id = @id
    `);
}

function toRunPayload(row: CronJobRunRow, jobName?: string): CronJobRunPayload {
  return {
    id: row.Id,
    cronJobId: row.CronJobId,
    jobName,
    runAt: row.RunAt instanceof Date ? row.RunAt.toISOString() : String(row.RunAt),
    status: row.Status as RunStatus,
    errorMessage: row.ErrorMessage,
    durationMs: row.DurationMs,
  };
}

export async function listRunHistory(query: CronJobHistoryQuery): Promise<{ data: CronJobRunPayload[]; total: number }> {
  const req = await getRequest();
  const offset = (query.page - 1) * query.pageSize;
  const hasJobId = query.jobId != null && query.jobId > 0 ? 1 : 0;
  const hasDateFrom = query.dateFrom && query.dateFrom.trim() ? 1 : 0;
  const hasDateTo = query.dateTo && query.dateTo.trim() ? 1 : 0;
  req.input('jobId', query.jobId ?? null);
  req.input('dateFrom', query.dateFrom?.trim() ?? null);
  req.input('dateTo', query.dateTo?.trim() ?? null);
  req.input('hasJobId', hasJobId);
  req.input('hasDateFrom', hasDateFrom);
  req.input('hasDateTo', hasDateTo);
  req.input('offset', offset);
  req.input('pageSize', query.pageSize);

  const countResult = await req.query(`
    SELECT COUNT(1) AS total
    FROM ${RUNS_TABLE} r
    WHERE (0 = @hasJobId OR r.CronJobId = @jobId)
      AND (0 = @hasDateFrom OR CONVERT(DATE, r.RunAt) >= @dateFrom)
      AND (0 = @hasDateTo OR CONVERT(DATE, r.RunAt) <= @dateTo)
  `);
  const total = ((countResult.recordset as { total: number }[])?.[0]?.total) ?? 0;

  const listReq = await getRequest();
  listReq.input('jobId', query.jobId ?? null);
  listReq.input('dateFrom', query.dateFrom?.trim() ?? null);
  listReq.input('dateTo', query.dateTo?.trim() ?? null);
  listReq.input('hasJobId', hasJobId);
  listReq.input('hasDateFrom', hasDateFrom);
  listReq.input('hasDateTo', hasDateTo);
  listReq.input('offset', offset);
  listReq.input('pageSize', query.pageSize);

  const listResult = await listReq.query(`
    ;WITH CTE AS (
      SELECT r.Id, r.CronJobId, r.RunAt, r.Status, r.ErrorMessage, r.DurationMs, j.Name AS JobName,
        ROW_NUMBER() OVER (ORDER BY r.RunAt DESC) AS rn
      FROM ${RUNS_TABLE} r
      LEFT JOIN ${TABLE} j ON j.Id = r.CronJobId
      WHERE (0 = @hasJobId OR r.CronJobId = @jobId)
        AND (0 = @hasDateFrom OR CONVERT(DATE, r.RunAt) >= @dateFrom)
        AND (0 = @hasDateTo OR CONVERT(DATE, r.RunAt) <= @dateTo)
    )
    SELECT Id, CronJobId, RunAt, Status, ErrorMessage, DurationMs, JobName
    FROM CTE
    WHERE rn > @offset AND rn <= @offset + @pageSize
  `);
  const rows = (listResult.recordset || []) as (CronJobRunRow & { JobName?: string })[];
  const data = rows.map((r) => toRunPayload(r, r.JobName));
  return { data, total };
}

export async function getDashboardStats(): Promise<CronJobDashboardStats> {
  const req = await getRequest();
  const [jobsResult, runsResult, last24Result, last7Result, byJobResult, recentResult] = await Promise.all([
    req.query(`SELECT COUNT(1) AS c FROM ${TABLE}`),
    getRequest().then((r) => r.query(`
      SELECT
        COUNT(1) AS totalRuns,
        SUM(CASE WHEN Status = 'success' THEN 1 ELSE 0 END) AS successCount,
        SUM(CASE WHEN Status = 'failed' THEN 1 ELSE 0 END) AS failedCount
      FROM ${RUNS_TABLE}
    `)),
    getRequest().then((r) => r.query(`
      SELECT COUNT(1) AS c FROM ${RUNS_TABLE}
      WHERE RunAt >= DATEADD(hour, -24, GETDATE())
    `)),
    getRequest().then((r) => r.query(`
      SELECT COUNT(1) AS c FROM ${RUNS_TABLE}
      WHERE RunAt >= DATEADD(day, -7, GETDATE())
    `)),
    getRequest().then((r) => r.query(`
      SELECT j.Id AS jobId, j.Name AS jobName,
        (SELECT COUNT(1) FROM ${RUNS_TABLE} r2 WHERE r2.CronJobId = j.Id) AS runCount,
        (SELECT TOP 1 RunAt FROM ${RUNS_TABLE} r3 WHERE r3.CronJobId = j.Id ORDER BY RunAt DESC) AS lastRunAt,
        (SELECT TOP 1 Status FROM ${RUNS_TABLE} r4 WHERE r4.CronJobId = j.Id ORDER BY RunAt DESC) AS lastStatus
      FROM ${TABLE} j
      ORDER BY j.Name
    `)),
    getRequest().then((r) => r.query(`
      SELECT TOP 20 r.Id, r.CronJobId, r.RunAt, r.Status, r.ErrorMessage, r.DurationMs, j.Name AS JobName
      FROM ${RUNS_TABLE} r
      LEFT JOIN ${TABLE} j ON j.Id = r.CronJobId
      ORDER BY r.RunAt DESC
    `)),
  ]);

  const totalJobs = ((jobsResult.recordset as { c: number }[])?.[0]?.c) ?? 0;
  const activeReq = await getRequest();
  const activeResult = await activeReq.query(`SELECT COUNT(1) AS c FROM ${TABLE} WHERE IsActive = 1`);
  const activeJobs = ((activeResult.recordset as { c: number }[])?.[0]?.c) ?? 0;
  const runAgg = (runsResult.recordset as { totalRuns: number; successCount: number; failedCount: number }[])?.[0];
  const totalRuns = runAgg?.totalRuns ?? 0;
  const successCount = runAgg?.successCount ?? 0;
  const failedCount = runAgg?.failedCount ?? 0;
  const runsLast24h = ((last24Result.recordset as { c: number }[])?.[0]?.c) ?? 0;
  const runsLast7d = ((last7Result.recordset as { c: number }[])?.[0]?.c) ?? 0;
  const byJobRows = (byJobResult.recordset || []) as { jobId: number; jobName: string; runCount: number; lastRunAt: Date | null; lastStatus: string | null }[];
  const runsByJob = byJobRows.map((row) => ({
    jobId: row.jobId,
    jobName: row.jobName || '—',
    runCount: row.runCount ?? 0,
    lastRunAt: row.lastRunAt ? (row.lastRunAt instanceof Date ? row.lastRunAt.toISOString() : String(row.lastRunAt)) : null,
    lastStatus: (row.lastStatus as RunStatus) || null,
  }));
  const recentRows = (recentResult.recordset || []) as (CronJobRunRow & { JobName?: string })[];
  const recentRuns = recentRows.map((r) => toRunPayload(r, r.JobName));

  return {
    totalJobs,
    activeJobs,
    totalRuns,
    successCount,
    failedCount,
    runsLast24h,
    runsLast7d,
    runsByJob,
    recentRuns,
  };
}

// --- Scheduler ---

const scheduledTasks = new Map<number, cron.ScheduledTask>();

export function rescheduleAll(): void {
  for (const t of scheduledTasks.values()) t.stop();
  scheduledTasks.clear();
  getRequest()
    .then((req) =>
      req.query(`
        SELECT Id, Name, TaskType, CronExpression, ConfigJson, IsActive
        FROM ${TABLE}
        WHERE IsActive = 1
      `)
    )
    .then((result) => {
      const rows = (result.recordset || []) as CronJobRow[];
      for (const row of rows) {
        if (!cron.validate(row.CronExpression)) continue;
        const task = cron.schedule(row.CronExpression, () => {
          runJob(row.Id).catch((err) => console.error('[CronJobs] Job', row.Id, row.Name, err?.message || err));
        });
        scheduledTasks.set(row.Id, task);
      }
    })
    .catch((err) => console.error('[CronJobs] rescheduleAll failed:', err?.message || err));
}

export function startScheduler(): void {
  rescheduleAll();
}
