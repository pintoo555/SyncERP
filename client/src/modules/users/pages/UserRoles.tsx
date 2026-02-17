import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../api/client';
import { UserAvatar } from '../../../components/UserAvatar';

interface Role {
  roleId: number;
  roleCode: string;
  roleName: string;
  description: string | null;
  isActive: boolean;
}

interface Permission {
  permissionId: number;
  permissionCode: string;
  permissionName: string;
  moduleName: string | null;
  description: string | null;
}

interface UserListItem {
  userId: number;
  name: string;
  email: string;
  departmentId: number | null;
}

interface UserRoleRow {
  roleId: number;
  roleCode: string;
  roleName: string;
  assignedAt: string;
  assignedBy: number | null;
}

interface AuditUser {
  userId: number;
  name: string;
  email: string;
  roles: { roleId: number; roleCode: string; roleName: string }[];
  permissionOverrides: { permissionId: number; permissionCode: string; permissionName: string; moduleName: string | null }[];
}

type TabKey = 'roles' | 'users' | 'audit';

function groupByModule(permissions: Permission[]): Map<string, Permission[]> {
  const map = new Map<string, Permission[]>();
  for (const p of permissions) {
    const mod = p.moduleName || 'Other';
    if (!map.has(mod)) map.set(mod, []);
    map.get(mod)!.push(p);
  }
  return map;
}

const MODULE_ICONS: Record<string, string> = {
  Assets: 'ti-box-seam',
  Calendar: 'ti-calendar',
  Chat: 'ti-message-circle',
  Email: 'ti-mail',
  Health: 'ti-heartbeat',
  HRMS: 'ti-id-badge',
  Accounts: 'ti-wallet',
  RBAC: 'ti-shield-lock',
  Reports: 'ti-chart-bar',
  Settings: 'ti-settings',
  Other: 'ti-dots',
};

const MODULE_COLORS: Record<string, string> = {
  Assets: 'success',
  Calendar: 'info',
  Chat: 'warning',
  Email: 'primary',
  Health: 'danger',
  HRMS: 'secondary',
  Accounts: 'dark',
  RBAC: 'primary',
  Reports: 'info',
  Settings: 'secondary',
  Other: 'secondary',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'danger',
  ASSET_MANAGER: 'success',
  SUPERVISOR: 'info',
  HR_MANAGER: 'warning',
  ACCOUNTANT: 'dark',
};

function getModuleIcon(mod: string): string {
  return MODULE_ICONS[mod] || 'ti-folder';
}

function getModuleColor(mod: string): string {
  return MODULE_COLORS[mod] || 'primary';
}

function getRoleColor(roleCode: string): string {
  return ROLE_COLORS[roleCode] || 'primary';
}

