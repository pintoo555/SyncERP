/**
 * In-memory store of user sessions (browser/device). Used for "Last account activity"
 * and "Currently being used in N other locations" in the footer.
 * For multi-instance deployment, replace with Redis or DB.
 */

const ACTIVE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export interface SessionRecord {
  sessionId: string;
  userId: number;
  userAgent: string;
  ipAddress: string;
  lastActivityAt: Date;
  createdAt: Date;
}

const store = new Map<string, SessionRecord>();
const revokedSessionIds = new Set<string>();

function isActive(s: SessionRecord): boolean {
  return Date.now() - s.lastActivityAt.getTime() < ACTIVE_WINDOW_MS;
}

export function addOrUpdateSession(
  sessionId: string,
  userId: number,
  userAgent: string,
  ipAddress: string
): void {
  const now = new Date();
  const existing = store.get(sessionId);
  store.set(sessionId, {
    sessionId,
    userId,
    userAgent,
    ipAddress,
    lastActivityAt: now,
    createdAt: existing?.createdAt ?? now,
  });
}

export function getSessionsForUser(userId: number): SessionRecord[] {
  const list: SessionRecord[] = [];
  store.forEach((s) => {
    if (s.userId === userId && isActive(s)) list.push(s);
  });
  return list.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
}

export function removeSession(sessionId: string): boolean {
  return store.delete(sessionId);
}

export function addRevokedSessionId(sessionId: string): void {
  revokedSessionIds.add(sessionId);
}

export function isSessionRevoked(sessionId: string): boolean {
  return revokedSessionIds.has(sessionId);
}

export function removeRevokedSessionId(sessionId: string): void {
  revokedSessionIds.delete(sessionId);
}

export function getActiveCountForUser(userId: number): number {
  let n = 0;
  store.forEach((s) => {
    if (s.userId === userId && isActive(s)) n++;
  });
  return n;
}

/** All active sessions (for admin "Active Sessions" page). */
export function getAllActiveSessions(): SessionRecord[] {
  const list: SessionRecord[] = [];
  store.forEach((s) => {
    if (isActive(s)) list.push(s);
  });
  return list.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
}
