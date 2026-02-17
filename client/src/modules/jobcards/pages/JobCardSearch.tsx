/**
 * Search Jobs – paginated, searchable, sortable job card list with infinite scroll.
 */

import { useEffect, useState, useRef } from 'react';
import { api } from '../../../api/client';

interface JobCardRow {
  jobId: number;
  instrument: string;
  date: string;
  manufacturer: string;
  serialNumber: string;
  weight: number | null;
  isInstrumentOut: number;
  statusOfWork: string;
  filePath: string;
  fileName: string;
  masterImageUploadID: string;
  feedbackTypeId: number | null;
  feedback: string;
  repeatCount: number | null;
  empName: string;
  clientName: string;
  clientCreatedOn: string | null;
  ownerName: string;
}

interface ApiResponse {
  success: boolean;
  data: JobCardRow[];
  total: number;
  hasClientAccess: boolean;
}

type SortField =
  | 'jobId'
  | 'instrument'
  | 'manufacturer'
  | 'date'
  | 'statusOfWork'
  | 'isInstrumentOut'
  | 'ownerName';

const SYNC_BASE = 'http://192.168.50.100/synchronics';

function thumbUrl(job: JobCardRow): string {
  if (job.masterImageUploadID && job.filePath && job.fileName && job.jobId) {
    return `${SYNC_BASE}/${job.filePath.replace(/\\/g, '/')}/${job.jobId}/Thumbnail/${job.fileName}`;
  }
  return '';
}

function fullImageUrl(job: JobCardRow): string {
  if (job.filePath && job.fileName && job.jobId) {
    return `${SYNC_BASE}/${job.filePath.replace(/\\/g, '/')}/${job.jobId}/${job.fileName}`;
  }
  return '';
}

function jobControlPanelUrl(jobId: number): string {
  return `${SYNC_BASE}/Categories/JobCards/ControlPanel.aspx?JobID=${jobId}`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}-${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;
}

function relativeDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  const dayOfWeek = now.getDay() || 7;
  if (diffDays < dayOfWeek) return 'This Week';
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
  const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  const diffYears = now.getFullYear() - d.getFullYear();
  return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
}

function clientDuration(createdOn: string | null): string {
  if (!createdOn) return '';
  const d = new Date(createdOn);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_SHORT[d.getMonth()];
  const year = d.getFullYear();
  const formattedDate = `${day}-${month}-${year}`;
  let years = now.getFullYear() - year;
  let months = now.getMonth() - d.getMonth();
  if (months < 0) { years--; months += 12; }
  return `${formattedDate} (${years} Year${years !== 1 ? 's' : ''} / ${months} Month${months !== 1 ? 's' : ''})`;
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'repaired & tested ok') return 'bg-success';
  if (s.includes('un') && s.includes('repairable')) return 'bg-warning text-dark';
  return 'bg-secondary';
}

function feedbackClass(feedback: string): string {
  if (!feedback) return 'text-success';
  const lower = feedback.toLowerCase();
  if (lower.includes('pending')) return 'text-warning';
  if (lower.includes('not') || lower.includes('bad') || lower.includes('issue') || lower.includes('negative') || lower.includes('fail') || lower.includes('error')) return 'text-danger';
  return 'text-success';
}

