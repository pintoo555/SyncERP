import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { LeadReminder, LeadReminderCreate } from './leads.types';

const SCHEMA = config.db.schema || 'dbo';
const REMINDER = `[${SCHEMA}].[utbl_Leads_Reminder]`;
const USERS = `[${SCHEMA}].[utbl_Users_Master]`;
const LEADS = `[${SCHEMA}].[utbl_Leads_Master]`;

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}
function dateToIsoOrNull(d: unknown): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function mapRow(r: any): LeadReminder {
  return {
    reminderId: r.reminderId,
    leadId: r.leadId,
    reminderDate: dateToIso(r.reminderDate),
    reminderText: r.reminderText,
    isCompleted: !!r.isCompleted,
    completedAt: dateToIsoOrNull(r.completedAt),
    createdBy: r.createdBy ?? null,
    createdByName: r.createdByName ?? null,
    createdOn: dateToIso(r.createdOn),
  };
}

const BASE_COLUMNS = `
  r.ReminderId   AS reminderId,
  r.LeadId       AS leadId,
  r.ReminderDate AS reminderDate,
  r.ReminderText AS reminderText,
  r.IsCompleted  AS isCompleted,
  r.CompletedAt  AS completedAt,
  r.CreatedBy    AS createdBy,
  u.Name         AS createdByName,
  r.CreatedOn    AS createdOn`;

const BASE_FROM = `
  FROM ${REMINDER} r
  LEFT JOIN ${USERS} u ON u.UserId = r.CreatedBy`;

export async function getReminders(leadId: number): Promise<LeadReminder[]> {
  const req = await getRequest();
  req.input('leadId', leadId);
  const result = await req.query(`
    SELECT ${BASE_COLUMNS}
    ${BASE_FROM}
    WHERE r.LeadId = @leadId
    ORDER BY r.ReminderDate ASC
  `);
  return (result.recordset as any[]).map(mapRow);
}

export async function createReminder(
  leadId: number,
  data: LeadReminderCreate,
  userId: number | null,
): Promise<number> {
  const parsedDate = new Date(data.reminderDate);
  if (isNaN(parsedDate.getTime())) throw new Error('Invalid reminderDate');

  const req = await getRequest();
  req.input('leadId', leadId);
  req.input('reminderDate', parsedDate);
  req.input('reminderText', data.reminderText.trim().slice(0, 500));
  req.input('createdBy', userId);

  const result = await req.query(`
    DECLARE @out TABLE (ReminderId BIGINT);

    INSERT INTO ${REMINDER}
      (LeadId, ReminderDate, ReminderText, CreatedBy)
    OUTPUT INSERTED.ReminderId INTO @out
    VALUES (@leadId, @reminderDate, @reminderText, @createdBy);

    SELECT ReminderId FROM @out;
  `);

  return (result.recordset as { ReminderId: number }[])[0].ReminderId;
}

export async function completeReminder(reminderId: number): Promise<void> {
  const req = await getRequest();
  req.input('reminderId', reminderId);
  await req.query(`
    UPDATE ${REMINDER}
    SET IsCompleted = 1, CompletedAt = GETDATE()
    WHERE ReminderId = @reminderId
  `);
}

export async function getOverdueReminders(): Promise<
  (LeadReminder & { leadCode: string; leadCompanyName: string | null })[]
> {
  const req = await getRequest();
  const result = await req.query(`
    SELECT ${BASE_COLUMNS},
           l.LeadCode      AS leadCode,
           l.CompanyName    AS leadCompanyName
    ${BASE_FROM}
    INNER JOIN ${LEADS} l ON l.LeadId = r.LeadId
    WHERE r.IsCompleted = 0 AND r.ReminderDate < GETDATE()
    ORDER BY r.ReminderDate ASC
  `);
  return (result.recordset as any[]).map((r) => ({
    ...mapRow(r),
    leadCode: r.leadCode,
    leadCompanyName: r.leadCompanyName ?? null,
  }));
}
