/**
 * Tracks "last activity" (e.g. last API request) for footer "Last account activity: X ago".
 */
let lastActivityAt = 0;
const listeners = new Set<() => void>();

export function touch(): void {
  lastActivityAt = Date.now();
  listeners.forEach((cb) => cb());
}

export function getLastActivityAt(): number {
  return lastActivityAt;
}

export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
