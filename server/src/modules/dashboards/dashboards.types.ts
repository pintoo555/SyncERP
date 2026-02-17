/**
 * Dashboards module types.
 */

export interface AdminDashboardKpis {
  totalAssets: number;
  availableAssets: number;
  issuedAssets: number;
  underRepairAssets: number;
  scrappedAssets: number;
  totalPurchaseValue: number;
  openTickets: number;
  totalUsers: number;
}

export interface AssetByStatusItem {
  status: string;
  count: number;
}

export interface AssetByCategoryItem {
  categoryName: string;
  count: number;
}

export interface CategoryValueItem {
  categoryName: string;
  totalValue: number;
  count: number;
}

export interface UserValueItem {
  userName: string;
  totalValue: number;
  count: number;
}

export interface ValueByStatusItem {
  status: string;
  totalValue: number;
  count: number;
}

export interface TicketByStatusItem {
  status: string;
  count: number;
}

export interface AdminDashboard {
  kpis: AdminDashboardKpis;
  assetsByStatus: AssetByStatusItem[];
  assetsByCategory: AssetByCategoryItem[];
  categoryValue: CategoryValueItem[];
  userValue: UserValueItem[];
  valueByStatus: ValueByStatusItem[];
  ticketsByStatus: TicketByStatusItem[];
  recentAuditCount: number;
}

export interface DepartmentDashboardKpis {
  departmentId: number;
  departmentName: string;
  totalAssets: number;
  assignedToDept: number;
  totalValue: number;
  openTickets: number;
}

export interface DepartmentDashboard {
  kpis: DepartmentDashboardKpis;
  assetsByStatus: AssetByStatusItem[];
}

export interface MyAssetItem {
  assetId: number;
  assetTag: string;
  categoryName: string | null;
  status: string;
  purchasePrice: number | null;
  warrantyExpiry: string | null;
  amcExpiry: string | null;
  locationName: string | null;
  assignedAt: Date | null;
}

export interface MyAssetsDashboard {
  assets: MyAssetItem[];
  totalCount: number;
  totalPurchaseValue: number;
  warrantyExpiringCount: number;
  warrantyExpiredCount: number;
}
