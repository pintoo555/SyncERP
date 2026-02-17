/**
 * Job Cards module API.
 */
import { api } from '../../../shared/api/baseClient';

export interface JobCardListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const jobcardsApi = {
  listJobs: (params?: JobCardListParams) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    if (params?.search) search.set('search', params.search);
    if (params?.sortBy) search.set('sortBy', params.sortBy);
    if (params?.sortOrder) search.set('sortOrder', params.sortOrder);
    return api.get<{ success: boolean; data: unknown[]; total: number; hasClientAccess: boolean }>(
      `/api/jobcards?${search.toString()}`
    );
  },
  getJob: (id: number) =>
    api.get<{ success: boolean; data: unknown }>(`/api/jobcards/${id}`),
};
