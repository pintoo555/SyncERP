/**
 * Call Matrix module types. Data from Matrix_CallLogs.
 */

export interface CallLogRow {
  callLogId: number;
  callDate: string;
  callTime: string;
  callType: string;
  callFrom: string;
  callTo: string;
  callFromNormalized: string | null;
  callToNormalized: string | null;
  callDurationSeconds: number | null;
  fileSizeBytes: number;
  recordingStart: string;
  recordingEnd: string;
  folderName: string;
  fileName: string;
  fullFilePath: string;
  callDirection: string;
  createdOn: string;
}

export interface CallLogListQuery {
  page: number;
  pageSize: number;
  dateFrom?: string;
  dateTo?: string;
  callDirection?: string;
  callType?: string;
  fromNumber?: string;
  toNumber?: string;
  minDurationSeconds?: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface CallsByDay {
  date: string;
  total: number;
  incoming: number;
  outgoing: number;
}

export interface CallsByDirection {
  direction: string;
  count: number;
}

export interface CallsByType {
  callType: string;
  count: number;
}

export interface TopCaller {
  number: string;
  count: number;
  userName?: string | null;
}

export interface TopCallee {
  number: string;
  count: number;
  userName?: string | null;
}

export interface DurationBucket {
  label: string;
  minSeconds: number;
  maxSeconds: number | null;
  count: number;
}

/** Calls per hour of day (0–23). */
export interface CallsByHour {
  hour: number;
  count: number;
}

/** Heatmap cell: dayOfWeek (1=Sun … 7=Sat), hour (0–23), count. */
export interface HeatmapCell {
  dayOfWeek: number;
  hour: number;
  count: number;
}

/** Internal calls: per-extension stats (internal records only). */
export interface InternalByExtension {
  extension: string;
  outgoingCount: number;
  incomingCount: number;
  totalCalls: number;
}

export interface CallMatrixDashboardStats {
  totalCalls: number;
  incomingCount: number;
  outgoingCount: number;
  avgDurationSeconds: number;
  callsByDay: CallsByDay[];
  callsByDirection: CallsByDirection[];
  callsByType: CallsByType[];
  topCallers: TopCaller[];
  topCallees: TopCallee[];
  durationDistribution: DurationBucket[];
  callsByHour: CallsByHour[];
  heatmap: HeatmapCell[];
  /** Internal (extension-to-extension) call count. */
  internalCount: number;
  /** External (outside) call count. */
  externalCount: number;
  /** Internal calls broken down by extension. */
  internalByExtension: InternalByExtension[];
}
