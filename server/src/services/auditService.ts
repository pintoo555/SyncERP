/**
 * Audit logging: write to react_AuditLog. Never log passwords.
 * Use logAuditFromRequest(req, entry) in controllers to auto-fill userId, userEmail, ipAddress, userAgent.
 */

import { getRequest } from '../db/pool';

export type AuditEventType =
  | 'login' | 'logout' | 'login_failure'
  | 'view' | 'search' | 'create' | 'update' | 'delete' | 'export' | 'upload';

export interface AuditEntry {
  eventType: AuditEventType;
  entityType?: string;
  entityId?: string;
  userId?: number;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  requestMethod?: string;
  requestPath?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const req = await getRequest();
    await req
      .input('eventType', entry.eventType)
      .input('entityType', entry.entityType ?? null)
      .input('entityId', entry.entityId ?? null)
      .input('userId', entry.userId ?? null)
      .input('userEmail', entry.userEmail ?? null)
      .input('ipAddress', entry.ipAddress ?? null)
      .input('userAgent', entry.userAgent ?? null)
      .input('details', entry.details ?? null)
      .input('requestMethod', entry.requestMethod ?? null)
      .input('requestPath', entry.requestPath ?? null)
      .query(`
        INSERT INTO react_AuditLog (EventType, EntityType, EntityID, UserID, UserEmail, IPAddress, UserAgent, Details, RequestMethod, RequestPath)
        VALUES (@eventType, @entityType, @entityId, @userId, @userEmail, @ipAddress, @userAgent, @details, @requestMethod, @requestPath)
      `);
  } catch (e) {
    console.error('Audit log write failed:', e);
  }
}

/** Request-like type for audit context (Express req or object with user and headers). */
export interface AuditRequestLike {
  user?: { userId?: number; email?: string } | null;
  ip?: string;
  method?: string;
  originalUrl?: string;
  path?: string;
  headers?: { [key: string]: string | string[] | undefined };
}

/** Log audit with user/IP/UA filled from request. Fire-and-forget (catch errors). */
export function logAuditFromRequest(
  req: AuditRequestLike,
  entry: Omit<AuditEntry, 'userId' | 'userEmail' | 'ipAddress' | 'userAgent' | 'requestMethod' | 'requestPath'> & Partial<Pick<AuditEntry, 'userId' | 'userEmail' | 'ipAddress' | 'userAgent' | 'requestMethod' | 'requestPath'>>
): void {
  const method = entry.requestMethod ?? req.method;
  const path = entry.requestPath ?? req.originalUrl ?? req.path;
  const requestPath = path != null ? String(path).slice(0, 500) : undefined;
  const requestMethod = method != null ? String(method).slice(0, 10) : undefined;
  const full: AuditEntry = {
    ...entry,
    userId: entry.userId ?? req.user?.userId,
    userEmail: entry.userEmail ?? req.user?.email,
    ipAddress: entry.ipAddress ?? getClientIp(req),
    userAgent: entry.userAgent ?? getUserAgent(req),
    requestMethod,
    requestPath,
  };
  logAudit(full).catch((e) => console.error('Audit log write failed:', e));
}

export function getClientIp(req: { ip?: string; headers?: { [key: string]: string | string[] | undefined } }): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const v = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (v) return String(v).split(',')[0].trim();
  return req.ip || '';
}

export function getUserAgent(req: { headers?: { [key: string]: string | string[] | undefined } }): string {
  const ua = req.headers?.['user-agent'];
  const v = Array.isArray(ua) ? ua[0] : ua;
  const s = v ? String(v) : '';
  return s.length <= 500 ? s : s.substring(0, 500);
}
