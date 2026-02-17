/**
 * ERP menu configuration: hierarchy, permissions, and icons.
 */
export interface MenuItemConfig {
  key: string;
  label: string;
  path?: string;
  icon: string;
  permission?: string | string[];
  children?: MenuItemConfig[];
}

export function hasMenuPermission(permissions: string[] | undefined, required: string | string[] | undefined): boolean {
  if (!required) return true;
  if (!permissions?.length) return false;
  const codes = Array.isArray(required) ? required : [required];
  return codes.some((p) => permissions.includes(p));
}

export function filterMenuByPermission(items: MenuItemConfig[], permissions: string[] | undefined): MenuItemConfig[] {
  return items
    .filter((item) => hasMenuPermission(permissions, item.permission))
    .map((item) => ({
      ...item,
      children: item.children?.length
        ? filterMenuByPermission(item.children, permissions)
        : undefined,
    }))
    .filter((item) => {
      if (item.children?.length) return true;
      if (item.path) return true;
      return false;
    });
}

export const MENU_ROOT: MenuItemConfig[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'speedometer2', permission: undefined },
  {
    key: 'health',
    label: 'Health',
    icon: 'heartbeat',
    permission: ['HEALTH.VIEW', 'HEALTH.SETTINGS'],
    children: [
      { key: 'health-dash', label: 'Health Dashboard', path: '/health', icon: 'heartbeat', permission: 'HEALTH.VIEW' },
      { key: 'health-settings', label: 'Health Alert Settings', path: '/health/settings', icon: 'gear', permission: 'HEALTH.SETTINGS' },
    ],
  },
  {
    key: 'assets',
    label: 'Assets',
    icon: 'box-seam',
    permission: ['ASSET.VIEW', 'ASSET.SEARCH', 'DASH.VIEW_SELF', 'DASH.VIEW_ADMIN', 'MASTERS.CAT.VIEW', 'REPORTS.EXPORT', 'VERIFY.VIEW', 'PRINT_LABELS.VIEW', 'TICKET.VIEW'],
    children: [
      { key: 'dashboard', label: 'Assets Dashboard', path: '/assets/dashboard', icon: 'speedometer2', permission: 'DASH.VIEW_SELF' },
      { key: 'dashboard-admin', label: 'Assets Admin Dashboard', path: '/assets/dashboard/admin', icon: 'bar-chart-fill', permission: 'DASH.VIEW_ADMIN' },
      { key: 'masters', label: 'Assets Masters', path: '/assets/masters', icon: 'database', permission: 'MASTERS.CAT.VIEW' },
      { key: 'reports', label: 'Assets Reports', path: '/assets/reports', icon: 'file-earmark-bar-graph', permission: 'REPORTS.EXPORT' },
      { key: 'assets-list', label: 'Asset List', path: '/assets', icon: 'list-ul', permission: 'ASSET.VIEW' },
      { key: 'assets-board', label: 'Asset Board', path: '/assets/board', icon: 'kanban', permission: 'ASSET.VIEW' },
      { key: 'my-assets', label: 'My Assets', path: '/assets/my', icon: 'person-badge', permission: 'ASSET.VIEW' },
      { key: 'search', label: 'Assets Search', path: '/assets/search', icon: 'search', permission: 'ASSET.SEARCH' },
      { key: 'verifications', label: 'Assets Verification', path: '/assets/verifications', icon: 'check2-square', permission: 'VERIFY.VIEW' },
      { key: 'print-labels', label: 'Assets Print Labels', path: '/assets/print-labels', icon: 'printer', permission: ['PRINT_LABELS.VIEW', 'DASH.VIEW_ADMIN'] },
      { key: 'tickets-list', label: 'Assets Tickets', path: '/assets/tickets', icon: 'ticket-perforated', permission: 'TICKET.VIEW' },
      { key: 'tickets-board', label: 'Assets Tickets Board', path: '/assets/tickets/board', icon: 'kanban', permission: 'TICKET.VIEW' },
    ],
  },
  {
    key: 'jobcard',
    label: 'Job Card',
    icon: 'clipboard-check',
    permission: 'JOBCARD.VIEW',
    children: [
      { key: 'jobcard-list', label: 'Job Cards', path: '/jobcard', icon: 'clipboard-check', permission: 'JOBCARD.VIEW' },
      { key: 'jobcard-search', label: 'Search Jobs', path: '/jobcard/search', icon: 'search', permission: 'JOBCARD.VIEW' },
    ],
  },
  { key: 'worklogs', label: 'Work Logs', path: '/worklogs', icon: 'journal-text', permission: 'WORKLOGS.VIEW' },
  {
    key: 'accounts',
    label: 'Accounts',
    icon: 'wallet2',
    permission: 'ACCOUNTS.VIEW',
    children: [
      { key: 'accounts-dash', label: 'Overview', path: '/accounts', icon: 'pie-chart', permission: 'ACCOUNTS.VIEW' },
      { key: 'invoices', label: 'Invoices', path: '/accounts/invoices', icon: 'receipt', permission: 'INVOICES.VIEW' },
      { key: 'credit-notes', label: 'Credit Notes', path: '/accounts/credit-notes', icon: 'receipt-cutoff', permission: 'CREDIT_NOTES.VIEW' },
    ],
  },
  { key: 'calendar', label: 'Calendar', path: '/calendar', icon: 'calendar3', permission: ['CALENDAR.VIEW', 'DASH.VIEW_SELF'] },
  { key: 'chat', label: 'Chat', path: '/chat', icon: 'chat-dots', permission: ['CHAT.USE', 'DASH.VIEW_ADMIN'] },
  {
    key: 'audit',
    label: 'Audit',
    icon: 'journal-check',
    permission: 'AUDIT.VIEW',
    children: [
      { key: 'audit-dashboard', label: 'Audit Dashboard', path: '/audit', icon: 'chart-bar', permission: 'AUDIT.VIEW' },
      { key: 'audit-log', label: 'Audit Log', path: '/audit/log', icon: 'search', permission: 'AUDIT.VIEW' },
    ],
  },
  {
    key: 'call-matrix',
    label: 'Call Matrix',
    icon: 'telephone',
    permission: undefined,
    children: [
      { key: 'call-matrix-dashboard', label: 'Dashboard', path: '/call-matrix', icon: 'speedometer2', permission: undefined },
      { key: 'call-matrix-search', label: 'Search', path: '/call-matrix/search', icon: 'search', permission: undefined },
    ],
  },
  {
    key: 'hrms',
    label: 'HRMS',
    icon: 'people',
    permission: 'HRMS.VIEW',
    children: [
      { key: 'hrms-employees', label: 'Employees', path: '/hrms/employees', icon: 'person-lines-fill', permission: 'HRMS.VIEW' },
      { key: 'hrms-user-search', label: 'User Search', path: '/hrms/user-search', icon: 'search', permission: 'HRMS.VIEW' },
      { key: 'hrms-departments', label: 'Departments', path: '/hrms/departments', icon: 'building', permission: 'HRMS.VIEW' },
      { key: 'hrms-designations', label: 'Designations', path: '/hrms/designations', icon: 'badge', permission: 'HRMS.VIEW' },
      { key: 'hrms-teams', label: 'Org Structure', path: '/hrms/teams', icon: 'sitemap', permission: 'HRMS.VIEW' },
    ],
  },
  { key: 'my-profile', label: 'My Profile', path: '/hrms/profile', icon: 'person-circle', permission: undefined },
  {
    key: 'emails',
    label: 'Emails',
    icon: 'mail',
    permission: undefined,
    children: [
      { key: 'emails-inbox', label: 'Inbox', path: '/emails', icon: 'inbox', permission: undefined },
      { key: 'emails-settings', label: 'Email Settings', path: '/emails/settings', icon: 'gear', permission: undefined },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'gear',
    permission: ['GENERAL_SETTINGS.VIEW', 'RBAC.ROLES.VIEW', 'RBAC.USERROLES.VIEW', 'AI_CONFIG.VIEW', 'EMAIL_SETTINGS.VIEW', 'SESSIONS.VIEW', 'HEALTH.SETTINGS'],
    children: [
      { key: 'settings-general', label: 'General Settings', path: '/settings/general', icon: 'gear-wide-connected', permission: 'GENERAL_SETTINGS.VIEW' },
      { key: 'settings-health-alerts', label: 'Health Alert Settings', path: '/health/settings', icon: 'heartbeat', permission: 'HEALTH.SETTINGS' },
      { key: 'settings-users-roles', label: 'Users & Roles', path: '/settings/users-roles', icon: 'people', permission: ['RBAC.ROLES.VIEW', 'RBAC.USERROLES.VIEW'] },
      { key: 'settings-active-sessions', label: 'Active Sessions', path: '/settings/active-sessions', icon: 'person-badge', permission: 'SESSIONS.VIEW' },
      { key: 'settings-ai-config', label: 'AI Config', path: '/settings/ai-config', icon: 'key', permission: 'AI_CONFIG.VIEW' },
      { key: 'settings-email', label: 'Email Settings', path: '/settings/email-settings', icon: 'mail', permission: 'EMAIL_SETTINGS.VIEW' },
      { key: 'settings-cron-jobs', label: 'Cron Jobs', path: '/settings/cron-jobs', icon: 'clock', permission: 'CRON_JOBS.VIEW' },
    ],
  },
];
