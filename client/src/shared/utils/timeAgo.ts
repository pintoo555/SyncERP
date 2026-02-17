export function formatTimeAgo(ms: number): string {
  if (ms < 0) return 'just now';
  if (ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins === 1) return '1 minute ago';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function locationFromUserAgent(ua: string): string {
  if (!ua) return 'Unknown device';
  const u = ua.toLowerCase();
  let browser = 'Browser';
  if (u.includes('firefox')) browser = 'Firefox';
  else if (u.includes('edg/')) browser = 'Edge';
  else if (u.includes('chrome')) browser = 'Chrome';
  else if (u.includes('safari') && !u.includes('chrome')) browser = 'Safari';
  let os = '';
  if (u.includes('windows')) os = 'Windows';
  else if (u.includes('mac os') || u.includes('macintosh')) os = 'Mac';
  else if (u.includes('linux')) os = 'Linux';
  else if (u.includes('android')) os = 'Android';
  else if (u.includes('iphone') || u.includes('ipad')) os = 'iOS';
  return os ? `${browser} on ${os}` : browser;
}
