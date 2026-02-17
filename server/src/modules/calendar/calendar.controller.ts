/**
 * Calendar events API: list (personal/company/all), create, update, delete.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { getPermissionsForUser } from '../rbac';
import { logAuditFromRequest } from '../../services/auditService';
import * as calendarService from './calendar.service';
import { emitCalendarEventCreated, emitCalendarEventUpdated, emitCalendarEventDeleted } from '../../realtime/setup';

const VIEW_VALUES = ['personal', 'company', 'all'] as const;
type ViewQuery = (typeof VIEW_VALUES)[number];

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const view = (VIEW_VALUES.includes((req.query.view as ViewQuery) || '') ? req.query.view : 'all') as calendarService.CalendarView;
    const start = typeof req.query.start === 'string' ? req.query.start : undefined;
    const end = typeof req.query.end === 'string' ? req.query.end : undefined;
    const events = await calendarService.listEvents(userId, view, start, end);
    res.json({ success: true, events });
  } catch (e) {
    next(e);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const perms = await getPermissionsForUser(userId);
    const body = req.body as {
      title?: string; start?: string; end?: string | null; allDay?: boolean; category?: string;
      scope?: string; reminderMinutes?: number | null;
    };
    const title = body.title?.trim();
    if (!title) return next(new AppError(400, 'Title is required'));
    if (!body.start) return next(new AppError(400, 'Start is required'));
    const scope = body.scope === 'company' ? 'company' : 'personal';
    if (scope === 'company' && !perms.includes('CALENDAR.CREATE_COMPANY')) {
      return next(new AppError(403, 'You do not have permission to create company events'));
    }
    if (scope === 'personal' && !perms.includes('CALENDAR.CREATE')) {
      return next(new AppError(403, 'You do not have permission to create calendar events'));
    }
    const category = (body.category as calendarService.CalendarCategory) || 'primary';
    const reminderMinutes = body.reminderMinutes != null && body.reminderMinutes >= 0 ? body.reminderMinutes : null;
    const event = await calendarService.createEvent({
      title,
      start: body.start,
      end: body.end ?? null,
      allDay: body.allDay ?? true,
      category,
      scope,
      reminderMinutes,
      createdByUserId: userId,
    });
    emitCalendarEventCreated(event);
    logAuditFromRequest(req, { eventType: 'create', entityType: 'calendar_event', entityId: String(event.id), details: scope === 'company' ? 'company event' : 'personal event' });
    res.status(201).json({ success: true, event });
  } catch (e) {
    next(e);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(String((req.params as { id?: string }).id), 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid event id'));
    const existing = await calendarService.getEventById(id);
    if (!existing) return next(new AppError(404, 'Event not found'));
    const perms = await getPermissionsForUser(userId);
    const isCompany = existing.scope === 'company';
    const isOwner = existing.createdByUserId === userId;
    if (isCompany) {
      if (!perms.includes('CALENDAR.EDIT_COMPANY')) return next(new AppError(403, 'You cannot edit this company event'));
    } else {
      if (!isOwner || !perms.includes('CALENDAR.EDIT_OWN')) return next(new AppError(403, 'You cannot edit this event'));
    }
    const body = req.body as {
      title?: string; start?: string; end?: string | null; allDay?: boolean; category?: string;
      scope?: string; reminderMinutes?: number | null;
    };
    const updated = await calendarService.updateEvent(id, {
      title: body.title?.trim(),
      start: body.start,
      end: body.end,
      allDay: body.allDay,
      category: body.category as calendarService.CalendarCategory | undefined,
      scope: body.scope === 'company' ? 'company' : body.scope === 'personal' ? 'personal' : undefined,
      reminderMinutes: body.reminderMinutes !== undefined ? (body.reminderMinutes != null && body.reminderMinutes >= 0 ? body.reminderMinutes : null) : undefined,
    });
    if (!updated) return next(new AppError(404, 'Event not found'));
    emitCalendarEventUpdated(updated);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'calendar_event', entityId: String(id) });
    res.json({ success: true, event: updated });
  } catch (e) {
    next(e);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(String((req.params as { id?: string }).id), 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid event id'));
    const existing = await calendarService.getEventById(id);
    if (!existing) return next(new AppError(404, 'Event not found'));
    const perms = await getPermissionsForUser(userId);
    const isCompany = existing.scope === 'company';
    const isOwner = existing.createdByUserId === userId;
    if (isCompany) {
      if (!perms.includes('CALENDAR.EDIT_COMPANY')) return next(new AppError(403, 'You cannot delete this company event'));
    } else {
      if (!isOwner || !perms.includes('CALENDAR.EDIT_OWN')) return next(new AppError(403, 'You cannot delete this event'));
    }
    const deleted = await calendarService.deleteEvent(id);
    if (!deleted) return next(new AppError(404, 'Event not found'));
    emitCalendarEventDeleted(id);
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'calendar_event', entityId: String(id) });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function availability(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const targetUserId = parseInt(String(req.query.userId), 10);
    if (Number.isNaN(targetUserId)) return next(new AppError(400, 'Valid userId required'));
    const start = typeof req.query.start === 'string' ? req.query.start : undefined;
    const end = typeof req.query.end === 'string' ? req.query.end : undefined;
    const events = await calendarService.listAvailabilityEvents(targetUserId, start, end);
    res.json({ success: true, events });
  } catch (e) {
    next(e);
  }
}

export async function users(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const list = await calendarService.listCalendarUsers();
    res.json({ success: true, users: list });
  } catch (e) {
    next(e);
  }
}
