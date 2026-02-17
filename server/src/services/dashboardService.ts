/**
 * Re-export from modules/dashboards for backward compatibility.
 */
export {
  getAdminDashboard,
  getDepartmentDashboard,
  getMyAssetsDashboard,
} from '../modules/dashboards/dashboards.service';
export type {
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
} from '../modules/dashboards/dashboards.types';
