/**
 * Base HTTP client for all API requests.
 * Modules use this to make requests - each module has its own api file that uses baseClient.
 */
import { getOrCreateSessionId } from '../utils/sessionId';
import { touch as activityTouch } from '../utils/activityTracker';
import { getSelectedBranchId } from '../../contexts/BranchContext';

/** When set (e.g. http://server:4000), all API and socket calls use this backend. */
const API_BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
  ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '')
  : '';

/** URL for Socket.IO so all clients connect to the same backend. */
export function getSocketUrl(): string {
  return API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
}

/** Message shown when the API is unreachable. */
export const API_UNREACHABLE_MSG = 'Cannot connect to the API server. Please check that the API is running.';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const sessionId = getOrCreateSessionId();
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };
  if (sessionId) headers['X-Session-Id'] = sessionId;
  const branchId = getSelectedBranchId();
  if (branchId) headers['X-Branch-Id'] = String(branchId);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });
  } catch {
    throw new Error(API_UNREACHABLE_MSG);
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new Error(API_UNREACHABLE_MSG);
  }
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  let data: Record<string, unknown> = {};
  if (isJson) {
    data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  }
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !path.includes('/api/auth/login')) {
      const onLoginPage = window.location.pathname === '/login' || window.location.pathname.endsWith('/login');
      if (!onLoginPage) {
        window.location.href = '/login';
      }
      throw new Error((data?.error as string) || 'Session ended');
    }
    if (res.status >= 500 && !isJson) {
      throw new Error(API_UNREACHABLE_MSG);
    }
    throw new Error((data?.error as string) || res.statusText || 'Request failed');
  }
  activityTouch();
  return data as T;
}

export interface UploadProgressOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

function uploadWithProgress<T>(path: string, formData: FormData, options: UploadProgressOptions = {}): Promise<T> {
  const { onProgress, signal } = options;
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const sessionId = getOrCreateSessionId();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && typeof onProgress === 'function') {
        const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      const contentType = xhr.getResponseHeader('content-type') ?? '';
      const isJson = contentType.includes('application/json');
      let data: Record<string, unknown> = {};
      try {
        if (xhr.responseText && isJson) data = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        // ignore
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        activityTouch();
        resolve(data as T);
        return;
      }
      if (xhr.status === 401 && typeof window !== 'undefined' && !path.includes('/api/auth/login')) {
        const onLoginPage = window.location.pathname === '/login' || window.location.pathname.endsWith('/login');
        if (!onLoginPage) window.location.href = '/login';
      }
      if (xhr.status === 502 || xhr.status === 503 || xhr.status === 504) {
        reject(new Error(API_UNREACHABLE_MSG));
        return;
      }
      reject(new Error((data?.error as string) || xhr.statusText || 'Request failed'));
    });

    xhr.addEventListener('error', () => reject(new Error(API_UNREACHABLE_MSG)));
    xhr.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));

    xhr.open('POST', url);
    if (sessionId) xhr.setRequestHeader('X-Session-Id', sessionId);
    const brId = getSelectedBranchId();
    if (brId) xhr.setRequestHeader('X-Branch-Id', String(brId));
    xhr.send(formData);
  });
}

/** Base API client - modules wrap this in their own api files. */
export const api = {
  get: <T>(path: string, options?: RequestInit) => request<T>(path, options),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body == null ? undefined : body instanceof FormData ? body : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
  uploadWithProgress: <T>(path: string, formData: FormData, options?: UploadProgressOptions) =>
    uploadWithProgress<T>(path, formData, options ?? {}),
};