export default function UserRoles() {
  const [tab, setTab] = useState<TabKey>('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [rolePermissionIds, setRolePermissionIds] = useState<Set<number>>(new Set());
  const [rolePermissionsLoading, setRolePermissionsLoading] = useState(false);
  const [roleSaveLoading, setRoleSaveLoading] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [userRoleIdsChecked, setUserRoleIdsChecked] = useState<Set<number>>(new Set());
  const [userRolesLoading, setUserRolesLoading] = useState(false);
  const [userSaveLoading, setUserSaveLoading] = useState(false);

  const [userPermissionIds, setUserPermissionIds] = useState<Set<number>>(new Set());
  const [userPermissionsLoading, setUserPermissionsLoading] = useState(false);
  const [userPermsSaveLoading, setUserPermsSaveLoading] = useState(false);

  const [permSearch, setPermSearch] = useState('');

  // Bulk selection state (User Assignment tab)
  const [bulkSelectedUserIds, setBulkSelectedUserIds] = useState<Set<number>>(new Set());
  const [bulkModalType, setBulkModalType] = useState<'assign' | 'revoke' | 'add-perms' | null>(null);
  const [bulkModalRoleIds, setBulkModalRoleIds] = useState<Set<number>>(new Set());
  const [bulkModalPermissionIds, setBulkModalPermissionIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Audit tab state
  const [auditData, setAuditData] = useState<AuditUser[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterRole, setAuditFilterRole] = useState<string>('all');
  const [auditFilterOverrides, setAuditFilterOverrides] = useState<'all' | 'with' | 'without'>('all');
  const [auditExpandedUserId, setAuditExpandedUserId] = useState<number | null>(null);

  const loadRoles = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<{ success: boolean; data: Role[] }>('/api/rbac/roles')
      .then((res) => setRoles(res.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadPermissions = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<{ success: boolean; data: Permission[] }>('/api/rbac/permissions')
      .then((res) => setPermissions(res.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadUsers = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<{ success: boolean; data: UserListItem[] }>('/api/users')
      .then((res) => setUsers(res.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadAuditData = useCallback(() => {
    setAuditLoading(true);
    setError(null);
    api.get<{ success: boolean; data: AuditUser[] }>('/api/rbac/audit-overview')
      .then((res) => setAuditData(res.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setAuditLoading(false));
  }, []);

  useEffect(() => {
    if (bulkModalType) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [bulkModalType]);

  useEffect(() => {
    if (tab === 'roles') {
      loadRoles();
      loadPermissions();
    } else if (tab === 'users') {
      loadRoles();
      loadUsers();
      loadPermissions();
    } else if (tab === 'audit') {
      loadRoles();
      loadAuditData();
    }
  }, [tab, loadRoles, loadPermissions, loadUsers, loadAuditData]);

  useEffect(() => {
    if (tab !== 'roles' || !selectedRoleId) return;
    setRolePermissionsLoading(true);
    api.get<{ success: boolean; data: number[] }>(`/api/rbac/roles/${selectedRoleId}/permissions`)
      .then((res) => setRolePermissionIds(new Set(res.data || [])))
      .catch(() => setRolePermissionIds(new Set()))
      .finally(() => setRolePermissionsLoading(false));
  }, [tab, selectedRoleId]);

  useEffect(() => {
    if (tab !== 'users' || !selectedUserId) return;
    setUserRolesLoading(true);
    api.get<{ success: boolean; data: UserRoleRow[] }>(`/api/rbac/user-roles/${selectedUserId}`)
      .then((res) => {
        const list = res.data || [];
        setUserRoles(list);
        setUserRoleIdsChecked(new Set(list.map((r) => r.roleId)));
      })
      .catch(() => {
        setUserRoles([]);
        setUserRoleIdsChecked(new Set());
      })
      .finally(() => setUserRolesLoading(false));
  }, [tab, selectedUserId]);

  useEffect(() => {
    if (tab !== 'users' || !selectedUserId) return;
    setUserPermissionsLoading(true);
    api.get<{ success: boolean; data: number[] }>(`/api/rbac/user-permissions/${selectedUserId}`)
      .then((res) => setUserPermissionIds(new Set(res.data || [])))
      .catch(() => setUserPermissionIds(new Set()))
      .finally(() => setUserPermissionsLoading(false));
  }, [tab, selectedUserId]);

  const toggleRolePermission = (permissionId: number) => {
    setRolePermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  };

  const toggleModulePermissions = (perms: Permission[], checked: boolean, setter: (fn: (prev: Set<number>) => Set<number>) => void) => {
    setter((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (checked) next.add(p.permissionId);
        else next.delete(p.permissionId);
      }
      return next;
    });
  };

  const saveRolePermissions = () => {
    if (!selectedRoleId) return;
    setRoleSaveLoading(true);
    setError(null);
    api.put(`/api/rbac/roles/${selectedRoleId}/permissions`, {
      permissionIds: Array.from(rolePermissionIds),
    })
      .then(() => { setSuccessMsg('Role permissions saved successfully'); setTimeout(() => setSuccessMsg(null), 3000); })
      .catch((e) => setError(e.message))
      .finally(() => setRoleSaveLoading(false));
  };

  const toggleUserRole = (roleId: number) => {
    setUserRoleIdsChecked((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const saveUserRoles = () => {
    if (!selectedUserId) return;
    const current = new Set(userRoles.map((r) => r.roleId));
    const desired = userRoleIdsChecked;
    const toAssign = [...desired].filter((id) => !current.has(id));
    const toRevoke = [...current].filter((id) => !desired.has(id));
    setUserSaveLoading(true);
    setError(null);
    const run = async () => {
      for (const roleId of toRevoke) {
        await api.post('/api/rbac/user-roles/revoke', { userId: selectedUserId, roleId });
      }
      for (const roleId of toAssign) {
        await api.post('/api/rbac/user-roles/assign', { userId: selectedUserId, roleId });
      }
    };
    run()
      .then(() => {
        setUserRoles((prev) =>
          prev.filter((r) => desired.has(r.roleId)).concat(
            toAssign.map((roleId) => {
              const r = roles.find((x) => x.roleId === roleId);
              return {
                roleId,
                roleCode: r?.roleCode ?? '',
                roleName: r?.roleName ?? '',
                assignedAt: new Date().toISOString(),
                assignedBy: null,
              };
            })
          )
        );
        setUserRoleIdsChecked(desired);
        setSuccessMsg('User roles saved successfully');
        setTimeout(() => setSuccessMsg(null), 3000);
      })
      .catch((e) => setError(e.message))
      .finally(() => setUserSaveLoading(false));
  };

  const toggleUserPermission = (permissionId: number) => {
    setUserPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  };

  const saveUserPermissions = () => {
    if (!selectedUserId) return;
    setUserPermsSaveLoading(true);
    setError(null);
    api.put(`/api/rbac/user-permissions/${selectedUserId}`, {
      permissionIds: Array.from(userPermissionIds),
    })
      .then(() => { setSuccessMsg('Permission overrides saved successfully'); setTimeout(() => setSuccessMsg(null), 3000); })
      .catch((e) => setError(e.message))
      .finally(() => setUserPermsSaveLoading(false));
  };

  const toggleBulkSelectUser = (userId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setBulkSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleBulkSelectAll = () => {
    if (bulkSelectedUserIds.size >= filteredUsers.length) {
      setBulkSelectedUserIds(new Set());
    } else {
      setBulkSelectedUserIds(new Set(filteredUsers.map((u) => u.userId)));
    }
  };

  const openBulkModal = (type: 'assign' | 'revoke' | 'add-perms') => {
    setBulkModalType(type);
    setBulkModalRoleIds(new Set());
    setBulkModalPermissionIds(new Set());
  };

  const closeBulkModal = () => {
    setBulkModalType(null);
    setBulkModalRoleIds(new Set());
    setBulkModalPermissionIds(new Set());
  };

  const bulkAssignRolesSubmit = () => {
    const userIds = Array.from(bulkSelectedUserIds);
    const roleIds = Array.from(bulkModalRoleIds);
    const selUserId = selectedUserId;
    if (userIds.length === 0 || roleIds.length === 0) return;
    setBulkLoading(true);
    setError(null);
    api.post('/api/rbac/user-roles/bulk-assign', { userIds, roleIds })
      .then(() => {
        setSuccessMsg(`Assigned ${roleIds.length} role(s) to ${userIds.length} user(s)`);
        setTimeout(() => setSuccessMsg(null), 4000);
        setBulkSelectedUserIds(new Set());
        closeBulkModal();
        loadAuditData();
        if (selUserId && userIds.includes(selUserId)) {
          api.get<{ success: boolean; data: UserRoleRow[] }>(`/api/rbac/user-roles/${selUserId}`).then((res) => {
            const list = res.data || [];
            setUserRoles(list);
            setUserRoleIdsChecked(new Set(list.map((r) => r.roleId)));
          });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setBulkLoading(false));
  };

  const bulkRevokeRolesSubmit = () => {
    const userIds = Array.from(bulkSelectedUserIds);
    const roleIds = Array.from(bulkModalRoleIds);
    const selUserId = selectedUserId;
    if (userIds.length === 0 || roleIds.length === 0) return;
    setBulkLoading(true);
    setError(null);
    api.post('/api/rbac/user-roles/bulk-revoke', { userIds, roleIds })
      .then(() => {
        setSuccessMsg(`Revoked ${roleIds.length} role(s) from ${userIds.length} user(s)`);
        setTimeout(() => setSuccessMsg(null), 4000);
        setBulkSelectedUserIds(new Set());
        closeBulkModal();
        loadAuditData();
        if (selUserId && userIds.includes(selUserId)) {
          api.get<{ success: boolean; data: UserRoleRow[] }>(`/api/rbac/user-roles/${selUserId}`).then((res) => {
            const list = res.data || [];
            setUserRoles(list);
            setUserRoleIdsChecked(new Set(list.map((r) => r.roleId)));
          });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setBulkLoading(false));
  };

  const bulkAddPermissionsSubmit = () => {
    const userIds = Array.from(bulkSelectedUserIds);
    const permissionIds = Array.from(bulkModalPermissionIds);
    const selUserId = selectedUserId;
    if (userIds.length === 0 || permissionIds.length === 0) return;
    setBulkLoading(true);
    setError(null);
    api.post('/api/rbac/user-permissions/bulk-add', { userIds, permissionIds })
      .then(() => {
        setSuccessMsg(`Added ${permissionIds.length} permission(s) to ${userIds.length} user(s)`);
        setTimeout(() => setSuccessMsg(null), 4000);
        setBulkSelectedUserIds(new Set());
        closeBulkModal();
        loadAuditData();
        if (selUserId && userIds.includes(selUserId)) {
          api.get<{ success: boolean; data: number[] }>(`/api/rbac/user-permissions/${selUserId}`).then((res) => {
            setUserPermissionIds(new Set(res.data || []));
          });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setBulkLoading(false));
  };

  const byModule = groupByModule(permissions);
  const filteredRoles = roles.filter(
    (r) => !roleSearch.trim() || r.roleName.toLowerCase().includes(roleSearch.toLowerCase()) || r.roleCode.toLowerCase().includes(roleSearch.toLowerCase())
  );
  const filteredUsers = users.filter(
    (u) => !userSearch.trim() || u.name.toLowerCase().includes(userSearch.toLowerCase()) || (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
  );
  const selectedRole = roles.find((r) => r.roleId === selectedRoleId);
  const selectedUser = users.find((u) => u.userId === selectedUserId);

  const filterPerms = (perms: Permission[]) => {
    if (!permSearch.trim()) return perms;
    const q = permSearch.toLowerCase();
    return perms.filter((p) => p.permissionName.toLowerCase().includes(q) || p.permissionCode.toLowerCase().includes(q));
  };

  // Audit tab computed values
  const auditUsersWithOverrides = auditData.filter((u) => u.permissionOverrides.length > 0).length;
  const auditUsersWithoutRoles = auditData.filter((u) => u.roles.length === 0).length;

  const filteredAuditUsers = auditData.filter((u) => {
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q)) return false;
    }
    if (auditFilterRole !== 'all') {
      if (!u.roles.some((r) => r.roleCode === auditFilterRole)) return false;
    }
    if (auditFilterOverrides === 'with' && u.permissionOverrides.length === 0) return false;
    if (auditFilterOverrides === 'without' && u.permissionOverrides.length > 0) return false;
    return true;
  });

  const renderPermissionGrid = (
    permIds: Set<number>,
    toggleFn: (id: number) => void,
    setterFn: (fn: (prev: Set<number>) => Set<number>) => void,
    idPrefix: string,
    colorScheme: 'primary' | 'secondary',
  ) => {
    const sortedModules = Array.from(byModule.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    return (
      <div className="d-flex flex-column gap-4">
        {sortedModules.map(([moduleName, perms]) => {
          const filtered = filterPerms(perms);
          if (filtered.length === 0) return null;
          const color = getModuleColor(moduleName);
          const icon = getModuleIcon(moduleName);
          const checkedCount = filtered.filter((p) => permIds.has(p.permissionId)).length;
          const allChecked = checkedCount === filtered.length;
          const someChecked = checkedCount > 0 && !allChecked;

          return (
            <div key={moduleName} className="card border-0 shadow-sm overflow-hidden">
              <div className={`card-header bg-${color} bg-opacity-10 border-bottom py-3`}>
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <span className={`rounded-circle bg-${color} bg-opacity-25 d-inline-flex align-items-center justify-content-center`} style={{ width: 34, height: 34 }}>
                      <i className={`ti ${icon} text-${color}`} />
                    </span>
                    <h6 className="mb-0 fw-bold">{moduleName}</h6>
                    <span className={`badge bg-${color} bg-opacity-25 text-${color} ms-1`}>
                      {checkedCount}/{filtered.length}
                    </span>
                  </div>
                  <div className="form-check form-switch mb-0">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      role="switch"
                      id={`${idPrefix}-all-${moduleName}`}
                      checked={allChecked}
                      ref={(el) => { if (el) el.indeterminate = someChecked; }}
                      onChange={(e) => toggleModulePermissions(filtered, e.target.checked, setterFn)}
                    />
                    <label className="form-check-label small fw-semibold" htmlFor={`${idPrefix}-all-${moduleName}`}>
                      {allChecked ? 'Deselect all' : 'Select all'}
                    </label>
                  </div>
                </div>
              </div>
              <div className="card-body py-3">
                <div className="row g-2">
                  {filtered.map((p) => {
                    const isChecked = permIds.has(p.permissionId);
                    return (
                      <div key={p.permissionId} className="col-12 col-sm-6 col-xl-4">
                        <label
                          htmlFor={`${idPrefix}-${p.permissionId}`}
                          className={`d-flex align-items-center gap-2 rounded-3 px-3 py-2 w-100 cursor-pointer ${isChecked ? `bg-${colorScheme} bg-opacity-10 border border-${colorScheme} border-opacity-25` : 'border bg-body-tertiary bg-opacity-50'}`}
                          style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                        >
                          <div className="form-check form-switch mb-0 p-0">
                            <input
                              type="checkbox"
                              className="form-check-input ms-0"
                              role="switch"
                              id={`${idPrefix}-${p.permissionId}`}
                              checked={isChecked}
                              onChange={() => toggleFn(p.permissionId)}
                            />
                          </div>
                          <div className="min-w-0 flex-grow-1">
                            <div className={`small ${isChecked ? 'fw-semibold' : 'text-body-secondary'}`}>{p.permissionName}</div>
                            {p.description && <div className="text-muted small text-truncate" style={{ fontSize: '0.75rem' }}>{p.description}</div>}
                          </div>
                          {isChecked && <i className={`ti ti-circle-check text-${colorScheme} flex-shrink-0`} />}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container-fluid py-4">
      {/* Page header */}
      <div className="row mb-4 align-items-center">
        <div className="col">
          <h2 className="mb-1 fw-bold">
            <i className="ti ti-shield-lock me-2 text-primary" />
            Users &amp; Roles
          </h2>
          <p className="text-muted mb-0">Manage roles, permissions, and user access control</p>
        </div>
        <div className="col-auto">
          <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2">
            <i className="ti ti-shield me-1" />
            {roles.length} Roles
          </span>
          <span className="badge bg-success bg-opacity-10 text-success px-3 py-2 ms-2">
            <i className="ti ti-users me-1" />
            {users.length || '...'} Users
          </span>
          <span className="badge bg-info bg-opacity-10 text-info px-3 py-2 ms-2">
            <i className="ti ti-key me-1" />
            {permissions.length} Permissions
          </span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          <i className="ti ti-alert-circle me-2" />{error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
          <i className="ti ti-circle-check me-2" />{successMsg}
          <button type="button" className="btn-close" onClick={() => setSuccessMsg(null)} aria-label="Close" />
        </div>
      )}

      {/* Tab navigation */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body py-2 px-3">
          <ul className="nav nav-pills">
            <li className="nav-item">
              <button type="button" className={`nav-link px-4 py-2 ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>
                <i className="ti ti-shield-lock me-2" />Roles &amp; Permissions
              </button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link px-4 py-2 ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
                <i className="ti ti-user-check me-2" />User Assignment
              </button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link px-4 py-2 ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>
                <i className="ti ti-list-search me-2" />Audit Overview
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* ─── TAB: Roles & Permissions ─── */}
      {tab === 'roles' && (
        <div className="row g-4">
          <div className="col-lg-3">
            <div className="card border-0 shadow-sm" style={{ position: 'sticky', top: 16 }}>
              <div className="card-header bg-transparent border-bottom py-3">
                <h6 className="mb-2 fw-bold"><i className="ti ti-shield me-2 text-primary" />Roles</h6>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light border-end-0"><i className="ti ti-search text-muted" /></span>
                  <input type="text" className="form-control border-start-0 bg-light" placeholder="Search roles..." value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} />
                </div>
              </div>
              <div className="card-body p-0 overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                {loading ? (
                  <div className="p-4 text-center text-muted"><div className="spinner-border spinner-border-sm me-2" />Loading...</div>
                ) : filteredRoles.length === 0 ? (
                  <div className="p-4 text-center text-muted small">No roles found</div>
                ) : (
                  <div className="list-group list-group-flush">
                    {filteredRoles.map((r) => {
                      const isActive = selectedRoleId === r.roleId;
                      return (
                        <button key={r.roleId} type="button" className={`list-group-item list-group-item-action border-0 py-3 px-3 ${isActive ? 'active' : ''}`} onClick={() => setSelectedRoleId(r.roleId)}>
                          <div className="d-flex align-items-center gap-2">
                            <span className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${isActive ? 'bg-white bg-opacity-25' : 'bg-primary bg-opacity-10'}`} style={{ width: 36, height: 36 }}>
                              <i className={`ti ti-shield ${isActive ? 'text-white' : 'text-primary'}`} />
                            </span>
                            <div className="min-w-0 flex-grow-1 text-start">
                              <div className="fw-semibold text-truncate">{r.roleName}</div>
                              <div className={`small ${isActive ? 'text-white-50' : 'text-muted'}`}>{r.roleCode}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="col-lg-9">
            {selectedRoleId ? (
              <div className="d-flex flex-column gap-4">
                <div className="card border-0 shadow-sm">
                  <div className="card-body py-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div className="d-flex align-items-center gap-3">
                      <span className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                        <i className="ti ti-key text-primary fs-4" />
                      </span>
                      <div>
                        <h5 className="mb-0 fw-bold">{selectedRole?.roleName}</h5>
                        <span className="text-muted small">{selectedRole?.roleCode} &mdash; {rolePermissionIds.size} permission{rolePermissionIds.size !== 1 ? 's' : ''} granted</span>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div className="input-group input-group-sm" style={{ maxWidth: 240 }}>
                        <span className="input-group-text bg-light border-end-0"><i className="ti ti-search text-muted" /></span>
                        <input type="text" className="form-control border-start-0 bg-light" placeholder="Filter permissions..." value={permSearch} onChange={(e) => setPermSearch(e.target.value)} />
                      </div>
                      <button type="button" className="btn btn-primary px-4" disabled={roleSaveLoading} onClick={saveRolePermissions}>
                        {roleSaveLoading ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : <><i className="ti ti-device-floppy me-2" />Save Permissions</>}
                      </button>
                    </div>
                  </div>
                </div>
                {rolePermissionsLoading ? (
                  <div className="card border-0 shadow-sm"><div className="card-body py-5 text-center text-muted"><div className="spinner-border me-2" />Loading permissions...</div></div>
                ) : (
                  renderPermissionGrid(rolePermissionIds, toggleRolePermission, setRolePermissionIds, 'rp', 'primary')
                )}
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body d-flex flex-column align-items-center justify-content-center text-center" style={{ minHeight: 400 }}>
                  <span className="rounded-circle bg-primary bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 80, height: 80 }}>
                    <i className="ti ti-shield-lock fs-1 text-primary" />
                  </span>
                  <h5 className="mb-2">Select a Role</h5>
                  <p className="text-muted small mb-0" style={{ maxWidth: 320 }}>Choose a role from the sidebar to view and manage its permissions across all modules</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: User Assignment ─── */}
      {tab === 'users' && (
        <div className="row g-4">
          <div className="col-lg-3">
            <div className="card border-0 shadow-sm" style={{ position: 'sticky', top: 16 }}>
              <div className="card-header bg-transparent border-bottom py-3">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <h6 className="mb-0 fw-bold"><i className="ti ti-users me-2 text-primary" />Users</h6>
                  {filteredUsers.length > 0 && (
                    <label className="form-check mb-0 ms-auto" title="Select all">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={bulkSelectedUserIds.size === filteredUsers.length}
                        ref={(el) => { if (el) el.indeterminate = bulkSelectedUserIds.size > 0 && bulkSelectedUserIds.size < filteredUsers.length; }}
                        onChange={toggleBulkSelectAll}
                      />
                      <span className="form-check-label small text-muted">All</span>
                    </label>
                  )}
                </div>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light border-end-0"><i className="ti ti-search text-muted" /></span>
                  <input type="text" className="form-control border-start-0 bg-light" placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                </div>
                {bulkSelectedUserIds.size > 0 && (
                  <div className="mt-2 p-2 rounded bg-primary bg-opacity-10 border border-primary border-opacity-25">
                    <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                      <span className="small fw-semibold text-primary">{bulkSelectedUserIds.size} selected</span>
                      <div className="d-flex flex-wrap gap-1">
                        <button type="button" className="btn btn-sm btn-primary py-1 px-2" onClick={(e) => { e.stopPropagation(); openBulkModal('assign'); }} title="Assign roles">
                          <i className="ti ti-user-plus me-1" style={{ fontSize: '0.75rem' }} />Roles
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-danger py-1 px-2" onClick={(e) => { e.stopPropagation(); openBulkModal('revoke'); }} title="Revoke roles">
                          <i className="ti ti-user-minus me-1" style={{ fontSize: '0.75rem' }} />Revoke
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-secondary py-1 px-2" onClick={(e) => { e.stopPropagation(); openBulkModal('add-perms'); }} title="Add permission overrides">
                          <i className="ti ti-key me-1" style={{ fontSize: '0.75rem' }} />Perms
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-secondary py-1 px-2" onClick={() => setBulkSelectedUserIds(new Set())} title="Clear selection">
                          <i className="ti ti-x" style={{ fontSize: '0.75rem' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="card-body p-0 overflow-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                {loading ? (
                  <div className="p-4 text-center text-muted"><div className="spinner-border spinner-border-sm me-2" />Loading...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-muted small">No users found</div>
                ) : (
                  <div className="list-group list-group-flush">
                    {filteredUsers.map((u) => {
                      const isActive = selectedUserId === u.userId;
                      const isBulkSelected = bulkSelectedUserIds.has(u.userId);
                      return (
                        <div
                          key={u.userId}
                          role="button"
                          tabIndex={0}
                          className={`list-group-item list-group-item-action border-0 py-3 px-3 d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}
                          onClick={() => setSelectedUserId(u.userId)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedUserId(u.userId); } }}
                        >
                          <div
                            className="form-check flex-shrink-0"
                            onClick={(e) => toggleBulkSelectUser(u.userId, e)}
                            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBulkSelectUser(u.userId); } }}
                            role="button"
                            tabIndex={0}
                          >
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={isBulkSelected}
                              onChange={() => toggleBulkSelectUser(u.userId)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <UserAvatar userId={u.userId} name={u.name} size={34} className="flex-shrink-0" />
                          <div className="min-w-0 flex-grow-1 text-start">
                            <div className="fw-semibold text-truncate">{u.name}</div>
                            <div className={`small text-truncate ${isActive ? 'text-white-50' : 'text-muted'}`}>{u.email || '\u2014'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="col-lg-9">
            {selectedUserId ? (
              <div className="d-flex flex-column gap-4">
                <div className="card border-0 shadow-sm">
                  <div className="card-body py-3 d-flex flex-wrap align-items-center gap-3">
                    <UserAvatar userId={selectedUserId} name={selectedUser?.name ?? ''} size={48} className="flex-shrink-0" />
                    <div className="flex-grow-1">
                      <h5 className="mb-0 fw-bold">{selectedUser?.name}</h5>
                      <span className="text-muted small">{selectedUser?.email}</span>
                    </div>
                    <div>
                      <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2">
                        {userRoleIdsChecked.size} role{userRoleIdsChecked.size !== 1 ? 's' : ''} assigned
                      </span>
                    </div>
                  </div>
                </div>
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-transparent border-bottom py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div>
                      <h6 className="mb-1 fw-bold"><i className="ti ti-user-check me-2 text-primary" />Role Assignment</h6>
                      <p className="text-muted small mb-0">Select which roles this user should have</p>
                    </div>
                    <button type="button" className="btn btn-primary px-4" disabled={userSaveLoading} onClick={saveUserRoles}>
                      {userSaveLoading ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : <><i className="ti ti-device-floppy me-2" />Save Roles</>}
                    </button>
                  </div>
                  <div className="card-body">
                    {userRolesLoading ? (
                      <div className="py-4 text-center text-muted"><div className="spinner-border spinner-border-sm me-2" />Loading...</div>
                    ) : (
                      <div className="row g-3">
                        {roles.map((r) => {
                          const isChecked = userRoleIdsChecked.has(r.roleId);
                          return (
                            <div key={r.roleId} className="col-12 col-md-6 col-xl-4">
                              <label htmlFor={`ur-${r.roleId}`} className={`d-flex align-items-center gap-3 rounded-3 p-3 w-100 ${isChecked ? 'bg-primary bg-opacity-10 border border-primary border-opacity-25' : 'border bg-body-tertiary bg-opacity-50'}`} style={{ cursor: 'pointer', transition: 'all 0.15s' }}>
                                <div className="form-check form-switch mb-0 p-0">
                                  <input type="checkbox" className="form-check-input ms-0" role="switch" id={`ur-${r.roleId}`} checked={isChecked} onChange={() => toggleUserRole(r.roleId)} />
                                </div>
                                <div className="min-w-0 flex-grow-1">
                                  <div className={`fw-semibold ${isChecked ? '' : 'text-body-secondary'}`}>{r.roleName}</div>
                                  <div className="small text-muted">{r.roleCode}</div>
                                  {r.description && <div className="text-muted small mt-1" style={{ fontSize: '0.75rem' }}>{r.description}</div>}
                                </div>
                                {isChecked && <i className="ti ti-circle-check text-primary flex-shrink-0 fs-5" />}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-transparent border-bottom py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div>
                      <h6 className="mb-1 fw-bold"><i className="ti ti-key me-2 text-warning" />Permission Overrides</h6>
                      <p className="text-muted small mb-0">Grant additional permissions beyond assigned roles</p>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div className="input-group input-group-sm" style={{ maxWidth: 220 }}>
                        <span className="input-group-text bg-light border-end-0"><i className="ti ti-search text-muted" /></span>
                        <input type="text" className="form-control border-start-0 bg-light" placeholder="Filter permissions..." value={permSearch} onChange={(e) => setPermSearch(e.target.value)} />
                      </div>
                      <button type="button" className="btn btn-outline-primary px-4" disabled={userPermsSaveLoading} onClick={saveUserPermissions}>
                        {userPermsSaveLoading ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : <><i className="ti ti-device-floppy me-2" />Save Overrides</>}
                      </button>
                    </div>
                  </div>
                </div>
                {userPermissionsLoading ? (
                  <div className="card border-0 shadow-sm"><div className="card-body py-5 text-center text-muted"><div className="spinner-border me-2" />Loading...</div></div>
                ) : (
                  renderPermissionGrid(userPermissionIds, toggleUserPermission, setUserPermissionIds, 'up', 'secondary')
                )}
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body d-flex flex-column align-items-center justify-content-center text-center" style={{ minHeight: 400 }}>
                  <span className="rounded-circle bg-primary bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 80, height: 80 }}>
                    <i className="ti ti-user-search fs-1 text-primary" />
                  </span>
                  <h5 className="mb-2">Select a User</h5>
                  <p className="text-muted small mb-0" style={{ maxWidth: 320 }}>Choose a user from the sidebar to manage their roles and permission overrides</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: Audit Overview ─── */}
      {tab === 'audit' && (
        <div className="d-flex flex-column gap-4">
          {/* Summary KPI cards */}
          <div className="row g-3">
            <div className="col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body py-3 d-flex align-items-center gap-3">
                  <span className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                    <i className="ti ti-users text-primary fs-4" />
                  </span>
                  <div>
                    <div className="text-muted small">Total Users</div>
                    <h4 className="mb-0 fw-bold">{auditData.length}</h4>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body py-3 d-flex align-items-center gap-3">
                  <span className="rounded-circle bg-warning bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                    <i className="ti ti-alert-triangle text-warning fs-4" />
                  </span>
                  <div>
                    <div className="text-muted small">With Overrides</div>
                    <h4 className="mb-0 fw-bold">{auditUsersWithOverrides}</h4>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body py-3 d-flex align-items-center gap-3">
                  <span className="rounded-circle bg-danger bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                    <i className="ti ti-user-off text-danger fs-4" />
                  </span>
                  <div>
                    <div className="text-muted small">No Roles Assigned</div>
                    <h4 className="mb-0 fw-bold">{auditUsersWithoutRoles}</h4>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body py-3 d-flex align-items-center gap-3">
                  <span className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                    <i className="ti ti-shield-check text-success fs-4" />
                  </span>
                  <div>
                    <div className="text-muted small">Available Roles</div>
                    <h4 className="mb-0 fw-bold">{roles.length}</h4>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters bar */}
          <div className="card border-0 shadow-sm">
            <div className="card-body py-3">
              <div className="row g-3 align-items-end">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold text-muted mb-1">Search users</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0"><i className="ti ti-search text-muted" /></span>
                    <input type="text" className="form-control border-start-0 bg-light" placeholder="Search by name or email..." value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} />
                  </div>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold text-muted mb-1">Filter by role</label>
                  <select className="form-select" value={auditFilterRole} onChange={(e) => setAuditFilterRole(e.target.value)}>
                    <option value="all">All Roles</option>
                    {roles.map((r) => (
                      <option key={r.roleId} value={r.roleCode}>{r.roleName}</option>
                    ))}
                    <option value="__none__">No roles assigned</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold text-muted mb-1">Permission overrides</label>
                  <select className="form-select" value={auditFilterOverrides} onChange={(e) => setAuditFilterOverrides(e.target.value as 'all' | 'with' | 'without')}>
                    <option value="all">All Users</option>
                    <option value="with">With Overrides Only</option>
                    <option value="without">Without Overrides</option>
                  </select>
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <button type="button" className="btn btn-outline-secondary w-100" onClick={loadAuditData}>
                    <i className="ti ti-refresh me-1" />Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* User list */}
          {auditLoading ? (
            <div className="card border-0 shadow-sm">
              <div className="card-body py-5 text-center text-muted">
                <div className="spinner-border me-2" />Loading audit data...
              </div>
            </div>
          ) : filteredAuditUsers.length === 0 ? (
            <div className="card border-0 shadow-sm">
              <div className="card-body py-5 text-center text-muted">
                <i className="ti ti-search fs-1 d-block mb-2" />
                No users match the current filters.
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              <div className="text-muted small fw-semibold px-1">
                Showing {filteredAuditUsers.length} of {auditData.length} users
              </div>

              {/* Handle "no roles" filter specifically */}
              {(auditFilterRole === '__none__'
                ? filteredAuditUsers.filter((u) => u.roles.length === 0)
                : filteredAuditUsers
              ).map((u) => {
                const hasOverrides = u.permissionOverrides.length > 0;
                const hasNoRoles = u.roles.length === 0;
                const isExpanded = auditExpandedUserId === u.userId;

                const overridesByModule = new Map<string, typeof u.permissionOverrides>();
                for (const p of u.permissionOverrides) {
                  const mod = p.moduleName || 'Other';
                  if (!overridesByModule.has(mod)) overridesByModule.set(mod, []);
                  overridesByModule.get(mod)!.push(p);
                }

                return (
                  <div
                    key={u.userId}
                    className={`card border-0 shadow-sm overflow-hidden ${hasOverrides ? 'border-start border-4 border-warning' : ''} ${hasNoRoles ? 'border-start border-4 border-danger' : ''}`}
                  >
                    <div
                      className="card-body py-3"
                      style={{ cursor: hasOverrides ? 'pointer' : 'default' }}
                      onClick={() => hasOverrides && setAuditExpandedUserId(isExpanded ? null : u.userId)}
                    >
                      <div className="d-flex align-items-start gap-3">
                        {/* Avatar */}
                        <div className="flex-shrink-0" style={{ marginTop: 2 }}>
                          <UserAvatar userId={u.userId} name={u.name} size={42} />
                        </div>

                        {/* User info + roles */}
                        <div className="flex-grow-1 min-w-0">
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <h6 className="mb-0 fw-bold">{u.name}</h6>
                            {hasOverrides && (
                              <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1" style={{ fontSize: '0.7rem' }}>
                                <i className="ti ti-alert-triangle" style={{ fontSize: '0.7rem' }} />
                                {u.permissionOverrides.length} Override{u.permissionOverrides.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {hasNoRoles && (
                              <span className="badge bg-danger text-white" style={{ fontSize: '0.7rem' }}>
                                <i className="ti ti-alert-circle me-1" style={{ fontSize: '0.7rem' }} />No Roles
                              </span>
                            )}
                          </div>
                          <div className="text-muted small mb-2">{u.email || '\u2014'}</div>

                          {/* Role badges */}
                          {u.roles.length > 0 && (
                            <div className="d-flex flex-wrap gap-2">
                              {u.roles.map((r) => {
                                const color = getRoleColor(r.roleCode);
                                const textCls = color === 'warning' ? 'text-dark' : 'text-white';
                                return (
                                  <span key={r.roleId} className={`badge bg-${color} ${textCls} d-inline-flex align-items-center py-1 px-2`} style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                    <i className="ti ti-shield me-1" style={{ fontSize: '0.7rem' }} />{r.roleName}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Expand chevron for users with overrides */}
                        {hasOverrides && (
                          <i className={`ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'} text-muted flex-shrink-0`} style={{ marginTop: 4 }} />
                        )}
                      </div>
                    </div>

                    {/* Expanded override details */}
                    {hasOverrides && isExpanded && (
                      <div className="border-top bg-warning bg-opacity-10">
                        <div className="px-3 py-2">
                          <div className="d-flex align-items-center gap-2 mb-2">
                            <i className="ti ti-alert-triangle text-warning" />
                            <span className="fw-bold small text-warning">Permission Overrides</span>
                            <span className="text-muted small">({u.permissionOverrides.length} extra permission{u.permissionOverrides.length !== 1 ? 's' : ''} beyond roles)</span>
                          </div>
                          <div className="d-flex flex-column gap-2">
                            {Array.from(overridesByModule.entries())
                              .sort((a, b) => a[0].localeCompare(b[0]))
                              .map(([moduleName, perms]) => {
                                const color = getModuleColor(moduleName);
                                const icon = getModuleIcon(moduleName);
                                return (
                                  <div key={moduleName}>
                                    <div className="d-flex align-items-center gap-1 mb-1">
                                      <i className={`ti ${icon} text-${color}`} style={{ fontSize: '0.8rem' }} />
                                      <span className="fw-semibold small">{moduleName}</span>
                                    </div>
                                    <div className="d-flex flex-wrap gap-1 ms-3">
                                      {perms.map((p) => (
                                        <span key={p.permissionId} className={`badge bg-${color} bg-opacity-10 text-${color} border border-${color} border-opacity-25 fw-normal`} style={{ fontSize: '0.7rem' }}>
                                          {p.permissionName}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bulk Assign/Revoke Roles & Add Permissions Modal - fixed overlay so it always appears on top */}
      {bulkModalType ? (
        <div
          className="modal show d-block"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1060,
            backgroundColor: 'rgba(0,0,0,0.5)',
            overflowX: 'hidden',
            overflowY: 'auto',
          }}
          onClick={closeBulkModal}
          onKeyDown={(e) => e.key === 'Escape' && closeBulkModal()}
          role="dialog"
          aria-modal
          aria-labelledby="bulk-modal-title"
          tabIndex={-1}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 id="bulk-modal-title" className="modal-title fw-bold">
                  {bulkModalType === 'assign' && <><i className="ti ti-user-plus me-2 text-primary" />Assign Roles</>}
                  {bulkModalType === 'revoke' && <><i className="ti ti-user-minus me-2 text-danger" />Revoke Roles</>}
                  {bulkModalType === 'add-perms' && <><i className="ti ti-key me-2 text-warning" />Add Permission Overrides</>}
                </h5>
                <button type="button" className="btn-close" onClick={closeBulkModal} aria-label="Close" />
              </div>
              <div className="modal-body py-4">
                <p className="text-muted small mb-3">
                  {bulkModalType === 'assign' && `Select roles to assign to ${bulkSelectedUserIds.size} user(s):`}
                  {bulkModalType === 'revoke' && `Select roles to revoke from ${bulkSelectedUserIds.size} user(s):`}
                  {bulkModalType === 'add-perms' && `Select permissions to add (merge with existing) for ${bulkSelectedUserIds.size} user(s):`}
                </p>
                {bulkModalType !== 'add-perms' && (
                  <div className="row g-2">
                    {roles.map((r) => {
                      const isChecked = bulkModalRoleIds.has(r.roleId);
                      return (
                        <div key={r.roleId} className="col-12 col-md-6">
                          <label className={`d-flex align-items-center gap-2 rounded-3 p-3 w-100 border ${isChecked ? 'bg-primary bg-opacity-10 border-primary' : 'border-secondary'}`} style={{ cursor: 'pointer' }}>
                            <input type="checkbox" className="form-check-input" checked={isChecked} onChange={() => {
                              setBulkModalRoleIds((prev) => { const n = new Set(prev); if (n.has(r.roleId)) n.delete(r.roleId); else n.add(r.roleId); return n; });
                            }} />
                            <span className="fw-semibold">{r.roleName}</span>
                            <span className="small text-muted">{r.roleCode}</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
                {bulkModalType === 'add-perms' && (
                  <div className="overflow-auto" style={{ maxHeight: 360 }}>
                    {renderPermissionGrid(
                      bulkModalPermissionIds,
                      (id) => setBulkModalPermissionIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
                      setBulkModalPermissionIds,
                      'bulk',
                      'primary'
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer border-top">
                <button type="button" className="btn btn-outline-secondary" onClick={closeBulkModal}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={bulkLoading || (bulkModalType !== 'add-perms' ? bulkModalRoleIds.size === 0 : bulkModalPermissionIds.size === 0)}
                  onClick={bulkModalType === 'assign' ? bulkAssignRolesSubmit : bulkModalType === 'revoke' ? bulkRevokeRolesSubmit : bulkAddPermissionsSubmit}
                >
                  {bulkLoading ? <><span className="spinner-border spinner-border-sm me-2" />Applying...</> : <><i className="ti ti-check me-2" />Apply</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
