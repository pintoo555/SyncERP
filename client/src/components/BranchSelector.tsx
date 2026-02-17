/**
 * BranchSelector: dropdown in the header for switching between branches.
 * Only visible if user has access to 2+ branches.
 */

import { useBranch } from '../contexts/BranchContext';

export default function BranchSelector() {
  const { branches, currentBranch, switchBranch, loading } = useBranch();

  if (loading || branches.length < 2) return null;

  return (
    <div className="d-flex align-items-center ms-3">
      <i className="ti ti-building me-1 text-muted" style={{ fontSize: '1.1rem' }} />
      <select
        className="form-select form-select-sm"
        style={{ maxWidth: 200, fontSize: '0.85rem' }}
        value={currentBranch?.id ?? ''}
        onChange={(e) => switchBranch(Number(e.target.value))}
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.branchName} ({b.branchCode})
          </option>
        ))}
      </select>
    </div>
  );
}
