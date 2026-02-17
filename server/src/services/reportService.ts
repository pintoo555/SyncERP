/**
 * Report data for admin reports module.
 */

import { getRequest } from '../db/pool';
import type { AdminDashboard } from './dashboardService';
import { getAdminDashboard } from './dashboardService';

export type ReportType = 'summary' | 'warranty' | 'assignments';

export interface WarrantyReportRow {
  assetId: number;
  assetTag: string;
  categoryName: string | null;
  status: string;
  warrantyExpiry: string | null;
  purchasePrice: number | null;
  locationName: string | null;
  assignedToUserName: string | null;
  /** 'expired' | 'expiring' */
  warrantyStatus: string;
}

export interface AssignmentReportRow {
  assignmentId: number;
  assetTag: string;
  categoryName: string | null;
  assignedToUserName: string;
  assignedByUserName: string;
  assignedAt: string;
  returnedAt: string | null;
  returnedByUserName: string | null;
  assignmentType: string;
}

export async function getReportSummary(): Promise<AdminDashboard> {
  return getAdminDashboard();
}

export async function getReportWarranty(): Promise<WarrantyReportRow[]> {
  const req = await getRequest();
  const result = await req.query(`
    SELECT a.AssetID AS assetId, a.AssetTag AS assetTag, c.CategoryName AS categoryName, a.Status AS status,
           CONVERT(NVARCHAR(10), a.WarrantyExpiry, 120) AS warrantyExpiry, a.PurchasePrice AS purchasePrice,
           l.LocationName AS locationName, u.Name AS assignedToUserName
    FROM react_Asset a
    LEFT JOIN react_AssetCategory c ON c.CategoryID = a.CategoryID
    LEFT JOIN react_Location l ON l.LocationID = a.LocationID
    LEFT JOIN rb_users u ON u.userid = a.CurrentAssignedToUserID
    WHERE a.IsDeleted = 0 AND a.WarrantyExpiry IS NOT NULL
    ORDER BY a.WarrantyExpiry ASC
  `);
  const rows = (result.recordset || []) as Omit<WarrantyReportRow, 'warrantyStatus'>[];
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);
  return rows.map((r) => {
    let warrantyStatus = 'expiring';
    if (r.warrantyExpiry) {
      if (r.warrantyExpiry < today) warrantyStatus = 'expired';
      else if (r.warrantyExpiry <= in30Str) warrantyStatus = 'expiring';
    }
    return { ...r, warrantyStatus };
  });
}

export async function getReportAssignments(days: number = 30): Promise<AssignmentReportRow[]> {
  const req = await getRequest();
  const result = await req.input('days', days).query(`
    SELECT aa.AssignmentID AS assignmentId, a.AssetTag AS assetTag, c.CategoryName AS categoryName,
           u1.Name AS assignedToUserName, u2.Name AS assignedByUserName,
           CONVERT(NVARCHAR(19), aa.AssignedAt, 120) AS assignedAt,
           CONVERT(NVARCHAR(19), aa.ReturnedAt, 120) AS returnedAt, u3.Name AS returnedByUserName,
           aa.AssignmentType AS assignmentType
    FROM react_AssetAssignment aa
    INNER JOIN react_Asset a ON a.AssetID = aa.AssetID AND a.IsDeleted = 0
    LEFT JOIN react_AssetCategory c ON c.CategoryID = a.CategoryID
    INNER JOIN rb_users u1 ON u1.userid = aa.AssignedToUserID
    INNER JOIN rb_users u2 ON u2.userid = aa.AssignedByUserID
    LEFT JOIN rb_users u3 ON u3.userid = aa.ReturnedByUserID
    WHERE aa.AssignedAt >= DATEADD(day, -@days, GETDATE())
    ORDER BY aa.AssignedAt DESC
  `);
  return (result.recordset || []) as AssignmentReportRow[];
}
