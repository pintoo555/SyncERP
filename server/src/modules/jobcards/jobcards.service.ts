/**
 * Job Cards service – queries sync_jobcardinfo and related tables.
 */

import { getRequest } from '../../config/db';
import type { JobCardRow, JobCardListResult } from './jobcards.types';

type SortField = 'jobId' | 'instrument' | 'manufacturer' | 'date' | 'statusOfWork' | 'isInstrumentOut' | 'clientName' | 'empName' | 'ownerName';

const SORT_MAP: Record<string, string> = {
  jobId: 'j.JobID', instrument: 'j.InstrumentName', manufacturer: 'm.ManufacturerName',
  date: 'j.InstrumentInDate', statusOfWork: 's.StatusOfWork', isInstrumentOut: 'j.IsInstrumentOut',
  clientName: 'cd.ClientName', empName: 'ce.EmpName', ownerName: 'ou.Name',
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  try {
    const dt = d instanceof Date ? d : new Date(d);
    return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export async function listJobs(opts: {
  page: number;
  pageSize: number;
  search: string;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  hasClientAccess: boolean;
}): Promise<JobCardListResult> {
  const { page, pageSize, search, sortBy, sortOrder, hasClientAccess } = opts;
  const sortColumn = SORT_MAP[sortBy] || 'j.JobID';
  const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * pageSize + 1;
  const limit = offset + pageSize - 1;

  const keywords = search.trim().split(/\s+/).filter(Boolean);
  const whereParts: string[] = [];
  let paramIndex = 0;
  const searchParams: Array<{ name: string; value: string }> = [];

  for (const word of keywords) {
    const like = `%${word}%`;
    const p1 = `sw${paramIndex++}`, p2 = `sw${paramIndex++}`, p3 = `sw${paramIndex++}`, p4 = `sw${paramIndex++}`;
    const params: string[] = [
      `j.InstrumentName LIKE @${p1}`,
      `m.ManufacturerName LIKE @${p2}`,
      `CAST(j.JobID AS NVARCHAR) LIKE @${p3}`,
      `ou.Name LIKE @${p4}`,
    ];
    searchParams.push({ name: p1, value: like }, { name: p2, value: like }, { name: p3, value: like }, { name: p4, value: like });
    if (hasClientAccess) {
      const p5 = `sw${paramIndex++}`, p6 = `sw${paramIndex++}`;
      params.push(`cd.ClientName LIKE @${p5}`, `ce.EmpName LIKE @${p6}`);
      searchParams.push({ name: p5, value: like }, { name: p6, value: like });
    }
    whereParts.push(`(${params.join(' OR ')})`);
  }

  const whereSQL = whereParts.length > 0 ? whereParts.join(' AND ') : '1=1';
  const fromJoins = `
    FROM sync_jobcardinfo j
    LEFT JOIN sync_Manufacturer m ON j.ManufacturerID = m.ManufacturerID
    LEFT JOIN sync_StatusOfWork s ON j.StatusOfWorkID = s.StatusOfWorkID
    LEFT JOIN sync_JobFileDetails f ON j.MasterImageUploadID = f.UploadID
    LEFT JOIN go_FeedbackTypes ft ON j.FeedbackTypeID = ft.FeedbackTypeID
    LEFT JOIN sync_clientemployees ce ON j.EmpID = ce.EmpID
    LEFT JOIN sync_clientdetails cd ON ce.ClientID = cd.ClientID
    LEFT JOIN utbl_Users_Master ou ON j.OwnerID = ou.UserId
  `;

  const dataQuery = `
    SELECT * FROM (
      SELECT j.JobID, j.InstrumentName, j.InstrumentInDate, m.ManufacturerName, j.SerialNumber,
        ROUND(j.Weight, 2) AS Weight, j.IsInstrumentOut, s.StatusOfWork, j.MasterImageUploadID,
        f.FilePath, f.FileName, j.FeedbackTypeID, CASE WHEN j.IsInstrumentOut = 1 THEN ft.Feedback ELSE '' END AS Feedback,
        j.RepeatCount, ce.EmpName, cd.ClientName, cd.CreatedOn AS ClientCreatedOn, ou.Name AS OwnerName,
        ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${sortDirection}) AS rn
      ${fromJoins}
      WHERE ${whereSQL}
    ) AS sub WHERE rn BETWEEN @offsetStart AND @offsetEnd
  `;

  const countQuery = `SELECT COUNT(*) AS total ${fromJoins} WHERE ${whereSQL}`;

  const dataReq = await getRequest();
  for (const p of searchParams) dataReq.input(p.name, p.value);
  dataReq.input('offsetStart', offset).input('offsetEnd', limit);
  const dataResult = await dataReq.query(dataQuery);

  const countReq = await getRequest();
  for (const p of searchParams) countReq.input(p.name, p.value);
  const countResult = await countReq.query(countQuery);
  const total = (countResult.recordset?.[0] as { total: number })?.total ?? 0;

  const rows: JobCardRow[] = (dataResult.recordset || []).map((row: any) => ({
    jobId: row.JobID, instrument: row.InstrumentName || '', date: formatDate(row.InstrumentInDate),
    manufacturer: row.ManufacturerName || '', serialNumber: row.SerialNumber || '',
    weight: row.Weight != null ? parseFloat(row.Weight) : null,
    isInstrumentOut: row.IsInstrumentOut != null ? Number(row.IsInstrumentOut) : 0,
    statusOfWork: row.StatusOfWork || '', filePath: row.FilePath || '', fileName: row.FileName || '',
    masterImageUploadID: row.MasterImageUploadID || '',
    feedbackTypeId: row.FeedbackTypeID != null ? Number(row.FeedbackTypeID) : null,
    feedback: row.Feedback || '', repeatCount: row.RepeatCount != null ? Number(row.RepeatCount) : null,
    empName: row.EmpName || '', clientName: row.ClientName || '', clientCreatedOn: formatDate(row.ClientCreatedOn),
    ownerName: row.OwnerName || '',
  }));

  return { data: rows, total };
}

export async function getJobById(jobId: number): Promise<JobCardRow | null> {
  const req = await getRequest();
  req.input('jobId', jobId);
  const result = await req.query(`
    SELECT j.JobID, j.InstrumentName, j.InstrumentInDate, m.ManufacturerName, j.SerialNumber,
      ROUND(j.Weight, 2) AS Weight, j.IsInstrumentOut, s.StatusOfWork, j.MasterImageUploadID,
      f.FilePath, f.FileName, j.FeedbackTypeID, CASE WHEN j.IsInstrumentOut = 1 THEN ft.Feedback ELSE '' END AS Feedback,
      j.RepeatCount, ce.EmpName, cd.ClientName, cd.CreatedOn AS ClientCreatedOn, ou.Name AS OwnerName
    FROM sync_jobcardinfo j
    LEFT JOIN sync_Manufacturer m ON j.ManufacturerID = m.ManufacturerID
    LEFT JOIN sync_StatusOfWork s ON j.StatusOfWorkID = s.StatusOfWorkID
    LEFT JOIN sync_JobFileDetails f ON j.MasterImageUploadID = f.UploadID
    LEFT JOIN go_FeedbackTypes ft ON j.FeedbackTypeID = ft.FeedbackTypeID
    LEFT JOIN sync_clientemployees ce ON j.EmpID = ce.EmpID
    LEFT JOIN sync_clientdetails cd ON ce.ClientID = cd.ClientID
    LEFT JOIN utbl_Users_Master ou ON j.OwnerID = ou.UserId
    WHERE j.JobID = @jobId
  `);
  const row = result.recordset?.[0] as any;
  if (!row) return null;
  return {
    jobId: row.JobID, instrument: row.InstrumentName || '', date: formatDate(row.InstrumentInDate),
    manufacturer: row.ManufacturerName || '', serialNumber: row.SerialNumber || '',
    weight: row.Weight != null ? parseFloat(row.Weight) : null,
    isInstrumentOut: row.IsInstrumentOut != null ? Number(row.IsInstrumentOut) : 0,
    statusOfWork: row.StatusOfWork || '', filePath: row.FilePath || '', fileName: row.FileName || '',
    masterImageUploadID: row.MasterImageUploadID || '',
    feedbackTypeId: row.FeedbackTypeID != null ? Number(row.FeedbackTypeID) : null,
    feedback: row.Feedback || '', repeatCount: row.RepeatCount != null ? Number(row.RepeatCount) : null,
    empName: row.EmpName || '', clientName: row.ClientName || '', clientCreatedOn: formatDate(row.ClientCreatedOn),
    ownerName: row.OwnerName || '',
  };
}

export async function hasClientAccess(_userId: number): Promise<boolean> {
  return true;
}
