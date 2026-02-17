/**
 * Call Matrix API. List call logs (search) and dashboard stats.
 */
import { api } from '../../../shared/api/baseClient';

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

export interface CallLogListParams {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  callDirection?: string;
  callType?: string;
  fromNumber?: string;
  toNumber?: string;
  minDurationSeconds?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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

export interface CallsByHour {
  hour: number;
  count: number;
}

export interface HeatmapCell {
  dayOfWeek: number;
  hour: number;
  count: number;
}

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
  internalCount: number;
  externalCount: number;
  internalByExtension: InternalByExtension[];
}

export const callMatrixApi = {
  listCallLogs: (params: CallLogListParams = {}) => {
    const search = new URLSearchParams();
    if (params.page != null) search.set('page', String(params.page));
    if (params.pageSize != null) search.set('pageSize', String(params.pageSize));
    if (params.dateFrom) search.set('dateFrom', params.dateFrom);
    if (params.dateTo) search.set('dateTo', params.dateTo);
    if (params.callDirection) search.set('callDirection', params.callDirection);
    if (params.callType) search.set('callType', params.callType);
    if (params.fromNumber) search.set('fromNumber', params.fromNumber);
    if (params.toNumber) search.set('toNumber', params.toNumber);
    if (params.minDurationSeconds != null) search.set('minDurationSeconds', String(params.minDurationSeconds));
    if (params.sortBy) search.set('sortBy', params.sortBy);
    if (params.sortOrder) search.set('sortOrder', params.sortOrder);
    return api.get<{ success: boolean; data: CallLogRow[]; total: number }>(
      `/api/call-matrix?${search.toString()}`
    );
  },

  getDashboardStats: (params: { days?: number; dateFrom?: string; dateTo?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.dateFrom) search.set('dateFrom', params.dateFrom);
    if (params.dateTo) search.set('dateTo', params.dateTo);
    if (params.days != null && !params.dateFrom) search.set('days', String(params.days));
    return api.get<{ success: boolean; data: CallMatrixDashboardStats }>(
      `/api/call-matrix/dashboard?${search.toString()}`
    );
  },
};
