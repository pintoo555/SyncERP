/**
 * Server-side date helpers. Convert DB datetime (stored as app timezone) to UTC ISO for API.
 */

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

export function localDatetimeStringToUtcIso(naiveLocalStr: string, timeZone: string): string {
  const s = (naiveLocalStr || '').trim();
  if (!s) return '';
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return s;
  const [, y, mo, d, h, min, sec] = match;
  const year = parseInt(y!, 10);
  const month = parseInt(mo!, 10) - 1;
  const day = parseInt(d!, 10);
  const hour = parseInt(h!, 10);
  const minute = parseInt(min!, 10);
  const second = parseInt(sec!, 10);
  const localAsUtcMs = Date.UTC(year, month, day, hour, minute, second);
  const offsetMin = getOffsetMinutesAtUtc(timeZone, localAsUtcMs);
  const utcMs = localAsUtcMs - offsetMin * 60 * 1000;
  return new Date(utcMs).toISOString();
}
