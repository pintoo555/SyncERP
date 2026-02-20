/**
 * Calendar events: CRUD for react_CalendarEvents.
 * Personal (creator only) vs Company (visible to all). Reminders. Availability for shared calendar.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { CalendarCategory, CalendarScope, CalendarEventRow, CalendarEventPayload, CalendarView, CalendarUserRow } from './calendar.types';

const SCHEMA = config.db.schema || 'dbo';
const TABLE = `[${SCHEMA}].[react_CalendarEvents]`;
const USERS_TABLE = config.db.schema ? `[${config.db.schema}].[utbl_Users_Master]` : '[dbo].[utbl_Users_Master]';

export type { CalendarCategory, CalendarScope, CalendarEventPayload, CalendarView, CalendarUserRow };

function toPayload(row: CalendarEventRow): CalendarEventPayload {
  const start = row.Start instanceof Date ? row.Start.toISOString() : String(row.Start);
  const end = row.End != null ? (row.End instanceof Date ? row.End.toISOString() : String(row.End)) : null;
  const createdAt = row.CreatedAt instanceof Date ? row.CreatedAt.toISOString() : String(row.CreatedAt);
  const updatedAt = row.UpdatedAt instanceof Date ? row.UpdatedAt.toISOString() : String(row.UpdatedAt);
  const allDay = Boolean(row.AllDay);
  const scope = (row.Scope === 'company' ? 'company' : 'personal') as CalendarScope;
  return {
    id: row.Id,
    title: row.Title,
    start,
    end,
    allDay,
    category: (row.Category as CalendarCategory) || 'primary',
    scope,
    reminderMinutes: row.ReminderMinutes ?? null,
    createdByUserId: row.CreatedByUserId,
    createdAt,
    updatedAt,
  };
}

const COLS = 'Id, Title, [Start], [End], AllDay, Category, Scope, ReminderMinutes, CreatedByUserId, CreatedAt, UpdatedAt';

function viewCondition(view: CalendarView, userId: number): string {
  switch (view) {
    case 'personal':
      return ` Scope = N'personal' AND CreatedByUserId = @userId`;
    case 'company':
      return ` Scope = N'company'`;
    case 'all':
      return ` (Scope = N'personal' AND CreatedByUserId = @userId) OR Scope = N'company'`;
    default:
      return ` (Scope = N'personal' AND CreatedByUserId = @userId) OR Scope = N'company'`;
  }
}

export async function listEvents(
  userId: number,
  view: CalendarView,
  start?: string,
  end?: string
): Promise<CalendarEventPayload[]> {
  const req = await getRequest();
  let sql = `SELECT ${COLS} FROM ${TABLE} WHERE ${viewCondition(view, userId)}`;
  if (start && end) {
    sql += ` AND [Start] < @end AND ([End] IS NULL OR [End] > @start)`;
  } else if (start) {
    sql += ` AND ([End] IS NULL OR [End] >= @start)`;
  } else if (end) {
    sql += ` AND [Start] <= @end`;
  }
  sql += ` ORDER BY [Start]`;
  let r = req.input('userId', userId);
  if (start) r = r.input('start', start);
  if (end) r = r.input('end', end);
  const result = await r.query(sql);
  const rows = (result.recordset || []) as CalendarEventRow[];
  return rows.map(toPayload);
}

export async function listAvailabilityEvents(
  targetUserId: number,
  start?: string,
  end?: string
): Promise<CalendarEventPayload[]> {
  const req = await getRequest();
  let sql = `SELECT ${COLS} FROM ${TABLE} WHERE CreatedByUserId = @userId AND (Scope = N'personal' OR Scope = N'company')`;
  if (start && end) {
    sql += ` AND [Start] < @end AND ([End] IS NULL OR [End] > @start)`;
  } else if (start) {
    sql += ` AND ([End] IS NULL OR [End] >= @start)`;
  } else if (end) {
    sql += ` AND [Start] <= @end`;
  }
  sql += ` ORDER BY [Start]`;
  let r = req.input('userId', targetUserId);
  if (start) r = r.input('start', start);
  if (end) r = r.input('end', end);
  const result = await r.query(sql);
  const rows = (result.recordset || []) as CalendarEventRow[];
  return rows.map(toPayload);
}

export async function getEventById(id: number): Promise<CalendarEventPayload | null> {
  const req = await getRequest();
  const result = await req
    .input('id', id)
    .query(`SELECT ${COLS} FROM ${TABLE} WHERE Id = @id`);
  const row = (result.recordset as CalendarEventRow[])?.[0];
  return row ? toPayload(row) : null;
}

export async function createEvent(data: {
  title: string;
  start: string;
  end?: string | null;
  allDay: boolean;
  category: CalendarCategory;
  scope: CalendarScope;
  reminderMinutes?: number | null;
  createdByUserId: number;
}): Promise<CalendarEventPayload> {
  const req = await getRequest();
  const end = data.end && data.end.trim() !== '' ? data.end : null;
  const scope = data.scope === 'company' ? 'company' : 'personal';
  const reminder = data.reminderMinutes != null && data.reminderMinutes >= 0 ? data.reminderMinutes : null;
  const result = await req
    .input('title', data.title.trim())
    .input('start', data.start)
    .input('end', end)
    .input('allDay', data.allDay)
    .input('category', data.category)
    .input('scope', scope)
    .input('reminderMinutes', reminder)
    .input('createdByUserId', data.createdByUserId)
    .query(`
      INSERT INTO ${TABLE} (Title, [Start], [End], AllDay, Category, Scope, ReminderMinutes, CreatedByUserId, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.[Start], INSERTED.[End], INSERTED.AllDay, INSERTED.Category, INSERTED.Scope, INSERTED.ReminderMinutes, INSERTED.CreatedByUserId, INSERTED.CreatedAt, INSERTED.UpdatedAt
      VALUES (@title, @start, @end, @allDay, @category, @scope, @reminderMinutes, @createdByUserId, SYSDATETIME(), SYSDATETIME())
    `);
  const row = (result.recordset as CalendarEventRow[])?.[0];
  if (!row) throw new Error('Insert failed');
  return toPayload(row);
}

export async function updateEvent(
  id: number,
  data: {
    title?: string;
    start?: string;
    end?: string | null;
    allDay?: boolean;
    category?: CalendarCategory;
    scope?: CalendarScope;
    reminderMinutes?: number | null;
  }
): Promise<CalendarEventPayload | null> {
  const existing = await getEventById(id);
  if (!existing) return null;
  const title = data.title !== undefined ? data.title.trim() : existing.title;
  const start = data.start !== undefined ? data.start : existing.start;
  const end = data.end !== undefined ? (data.end && data.end.trim() !== '' ? data.end : null) : existing.end;
  const allDay = data.allDay !== undefined ? data.allDay : existing.allDay;
  const category = data.category !== undefined ? data.category : existing.category;
  const scope = data.scope !== undefined ? (data.scope === 'company' ? 'company' : 'personal') : existing.scope;
  const reminderMinutes = data.reminderMinutes !== undefined
    ? (data.reminderMinutes != null && data.reminderMinutes >= 0 ? data.reminderMinutes : null)
    : existing.reminderMinutes;
  const req = await getRequest();
  await req
    .input('id', id)
    .input('title', title)
    .input('start', start)
    .input('end', end)
    .input('allDay', allDay)
    .input('category', category)
    .input('scope', scope)
    .input('reminderMinutes', reminderMinutes)
    .query(`
      UPDATE ${TABLE}
      SET Title = @title, [Start] = @start, [End] = @end, AllDay = @allDay, Category = @category, Scope = @scope, ReminderMinutes = @reminderMinutes, UpdatedAt = SYSDATETIME()
      WHERE Id = @id
    `);
  return getEventById(id);
}

export async function deleteEvent(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${TABLE} WHERE Id = @id`);
  return (result.rowsAffected?.[0] ?? 0) > 0;
}

export async function listCalendarUsers(): Promise<CalendarUserRow[]> {
  const req = await getRequest();
  const result = await req.query(`
    SELECT UserId AS userId, Name AS name, Email AS email
    FROM ${USERS_TABLE}
    WHERE IsActive = 1
    ORDER BY Name
  `);
  return (result.recordset || []) as CalendarUserRow[];
}
