/**
 * Re-export from modules/chat for backward compatibility.
 */
export {
  getConversations,
  markMessagesDelivered,
  markMessagesRead,
  markAllMessagesRead,
  getUnreadCount,
  canAccessChatFile,
  getLastSeen,
  updateLastSeen,
  getMessages,
  sendMessage,
  getMessageById,
  setReaction,
  removeReaction,
  getMessageParticipants,
  getReactionsForMessage,
  forwardMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  starMessage,
  unstarMessage,
  pinMessage,
  unpinMessage,
} from '../modules/chat/chat.service';
export type { ChatMessageReaction, ChatMessageRow, ConversationRow } from '../modules/chat/chat.types';
