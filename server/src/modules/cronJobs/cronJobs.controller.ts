/**
 * Cron Jobs controller. CRUD and run-now.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import * as cronJobsService from './cronJobs.service';
import type { CreateCronJobInput, UpdateCronJobInput, TaskType } from './cronJobs.types';

const TASK_TYPES: TaskType[] = ['send_report', 'send_whatsapp', 'send_audit_report'];

function parseId(param: unknown): number {
  const id = parseInt(String(param), 10);
  if (Number.isNaN(id)) throw new AppError(400, 'Invalid id');
  return id;
}

function parseRecipientEmails(body: Record<string, unknown>, key: string): string[] {
  const raw = body[key];
  if (Array.isArray(raw)) return (raw as string[]).filter((e) => typeof e === 'string' && e.trim());
  if (typeof raw === 'string') return raw.split(',').map((e) => e.trim()).filter(Boolean);
  return [];
}

function parseBodyCreate(body: Record<string, unknown>): CreateCronJobInput {
  const name = String(body.name ?? '').trim();
  const taskType = (body.taskType === 'send_whatsapp' ? 'send_whatsapp' : body.taskType === 'send_audit_report' ? 'send_audit_report' : 'send_report') as TaskType;
  const cronExpression = String(body.cronExpression ?? '').trim();
  const isActive = body.isActive !== false;
  let config: CreateCronJobInput['config'];
  if (taskType === 'send_report') {
    const reportType = (body.reportType === 'warranty' || body.reportType === 'assignments' ? body.reportType : 'summary') as 'summary' | 'warranty' | 'assignments';
    const recipientEmails = parseRecipientEmails(body, 'recipientEmails');
    const days = typeof body.days === 'number' ? body.days : Number(body.days) || 30;
    config = { reportType, recipientEmails, days };
  } else if (taskType === 'send_audit_report') {
    const dateRange = (body.dateRange === 'last30' || body.dateRange === 'custom' ? body.dateRange : 'last7') as 'last7' | 'last30' | 'custom';
    const dateFrom = typeof body.dateFrom === 'string' ? body.dateFrom : undefined;
    const dateTo = typeof body.dateTo === 'string' ? body.dateTo : undefined;
    const recipientEmails = parseRecipientEmails(body, 'recipientEmails');
    const format = (body.format === 'csv' || body.format === 'both' ? body.format : 'pdf') as 'pdf' | 'csv' | 'both';
    config = { dateRange, dateFrom, dateTo, recipientEmails, format };
  } else {
    const to = String(body.to ?? '').trim();
    const message = String(body.message ?? '').trim();
    config = { to, message };
  }
  return { name, taskType, cronExpression, config, isActive };
}

function parseBodyUpdate(body: Record<string, unknown>): UpdateCronJobInput {
  const out: UpdateCronJobInput = {};
  if (body.name !== undefined) out.name = String(body.name).trim();
  if (body.taskType !== undefined) out.taskType = (body.taskType === 'send_whatsapp' ? 'send_whatsapp' : body.taskType === 'send_audit_report' ? 'send_audit_report' : 'send_report') as TaskType;
  if (body.cronExpression !== undefined) out.cronExpression = String(body.cronExpression).trim();
  if (body.isActive !== undefined) out.isActive = body.isActive === true;
  if (body.reportType !== undefined || body.recipientEmails !== undefined || body.days !== undefined) {
    const reportType = (body.reportType === 'warranty' || body.reportType === 'assignments' ? body.reportType : 'summary') as 'summary' | 'warranty' | 'assignments';
    const recipientEmails = parseRecipientEmails(body, 'recipientEmails');
    const days = typeof body.days === 'number' ? body.days : Number(body.days) || 30;
    out.config = { reportType, recipientEmails, days };
  }
  if (body.to !== undefined || body.message !== undefined) {
    out.config = {
      to: String(body.to ?? '').trim(),
      message: String(body.message ?? '').trim(),
    };
  }
  if (body.dateRange !== undefined || body.dateFrom !== undefined || body.dateTo !== undefined || body.recipientEmails !== undefined || body.format !== undefined) {
    const dateRange = (body.dateRange === 'last30' || body.dateRange === 'custom' ? body.dateRange : 'last7') as 'last7' | 'last30' | 'custom';
    const dateFrom = typeof body.dateFrom === 'string' ? body.dateFrom : undefined;
    const dateTo = typeof body.dateTo === 'string' ? body.dateTo : undefined;
    const recipientEmails = parseRecipientEmails(body, 'recipientEmails');
    const format = (body.format === 'csv' || body.format === 'both' ? body.format : 'pdf') as 'pdf' | 'csv' | 'both';
    out.config = { dateRange, dateFrom, dateTo, recipientEmails, format };
  }
  return out;
}

export async function getList(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await cronJobsService.list();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const job = await cronJobsService.getById(id);
    if (!job) return next(new AppError(404, 'Cron job not found'));
    res.json({ success: true, data: job });
  } catch (e) {
    next(e);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = parseBodyCreate((req.body || {}) as Record<string, unknown>);
    if (!input.name) return next(new AppError(400, 'Name is required'));
    const job = await cronJobsService.create(input);
    res.status(201).json({ success: true, data: job });
  } catch (e) {
    next(e);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const input = parseBodyUpdate((req.body || {}) as Record<string, unknown>);
    const job = await cronJobsService.update(id, input);
    if (!job) return next(new AppError(404, 'Cron job not found'));
    res.json({ success: true, data: job });
  } catch (e) {
    next(e);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const deleted = await cronJobsService.remove(id);
    if (!deleted) return next(new AppError(404, 'Cron job not found'));
    res.json({ success: true, message: 'Deleted' });
  } catch (e) {
    next(e);
  }
}

export async function runNow(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const job = await cronJobsService.getById(id);
    if (!job) return next(new AppError(404, 'Cron job not found'));
    await cronJobsService.runJob(id);
    res.json({ success: true, message: 'Job executed' });
  } catch (e) {
    next(e);
  }
}

function parseNumber(val: unknown): number | undefined {
  if (val == null || val === '') return undefined;
  const n = Number(val);
  return Number.isNaN(n) ? undefined : n;
}

export async function getHistory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const jobId = parseNumber(req.query.jobId);
    const page = Math.max(1, parseNumber(req.query.page) ?? 1);
    const pageSize = Math.min(100, Math.max(1, parseNumber(req.query.pageSize) ?? 20));
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined;
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined;
    const result = await cronJobsService.listRunHistory({ jobId, page, pageSize, dateFrom, dateTo });
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}

export async function getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await cronJobsService.getDashboardStats();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
