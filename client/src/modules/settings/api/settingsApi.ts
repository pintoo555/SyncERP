/**
 * Settings module API.
 */
import { api } from '../../../shared/api/baseClient';

export const settingsApi = {
  getAppSettings: () => api.get<{ timeZone: string }>('/api/settings/app'),
  updateAppSettings: (timeZone: string) =>
    api.put<{ success: boolean; timeZone: string }>('/api/settings/app', { timeZone }),
  getUserPreferences: () =>
    api.get<{ idleLockMinutes: number; theme: string }>('/api/settings/user'),
  updateUserPreferences: (data: { idleLockMinutes?: number; theme?: string }) =>
    api.put<{ success: boolean }>('/api/settings/user', data),
  getSessions: () =>
    api.get<{ success: boolean; sessions: unknown[] }>('/api/auth/sessions'),
  revokeSession: (sessionId: string) =>
    api.post(`/api/auth/sessions/${sessionId}/revoke`, {}),
  getAiConfig: () => api.get<{ success: boolean; data: unknown }>('/api/ai-config'),
  updateAiConfig: (data: unknown) => api.put('/api/ai-config', data),
  getEmailSettings: () => api.get<{ success: boolean; data: unknown }>('/api/email-settings'),
  updateEmailSettings: (data: unknown) => api.put('/api/email-settings', data),
};
