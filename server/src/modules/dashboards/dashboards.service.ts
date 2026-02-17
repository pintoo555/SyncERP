/**
 * Dashboard KPIs and chart data: admin, department, and my-assets.
 */

import { getRequest } from '../../config/db';
import type {
  AdminDashboard,
  AdminDashboardKpis,
  AssetByStatusItem,
  AssetByCategoryItem,
  CategoryValueItem,
  UserValueItem,
  ValueByStatusItem,
  TicketByStatusItem,
  DepartmentDashboard,
  DepartmentDashboardKpis,
  MyAssetItem,
  MyAssetsDashboard,
} from './dashboards.types';

export type {
  AdminDashboardKpis,
  AssetByStatusItem,
  AssetByCategoryItem,
  CategoryValueItem,
  UserValueItem,
  ValueByStatusItem,
  TicketByStatusItem,
  AdminDashboard,
  DepartmentDashboardKpis,
  DepartmentDashboard,
  MyAssetItem,
  MyAssetsDashboard,
} from './dashboards.types';

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const req = await getRequest();
  const [
    kpiResult,
    statusResult,
    categoryResult,
    auditResult,
    categoryValueResult,
    userValueResult,
    valueByStatusResult,
    ticketsByStatusResult,
  ] = await Promise.all([
    req.query(`
      SELECT
        (SELECT COUNT(*) FROM react_Asset WHERE IsDeleted = 0) AS totalAssets,
        (SELECT COUNT(*) FROM react_Asset WHERE IsDeleted = 0 AND Status = 'AVAILABLE') AS availableAssets,
        (SELECT COUNT(*) FROM react_Asset WHERE IsDeleted = 0 AND Status = 'ISSUED') AS issuedAssets,
        (SELECT COUNT(*) FROM react_Asset WHERE IsDeleted = 0 AND Status = 'UNDER_REPAIR') AS underRepairAssets,
        (SELECT COUNT(*) FROM react_Asset WHERE IsDeleted = 0 AND Status = 'SCRAPPED') AS scrappedAssets,
        (SELECT ISNULL(SUM(PurchasePrice), 0) FROM react_Asset WHERE IsDeleted = 0) AS totalPurchaseValue,
        (SELECT COUNT(*) FROM react_AssetMaintenanceTicket WHERE IsDeleted = 0 AND ResolvedAt IS NULL) AS openTickets,
        (SELECT COUNT(*) FROM rb_users WHERE IsActive = 1) AS totalUsers
    `),
    (async () => {
      const r = await getRequest();
      return r.query(`
        SELECT Status AS status, COUNT(*) AS count
        FROM react_Asset WHERE IsDeleted = 0 GROUP BY Status ORDER BY count DESC
      `);
    })(),
    (async () => {
      const r = await getRequest();
      return r.query(`
        SELECT ISNULL(c.CategoryName, 'Uncategorized') AS categoryName, COUNT(*) AS count
        FROM react_Asset a
        LEFT JOIN react_AssetCategory c ON c.CategoryID = a.CategoryID
        WHERE a.IsDeleted = 0 GROUP BY c.CategoryName ORDER BY count DESC
      `);
    })(),
    (async () => {
      const r = await getRequest();
      return r.query(`
        SELECT COUNT_BIG(*) AS cnt FROM react_AuditLog WHERE CreatedAt >= DATEADD(day, -7, GETDATE())
      `);
    })(),
    (async () => {
      const r = await getRequest();
      return r.query(`
        SELECT ISNULL(c.CategoryName, 'Uncategorized') AS categoryName,
               ISNULL(SUM(a.PurchasePrice), 0) AS totalValue, COUNT(*) AS count
        FROM react_Asset a
        LEFT JOIN react_AssetCategory c ON c.CategoryID = a.CategoryID
        WHERE a.IsDeleted = 0
        GROUP BY c.CategoryName
        ORDER BY SUM(a.PurchasePrice) DESC
      `);
    })(),
    (async () => {
      const r = await getRequest();
      return r.query(`
        SELECT ISNULL(u.Name, 'Unassigned') AS userName,
               ISNULL(SUM(a.PurchasePrice), 0) AS totalValue, COUNT(*) AS count
        FROM react_Asset a
        LEFT JOIN rb_users u ON u.userid = a.CurrentAssignedToUserID
        WHERE a.IsDeleted = 0 AND a.CurrentAssignedToUserID IS NOT NULL
        GROUP BY u.Name
        ORDER BY SUM(a.PurchasePrice) DESC
      `);
    })(),
    (async () => {
      const r = await getRequest();
      return r.query(`
        SELECT Status AS status, ISNULL(SUM(PurchasePrice), 0) AS totalValue, COUNT(*) AS count
        FROM react_Asset WHERE IsDeleted = 0 GROUP BY Status ORDER BY totalValue DESC
      `);
    })(),
    (async () => {
      const r = await getRequest();
      return r.query(`
        SELECT Status AS status, COUNT(*) AS count
        FROM react_AssetMaintenanceTicket WHERE IsDeleted = 0
        GROUP BY Status ORDER BY count DESC
      `);
    })(),
  ]);

  const k = kpiResult.recordset[0] as Record<string, number>;
  const kpis: AdminDashboardKpis = {
    totalAssets: Number(k?.totalAssets ?? 0),
    availableAssets: Number(k?.availableAssets ?? 0),
    issuedAssets: Number(k?.issuedAssets ?? 0),
    underRepairAssets: Number(k?.underRepairAssets ?? 0),
    scrappedAssets: Number(k?.scrappedAssets ?? 0),
    totalPurchaseValue: Number(k?.totalPurchaseValue ?? 0),
    openTickets: Number(k?.openTickets ?? 0),
    totalUsers: Number(k?.totalUsers ?? 0),
  };
  const assetsByStatus = (statusResult.recordset || []) as AssetByStatusItem[];
  const assetsByCategory = (categoryResult.recordset || []) as AssetByCategoryItem[];
  const recentAuditCount = Number((auditResult.recordset?.[0] as { cnt: number })?.cnt ?? 0);
  const categoryValue = (categoryValueResult.recordset || []).map((row: Record<string, unknown>) => ({
    categoryName: String(row.categoryName ?? 'Uncategorized'),
    totalValue: Number(row.totalValue ?? 0),
    count: Number(row.count ?? 0),
  })) as CategoryValueItem[];
  const userValue = (userValueResult.recordset || []).map((row: Record<string, unknown>) => ({
    userName: String(row.userName ?? 'Unknown'),
    totalValue: Number(row.totalValue ?? 0),
    count: Number(row.count ?? 0),
  })) as UserValueItem[];
  const valueByStatus = (valueByStatusResult.recordset || []).map((row: Record<string, unknown>) => ({
    status: String(row.status ?? ''),
    totalValue: Number(row.totalValue ?? 0),
    count: Number(row.count ?? 0),
  })) as ValueByStatusItem[];
  const ticketsByStatus = (ticketsByStatusResult.recordset || []) as TicketByStatusItem[];

  return {
    kpis,
    assetsByStatus,
    assetsByCategory,
    categoryValue,
    userValue,
    valueByStatus,
    ticketsByStatus,
    recentAuditCount,
  };
}

