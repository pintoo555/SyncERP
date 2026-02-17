/**
 * Legacy API client - re-exports from shared for backward compatibility.
 * New code should import from @/shared/api/baseClient or module-specific api files.
 */
export { api, getSocketUrl, API_UNREACHABLE_MSG, type UploadProgressOptions } from '../shared/api/baseClient';
