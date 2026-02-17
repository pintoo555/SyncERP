const STORAGE_KEY = 'app_session_id';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id || id.length > 64) {
      id = generateId();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return generateId();
  }
}