export async function getDepartmentDashboard(departmentId: number): Promise<DepartmentDashboard | null> {
  const req = await getRequest();
  const deptResult = await req.input('departmentId', departmentId).query(`
    SELECT DepartmentID AS departmentId, DepartmentName AS departmentName FROM sync_Department WHERE DepartmentID = @departmentId
  `);
  const dept = deptResult.recordset[0] as { departmentId: number; departmentName: string } | undefined;
  if (!dept) return null;

  const req2 = await getRequest();
  const kpiResult = await req2.input('departmentId', departmentId).query(`
    SELECT
      (SELECT COUNT(*) FROM react_Asset a INNER JOIN rb_users u ON u.userid = a.CurrentAssignedToUserID WHERE a.IsDeleted = 0 AND u.DepartmentID = @departmentId) AS assignedToDept,
      (SELECT ISNULL(SUM(a.PurchasePrice), 0) FROM react_Asset a INNER JOIN rb_users u ON u.userid = a.CurrentAssignedToUserID WHERE a.IsDeleted = 0 AND u.DepartmentID = @departmentId) AS totalValue,
      (SELECT COUNT(*) FROM react_AssetMaintenanceTicket t INNER JOIN react_Asset a ON a.AssetID = t.AssetID INNER JOIN rb_users u ON u.userid = a.CurrentAssignedToUserID WHERE t.IsDeleted = 0 AND t.ResolvedAt IS NULL AND u.DepartmentID = @departmentId) AS openTickets
  `);
  const k = kpiResult.recordset[0] as Record<string, number>;
  const totalAssets = Number(k?.assignedToDept ?? 0);

  const statusReq = await getRequest();
  const statusResult = await statusReq.input('departmentId', departmentId).query(`
    SELECT a.Status AS status, COUNT(*) AS count
    FROM react_Asset a
    INNER JOIN rb_users u ON u.userid = a.CurrentAssignedToUserID
    WHERE a.IsDeleted = 0 AND u.DepartmentID = @departmentId
    GROUP BY a.Status ORDER BY count DESC
  `);

  const kpis: DepartmentDashboardKpis = {
    departmentId: dept.departmentId,
    departmentName: dept.departmentName,
    totalAssets,
    assignedToDept: totalAssets,
    totalValue: Number(k?.totalValue ?? 0),
    openTickets: Number(k?.openTickets ?? 0),
  };
  const assetsByStatus = (statusResult.recordset || []) as AssetByStatusItem[];
  return { kpis, assetsByStatus };
}

