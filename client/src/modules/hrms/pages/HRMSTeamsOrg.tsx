import { useCallback, useEffect, useState, createContext, useContext } from 'react';
import { Link } from 'react-router-dom';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { hrmsApi, type OrgDepartment, type OrgTeam, type OrgTreeNode } from '../api/hrmsApi';
import { useAuth } from '../../../hooks/useAuth';

type OrgContextValue = {
  onMoveUser: ((userId: number, toTeamId: number) => void) | null;
  onNodeSelect: ((node: OrgTreeNode) => void) | null;
  setSelectedNode: (node: OrgTreeNode | null) => void;
  canEdit: boolean;
};
const OrgContext = createContext<OrgContextValue>({ onMoveUser: null, onNodeSelect: null, setSelectedNode: () => {}, canEdit: false });

const NODE_WIDTH = 180;
const NODE_HEIGHT = 64;
const GAP_X = 28;
const GAP_Y = 48;

const COMPANY_ROOT_ID = 'company-root';

function layoutTree(
  nodes: OrgTreeNode[],
  edges: { source: string; target: string }[],
  options: { addCompanyRoot?: boolean }
): { nodes: Node[]; edges: Edge[] } {
  const childrenMap = new Map<string, string[]>();
  for (const e of edges) {
    const arr = childrenMap.get(e.source) ?? [];
    arr.push(e.target);
    childrenMap.set(e.source, arr);
  }
  let roots = nodes.filter((n) => !n.parentId || !nodes.some((m) => m.id === n.parentId)).map((n) => n.id);

  if (options.addCompanyRoot && roots.length > 1) {
    roots = [COMPANY_ROOT_ID];
    childrenMap.set(COMPANY_ROOT_ID, nodes.filter((n) => n.type === 'department').map((n) => n.id));
  }

  const positions = new Map<string, { x: number; y: number }>();
  let y = 0;
  let xCursor = 0;

  function place(nodeId: string, depth: number): number {
    const children = nodeId === COMPANY_ROOT_ID
      ? (childrenMap.get(nodeId) ?? [])
      : (childrenMap.get(nodeId) ?? []);
    const startX = xCursor;
    let childX = xCursor;
    for (const c of children) {
      const w = place(c, depth + 1);
      childX += w + GAP_X;
    }
    const myX = children.length > 0 ? (startX + (childX - GAP_X - startX) / 2 - NODE_WIDTH / 2) : xCursor;
    positions.set(nodeId, { x: myX, y: depth * (NODE_HEIGHT + GAP_Y) });
    xCursor = children.length > 0 ? childX - GAP_X : xCursor + NODE_WIDTH + GAP_X;
    return children.length > 0 ? childX - startX - GAP_X : NODE_WIDTH + GAP_X;
  }

  for (const r of roots) {
    place(r, 0);
  }

  const flowNodes: Node[] = [];
  if (options.addCompanyRoot && roots.includes(COMPANY_ROOT_ID)) {
    const pos = positions.get(COMPANY_ROOT_ID) ?? { x: 0, y: 0 };
    flowNodes.push({
      id: COMPANY_ROOT_ID,
      type: 'company',
      position: { x: pos.x, y: pos.y },
      data: { label: 'Company', _node: { id: COMPANY_ROOT_ID, type: 'department', parentId: null, data: { label: 'Company' } } },
    });
  }
  for (const n of nodes) {
    const pos = positions.get(n.id) ?? { x: 0, y: 0 };
    flowNodes.push({
      id: n.id,
      type: n.type,
      position: { x: pos.x, y: pos.y },
      data: { ...n.data, _node: n },
    });
  }
  const flowEdges: Edge[] = [];
  if (options.addCompanyRoot && roots.includes(COMPANY_ROOT_ID)) {
    const deptIds = childrenMap.get(COMPANY_ROOT_ID) ?? [];
    deptIds.forEach((target, i) => flowEdges.push({ id: `eroot-${i}`, source: COMPANY_ROOT_ID, target }));
  }
  edges.forEach((e, i) => flowEdges.push({ id: `e${i}`, source: e.source, target: e.target }));

  return { nodes: flowNodes, edges: flowEdges };
}

function CompanyNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div
      className="nodrag rounded-3 shadow-sm border-2 border-dark bg-gradient px-3 py-3 text-center text-white"
      style={{
        minWidth: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #1e3a5f 100%)',
        cursor: 'default',
      }}
    >
      <i className="ti ti-building-skyscraper d-block fs-4 mb-1" style={{ opacity: 0.95 }} />
      <strong className="small">{String(data.label ?? 'Company')}</strong>
    </div>
  );
}

function DepartmentNode({ data }: { data: Record<string, unknown> }) {
  const { setSelectedNode, canEdit } = useContext(OrgContext);
  const _node = data._node as OrgTreeNode | undefined;
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (_node) setSelectedNode(_node);
    },
    [_node, setSelectedNode]
  );
  return (
    <div
      role="button"
      tabIndex={0}
      className="nodrag nopan rounded-3 shadow-sm border-2 p-3 text-center text-primary"
      style={{
        minWidth: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        background: 'linear-gradient(145deg, #e8f4fc 0%, #cce5f7 100%)',
        borderColor: '#0d6efd',
        cursor: canEdit ? 'pointer' : 'default',
      }}
      onClick={handleClick}
      onKeyDown={(e) => { e.key === 'Enter' && _node && setSelectedNode(_node); }}
    >
      <i className="ti ti-building d-block fs-4 mb-1" />
      <strong className="small d-block text-truncate">{String(data.label ?? '')}</strong>
      <span className="small text-muted">{String(data.code ?? '')}</span>
    </div>
  );
}

function TeamNode({ data }: { data: Record<string, unknown> }) {
  const { onMoveUser, setSelectedNode, canEdit } = useContext(OrgContext);
  const _node = data._node as OrgTreeNode | undefined;
  const teamId = _node?.teamId;

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('application/reactflow');
      if (!raw || !teamId) return;
      try {
        const d = JSON.parse(raw) as { userId?: number };
        if (typeof d.userId === 'number' && onMoveUser) onMoveUser(d.userId, teamId);
      } catch {
        // ignore
      }
    },
    [teamId, onMoveUser]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (_node) setSelectedNode(_node);
    },
    [_node, setSelectedNode]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      className="nodrag nopan rounded-3 shadow-sm border-2 p-3 text-center"
      style={{
        minWidth: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        background: 'linear-gradient(145deg, #f3e8fc 0%, #e6d5f7 100%)',
        borderColor: '#6f42c1',
        cursor: canEdit ? 'pointer' : 'default',
      }}
      data-team-id={teamId}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onClick={handleClick}
      onKeyDown={(e) => { e.key === 'Enter' && _node && setSelectedNode(_node); }}
    >
      <i className="ti ti-users-group d-block fs-4 mb-1 text-secondary" />
      <div className="fw-semibold small text-truncate">{String(data.label ?? '')}</div>
      <div className="small text-muted">Level {Number(data.level ?? 0)}</div>
    </div>
  );
}

function UserNode({ data }: { data: Record<string, unknown> }) {
  const { setSelectedNode, onMoveUser } = useContext(OrgContext);
  const _node = data._node as OrgTreeNode | undefined;
  const userId = _node?.userId;

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      if (userId != null && onMoveUser) {
        e.dataTransfer.setData('application/reactflow', JSON.stringify({ userId }));
        e.dataTransfer.effectAllowed = 'move';
      }
    },
    [userId, onMoveUser]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (_node) setSelectedNode(_node);
    },
    [_node, setSelectedNode]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      className="nodrag nopan rounded-3 shadow-sm border-2 p-3 text-center"
      style={{
        minWidth: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        background: 'linear-gradient(145deg, #e8f5e9 0%, #c8e6c9 100%)',
        borderColor: '#198754',
        cursor: 'pointer',
      }}
      draggable={userId != null && !!onMoveUser}
      onDragStart={onDragStart}
      onClick={handleClick}
      onKeyDown={(e) => { e.key === 'Enter' && _node && setSelectedNode(_node); }}
    >
      <i className="ti ti-user d-block fs-4 mb-1 text-success" />
      <div className="small fw-semibold text-truncate">{String(data.label ?? '')}</div>
      {data.designationName ? <div className="small text-muted text-truncate">{String(data.designationName)}</div> : null}
    </div>
  );
}

