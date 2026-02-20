/**
 * User feed service: targeted announcements for the current user.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { FeedItem, AttachmentRow, PollRow } from './announcements.types';
import * as pollService from './announcementPoll.service';
import { cache, TTL } from './cache';

const S = config.db.schema || 'dbo';
const MASTER     = `[${S}].[utbl_Announcements_Master]`;
const CATEGORY   = `[${S}].[utbl_Announcements_Category]`;
const AUDIENCE   = `[${S}].[utbl_Announcements_Audience]`;
const READLOG    = `[${S}].[utbl_Announcements_ReadLog]`;
const ATTACHMENT = `[${S}].[utbl_Announcements_Attachment]`;
const POLL       = `[${S}].[utbl_Announcements_Poll]`;

function iso(d: unknown): string { return d instanceof Date ? d.toISOString() : String(d ?? ''); }
function isoOrNull(d: unknown): string | null { return d == null ? null : iso(d); }

/**
 * Inline user-targeting WHERE clause (correlated to a.Id)
 */
function targetingWhere(paramName: string): string {
  return `(
    a.IsCompanyWide = 1
    OR EXISTS (SELECT 1 FROM ${AUDIENCE} aud WHERE aud.AnnouncementId = a.Id AND aud.TargetType = 'USER' AND aud.TargetId = ${paramName})
    OR EXISTS (
      SELECT 1 FROM ${AUDIENCE} aud
      INNER JOIN [${S}].[utbl_UserBranchAccess] uba ON aud.TargetType = 'BRANCH' AND uba.BranchId = aud.TargetId AND uba.UserID = ${paramName} AND uba.IsActive = 1
      WHERE aud.AnnouncementId = a.Id
    )
    OR EXISTS (
      SELECT 1 FROM ${AUDIENCE} aud
      INNER JOIN [${S}].[hrms_EmployeeProfile] ep ON aud.TargetType = 'DEPARTMENT' AND ep.OrgDepartmentId = aud.TargetId AND ep.UserID = ${paramName}
      WHERE aud.AnnouncementId = a.Id
    )
    OR EXISTS (
      SELECT 1 FROM ${AUDIENCE} aud
      INNER JOIN [${S}].[utbl_Org_TeamMember] tm ON aud.TargetType = 'TEAM' AND tm.TeamId = aud.TargetId AND tm.UserId = ${paramName} AND tm.LeftAt IS NULL
      WHERE aud.AnnouncementId = a.Id
    )
    OR EXISTS (
      SELECT 1 FROM ${AUDIENCE} aud
      INNER JOIN [${S}].[hrms_EmployeeProfile] ep ON aud.TargetType = 'DESIGNATION' AND ep.OrgDesignationId = aud.TargetId AND ep.UserID = ${paramName}
      WHERE aud.AnnouncementId = a.Id
    )
    OR EXISTS (
      SELECT 1 FROM ${AUDIENCE} aud
      INNER JOIN [${S}].[react_UserRoles] ur ON aud.TargetType = 'ROLE' AND ur.RoleID = aud.TargetId AND ur.UserID = ${paramName} AND ur.RevokedAt IS NULL
      WHERE aud.AnnouncementId = a.Id
    )
  )`;
}

interface FeedFilters {
  tab?: 'all' | 'unread' | 'acknowledgment' | 'archived';
  page?: number;
  pageSize?: number;
}

