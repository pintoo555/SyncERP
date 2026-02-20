import { getRequest } from '../../config/db';

export interface ImportRow {
  contactName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  whatsAppNumber?: string;
  designation?: string;
  clientType?: string;
  city?: string;
  gstNumber?: string;
  estimatedValue?: number;
  tags?: string;
  notes?: string;
}

export interface ImportOptions {
  sourceId: number;
  stageId: number;
  assignedToUserId?: number;
  userId: number;
}

export interface ImportResult {
  totalRows: number;
  successCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: Array<{ row: number; error: string }>;
  createdLeadIds: number[];
}

function generateLeadCode(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
  return `LD${y}${m}${rand}`;
}

async function isDuplicate(email?: string, phone?: string): Promise<boolean> {
  if (!email && !phone) return false;

  const req = await getRequest();
  const conditions: string[] = [];
  if (email) {
    req.input('dup_email', email.trim());
    conditions.push('(Email = @dup_email)');
  }
  if (phone) {
    req.input('dup_phone', phone.trim());
    conditions.push('(Phone = @dup_phone)');
  }

  const result = await req.query(
    `SELECT TOP 1 LeadId FROM dbo.utbl_Leads_Master WHERE ${conditions.join(' OR ')}`
  );
  return result.recordset.length > 0;
}

export async function bulkImport(rows: ImportRow[], options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = {
    totalRows: rows.length,
    successCount: 0,
    duplicateCount: 0,
    errorCount: 0,
    errors: [],
    createdLeadIds: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.contactName?.trim()) {
        result.errors.push({ row: i + 1, error: 'Contact Name is required' });
        result.errorCount++;
        continue;
      }

      const dup = await isDuplicate(row.email, row.phone);
      if (dup) {
        result.duplicateCount++;
        continue;
      }

      const code = generateLeadCode();
      const req = await getRequest();
      req.input('code', code);
      req.input('contactName', row.contactName.trim());
      req.input('companyName', row.companyName?.trim() || null);
      req.input('email', row.email?.trim() || null);
      req.input('phone', row.phone?.trim() || null);
      req.input('whatsAppNumber', row.whatsAppNumber?.trim() || null);
      req.input('designation', row.designation?.trim() || null);
      req.input('clientType', row.clientType?.trim() || null);
      req.input('city', row.city?.trim() || null);
      req.input('gstNumber', row.gstNumber?.trim() || null);
      req.input('estimatedValue', row.estimatedValue ?? null);
      req.input('tags', row.tags?.trim() || null);
      req.input('notes', row.notes?.trim() || null);
      req.input('sourceId', options.sourceId);
      req.input('stageId', options.stageId);
      req.input('assignedToUserId', options.assignedToUserId ?? null);
      req.input('userId', options.userId);

      const insertResult = await req.query(`
        DECLARE @out TABLE (LeadId BIGINT);
        INSERT INTO dbo.utbl_Leads_Master
          (LeadCode, ContactName, CompanyName, Email, Phone, WhatsAppNumber,
           Designation, ClientType, City, GSTNumber, EstimatedValue, Tags, Notes,
           SourceId, StageId, AssignedToUserId, CreatedBy)
        OUTPUT INSERTED.LeadId INTO @out
        VALUES
          (@code, @contactName, @companyName, @email, @phone, @whatsAppNumber,
           @designation, @clientType, @city, @gstNumber, @estimatedValue, @tags, @notes,
           @sourceId, @stageId, @assignedToUserId, @userId);
        SELECT LeadId FROM @out;
      `);

      const newId = insertResult.recordset[0]?.LeadId;
      if (newId) {
        result.createdLeadIds.push(newId);
        result.successCount++;

        const actReq = await getRequest();
        actReq.input('actLeadId', newId);
        actReq.input('actUserId', options.userId);
        await actReq.query(`
          INSERT INTO dbo.utbl_Leads_Activity (LeadId, ActivityType, Subject, CreatedBy)
          VALUES (@actLeadId, 'SYSTEM', 'Lead created via bulk import', @actUserId)
        `);
      }
    } catch (e: any) {
      result.errors.push({ row: i + 1, error: e.message || 'Unknown error' });
      result.errorCount++;
    }
  }

  return result;
}