const nodeTypes = { company: CompanyNode, department: DepartmentNode, team: TeamNode, user: UserNode };

export default function HRMSTeamsOrg() {
  const { user: currentUser } = useAuth();
  const canEdit = (currentUser?.permissions ?? []).includes('HRMS.EDIT');

  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [tree, setTree] = useState<{ nodes: OrgTreeNode[]; edges: { source: string; target: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ userId: number; toTeamId: number } | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [selectedNode, setSelectedNode] = useState<OrgTreeNode | null>(null);
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({ departmentCode: '', departmentName: '', sortOrder: 0 });
  const [teamForm, setTeamForm] = useState({ departmentId: '' as number | '', name: '', level: 1, parentTeamId: '' as number | '' });
  const [saving, setSaving] = useState(false);

  const loadTree = useCallback(() => {
    setLoading(true);
    setError(null);
    hrmsApi.getOrgTree(departmentId === '' ? undefined : Number(departmentId))
      .then((res) => {
        setTree({ nodes: res.nodes, edges: res.edges });
        setError(null);
      })
      .catch((e) => {
        setTree(null);
        setError(e?.message ?? 'Failed to load org tree');
      })
      .finally(() => setLoading(false));
  }, [departmentId]);

  useEffect(() => {
    hrmsApi.listOrgDepartments()
      .then((res) => setDepartments(res.data ?? []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (tree) {
      const addCompanyRoot = departmentId === '' && tree.nodes.filter((n) => n.type === 'department').length > 1;
      const { nodes: n, edges: e } = layoutTree(tree.nodes, tree.edges, { addCompanyRoot });
      setNodes(n);
      setEdges(e);
    }
  }, [tree, departmentId, setNodes, setEdges]);

  const handleMoveUser = useCallback((userId: number, toTeamId: number) => {
    setMoveTarget({ userId, toTeamId });
  }, []);

  useEffect(() => {
    if (!moveTarget) return;
    hrmsApi.moveUserToTeam(moveTarget.userId, moveTarget.toTeamId)
      .then(() => loadTree())
      .catch((e) => setError(e?.message ?? 'Move failed'))
      .finally(() => setMoveTarget(null));
  }, [moveTarget, loadTree]);

  const handleNodeSelect = useCallback((node: OrgTreeNode) => {
    setSelectedNode(node);
  }, []);

  const closeModals = useCallback(() => {
    setSelectedNode(null);
    setAddDeptOpen(false);
    setAddTeamOpen(false);
  }, []);

  const selectedDept = selectedNode?.type === 'department' ? (selectedNode.departmentId ?? null) : null;
  const selectedTeam = selectedNode?.type === 'team' ? (selectedNode.teamId ?? null) : null;
  const selectedUser = selectedNode?.type === 'user' ? (selectedNode.userId ?? null) : null;

  const saveDepartment = useCallback(() => {
    const d = selectedNode;
    if (!d || d.type !== 'department' || !deptForm.departmentCode.trim() || !deptForm.departmentName.trim()) return;
    setSaving(true);
    hrmsApi.updateOrgDepartment(d.departmentId!, {
      departmentCode: deptForm.departmentCode.trim(),
      departmentName: deptForm.departmentName.trim(),
      sortOrder: deptForm.sortOrder,
    })
      .then(() => { closeModals(); loadTree(); })
      .catch((e) => setError(e?.message ?? 'Failed to update'))
      .finally(() => setSaving(false));
  }, [selectedNode, deptForm, closeModals, loadTree]);

  const deleteDepartment = useCallback(() => {
    const d = selectedNode;
    if (!d || d.type !== 'department' || !window.confirm('Delete this department? This may affect designations and teams.')) return;
    setSaving(true);
    hrmsApi.deleteOrgDepartment(d.departmentId!)
      .then(() => { closeModals(); loadTree(); })
      .catch((e) => setError(e?.message ?? 'Failed to delete'))
      .finally(() => setSaving(false));
  }, [selectedNode, closeModals, loadTree]);

  const saveTeam = useCallback(() => {
    const t = selectedNode;
    if (!t || t.type !== 'team' || !teamForm.name.trim()) return;
    setSaving(true);
    hrmsApi.updateOrgTeam(t.teamId!, {
      name: teamForm.name.trim(),
      level: teamForm.level,
      parentTeamId: teamForm.parentTeamId === '' ? null : teamForm.parentTeamId,
    })
      .then(() => { closeModals(); loadTree(); })
      .catch((e) => setError(e?.message ?? 'Failed to update'))
      .finally(() => setSaving(false));
  }, [selectedNode, teamForm, closeModals, loadTree]);

  const deleteTeam = useCallback(() => {
    const t = selectedNode;
    if (!t || t.type !== 'team' || !window.confirm('Delete this team? Members will need to be reassigned.')) return;
    setSaving(true);
    hrmsApi.deleteOrgTeam(t.teamId!)
      .then(() => { closeModals(); loadTree(); })
      .catch((e) => setError(e?.message ?? 'Failed to delete'))
      .finally(() => setSaving(false));
  }, [selectedNode, closeModals, loadTree]);

  const createDepartment = useCallback(() => {
    if (!deptForm.departmentCode.trim() || !deptForm.departmentName.trim()) return;
    setSaving(true);
    hrmsApi.createOrgDepartment({
      departmentCode: deptForm.departmentCode.trim(),
      departmentName: deptForm.departmentName.trim(),
      sortOrder: deptForm.sortOrder,
    })
      .then(() => { setAddDeptOpen(false); setDeptForm({ departmentCode: '', departmentName: '', sortOrder: departments.length }); loadTree(); })
      .catch((e) => setError(e?.message ?? 'Failed to create'))
      .finally(() => setSaving(false));
  }, [deptForm, departments.length, loadTree]);

  const createTeam = useCallback(() => {
    if (teamForm.departmentId === '' || !teamForm.name.trim()) return;
    setSaving(true);
    hrmsApi.createOrgTeam({
      departmentId: teamForm.departmentId,
      name: teamForm.name.trim(),
      level: teamForm.level,
      parentTeamId: teamForm.parentTeamId === '' ? null : teamForm.parentTeamId,
    })
      .then(() => { setAddTeamOpen(false); setTeamForm({ departmentId: '', name: '', level: 1, parentTeamId: '' }); loadTree(); })
      .catch((e) => setError(e?.message ?? 'Failed to create'))
      .finally(() => setSaving(false));
  }, [teamForm, loadTree]);

  useEffect(() => {
    if (selectedNode?.type === 'department' && selectedNode.data) {
      setDeptForm({
        departmentCode: String(selectedNode.data.code ?? ''),
        departmentName: String(selectedNode.data.label ?? ''),
        sortOrder: 0,
      });
    }
  }, [selectedNode]);

  useEffect(() => {
    if (selectedNode?.type === 'team' && selectedNode.data) {
      setTeamForm({
        departmentId: selectedNode.departmentId ?? '',
        name: String(selectedNode.data.label ?? ''),
        level: Number(selectedNode.data.level ?? 1),
        parentTeamId: '',
      });
    }
  }, [selectedNode]);

  const [teamsForDept, setTeamsForDept] = useState<OrgTeam[]>([]);
  useEffect(() => {
    if (addTeamOpen && teamForm.departmentId !== '') {
      hrmsApi.listOrgTeams(teamForm.departmentId).then((r) => setTeamsForDept(r.data ?? [])).catch(() => setTeamsForDept([]));
    } else {
      setTeamsForDept([]);
    }
  }, [addTeamOpen, teamForm.departmentId]);

  const openAddDept = useCallback(() => {
    setDeptForm({ departmentCode: '', departmentName: '', sortOrder: departments.length });
    setAddDeptOpen(true);
  }, [departments.length]);

  const openAddTeam = useCallback(() => {
    setTeamForm({ departmentId: departmentId === '' ? (departments[0]?.id ?? '') : departmentId, name: '', level: 1, parentTeamId: '' });
    setAddTeamOpen(true);
  }, [departmentId, departments]);

  return (
    <div className="container-fluid py-4" style={{ position: 'relative' }}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3" style={{ position: 'relative', zIndex: 10 }}>
        <h4 className="mb-0"><i className="ti ti-sitemap me-2" />Org Structure</h4>
        <div className="d-flex flex-wrap align-items-center gap-2">
          {canEdit && (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={openAddDept}>
                <i className="ti ti-plus me-1" />Add Department
              </button>
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={openAddTeam}>
                <i className="ti ti-users-plus me-1" />Add Team
              </button>
            </>
          )}
          <label className="form-label mb-0 small text-muted">Filter</label>
          <select className="form-select form-select-sm" style={{ width: 200 }} value={departmentId} onChange={(e) => setDepartmentId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">All (full company)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.departmentName}</option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}
      <OrgContext.Provider value={{ onMoveUser: canEdit ? handleMoveUser : null, onNodeSelect: handleNodeSelect, setSelectedNode, canEdit }}>
        <div className="border rounded-3 overflow-hidden bg-light" style={{ height: 640, position: 'relative', zIndex: 1 }}>
          {loading ? (
            <div className="d-flex align-items-center justify-content-center h-100 text-muted">
              <span className="spinner-border spinner-border-sm me-2" />Loading structure…
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              nodesDraggable={true}
              noDragClassName="nodrag"
              onNodeClick={(_e, node) => {
                if (node.type === 'company') return;
                const d = node.data?._node as OrgTreeNode | undefined;
                if (d) handleNodeSelect(d);
              }}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              attributionPosition="bottom-left"
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#94a3b8" gap={16} />
              <Controls className="rounded-2 shadow" />
              <MiniMap className="rounded-2" nodeColor={(n) => (n.type === 'department' ? '#0d6efd' : n.type === 'team' ? '#6f42c1' : n.type === 'user' ? '#198754' : '#1e3a5f')} />
            </ReactFlow>
          )}
        </div>
        <p className="small text-muted mt-2 mb-0">
          <i className="ti ti-info-circle me-1" />
          Click a card to edit. Drag users onto teams to reassign (same designation level). Drag nodes to rearrange the layout.
        </p>
      </OrgContext.Provider>

      {/* Edit Department modal */}
      {selectedNode?.type === 'department' && selectedDept != null && (
        <div className="modal d-block bg-dark bg-opacity-50" tabIndex={-1} style={{ zIndex: 1100 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ zIndex: 1105 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="ti ti-building me-2" />Edit Department</h5>
                <button type="button" className="btn-close" onClick={closeModals} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label small">Code</label>
                  <input type="text" className="form-control form-control-sm" value={deptForm.departmentCode} onChange={(e) => setDeptForm((f) => ({ ...f, departmentCode: e.target.value }))} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Name</label>
                  <input type="text" className="form-control form-control-sm" value={deptForm.departmentName} onChange={(e) => setDeptForm((f) => ({ ...f, departmentName: e.target.value }))} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Sort order</label>
                  <input type="number" className="form-control form-control-sm" value={deptForm.sortOrder} onChange={(e) => setDeptForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-danger me-auto" onClick={deleteDepartment} disabled={saving}>Delete</button>
                <button type="button" className="btn btn-secondary" onClick={closeModals}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={saveDepartment} disabled={saving}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Team modal */}
      {selectedNode?.type === 'team' && selectedTeam != null && (
        <div className="modal d-block bg-dark bg-opacity-50" tabIndex={-1} style={{ zIndex: 1100 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ zIndex: 1105 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="ti ti-users-group me-2" />Edit Team</h5>
                <button type="button" className="btn-close" onClick={closeModals} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label small">Name</label>
                  <input type="text" className="form-control form-control-sm" value={teamForm.name} onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Level</label>
                  <input type="number" className="form-control form-control-sm" value={teamForm.level} onChange={(e) => setTeamForm((f) => ({ ...f, level: Number(e.target.value) || 1 }))} min={1} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-danger me-auto" onClick={deleteTeam} disabled={saving}>Delete</button>
                <button type="button" className="btn btn-secondary" onClick={closeModals}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={saveTeam} disabled={saving}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View User (link to profile) */}
      {selectedNode?.type === 'user' && selectedUser != null && (
        <div className="modal d-block bg-dark bg-opacity-50" tabIndex={-1} style={{ zIndex: 1100 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ zIndex: 1105 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="ti ti-user me-2" />Employee</h5>
                <button type="button" className="btn-close" onClick={closeModals} aria-label="Close" />
              </div>
              <div className="modal-body">
                <p className="mb-0">{selectedNode.data?.label && String(selectedNode.data.label)}</p>
                {selectedNode.data?.designationName && <p className="small text-muted mb-0">{String(selectedNode.data.designationName)}</p>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModals}>Close</button>
                <Link className="btn btn-primary" to={`/hrms/employees/${selectedUser}`}>Open profile</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Department modal */}
      {addDeptOpen && (
        <div className="modal d-block bg-dark bg-opacity-50" tabIndex={-1} style={{ zIndex: 1100 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ zIndex: 1105 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="ti ti-building me-2" />Add Department</h5>
                <button type="button" className="btn-close" onClick={() => setAddDeptOpen(false)} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label small">Code</label>
                  <input type="text" className="form-control form-control-sm" placeholder="e.g. ENG" value={deptForm.departmentCode} onChange={(e) => setDeptForm((f) => ({ ...f, departmentCode: e.target.value }))} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Name</label>
                  <input type="text" className="form-control form-control-sm" placeholder="e.g. Engineering" value={deptForm.departmentName} onChange={(e) => setDeptForm((f) => ({ ...f, departmentName: e.target.value }))} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Sort order</label>
                  <input type="number" className="form-control form-control-sm" value={deptForm.sortOrder} onChange={(e) => setDeptForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAddDeptOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={createDepartment} disabled={saving || !deptForm.departmentCode.trim() || !deptForm.departmentName.trim()}>Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Team modal */}
      {addTeamOpen && (
        <div className="modal d-block bg-dark bg-opacity-50" tabIndex={-1} style={{ zIndex: 1100 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ zIndex: 1105 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="ti ti-users-plus me-2" />Add Team</h5>
                <button type="button" className="btn-close" onClick={() => setAddTeamOpen(false)} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label small">Department</label>
                  <select className="form-select form-select-sm" value={teamForm.departmentId} onChange={(e) => setTeamForm((f) => ({ ...f, departmentId: e.target.value === '' ? '' : Number(e.target.value) }))}>
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.departmentName}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="form-label small">Team name</label>
                  <input type="text" className="form-control form-control-sm" placeholder="e.g. Backend" value={teamForm.name} onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Level</label>
                  <input type="number" className="form-control form-control-sm" value={teamForm.level} onChange={(e) => setTeamForm((f) => ({ ...f, level: Number(e.target.value) || 1 }))} min={1} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Parent team (optional)</label>
                  <select className="form-select form-select-sm" value={teamForm.parentTeamId} onChange={(e) => setTeamForm((f) => ({ ...f, parentTeamId: e.target.value === '' ? '' : Number(e.target.value) }))}>
                    <option value="">None</option>
                    {teamsForDept.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAddTeamOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={createTeam} disabled={saving || teamForm.departmentId === '' || !teamForm.name.trim()}>Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
