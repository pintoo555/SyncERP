/**
 * Type definitions for the Announcements module.
 */

/* ─── Enums / Constants ─── */

export const PRIORITY = { LOW: 0, NORMAL: 1, IMPORTANT: 2, CRITICAL: 3 } as const;
export type PriorityValue = (typeof PRIORITY)[keyof typeof PRIORITY];

export const STATUS = {
  DRAFT: 0,
  PENDING_APPROVAL: 1,
  APPROVED: 2,
  REJECTED: 3,
  PUBLISHED: 4,
  ARCHIVED: 5,
} as const;
export type StatusValue = (typeof STATUS)[keyof typeof STATUS];

export const TARGET_TYPES = ['BRANCH', 'DEPARTMENT', 'TEAM', 'DESIGNATION', 'ROLE', 'USER'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

/* ─── Category ─── */

export interface CategoryRow {
  id: number;
  name: string;
  icon: string | null;
  colorCode: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  createdBy: number | null;
}

export interface CategoryCreateData {
  name: string;
  icon?: string;
  colorCode?: string;
  sortOrder?: number;
}

/* ─── Announcement Master ─── */

export interface AnnouncementRow {
  id: number;
  title: string;
  content: string;
  contentPlainText: string | null;
  categoryId: number;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  priority: PriorityValue;
  status: StatusValue;
  isPinned: boolean;
  pinnedOrder: number | null;
  isOneTimeView: boolean;
  requireAcknowledgment: boolean;
  isEmergency: boolean;
  isCompanyWide: boolean;
  publishFrom: string | null;
  publishTo: string | null;
  publishedAt: string | null;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  hasPoll: boolean;
  hasFeedback: boolean;
  reminderEnabled: boolean;
  reminderIntervalHours: number | null;
  reminderMaxCount: number | null;
  currentVersion: number;
  createdAt: string;
  createdBy: number;
  createdByName: string | null;
  updatedAt: string | null;
  updatedBy: number | null;
  readCount: number;
}

export interface AnnouncementCreateData {
  title: string;
  content: string;
  contentPlainText?: string;
  categoryId: number;
  priority?: PriorityValue;
  isPinned?: boolean;
  pinnedOrder?: number;
  isOneTimeView?: boolean;
  requireAcknowledgment?: boolean;
  isEmergency?: boolean;
  isCompanyWide?: boolean;
  publishFrom?: string;
  publishTo?: string;
  hasPoll?: boolean;
  hasFeedback?: boolean;
  reminderEnabled?: boolean;
  reminderIntervalHours?: number;
  reminderMaxCount?: number;
  audience?: AudienceTarget[];
  polls?: PollCreateData[];
}

export interface AnnouncementUpdateData extends Partial<AnnouncementCreateData> {
  changeNotes?: string;
}

export interface AnnouncementListFilters {
  search?: string;
  status?: number;
  categoryId?: number;
  priority?: number;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

/* ─── Audience ─── */

export interface AudienceTarget {
  targetType: TargetType;
  targetId: number;
}

export interface AudienceRow {
  id: number;
  announcementId: number;
  targetType: TargetType;
  targetId: number;
  targetName: string | null;
  createdAt: string;
}

/* ─── Read Log ─── */

export interface ReadLogRow {
  id: number;
  announcementId: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  branchName: string | null;
  departmentName: string | null;
  firstOpenedAt: string;
  lastOpenedAt: string;
  openCount: number;
  acknowledgedAt: string | null;
  timeSpentSeconds: number | null;
  deviceType: string | null;
  ipAddress: string | null;
}

export interface TrackReadData {
  announcementId: number;
  userId: number;
  deviceType?: string;
  ipAddress?: string;
  timeSpentSeconds?: number;
}

/* ─── Version ─── */

export interface VersionRow {
  id: number;
  announcementId: number;
  versionNumber: number;
  title: string;
  content: string;
  editedBy: number;
  editedByName: string | null;
  editedAt: string;
  changeNotes: string | null;
}

/* ─── Attachment ─── */

export interface AttachmentRow {
  id: number;
  announcementId: number;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: string;
  uploadedBy: number;
}

/* ─── Poll ─── */

export interface PollRow {
  id: number;
  announcementId: number;
  question: string;
  pollType: 'SINGLE' | 'MULTI';
  options: string[];
  isActive: boolean;
  createdAt: string;
}

export interface PollCreateData {
  question: string;
  pollType?: 'SINGLE' | 'MULTI';
  options: string[];
}

export interface PollResponseRow {
  id: number;
  pollId: number;
  userId: number;
  userName: string | null;
  selectedOption: string;
  respondedAt: string;
}

export interface PollResultSummary {
  pollId: number;
  question: string;
  pollType: string;
  options: string[];
  totalResponses: number;
  results: { option: string; count: number; percentage: number }[];
}

/* ─── Feedback ─── */

export interface FeedbackRow {
  id: number;
  announcementId: number;
  userId: number;
  userName: string | null;
  comment: string;
  createdAt: string;
}

/* ─── Reminder Log ─── */

export interface ReminderLogRow {
  id: number;
  announcementId: number;
  userId: number;
  reminderCount: number;
  sentAt: string;
  channel: string;
}

/* ─── Approval History ─── */

export interface ApprovalHistoryRow {
  id: number;
  announcementId: number;
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RECALLED';
  actionBy: number;
  actionByName: string | null;
  actionAt: string;
  comments: string | null;
}

/* ─── Analytics ─── */

export interface AnnouncementAnalytics {
  announcementId: number;
  totalTargeted: number;
  viewedCount: number;
  notViewedCount: number;
  acknowledgedCount: number;
  readPercentage: number;
  ackPercentage: number;
  avgTimeToFirstOpen: number | null;
}

export interface AnalyticsBySegment {
  segmentName: string;
  segmentId: number;
  targeted: number;
  viewed: number;
  acknowledged: number;
  readPercentage: number;
}

export interface AnalyticsOverview {
  totalAnnouncements: number;
  totalPublished: number;
  totalReach: number;
  avgReadRate: number;
  avgAckRate: number;
  trend: { date: string; published: number; reads: number }[];
}

/* ─── Feed ─── */

export interface FeedItem extends AnnouncementRow {
  isRead: boolean;
  isAcknowledged: boolean;
  attachments: AttachmentRow[];
  polls: PollRow[];
  myPollResponses: { pollId: number; selectedOption: string }[];
}

/* ─── Paginated ─── */

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