export async function getMyAssetsDashboard(userId: number): Promise<MyAssetsDashboard> {
  const req = await getRequest();
  const assetsResult = await req.input('userId', userId).query(`
    SELECT a.AssetID AS assetId, a.AssetTag AS assetTag, c.CategoryName AS categoryName, a.Status AS status,
           a.PurchasePrice AS purchasePrice, CONVERT(NVARCHAR(10), a.WarrantyExpiry, 120) AS warrantyExpiry,
           CONVERT(NVARCHAR(10), a.AMCExpiry, 120) AS amcExpiry, l.LocationName AS locationName,
           (SELECT TOP 1 aa.AssignedAt FROM react_AssetAssignment aa WHERE aa.AssetID = a.AssetID AND aa.ReturnedAt IS NULL ORDER BY aa.AssignedAt DESC) AS assignedAt
    FROM react_Asset a
    LEFT JOIN react_AssetCategory c ON c.CategoryID = a.CategoryID
    LEFT JOIN react_Location l ON l.LocationID = a.LocationID
    WHERE a.IsDeleted = 0 AND a.CurrentAssignedToUserID = @userId
    ORDER BY a.AssetTag
  `);
  const assets = (assetsResult.recordset || []) as MyAssetItem[];
  const totalPurchaseValue = assets.reduce((sum, x) => sum + (Number(x.purchasePrice) || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  let warrantyExpiringCount = 0;
  let warrantyExpiredCount = 0;
  for (const a of assets) {
    if (!a.warrantyExpiry) continue;
    if (a.warrantyExpiry < today) warrantyExpiredCount++;
    else {
      const exp = new Date(a.warrantyExpiry);
      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);
      if (exp <= in30) warrantyExpiringCount++;
    }
  }
  return {
    assets,
    totalCount: assets.length,
    totalPurchaseValue,
    warrantyExpiringCount,
    warrantyExpiredCount,
  };
}
