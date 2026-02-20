/* ------------------------------------------------------------------ */
/*  Lead Management CRM – shared TypeScript types                      */
/* ------------------------------------------------------------------ */

// ==================== Stage ====================
export interface LeadStage {
  stageId: number;
  stageName: string;
  stageOrder: number;
  color: string;
  isDefault: boolean;
  isWon: boolean;
  isLost: boolean;
  isActive: boolean;
}

export interface LeadStageCreate {
  stageName: string;
  stageOrder?: number;
  color?: string;
  isDefault?: boolean;
  isWon?: boolean;
  isLost?: boolean;
}

export interface LeadStageUpdate {
  stageName?: string;
  stageOrder?: number;
  color?: string;
  isDefault?: boolean;
  isWon?: boolean;
  isLost?: boolean;
  isActive?: boolean;
}

// ==================== Source ====================
export interface LeadSource {
  sourceId: number;
  sourceName: string;
  sourceCategory: string;
  isActive: boolean;
}

export interface LeadSourceCreate {
  sourceName: string;
  sourceCategory: string;
}

export interface LeadSourceUpdate {
  sourceName?: string;
  sourceCategory?: string;
  isActive?: boolean;
}

// ==================== Lead ====================
export interface LeadRow {
  leadId: number;
  leadCode: string;
  companyName: string | null;
  contactName: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  whatsAppNumber: string | null;
  industryId: number | null;
  industryName: string | null;
  clientType: string | null;
  sourceId: number | null;
  sourceName: string | null;
  stageId: number;
  stageName: string;
  stageColor: string;
  stageIsWon: boolean;
  stageIsLost: boolean;
  assignedToUserId: number | null;
  assignedToName: string | null;
  estimatedValue: number | null;
  currency: string;
  expectedCloseDate: string | null;
  aiScore: number | null;
  aiScoreLabel: string | null;
  aiScoredAt: string | null;
  convertedToClientId: number | null;
  convertedAt: string | null;
  lostReason: string | null;
  lostAt: string | null;
  tags: string | null;
  notes: string | null;
  gstNumber: string | null;
  city: string | null;
  isActive: boolean;
  createdOn: string;
  createdBy: number | null;
  updatedOn: string | null;
  updatedBy: number | null;
}

