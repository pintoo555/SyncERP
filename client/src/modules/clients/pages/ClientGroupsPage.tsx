/**
 * Client Groups page: list groups, create groups, manage members.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as clientsApi from '../api/clientsApi';
import type { ClientGroup, GroupMember, Client, Industry } from '../types';
import { GROUP_ROLES } from '../types';

export default function ClientGroupsPage() {
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Create group modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ groupName: '', industryId: 0 });
  const [saving, setSaving] = useState(false);
  const [industries, setIndustries] = useState<Industry[]>([]);

  // Add member
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({ clientId: 0, roleInGroup: 'Other' });
  const [clients, setClients] = useState<Client[]>([]);

  const loadGroups = useCallback(() => {
    setLoading(true);
    clientsApi.listGroups()
      .then(res => setGroups(res.data || []))
      .catch(e => setError(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);
  useEffect(() => {
    clientsApi.listIndustries().then(r => setIndustries(r.data || [])).catch(() => {});
  }, []);

  const toggleGroup = (groupId: number) => {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null);
      return;
    }
    setExpandedGroupId(groupId);
    setLoadingMembers(true);
    clientsApi.getGroup(groupId)
      .then(res => setMembers(res.data?.members || []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  };

  const handleCreateGroup = async () => {
    if (!createForm.groupName.trim()) return;
    try {
      setSaving(true);
      await clientsApi.createGroup({ groupName: createForm.groupName, industryId: createForm.industryId || undefined });
      setShowCreate(false);
      setCreateForm({ groupName: '', industryId: 0 });
      loadGroups();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!expandedGroupId || !addMemberForm.clientId) return;
    try {
      setSaving(true);
      await clientsApi.addGroupMember(expandedGroupId, addMemberForm);
      setShowAddMember(false);
      setAddMemberForm({ clientId: 0, roleInGroup: 'Other' });
      toggleGroup(expandedGroupId);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMember = async (memberId: number, isActive: boolean) => {
    if (!expandedGroupId) return;
    try {
      await clientsApi.toggleMemberStatus(expandedGroupId, memberId, isActive);
      toggleGroup(expandedGroupId);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update member');
    }
  };

  const openAddMember = () => {
    if (clients.length === 0) {
      clientsApi.listClients({ pageSize: 200, isActive: 1 })
        .then(res => setClients(res.data || []))
        .catch(() => {});
    }
    setShowAddMember(true);
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="mb-1 fw-bold"><i className="ti ti-users-group me-2 text-primary" />Client Groups</h4>
          <p className="text-muted mb-0 small">Manage group companies and their members</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <i className="ti ti-plus me-1" /> New Group
        </button>
      </div>

      {error && <div className="alert alert-danger alert-dismissible fade show">{error}<button className="btn-close" onClick={() => setError(null)} /></div>}

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading && <div className="text-center py-5 text-muted"><span className="spinner-border spinner-border-sm me-2" />Loading...</div>}
          {!loading && groups.length === 0 && <div className="text-center py-5 text-muted">No groups created yet.</div>}
          {!loading && groups.map(g => (
            <div key={g.id} className="border-bottom">
              <div
                className="d-flex justify-content-between align-items-center p-3"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleGroup(g.id)}
              >
                <div>
                  <code className="me-2">{g.groupCode}</code>
                  <strong>{g.groupName}</strong>
                  {g.industryName && <span className="text-muted ms-2 small">({g.industryName})</span>}
                  {!g.isActive && <span className="badge bg-secondary ms-2">Inactive</span>}
                </div>
                <i className={`ti ${expandedGroupId === g.id ? 'ti-chevron-up' : 'ti-chevron-down'}`} />
              </div>
              {expandedGroupId === g.id && (
                <div className="px-3 pb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0 small fw-semibold">Members</h6>
                    <button className="btn btn-sm btn-outline-primary" onClick={openAddMember}>
                      <i className="ti ti-plus me-1" />Add Member
                    </button>
                  </div>
                  {loadingMembers && <div className="text-muted small"><span className="spinner-border spinner-border-sm me-1" />Loading members...</div>}
                  {!loadingMembers && members.length === 0 && <p className="text-muted small">No members in this group.</p>}
                  {!loadingMembers && members.length > 0 && (
                    <table className="table table-sm table-hover mb-0">
                      <thead className="table-light"><tr><th>Code</th><th>Client</th><th>Role</th><th>Status</th><th></th></tr></thead>
                      <tbody>
                        {members.map(m => (
                          <tr key={m.id}>
                            <td><code className="small">{m.clientCode}</code></td>
                            <td><Link to={`/clients/${m.clientId}`}>{m.clientName}</Link></td>
                            <td><span className="badge bg-outline-primary">{m.roleInGroup}</span></td>
                            <td>{m.isActive ? <span className="badge bg-success-subtle text-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}</td>
                            <td className="text-end">
                              <button
                                className={`btn btn-sm ${m.isActive ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                onClick={() => handleToggleMember(m.id, !m.isActive)}
                              >
                                {m.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Inline Add Member Form */}
                  {showAddMember && (
                    <div className="border rounded p-3 mt-2 bg-light">
                      <div className="row g-2 align-items-end">
                        <div className="col-md-5">
                          <label className="form-label small">Client</label>
                          <select className="form-select form-select-sm" value={addMemberForm.clientId} onChange={e => setAddMemberForm(p => ({ ...p, clientId: Number(e.target.value) }))}>
                            <option value="0">Select client...</option>
                            {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.clientCode} - {cl.clientName}</option>)}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Role</label>
                          <select className="form-select form-select-sm" value={addMemberForm.roleInGroup} onChange={e => setAddMemberForm(p => ({ ...p, roleInGroup: e.target.value }))}>
                            {GROUP_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <div className="col-md-4">
                          <button className="btn btn-sm btn-primary me-2" onClick={handleAddMember} disabled={saving || !addMemberForm.clientId}>Add</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => setShowAddMember(false)}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreate && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Create Client Group</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreate(false)} disabled={saving} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label small">Group Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={createForm.groupName}
                    onChange={e => setCreateForm(p => ({ ...p, groupName: e.target.value }))}
                    maxLength={200}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small">Industry</label>
                  <select className="form-select form-select-sm" value={createForm.industryId} onChange={e => setCreateForm(p => ({ ...p, industryId: Number(e.target.value) }))}>
                    <option value="0">None</option>
                    {industries.filter(i => i.isActive).map(i => <option key={i.id} value={i.id}>{i.industryName}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateGroup} disabled={saving || !createForm.groupName.trim()}>
                  {saving ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
