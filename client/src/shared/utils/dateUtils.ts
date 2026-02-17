/**
 * Date/time helpers using the app timezone (from AppSettings).
 */
const DEFAULT_APP_TIMEZONE = 'Asia/Kolkata';

export function formatInAppTz(
  isoString: string | null | undefined,
  timeZone: string = DEFAULT_APP_TIMEZONE,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
): string {
  if (isoString == null || isoString === '') return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { ...options, timeZone });
}

export function formatDateInAppTz(
  isoString: string | null | undefined,
  timeZone: string = DEFAULT_APP_TIMEZONE
): string {
  return formatInAppTz(isoString, timeZone, { dateStyle: 'medium' });
}

export function formatDateTimeInAppTz(
  isoString: string | null | undefined,
  timeZone: string = DEFAULT_APP_TIMEZONE
): string {
  return formatInAppTz(isoString, timeZone, { dateStyle: 'medium', timeStyle: 'short' });
}

function getOffsetMinutesAtUtc(timeZone: string, utcTimestamp: number): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  });
  const parts = formatter.formatToParts(new Date(utcTimestamp));
  const tzPart = parts.find((p) => p.type === 'timeZoneName');
  if (!tzPart) return 0;
  const m = tzPart.value.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (!m) return 0;
  const sign = m[1] === '+' ? 1 : -1;
  const hours = parseInt(m[2], 10) || 0;
  const mins = parseInt(m[3], 10) || 0;
  return sign * (hours * 60 + mins);
}

export function parseAppTzToUtc(
  localDateString: string,
  timeZone: string = DEFAULT_APP_TIMEZONE
): string {
  const s = (localDateString || '').trim();
  if (!s) return new Date().toISOString();
  const dateOnly = s.slice(0, 10);
  const [y, m, d] = dateOnly.split('-').map(Number);
  let hour = 0;
  let min = 0;
  if (s.includes('T')) {
    const timePart = s.split('T')[1] || '';
    const [h, minStr] = timePart.split(':');
    hour = parseInt(h || '0', 10);
    min = parseInt(minStr || '0', 10);
  }
  const month = (m || 1) - 1;
  const day = d || 1;
  let utcMs = Date.UTC(y, month, day, hour, min, 0, 0);
  const offsetMin = getOffsetMinutesAtUtc(timeZone, utcMs);
  utcMs -= offsetMin * 60 * 1000;
  return new Date(utcMs).toISOString();
}

export function utcToAppTzInputValue(
  isoUtc: string | null | undefined,
  timeZone: string = DEFAULT_APP_TIMEZONE,
  allDay: boolean = false
): string {
  if (isoUtc == null || isoUtc === '') return '';
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(allDay ? {} : { hour: '2-digit', minute: '2-digit', hour12: false }),
  });
  const parts = formatter.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const y = get('year');
  const mo = get('month');
  const day = get('day');
  if (allDay) return `${y}-${mo}-${day}`;
  const h = get('hour').padStart(2, '0');
  const min = get('minute').padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${min}`;
}