export async function getUserFeed(userId: number, filters: FeedFilters = {}): Promise<{ data: FeedItem[]; total: number }> {
  const page = filters.page || 1;
  const pageSize = Math.min(filters.pageSize || 20, 100);
  const tab = filters.tab || 'all';

  let statusCondition = 'a.Status = 4';
  let publishCondition = '(a.PublishFrom IS NULL OR a.PublishFrom <= GETDATE()) AND (a.PublishTo IS NULL OR a.PublishTo > GETDATE())';
  let extraCondition = '';

  if (tab === 'unread') {
    extraCondition = `AND NOT EXISTS (SELECT 1 FROM ${READLOG} r2 WHERE r2.AnnouncementId = a.Id AND r2.UserId = @userId)`;
  } else if (tab === 'acknowledgment') {
    extraCondition = `AND a.RequireAcknowledgment = 1 AND NOT EXISTS (SELECT 1 FROM ${READLOG} r4 WHERE r4.AnnouncementId = a.Id AND r4.UserId = @userId AND r4.AcknowledgedAt IS NOT NULL)`;
  } else if (tab === 'archived') {
    statusCondition = 'a.Status = 5';
    publishCondition = '1=1';
  }

  const oneTimeExclude = `AND (a.IsOneTimeView = 0 OR NOT EXISTS (SELECT 1 FROM ${READLOG} r3 WHERE r3.AnnouncementId = a.Id AND r3.UserId = @userId))`;
  const otFilter = tab === 'archived' ? '' : oneTimeExclude;

  const whereClause = `
    WHERE ${statusCondition}
      AND ${publishCondition}
      AND ${targetingWhere('@userId')}
      ${extraCondition}
      ${otFilter}
  `;

  const [countResult, result] = await Promise.all([
    (async () => {
      const r = await getRequest();
      r.input('userId', userId);
      return r.query(`
        SELECT COUNT(DISTINCT a.Id) AS total
        FROM ${MASTER} a
        LEFT JOIN ${READLOG} rl ON rl.AnnouncementId = a.Id AND rl.UserId = @userId
        ${whereClause}
      `);
    })(),
    (async () => {
      const r = await getRequest();
      r.input('userId', userId);
      r.input('offset', (page - 1) * pageSize);
      r.input('pageSize', pageSize);
      return r.query(`
        ;WITH CTE AS (
          SELECT
            a.Id AS id, a.Title AS title, a.Content AS content, a.ContentPlainText AS contentPlainText,
            a.CategoryId AS categoryId, c.Name AS categoryName, c.Icon AS categoryIcon, c.ColorCode AS categoryColor,
            a.Priority AS priority, a.Status AS status,
            a.IsPinned AS isPinned, a.PinnedOrder AS pinnedOrder,
            a.IsOneTimeView AS isOneTimeView, a.RequireAcknowledgment AS requireAcknowledgment,
            a.IsEmergency AS isEmergency, a.IsCompanyWide AS isCompanyWide,
            a.PublishFrom AS publishFrom, a.PublishTo AS publishTo, a.PublishedAt AS publishedAt,
            a.ApprovedBy AS approvedBy, NULL AS approvedByName, a.ApprovedAt AS approvedAt,
            a.RejectedReason AS rejectedReason,
            a.HasPoll AS hasPoll, a.HasFeedback AS hasFeedback,
            a.ReminderEnabled AS reminderEnabled, a.ReminderIntervalHours AS reminderIntervalHours,
            a.ReminderMaxCount AS reminderMaxCount, a.CurrentVersion AS currentVersion,
            a.CreatedAt AS createdAt, a.CreatedBy AS createdBy, creator.Name AS createdByName,
            a.UpdatedAt AS updatedAt, a.UpdatedBy AS updatedBy,
            CASE WHEN rl.Id IS NOT NULL THEN 1 ELSE 0 END AS isRead,
            CASE WHEN rl.AcknowledgedAt IS NOT NULL THEN 1 ELSE 0 END AS isAcknowledged,
            ROW_NUMBER() OVER (ORDER BY a.IsPinned DESC, a.PinnedOrder ASC, a.Priority DESC, a.PublishedAt DESC) AS rn
          FROM ${MASTER} a
          LEFT JOIN ${CATEGORY} c ON c.Id = a.CategoryId
          LEFT JOIN [${S}].[utbl_Users_Master] creator ON creator.UserId = a.CreatedBy
          LEFT JOIN ${READLOG} rl ON rl.AnnouncementId = a.Id AND rl.UserId = @userId
          ${whereClause}
        )
        SELECT * FROM CTE WHERE rn > @offset AND rn <= @offset + @pageSize
      `);
    })(),
  ]);

  const total = countResult.recordset[0]?.total || 0;
  const rows = result.recordset as any[];

  if (!rows.length) return { data: [], total };

  const ids = rows.map((r: any) => r.id);
  const idList = ids.join(',');

  const [attachRes, pollRes, respRes] = await Promise.all([
    (async () => {
      const r = await getRequest();
      return r.query(`
        SELECT Id AS id, AnnouncementId AS announcementId, FileName AS fileName,
               FilePath AS filePath, FileSize AS fileSize, MimeType AS mimeType,
               UploadedAt AS uploadedAt, UploadedBy AS uploadedBy
        FROM ${ATTACHMENT} WHERE AnnouncementId IN (${idList})
      `);
    })(),
    (async () => {
      const r = await getRequest();
      return r.query(`
        SELECT Id AS id, AnnouncementId AS announcementId, Question AS question,
               PollType AS pollType, Options AS options, IsActive AS isActive, CreatedAt AS createdAt
        FROM ${POLL} WHERE AnnouncementId IN (${idList}) AND IsActive = 1 ORDER BY CreatedAt
      `);
    })(),
    (async () => {
      const r = await getRequest();
      r.input('userId2', userId);
      return r.query(`
        SELECT pr.PollId AS pollId, pr.SelectedOption AS selectedOption, p.AnnouncementId AS announcementId
        FROM [${S}].[utbl_Announcements_PollResponse] pr
        INNER JOIN ${POLL} p ON p.Id = pr.PollId
        WHERE p.AnnouncementId IN (${idList}) AND pr.UserId = @userId2
      `);
    })(),
  ]);

  const attachMap = new Map<number, any[]>();
  for (const a of attachRes.recordset) {
    const list = attachMap.get(a.announcementId) || [];
    list.push(a);
    attachMap.set(a.announcementId, list);
  }

  const pollMap = new Map<number, any[]>();
  for (const p of pollRes.recordset) {
    const parsed = { ...p, options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options };
    const list = pollMap.get(p.announcementId) || [];
    list.push(parsed);
    pollMap.set(p.announcementId, list);
  }

  const respMap = new Map<number, { pollId: number; selectedOption: string }[]>();
  for (const r of respRes.recordset) {
    const list = respMap.get(r.announcementId) || [];
    list.push({ pollId: r.pollId, selectedOption: r.selectedOption });
    respMap.set(r.announcementId, list);
  }

  const feedItems: FeedItem[] = rows.map((row: any) => ({
    ...row,
    createdAt: iso(row.createdAt),
    updatedAt: isoOrNull(row.updatedAt),
    publishFrom: isoOrNull(row.publishFrom),
    publishTo: isoOrNull(row.publishTo),
    publishedAt: isoOrNull(row.publishedAt),
    approvedAt: isoOrNull(row.approvedAt),
    isRead: !!row.isRead,
    isAcknowledged: !!row.isAcknowledged,
    attachments: attachMap.get(row.id) || [],
    polls: pollMap.get(row.id) || [],
    myPollResponses: respMap.get(row.id) || [],
  }));

  return { data: feedItems, total };
}

