/**
 * Core announcement service: CRUD, status transitions, and category management.
 */

import sql from 'mssql';
import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type {
  AnnouncementRow, AnnouncementCreateData, AnnouncementUpdateData,
  AnnouncementListFilters, CategoryRow, CategoryCreateData,
  PaginatedResult, STATUS,
} from './announcements.types';
import { cache, TTL } from './cache';

const S = config.db.schema || 'dbo';
const MASTER   = `[${S}].[utbl_Announcements_Master]`;
const CATEGORY = `[${S}].[utbl_Announcements_Category]`;
const AUDIENCE = `[${S}].[utbl_Announcements_Audience]`;
const VERSION  = `[${S}].[utbl_Announcements_Version]`;

function iso(d: unknown): string { return d instanceof Date ? d.toISOString() : String(d ?? ''); }
function isoOrNull(d: unknown): string | null { return d == null ? null : iso(d); }

/** Convert a date-like value to a JS Date or null for safe MSSQL DateTime binding. */
function toDateOrNull(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

const READLOG = `[${S}].[utbl_Announcements_ReadLog]`;

const ANN_COLUMNS = `
  a.Id AS id, a.Title AS title, a.Content AS content, a.ContentPlainText AS contentPlainText,
  a.CategoryId AS categoryId, c.Name AS categoryName, c.Icon AS categoryIcon, c.ColorCode AS categoryColor,
  a.Priority AS priority, a.Status AS status,
  a.IsPinned AS isPinned, a.PinnedOrder AS pinnedOrder,
  a.IsOneTimeView AS isOneTimeView, a.RequireAcknowledgment AS requireAcknowledgment,
  a.IsEmergency AS isEmergency, a.IsCompanyWide AS isCompanyWide,
  a.PublishFrom AS publishFrom, a.PublishTo AS publishTo, a.PublishedAt AS publishedAt,
  a.ApprovedBy AS approvedBy, approver.Name AS approvedByName, a.ApprovedAt AS approvedAt,
  a.RejectedReason AS rejectedReason,
  a.HasPoll AS hasPoll, a.HasFeedback AS hasFeedback,
  a.ReminderEnabled AS reminderEnabled, a.ReminderIntervalHours AS reminderIntervalHours,
  a.ReminderMaxCount AS reminderMaxCount, a.CurrentVersion AS currentVersion,
  a.CreatedAt AS createdAt, a.CreatedBy AS createdBy, creator.Name AS createdByName,
  a.UpdatedAt AS updatedAt, a.UpdatedBy AS updatedBy,
  (SELECT COUNT(DISTINCT UserId) FROM ${READLOG} WHERE AnnouncementId = a.Id) AS readCount
`;

const ANN_JOINS = `
  FROM ${MASTER} a
  LEFT JOIN ${CATEGORY} c ON c.Id = a.CategoryId
  LEFT JOIN [${S}].[utbl_Users_Master] approver ON approver.UserId = a.ApprovedBy
  LEFT JOIN [${S}].[utbl_Users_Master] creator ON creator.UserId = a.CreatedBy
`;

function mapRow(r: any): AnnouncementRow {
  return {
    ...r,
    createdAt: iso(r.createdAt),
    updatedAt: isoOrNull(r.updatedAt),
    publishFrom: isoOrNull(r.publishFrom),
    publishTo: isoOrNull(r.publishTo),
    publishedAt: isoOrNull(r.publishedAt),
    approvedAt: isoOrNull(r.approvedAt),
  };
}

const ALLOWED_SORT: Record<string, string> = {
  title: 'a.Title',
  priority: 'a.Priority',
  status: 'a.Status',
  createdAt: 'a.CreatedAt',
  publishFrom: 'a.PublishFrom',
  categoryName: 'c.Name',
};

/* ─── CRUD ─── */

export async function list(filters: AnnouncementListFilters): Promise<PaginatedResult<AnnouncementRow>> {
  const conditions: string[] = [];
  const addInputs = (r: any) => {
    if (filters.search) r.input('search', `%${filters.search}%`);
    if (filters.status !== undefined) r.input('status', filters.status);
    if (filters.categoryId) r.input('catId', filters.categoryId);
    if (filters.priority !== undefined) r.input('pri', filters.priority);
  };

  if (filters.search) conditions.push('(a.Title LIKE @search OR a.ContentPlainText LIKE @search)');
  if (filters.status !== undefined) conditions.push('a.Status = @status');
  if (filters.categoryId) conditions.push('a.CategoryId = @catId');
  if (filters.priority !== undefined) conditions.push('a.Priority = @pri');

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortCol = ALLOWED_SORT[filters.sortBy || ''] || 'a.CreatedAt';
  const sortDir = filters.sortDir === 'ASC' ? 'ASC' : 'DESC';
  const offset = (filters.page - 1) * filters.pageSize;

  const countReq = await getRequest();
  addInputs(countReq);
  const countResult = await countReq.query(`SELECT COUNT(*) AS total ${ANN_JOINS} ${where}`);
  const total = countResult.recordset[0]?.total || 0;

  const dataReq = await getRequest();
  addInputs(dataReq);
  dataReq.input('offset', offset);
  dataReq.input('pageSize', filters.pageSize);

  const dataResult = await dataReq.query(`
    ;WITH CTE AS (
      SELECT ${ANN_COLUMNS},
             ROW_NUMBER() OVER (ORDER BY ${sortCol} ${sortDir}) AS rn
      ${ANN_JOINS} ${where}
    )
    SELECT * FROM CTE WHERE rn > @offset AND rn <= @offset + @pageSize
  `);

  return {
    total,
    data: (dataResult.recordset as any[]).map(mapRow),
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getById(id: number): Promise<AnnouncementRow | null> {
  const req = await getRequest();
  req.input('id', id);
  const result = await req.query(`SELECT ${ANN_COLUMNS} ${ANN_JOINS} WHERE a.Id = @id`);
  const row = result.recordset[0];
  return row ? mapRow(row) : null;
}

export async function create(data: AnnouncementCreateData, userId: number): Promise<number> {
  const req = await getRequest();
  req.input('title', (data.title || '').trim().slice(0, 300));
  req.input('content', data.content || '');
  req.input('plainText', (data.contentPlainText || '').slice(0, 8000));
  req.input('categoryId', data.categoryId);
  req.input('priority', data.priority ?? 1);
  req.input('isPinned', data.isPinned ? 1 : 0);
  req.input('pinnedOrder', data.pinnedOrder ?? null);
  req.input('isOneTimeView', data.isOneTimeView ? 1 : 0);
  req.input('requireAck', data.requireAcknowledgment ? 1 : 0);
  req.input('isEmergency', data.isEmergency ? 1 : 0);
  req.input('isCompanyWide', data.isCompanyWide ? 1 : 0);
  req.input('publishFrom', sql.DateTime, toDateOrNull(data.publishFrom));
  req.input('publishTo', sql.DateTime, toDateOrNull(data.publishTo));
  req.input('hasPoll', data.hasPoll ? 1 : 0);
  req.input('hasFeedback', data.hasFeedback ? 1 : 0);
  req.input('reminderEnabled', data.reminderEnabled ? 1 : 0);
  req.input('reminderHours', data.reminderIntervalHours ?? null);
  req.input('reminderMax', data.reminderMaxCount ?? 3);
  req.input('createdBy', userId);

  const result = await req.query(`
    INSERT INTO ${MASTER} (
      Title, Content, ContentPlainText, CategoryId, Priority, Status,
      IsPinned, PinnedOrder, IsOneTimeView, RequireAcknowledgment,
      IsEmergency, IsCompanyWide, PublishFrom, PublishTo,
      HasPoll, HasFeedback, ReminderEnabled, ReminderIntervalHours, ReminderMaxCount,
      CreatedBy
    ) OUTPUT INSERTED.Id
    VALUES (
      @title, @content, @plainText, @categoryId, @priority, 0,
      @isPinned, @pinnedOrder, @isOneTimeView, @requireAck,
      @isEmergency, @isCompanyWide, @publishFrom, @publishTo,
      @hasPoll, @hasFeedback, @reminderEnabled, @reminderHours, @reminderMax,
      @createdBy
    )
  `);
  return result.recordset[0].Id;
}

export async function update(id: number, data: AnnouncementUpdateData, userId: number): Promise<void> {
  const existing = await getById(id);
  if (!existing) throw new Error('Announcement not found');

  const isPublished = existing.status === 4;
  if (isPublished) {
    const vReq = await getRequest();
    vReq.input('annId', id);
    vReq.input('version', existing.currentVersion);
    vReq.input('title', existing.title);
    vReq.input('content', existing.content);
    vReq.input('editedBy', userId);
    vReq.input('notes', data.changeNotes || null);
    await vReq.query(`
      INSERT INTO ${VERSION} (AnnouncementId, VersionNumber, Title, Content, EditedBy, ChangeNotes)
      VALUES (@annId, @version, @title, @content, @editedBy, @notes)
    `);
  }

  const sets: string[] = [];
  const req = await getRequest();
  req.input('id', id);
  req.input('updatedBy', userId);

  if (data.title !== undefined) { req.input('title', data.title.trim().slice(0, 300)); sets.push('Title = @title'); }
  if (data.content !== undefined) { req.input('content', data.content); sets.push('Content = @content'); }
  if (data.contentPlainText !== undefined) { req.input('plainText', data.contentPlainText.slice(0, 8000)); sets.push('ContentPlainText = @plainText'); }
  if (data.categoryId !== undefined) { req.input('catId', data.categoryId); sets.push('CategoryId = @catId'); }
  if (data.priority !== undefined) { req.input('pri', data.priority); sets.push('Priority = @pri'); }
  if (data.isPinned !== undefined) { req.input('pinned', data.isPinned ? 1 : 0); sets.push('IsPinned = @pinned'); }
  if (data.pinnedOrder !== undefined) { req.input('pinnedOrd', data.pinnedOrder); sets.push('PinnedOrder = @pinnedOrd'); }
  if (data.isOneTimeView !== undefined) { req.input('otv', data.isOneTimeView ? 1 : 0); sets.push('IsOneTimeView = @otv'); }
  if (data.requireAcknowledgment !== undefined) { req.input('ack', data.requireAcknowledgment ? 1 : 0); sets.push('RequireAcknowledgment = @ack'); }
  if (data.isEmergency !== undefined) { req.input('emrg', data.isEmergency ? 1 : 0); sets.push('IsEmergency = @emrg'); }
  if (data.isCompanyWide !== undefined) { req.input('cw', data.isCompanyWide ? 1 : 0); sets.push('IsCompanyWide = @cw'); }
  if (data.publishFrom !== undefined) { req.input('pubFrom', sql.DateTime, toDateOrNull(data.publishFrom)); sets.push('PublishFrom = @pubFrom'); }
  if (data.publishTo !== undefined) { req.input('pubTo', sql.DateTime, toDateOrNull(data.publishTo)); sets.push('PublishTo = @pubTo'); }
  if (data.hasPoll !== undefined) { req.input('hp', data.hasPoll ? 1 : 0); sets.push('HasPoll = @hp'); }
  if (data.hasFeedback !== undefined) { req.input('hf', data.hasFeedback ? 1 : 0); sets.push('HasFeedback = @hf'); }
  if (data.reminderEnabled !== undefined) { req.input('re', data.reminderEnabled ? 1 : 0); sets.push('ReminderEnabled = @re'); }
  if (data.reminderIntervalHours !== undefined) { req.input('rh', data.reminderIntervalHours); sets.push('ReminderIntervalHours = @rh'); }
  if (data.reminderMaxCount !== undefined) { req.input('rm', data.reminderMaxCount); sets.push('ReminderMaxCount = @rm'); }

  if (isPublished) sets.push('CurrentVersion = CurrentVersion + 1');
  sets.push('UpdatedAt = GETDATE()', 'UpdatedBy = @updatedBy');

  await req.query(`UPDATE ${MASTER} SET ${sets.join(', ')} WHERE Id = @id`);
}

export async function updateStatus(id: number, status: number, userId: number, extra?: Record<string, any>): Promise<void> {
  const req = await getRequest();
  req.input('id', id);
  req.input('status', status);
  req.input('userId', userId);

  const sets = ['Status = @status', 'UpdatedAt = GETDATE()', 'UpdatedBy = @userId'];

  if (status === 4) sets.push('PublishedAt = GETDATE()');
  if (status === 2) { sets.push('ApprovedBy = @userId', 'ApprovedAt = GETDATE()'); }
  if (status === 3 && extra?.reason) {
    req.input('reason', String(extra.reason).slice(0, 500));
    sets.push('RejectedReason = @reason');
  }

  await req.query(`UPDATE ${MASTER} SET ${sets.join(', ')} WHERE Id = @id`);
}

export async function archiveExpired(): Promise<number> {
  const req = await getRequest();
  const result = await req.query(`
    UPDATE ${MASTER}
    SET Status = 5, UpdatedAt = GETDATE()
    WHERE Status = 4 AND PublishTo IS NOT NULL AND PublishTo < GETDATE()
  `);
  return result.rowsAffected[0];
}

/* ─── Categories ─── */

export async function listCategories(): Promise<CategoryRow[]> {
  const CACHE_KEY = 'categories:all';
  const cached = cache.get<CategoryRow[]>(CACHE_KEY);
  if (cached) return cached;

  const req = await getRequest();
  const result = await req.query(`
    SELECT Id AS id, Name AS name, Icon AS icon, ColorCode AS colorCode,
           SortOrder AS sortOrder, IsActive AS isActive, CreatedAt AS createdAt, CreatedBy AS createdBy
    FROM ${CATEGORY}
    ORDER BY SortOrder, Name
  `);
  cache.set(CACHE_KEY, result.recordset, TTL.CATEGORIES);
  return result.recordset;
}

export async function createCategory(data: CategoryCreateData, userId: number): Promise<number> {
  const req = await getRequest();
  req.input('name', data.name.trim().slice(0, 100));
  req.input('icon', data.icon || null);
  req.input('color', data.colorCode || null);
  req.input('sort', data.sortOrder ?? 0);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${CATEGORY} (Name, Icon, ColorCode, SortOrder, CreatedBy)
    OUTPUT INSERTED.Id
    VALUES (@name, @icon, @color, @sort, @createdBy)
  `);
  cache.invalidate('categories:');
  return result.recordset[0].Id;
}

export async function updateCategory(id: number, data: Partial<CategoryCreateData> & { isActive?: boolean }): Promise<void> {
  const sets: string[] = [];
  const req = await getRequest();
  req.input('id', id);
  if (data.name !== undefined) { req.input('name', data.name.trim().slice(0, 100)); sets.push('Name = @name'); }
  if (data.icon !== undefined) { req.input('icon', data.icon); sets.push('Icon = @icon'); }
  if (data.colorCode !== undefined) { req.input('color', data.colorCode); sets.push('ColorCode = @color'); }
  if (data.sortOrder !== undefined) { req.input('sort', data.sortOrder); sets.push('SortOrder = @sort'); }
  if (data.isActive !== undefined) { req.input('active', data.isActive ? 1 : 0); sets.push('IsActive = @active'); }
  if (!sets.length) return;
  await req.query(`UPDATE ${CATEGORY} SET ${sets.join(', ')} WHERE Id = @id`);
  cache.invalidate('categories:');
}

export async function deleteCategory(id: number): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  const check = await req.query(`SELECT COUNT(*) AS cnt FROM ${MASTER} WHERE CategoryId = @id`);
  if (check.recordset[0].cnt > 0) return false;
  const req2 = await getRequest();
  req2.input('id', id);
  await req2.query(`DELETE FROM ${CATEGORY} WHERE Id = @id`);
  cache.invalidate('categories:');
  return true;
}
