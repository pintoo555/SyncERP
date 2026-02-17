/**
 * Chat module API.
 */
import { api } from '../../../shared/api/baseClient';

export const chatApi = {
  getUsers: () => api.get<{ success: boolean; data: unknown[] }>('/api/chat/users'),
  getConversations: () => api.get<{ success: boolean; data: unknown[] }>('/api/chat/conversations'),
  getMessages: (withUserId: number, before?: number, limit = 40) => {
    const params = new URLSearchParams({ with: String(withUserId), limit: String(limit) });
    if (before) params.set('before', String(before));
    return api.get<{ success: boolean; data: unknown[] }>(`/api/chat/messages?${params}`);
  },
  sendMessage: (body: { toUserId: number; text: string }) =>
    api.post<{ success: boolean; data: unknown }>('/api/chat/send', body),
  markRead: (withUserId: number) =>
    api.post('/api/chat/mark-read', { withUserId }),
  getUnreadCount: () =>
    api.get<{ success: boolean; data: { total: number } }>('/api/chat/unread-count'),
};
