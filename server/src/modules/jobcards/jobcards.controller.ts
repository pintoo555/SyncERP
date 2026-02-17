/**
 * Job Cards controller – request/response handling.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import * as jobcardsService from './jobcards.service';

const ALLOWED_SORT_FIELDS = ['jobId', 'instrument', 'manufacturer', 'date', 'statusOfWork', 'isInstrumentOut', 'clientName', 'empName', 'ownerName'] as const;
type SortField = (typeof ALLOWED_SORT_FIELDS)[number];

function isSortField(v: unknown): v is SortField {
  return typeof v === 'string' && (ALLOWED_SORT_FIELDS as readonly string[]).includes(v);
}

export async function listJobs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 10));
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const sortBy = isSortField(req.query.sortBy) ? req.query.sortBy : 'jobId';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
    const userId = req.user?.userId;
    const clientAccess = userId ? await jobcardsService.hasClientAccess(userId) : false;
    const result = await jobcardsService.listJobs({ page, pageSize, search, sortBy, sortOrder, hasClientAccess: clientAccess });
    res.json({ success: true, data: result.data, total: result.total, hasClientAccess: clientAccess });
  } catch (e) {
    next(e);
  }
}

export async function getJob(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const jobId = parseInt(req.params.id, 10);
    if (!jobId || jobId <= 0) {
      res.status(400).json({ success: false, error: 'Invalid job ID' });
      return;
    }
    const job = await jobcardsService.getJobById(jobId);
    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }
    res.json({ success: true, data: job });
  } catch (e) {
    next(e);
  }
}
