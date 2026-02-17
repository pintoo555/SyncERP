/**
 * Audit log module types.
 */

export interface AuditLogRecord {
  auditId: number;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  userId: number | null;
  userEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  createdAt: string;
}
