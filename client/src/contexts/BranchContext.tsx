/**
 * BranchContext: provides current branch, list of accessible branches, and switch functionality.
 * Stores selected branch in localStorage and exposes it for the X-Branch-Id header.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

export interface BranchInfo {
  id: number;
  branchCode: string;
  branchName: string;
  branchType: string;
}

interface BranchContextValue {
  branches: BranchInfo[];
  currentBranch: BranchInfo | null;
  switchBranch: (branchId: number) => void;
  loading: boolean;
}

const BranchCtx = createContext<BranchContextValue>({
  branches: [],
  currentBranch: null,
  switchBranch: () => {},
  loading: true,
});

const STORAGE_KEY = 'sync_selected_branch_id';

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState<BranchInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBranches = useCallback(async () => {
    if (!user) {
      setBranches([]);
      setCurrentBranch(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/organization/my-branches', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        setBranches([]);
        setCurrentBranch(null);
        setLoading(false);
        return;
      }
      const json = await res.json();
      const list: BranchInfo[] = (json.data || []).map((b: any) => ({
        id: b.id,
        branchCode: b.branchCode,
        branchName: b.branchName,
        branchType: b.branchType,
      }));
      setBranches(list);

      const savedId = localStorage.getItem(STORAGE_KEY);
      const saved = savedId ? list.find((b) => b.id === Number(savedId)) : null;
      const defaultBranch = saved || list[0] || null;
      setCurrentBranch(defaultBranch);
      if (defaultBranch) localStorage.setItem(STORAGE_KEY, String(defaultBranch.id));
    } catch {
      setBranches([]);
      setCurrentBranch(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const switchBranch = useCallback((branchId: number) => {
    const branch = branches.find((b) => b.id === branchId);
    if (branch) {
      setCurrentBranch(branch);
      localStorage.setItem(STORAGE_KEY, String(branchId));
    }
  }, [branches]);

  return (
    <BranchCtx.Provider value={{ branches, currentBranch, switchBranch, loading }}>
      {children}
    </BranchCtx.Provider>
  );
}

export function useBranch() {
  return useContext(BranchCtx);
}

/** Get the currently selected branch ID for use in headers. */
export function getSelectedBranchId(): number | null {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? Number(saved) : null;
}