export interface LeadListFilters {
  search?: string;
  stageId?: number;
  sourceId?: number;
  assignedToUserId?: number;
  aiScoreLabel?: string;
  clientType?: string;
  isActive?: boolean;
  hasConversion?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

export interface LeadCreateData {
  companyName?: string;
  contactName: string;
  designation?: string;
  email?: string;
  phone?: string;
  whatsAppNumber?: string;
  industryId?: number;
  clientType?: string;
  sourceId?: number;
  stageId?: number;
  assignedToUserId?: number;
  estimatedValue?: number;
  currency?: string;
  expectedCloseDate?: string;
  tags?: string;
  notes?: string;
  gstNumber?: string;
  city?: string;
  stateId?: number;
  countryId?: number;
}

export interface LeadUpdateData {
  companyName?: string;
  contactName?: string;
  designation?: string;
  email?: string;
  phone?: string;
  whatsAppNumber?: string;
  industryId?: number | null;
  clientType?: string | null;
  sourceId?: number | null;
  assignedToUserId?: number | null;
  estimatedValue?: number | null;
  currency?: string;
  expectedCloseDate?: string | null;
  tags?: string | null;
  notes?: string | null;
  gstNumber?: string | null;
  city?: string | null;
  stateId?: number | null;
  countryId?: number | null;
}

// ==================== Activity ====================
export type ActivityType =
  | 'NOTE' | 'CALL' | 'EMAIL_SENT' | 'EMAIL_RECEIVED'
  | 'WHATSAPP_SENT' | 'WHATSAPP_RECEIVED'
  | 'SOCIAL_SENT' | 'SOCIAL_RECEIVED'
  | 'STAGE_CHANGE' | 'SCORE_CHANGE'
  | 'MEETING' | 'TASK' | 'SYSTEM' | 'WEBHOOK_CAPTURE';

export interface LeadActivity {
  activityId: number;
  leadId: number;
  activityType: ActivityType;
  subject: string | null;
  description: string | null;
  fromStageId: number | null;
  fromStageName: string | null;
  toStageId: number | null;
  toStageName: string | null;
  conversationId: number | null;
  createdOn: string;
  createdBy: number | null;
  createdByName: string | null;
}

export interface LeadActivityCreate {
  activityType: ActivityType;
  subject?: string;
  description?: string;
  fromStageId?: number;
  toStageId?: number;
  conversationId?: number;
  communicationRef?: string;
}

// ==================== Score ====================
export interface LeadScore {
  scoreId: number;
  leadId: number;
  score: number;
  label: string;
  reasoning: string | null;
  model: string | null;
  createdOn: string;
}

// ==================== Reminder ====================
export interface LeadReminder {
  reminderId: number;
  leadId: number;
  reminderDate: string;
  reminderText: string;
  isCompleted: boolean;
  completedAt: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdOn: string;
}

export interface LeadReminderCreate {
  reminderDate: string;
  reminderText: string;
}

// ==================== Product ====================
export interface LeadProduct {
  leadProductId: number;
  leadId: number;
  productName: string;
  description: string | null;
  estimatedValue: number | null;
  createdOn: string;
}

export interface LeadProductCreate {
  productName: string;
  description?: string;
  estimatedValue?: number;
}

// ==================== Webhook ====================
export interface LeadWebhook {
  webhookId: number;
  webhookName: string;
  apiKey: string;
  sourceId: number;
  sourceName: string;
  defaultStageId: number | null;
  defaultStageName: string | null;
  defaultAssignedToUserId: number | null;
  defaultAssignedToName: string | null;
  fieldMapping: Record<string, string> | null;
  isActive: boolean;
  totalLeadsReceived: number;
  lastReceivedAt: string | null;
  createdOn: string;
}

export interface LeadWebhookCreate {
  webhookName: string;
  sourceId: number;
  defaultStageId?: number;
  defaultAssignedToUserId?: number;
  fieldMapping?: Record<string, string>;
}

export interface LeadWebhookUpdate {
  webhookName?: string;
  sourceId?: number;
  defaultStageId?: number | null;
  defaultAssignedToUserId?: number | null;
  fieldMapping?: Record<string, string> | null;
  isActive?: boolean;
}

// ==================== Inbox Channel ====================
export type InboxChannelType = 'whatsapp' | 'email' | 'facebook_messenger' | 'instagram';

export interface InboxChannel {
  inboxChannelId: number;
  channelType: InboxChannelType;
  displayName: string;
  isActive: boolean;
  isDefault: boolean;
  communicationChannelId: number | null;
  emailAddress: string | null;
  metaPageId: string | null;
  metaInstagramAccountId: string | null;
  createdOn: string;
}

// ==================== Conversation ====================
export type ConversationStatus = 'Open' | 'Pending' | 'Resolved' | 'Snoozed';

export interface Conversation {
  conversationId: number;
  inboxChannelId: number;
  channelType: InboxChannelType;
  channelDisplayName: string;
  externalPhone: string | null;
  externalEmail: string | null;
  externalSocialId: string | null;
  externalSocialUsername: string | null;
  externalSocialProfilePic: string | null;
  externalName: string | null;
  leadId: number | null;
  leadCode: string | null;
  leadCompanyName: string | null;
  clientId: number | null;
  clientName: string | null;
  isExistingClient: boolean;
  status: ConversationStatus;
  snoozedUntil: string | null;
  assignedToUserId: number | null;
  assignedToName: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  isActive: boolean;
  createdOn: string;
}

export interface ConversationMessage {
  messageId: number;
  conversationId: number;
  direction: 'INBOUND' | 'OUTBOUND';
  isInternal: boolean;
  senderUserId: number | null;
  senderName: string | null;
  messageText: string | null;
  messageHtml: string | null;
  subject: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  isForwarded: boolean;
  originalSenderEmail: string | null;
  originalSenderName: string | null;
  createdOn: string;
}

// ==================== Paginated Result ====================
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
