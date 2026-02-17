export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'Asia/Kolkata', label: 'Kolkata, West Bengal (GMT+5:30)' },
  { value: 'Asia/Dubai', label: 'Dubai (GMT+4:00)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8:00)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (GMT+7:00)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9:00)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (GMT+8:00)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (GMT+8:00)' },
  { value: 'Europe/London', label: 'London (GMT+0:00)' },
  { value: 'Europe/Paris', label: 'Paris (GMT+1:00)' },
  { value: 'Europe/Berlin', label: 'Berlin (GMT+1:00)' },
  { value: 'America/New_York', label: 'New York (GMT-5:00)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8:00)' },
  { value: 'America/Chicago', label: 'Chicago (GMT-6:00)' },
  { value: 'Australia/Sydney', label: 'Sydney (GMT+10:00)' },
  { value: 'UTC', label: 'UTC (GMT+0:00)' },
];
