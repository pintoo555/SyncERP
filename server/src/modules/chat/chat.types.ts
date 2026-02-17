/**
 * Chat module types.
 */

/** Reaction on a message: emoji and whether current user used it. */
export interface ChatMessageReaction {
  emoji: string;
  count: number;
  you: boolean;
}

export interface ChatMessageRow {
  messageId: number;
  senderUserId: number;
  receiverUserId: number;
  messageText: string;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  senderName: string;
  receiverName: string;
  attachmentFileId?: number | null;
  attachmentFileName?: string | null;
  attachmentMimeType?: string | null;
  attachmentAccessToken?: string | null;
  replyToMessageId?: number | null;
  replyToPreview?: string | null;
  replyToSenderName?: string | null;
  reactions?: ChatMessageReaction[];
  isStarred?: boolean;
  isPinned?: boolean;
  isDeleted?: boolean;
}

export interface ConversationRow {
  userId: number;
  name: string;
  email: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount?: number;
}
