import { getRequest } from '../../config/db';

export interface OverdueReminder {
  reminderId: number;
  leadId: number;
  leadCode: string;
  contactName: string;
  reminderDate: string;
  reminderText: string;
  assignedToUserId: number | null;
  assignedToName: string | null;
  createdByName: string | null;
}

export interface StaleLeadInfo {
  leadId: number;
  leadCode: string;
  contactName: string;
  companyName: string | null;
  stageName: string;
  assignedToUserId: number | null;
  assignedToName: string | null;
  daysSinceLastActivity: number;
  lastActivityDate: string | null;
}

export async function getOverdueReminders(): Promise<OverdueReminder[]> {
  const req = await getRequest();
  const result = await req.query(`
    SELECT r.ReminderId AS reminderId, r.LeadId AS leadId,
           l.LeadCode AS leadCode, l.ContactName AS contactName,
           CONVERT(NVARCHAR(19), r.ReminderDate, 120) AS reminderDate,
           r.ReminderText AS reminderText,
           l.AssignedToUserId AS assignedToUserId,
           au.Name AS assignedToName,
           cu.Name AS createdByName
    FROM dbo.utbl_Leads_Reminder r
    INNER JOIN dbo.utbl_Leads_Master l ON l.LeadId = r.LeadId
    LEFT JOIN dbo.utbl_Users_Master au ON au.UserId = l.AssignedToUserId
    LEFT JOIN dbo.utbl_Users_Master cu ON cu.UserId = r.CreatedBy
    WHERE r.IsCompleted = 0
      AND r.ReminderDate <= GETDATE()
      AND l.IsActive = 1
    ORDER BY r.ReminderDate ASC
  `);
  return result.recordset;
}

export async function getStaleLeads(staleDaysThreshold = 14): Promise<StaleLeadInfo[]> {
  const req = await getRequest();
  req.input('threshold', staleDaysThreshold);
  const result = await req.query(`
    SELECT l.LeadId AS leadId, l.LeadCode AS leadCode,
           l.ContactName AS contactName, l.CompanyName AS companyName,
           s.StageName AS stageName,
           l.AssignedToUserId AS assignedToUserId,
           u.Name AS assignedToName,
           DATEDIFF(DAY, ISNULL(latestAct.LastDate, l.CreatedOn), GETDATE()) AS daysSinceLastActivity,
           CONVERT(NVARCHAR(19), ISNULL(latestAct.LastDate, l.CreatedOn), 120) AS lastActivityDate
    FROM dbo.utbl_Leads_Master l
    INNER JOIN dbo.utbl_Leads_Stage s ON s.StageId = l.StageId
    LEFT JOIN dbo.utbl_Users_Master u ON u.UserId = l.AssignedToUserId
    OUTER APPLY (
      SELECT MAX(a.CreatedOn) AS LastDate
      FROM dbo.utbl_Leads_Activity a
      WHERE a.LeadId = l.LeadId
    ) latestAct
    WHERE l.IsActive = 1
      AND s.IsWon = 0 AND s.IsLost = 0
      AND DATEDIFF(DAY, ISNULL(latestAct.LastDate, l.CreatedOn), GETDATE()) >= @threshold
    ORDER BY daysSinceLastActivity DESC
  `);
  return result.recordset;
}

export async function autoCreateRemindersForStaleLeads(staleDaysThreshold = 14, systemUserId = 0): Promise<number> {
  const staleLeads = await getStaleLeads(staleDaysThreshold);
  let created = 0;

  for (const lead of staleLeads) {
    const req = await getRequest();
    req.input('leadId', lead.leadId);
    const existing = await req.query(`
      SELECT TOP 1 ReminderId FROM dbo.utbl_Leads_Reminder
      WHERE LeadId = @leadId AND IsCompleted = 0
      ORDER BY ReminderDate DESC
    `);

    if (existing.recordset.length === 0) {
      const insertReq = await getRequest();
      insertReq.input('leadId', lead.leadId);
      insertReq.input('text', `Follow up required: ${lead.daysSinceLastActivity} days since last activity`);
      insertReq.input('userId', systemUserId);
      await insertReq.query(`
        INSERT INTO dbo.utbl_Leads_Reminder (LeadId, ReminderDate, ReminderText, CreatedBy)
        VALUES (@leadId, GETDATE(), @text, @userId)
      `);
      created++;
    }
  }

  return created;
}