export async function getEmergencyAnnouncements(userId: number): Promise<FeedItem[]> {
  const CACHE_KEY = `emergency:${userId}`;
  const cached = cache.get<FeedItem[]>(CACHE_KEY);
  if (cached) return cached;

  const req = await getRequest();
  req.input('userId', userId);
  const result = await req.query(`
    SELECT a.Id AS id, a.Title AS title, a.Content AS content, a.ContentPlainText AS contentPlainText,
           a.CategoryId AS categoryId, c.Name AS categoryName, c.Icon AS categoryIcon, c.ColorCode AS categoryColor,
           a.Priority AS priority, a.Status AS status,
           a.IsPinned AS isPinned, a.PinnedOrder AS pinnedOrder,
           a.IsOneTimeView AS isOneTimeView, a.RequireAcknowledgment AS requireAcknowledgment,
           a.IsEmergency AS isEmergency, a.IsCompanyWide AS isCompanyWide,
           a.PublishFrom AS publishFrom, a.PublishTo AS publishTo, a.PublishedAt AS publishedAt,
           a.ApprovedBy AS approvedBy, NULL AS approvedByName, a.ApprovedAt AS approvedAt,
           a.RejectedReason AS rejectedReason,
           a.HasPoll AS hasPoll, a.HasFeedback AS hasFeedback,
           a.ReminderEnabled AS reminderEnabled, a.ReminderIntervalHours AS reminderIntervalHours,
           a.ReminderMaxCount AS reminderMaxCount, a.CurrentVersion AS currentVersion,
           a.CreatedAt AS createdAt, a.CreatedBy AS createdBy, creator.Name AS createdByName,
           a.UpdatedAt AS updatedAt, a.UpdatedBy AS updatedBy,
           CASE WHEN rl.AcknowledgedAt IS NOT NULL THEN 1 ELSE 0 END AS isAcknowledged
    FROM ${MASTER} a
    LEFT JOIN ${CATEGORY} c ON c.Id = a.CategoryId
    LEFT JOIN [${S}].[utbl_Users_Master] creator ON creator.UserId = a.CreatedBy
    LEFT JOIN ${READLOG} rl ON rl.AnnouncementId = a.Id AND rl.UserId = @userId
    WHERE a.Status = 4 AND a.IsEmergency = 1
      AND (a.PublishFrom IS NULL OR a.PublishFrom <= GETDATE())
      AND (a.PublishTo IS NULL OR a.PublishTo > GETDATE())
      AND ${targetingWhere('@userId')}
      AND (rl.AcknowledgedAt IS NULL)
    ORDER BY a.Priority DESC, a.PublishedAt DESC
  `);

  const items = result.recordset.map((row: any) => ({
    ...row,
    createdAt: iso(row.createdAt),
    updatedAt: isoOrNull(row.updatedAt),
    publishFrom: isoOrNull(row.publishFrom),
    publishTo: isoOrNull(row.publishTo),
    publishedAt: isoOrNull(row.publishedAt),
    approvedAt: isoOrNull(row.approvedAt),
    isRead: true,
    isAcknowledged: !!row.isAcknowledged,
    attachments: [],
    polls: [],
    myPollResponses: [],
  }));
  cache.set(CACHE_KEY, items, TTL.EMERGENCY);
  return items;
}

export async function getFeedbackForAnnouncement(announcementId: number): Promise<any[]> {
  const req = await getRequest();
  req.input('annId', announcementId);
  const result = await req.query(`
    SELECT f.Id AS id, f.AnnouncementId AS announcementId,
           f.UserId AS userId, u.Name AS userName,
           f.Comment AS comment, f.CreatedAt AS createdAt
    FROM [${S}].[utbl_Announcements_Feedback] f
    LEFT JOIN [${S}].[utbl_Users_Master] u ON u.UserId = f.UserId
    WHERE f.AnnouncementId = @annId
    ORDER BY f.CreatedAt DESC
  `);
  return result.recordset;
}

export async function addFeedback(announcementId: number, userId: number, comment: string): Promise<number> {
  const req = await getRequest();
  req.input('annId', announcementId);
  req.input('userId', userId);
  req.input('comment', comment.trim().slice(0, 1000));
  const result = await req.query(`
    INSERT INTO [${S}].[utbl_Announcements_Feedback] (AnnouncementId, UserId, Comment)
    OUTPUT INSERTED.Id
    VALUES (@annId, @userId, @comment)
  `);
  return result.recordset[0].Id;
}