function ThumbCell({ job }: { job: JobCardRow }) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const src = thumbUrl(job);
  const preview = fullImageUrl(job);
  const handleEnter = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.right + 10, y: rect.top });
    setHover(true);
  };
  if (!src) {
    return <span className="text-muted" style={{ display: 'inline-block', width: 60, height: 60, lineHeight: '60px', textAlign: 'center' }}>—</span>;
  }
  return (
    <div style={{ position: 'relative' }} onMouseEnter={handleEnter} onMouseLeave={() => setHover(false)}>
      <a href={jobControlPanelUrl(job.jobId)} target="_blank" rel="noopener noreferrer">
        <img src={src} alt="thumb" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </a>
      {hover && preview && (
        <div style={{ position: 'fixed', top: pos.y, left: pos.x, width: 500, height: 340, background: '#fff', border: '1px solid #ccc', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 1050, padding: 4, borderRadius: 4 }}>
          <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 10;
const SCROLL_THRESHOLD = 400;

/** Single job card for mobile layout – all fields, touch-friendly. */
function JobCardMobile({
  job,
  hasClientAccess,
  searchByManufacturer,
}: {
  job: JobCardRow;
  hasClientAccess: boolean;
  searchByManufacturer: (name: string) => void;
}) {
  const thumb = thumbUrl(job);
  return (
    <div className="card border shadow-sm mb-3">
      <div className="card-body p-3">
        <div className="d-flex gap-3 mb-3">
          <div className="flex-shrink-0">
            {thumb ? (
              <a href={jobControlPanelUrl(job.jobId)} target="_blank" rel="noopener noreferrer">
                <img src={thumb} alt="" className="rounded" style={{ width: 72, height: 72, objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </a>
            ) : (
              <div className="rounded bg-light d-flex align-items-center justify-content-center text-muted" style={{ width: 72, height: 72 }}>—</div>
            )}
          </div>
          <div className="flex-grow-1 min-w-0">
            <a href={jobControlPanelUrl(job.jobId)} target="_blank" rel="noopener noreferrer" className="fw-bold text-primary text-decoration-none d-block mb-1">Job #{job.jobId}</a>
            <div className="fw-semibold text-dark">{job.instrument}</div>
            <div className="small text-muted">
              Sn: {job.serialNumber || 'N/A'} · Wt: {job.weight != null ? job.weight.toFixed(2) : '0.00'} Kg
              {Number(job.weight) > 10 && <span className="text-danger ms-1">▲</span>}
            </div>
            {job.feedback && (
              <div className={`small fst-italic mt-1 ${feedbackClass(job.feedback)}`}>Feedback: {job.feedback}</div>
            )}
          </div>
        </div>
        <div className="small">
          <div className="d-flex flex-wrap gap-2 mb-2">
            {job.statusOfWork && <span className={`badge ${statusBadgeClass(job.statusOfWork)}`}>{job.statusOfWork}</span>}
            <span className={`badge ${job.isInstrumentOut === 1 ? 'bg-danger' : 'bg-info text-dark'}`}>{job.isInstrumentOut === 1 ? 'Out' : 'In'}</span>
          </div>
          <div className="row g-2">
            <div className="col-6 col-sm-4">
              <span className="text-muted d-block">Manufacturer</span>
              {job.manufacturer ? (
                <button type="button" className="btn btn-link btn-sm p-0 text-primary text-decoration-underline text-start" onClick={() => searchByManufacturer(job.manufacturer)}>{job.manufacturer}</button>
              ) : (
                <span className="text-muted">—</span>
              )}
            </div>
            <div className="col-6 col-sm-4">
              <span className="text-muted d-block">Owner</span>
              <span>{job.ownerName || '—'}</span>
            </div>
            <div className="col-6 col-sm-4">
              <span className="text-muted d-block">Date</span>
              {job.date ? <span>{formatDateDisplay(job.date)}<br /><span className="text-muted">{relativeDate(job.date)}</span></span> : '—'}
            </div>
            {hasClientAccess && (job.clientName || job.empName) && (
              <div className="col-12 mt-2 pt-2 border-top">
                <span className="text-muted d-block">Client</span>
                <strong>{job.clientName}</strong>
                {job.empName && <div className="text-muted">{job.empName}</div>}
                {job.clientCreatedOn && <div className="text-muted small">{clientDuration(job.clientCreatedOn)}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JobCardSearch() {
  const [data, setData] = useState<JobCardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasClientAccess, setHasClientAccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounce(searchText, 300);
  const [sortField, setSortField] = useState<SortField>('jobId');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);
  const fetchIdRef = useRef(0);
  const searchRef = useRef(debouncedSearch);
  const sortFieldRef = useRef(sortField);
  const sortOrderRef = useRef(sortOrder);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { searchRef.current = debouncedSearch; }, [debouncedSearch]);
  useEffect(() => { sortFieldRef.current = sortField; }, [sortField]);
  useEffect(() => { sortOrderRef.current = sortOrder; }, [sortOrder]);

  const fetchFnRef = useRef<() => Promise<void>>(null!);
  fetchFnRef.current = async function fetchNextPage() {
    if (isFetchingRef.current || !hasMoreRef.current) return;
    isFetchingRef.current = true;
    const myId = fetchIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageRef.current),
        pageSize: String(PAGE_SIZE),
        search: searchRef.current,
        sortBy: sortFieldRef.current,
        sortOrder: sortOrderRef.current,
      });
      const res = await api.get<ApiResponse>(`/api/jobcards?${params}`);
      if (myId !== fetchIdRef.current) return;
      const jobs = res.data ?? [];
      setHasClientAccess(res.hasClientAccess ?? false);
      setData((prev) => {
        const existing = new Set(prev.map((p) => p.jobId));
        const unique = jobs.filter((j) => !existing.has(j.jobId));
        return [...prev, ...unique];
      });
      setTotal(res.total ?? 0);
      if (jobs.length < PAGE_SIZE) {
        hasMoreRef.current = false;
        setHasMore(false);
      }
      pageRef.current += 1;
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchIdRef.current++;
    setData([]);
    pageRef.current = 1;
    hasMoreRef.current = true;
    setHasMore(true);
    isFetchingRef.current = false;
    setInitialLoading(true);
    fetchFnRef.current();
  }, [debouncedSearch, sortField, sortOrder]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    function checkAndLoad() {
      if (isFetchingRef.current || !hasMoreRef.current) return;
      const rect = sentinel!.getBoundingClientRect();
      if (rect.top <= window.innerHeight + SCROLL_THRESHOLD) fetchFnRef.current();
    }
    document.addEventListener('scroll', checkAndLoad, { capture: true, passive: true });
    window.addEventListener('scroll', checkAndLoad, { passive: true });
    window.addEventListener('resize', checkAndLoad, { passive: true });
    const raf = requestAnimationFrame(() => checkAndLoad());
    return () => {
      document.removeEventListener('scroll', checkAndLoad, { capture: true } as EventListenerOptions);
      window.removeEventListener('scroll', checkAndLoad);
      window.removeEventListener('resize', checkAndLoad);
      cancelAnimationFrame(raf);
    };
  }, [data]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortOrder('asc'); }
  };

  const sortIcon = (field: SortField) => sortField === field ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : '';

  const searchByManufacturer = (name: string) => {
    setSearchText(name);
    searchInputRef.current?.focus();
    const contentPage = document.querySelector('.content-page');
    if (contentPage) contentPage.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0 fw-semibold">Search Jobs</h4>
      </div>
      {!hasClientAccess && !initialLoading && (
        <div className="alert alert-info py-2 small mb-3">You are signed in without Client Access. Client details are hidden for your role.</div>
      )}
      <div className="card">
        <div className="card-header border-bottom d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 gap-sm-3 py-2 py-sm-2">
          <div className="position-relative flex-grow-1" style={{ maxWidth: 460 }}>
            <input ref={searchInputRef} type="search" className="form-control" placeholder="Search by Instrument, Manufacturer, Job ID, Owner..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </div>
          <span className="text-muted small align-self-sm-center">Total: {total}</span>
        </div>
        <div className="card-body p-0">
          {/* Desktop: table (hidden on small screens) */}
          <div className="d-none d-md-block">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 80 }}>Thumb</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('jobId')}>Job ID{sortIcon('jobId')}</th>
                    <th style={{ cursor: 'pointer', minWidth: 200 }} onClick={() => handleSort('instrument')}>Instrument{sortIcon('instrument')}</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('manufacturer')}>Manufacturer{sortIcon('manufacturer')}</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('ownerName')}>Job Owner{sortIcon('ownerName')}</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('date')}>Date{sortIcon('date')}</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('statusOfWork')}>Work Status{sortIcon('statusOfWork')}</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('isInstrumentOut')}>In/Out{sortIcon('isInstrumentOut')}</th>
                    {hasClientAccess && <th>Client Details</th>}
                  </tr>
                </thead>
                <tbody>
                  {initialLoading && (
                    <tr><td colSpan={hasClientAccess ? 9 : 8} className="text-center py-5 text-muted"><div className="spinner-border spinner-border-sm me-2" role="status" />Loading...</td></tr>
                  )}
                  {!initialLoading && data.length === 0 && !loading && (
                    <tr><td colSpan={hasClientAccess ? 9 : 8} className="text-center py-5 text-muted">No records found</td></tr>
                  )}
                  {data.map((job) => (
                    <tr key={job.jobId}>
                      <td><ThumbCell job={job} /></td>
                      <td><a href={jobControlPanelUrl(job.jobId)} target="_blank" rel="noopener noreferrer" className="fw-semibold text-primary text-decoration-none">{job.jobId}</a></td>
                      <td>
                        <div><strong>{job.instrument}</strong>
                          <div className="text-muted small d-flex align-items-center">Sn: {job.serialNumber || 'N/A'} &nbsp;|&nbsp; Wt:&nbsp;<span style={{ fontWeight: Number(job.weight) > 10 ? 'bold' : 'normal', display: 'flex', alignItems: 'center' }}>{job.weight != null ? job.weight.toFixed(2) : '0.00'} Kg{Number(job.weight) > 10 && <span style={{ color: 'red', marginLeft: 4, fontSize: 12 }}>▲</span>}</span></div>
                          {job.feedback && <div className={`small fst-italic mt-1 ${feedbackClass(job.feedback)}`}>Feedback: {job.feedback}</div>}
                        </div>
                      </td>
                      <td>{job.manufacturer ? <a href="#" className="text-primary text-decoration-underline" onClick={(e) => { e.preventDefault(); searchByManufacturer(job.manufacturer); }}>{job.manufacturer}</a> : <span className="text-muted">—</span>}</td>
                      <td>{job.ownerName || <span className="text-muted">—</span>}</td>
                      <td>{job.date ? <div><div>{formatDateDisplay(job.date)}</div><div className="text-muted small">{relativeDate(job.date)}</div></div> : <span className="text-muted">—</span>}</td>
                      <td>{job.statusOfWork ? <span className={`badge ${statusBadgeClass(job.statusOfWork)}`}>{job.statusOfWork}</span> : <span className="text-muted">—</span>}</td>
                      <td><span className={`badge ${job.isInstrumentOut === 1 ? 'bg-danger' : 'bg-info text-dark'}`}>{job.isInstrumentOut === 1 ? 'Out' : 'In'}</span></td>
                      {hasClientAccess && (
                        <td>{job.clientName || job.empName ? <div><div><strong>{job.clientName}</strong></div>{job.empName && <div className="text-muted small">{job.empName}</div>}{job.clientCreatedOn && <div className="text-muted small">{clientDuration(job.clientCreatedOn)}</div>}</div> : <span className="text-muted">—</span>}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: cards (visible only on small screens) */}
          <div className="d-md-none px-3 pt-3">
            {initialLoading && (
              <div className="text-center py-5 text-muted"><div className="spinner-border spinner-border-sm me-2" role="status" />Loading...</div>
            )}
            {!initialLoading && data.length === 0 && !loading && (
              <div className="text-center py-5 text-muted">No records found</div>
            )}
            {data.map((job) => (
              <JobCardMobile key={job.jobId} job={job} hasClientAccess={hasClientAccess} searchByManufacturer={searchByManufacturer} />
            ))}
          </div>

          {loading && !initialLoading && <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-primary" role="status" /><span className="ms-2 small text-muted">Loading more...</span></div>}
          {!hasMore && data.length > 0 && !loading && <div className="text-center py-3 text-muted small">All {total} records loaded</div>}
          <div ref={sentinelRef} style={{ height: 1 }} />
        </div>
      </div>
    </div>
  );
}
