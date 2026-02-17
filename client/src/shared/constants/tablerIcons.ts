export const TABLER_ICON_MAP: Record<string, string> = {
  'speedometer2': 'layout-dashboard', 'bar-chart-fill': 'chart-bar', 'box-seam': 'box', 'list-ul': 'list',
  'kanban': 'layout-kanban', 'person-badge': 'user', 'search': 'search', 'check2-square': 'circle-check',
  'printer': 'printer', 'ticket-perforated': 'ticket', 'clipboard-check': 'clipboard-check', 'journal-text': 'notebook',
  'wallet2': 'wallet', 'pie-chart': 'chart-pie', 'receipt': 'receipt', 'receipt-cutoff': 'file-invoice',
  'database': 'database', 'file-earmark-bar-graph': 'chart-bar', 'chat-dots': 'message-circle',
  'journal-check': 'clipboard-check', 'gear': 'settings', 'gear-wide-connected': 'settings', 'people': 'users',
  'chevron-down': 'chevron-down', 'chevron-right': 'chevron-right', 'key': 'key', 'calendar3': 'calendar',
  'mail': 'mail', 'inbox': 'inbox', 'heartbeat': 'heartbeat',
};

export function getTablerIconClass(iconName: string): string {
  const ti = TABLER_ICON_MAP[iconName] || 'circle';
  return `ti ti-${ti}`;
}
