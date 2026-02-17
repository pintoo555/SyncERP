import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, useReactFlow,
  Handle, Position, MarkerType, ConnectionMode,
  type Node, type Edge, type Connection, type NodeChange, type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { io, type Socket } from 'socket.io-client';
import { hrmsApi, type OrgDepartment, type OrgTeam, type OrgTreeNode, type UnassignedUser } from '../api/hrmsApi';
import { useAuth } from '../../../hooks/useAuth';
import { api, getSocketUrl } from '../../../api/client';
import { useBranch } from '../../../contexts/BranchContext';

/* ─── constants ─── */
const NODE_W = 220;
const NODE_H = 84;
const GAP_X = 48;
const GAP_Y = 80;
const LAYOUT_KEY = 'hrms-org-layout';
const ROOT_ID = 'company-root';

/* ─── localStorage layout persistence ─── */
function loadPositions(scope: string): Record<string, { x: number; y: number }> {
  try { const r = localStorage.getItem(`${LAYOUT_KEY}-${scope}`); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
function savePositions(scope: string, pos: Record<string, { x: number; y: number }>) {
  try { localStorage.setItem(`${LAYOUT_KEY}-${scope}`, JSON.stringify(pos)); } catch { /* */ }
}
function clearPositions(scope: string) {
  try { localStorage.removeItem(`${LAYOUT_KEY}-${scope}`); } catch { /* */ }
}

/* ─── tree-based org-chart layout ─── */
function buildLayout(
  treeNodes: OrgTreeNode[],
  treeEdges: { source: string; target: string }[],
  opts: { addRoot?: boolean; saved?: Record<string, { x: number; y: number }> | null },
): { nodes: Node[]; edges: Edge[] } {
  const childMap = new Map<string, string[]>();
  for (const e of treeEdges) { const a = childMap.get(e.source) ?? []; a.push(e.target); childMap.set(e.source, a); }

  let roots = treeNodes.filter(n => !n.parentId || !treeNodes.some(m => m.id === n.parentId)).map(n => n.id);
  if (opts.addRoot && roots.length > 1) {
    roots = [ROOT_ID];
    childMap.set(ROOT_ID, treeNodes.filter(n => n.type === 'department').map(n => n.id));
  }

  const subtreeWidth = new Map<string, number>();
  function calcWidth(id: string): number {
    const ch = childMap.get(id) ?? [];
    if (ch.length === 0) { subtreeWidth.set(id, NODE_W); return NODE_W; }
    let total = 0;
    for (const c of ch) total += calcWidth(c);
    total += (ch.length - 1) * GAP_X;
    const w = Math.max(NODE_W, total);
    subtreeWidth.set(id, w);
    return w;
  }

  const positions = new Map<string, { x: number; y: number }>();
  function placeTree(id: string, left: number, top: number): void {
    const w = subtreeWidth.get(id) ?? NODE_W;
    const myX = left + (w - NODE_W) / 2;
    positions.set(id, { x: myX, y: top });
    const ch = childMap.get(id) ?? [];
    if (ch.length === 0) return;
    let childLeft = left;
    for (const c of ch) {
      const cw = subtreeWidth.get(c) ?? NODE_W;
      placeTree(c, childLeft, top + NODE_H + GAP_Y);
      childLeft += cw + GAP_X;
    }
  }

  let globalLeft = 0;
  for (const r of roots) {
    calcWidth(r);
    placeTree(r, globalLeft, 0);
    globalLeft += (subtreeWidth.get(r) ?? NODE_W) + GAP_X * 2;
  }

  const saved = opts.saved ?? null;
  const flowNodes: Node[] = [];
  if (opts.addRoot && roots.includes(ROOT_ID)) {
    const p = saved?.[ROOT_ID] ?? positions.get(ROOT_ID) ?? { x: 0, y: 0 };
    flowNodes.push({ id: ROOT_ID, type: 'company', position: p, data: { label: 'Company', _node: { id: ROOT_ID, type: 'department', parentId: null, data: { label: 'Company' } } } });
  }
  for (const n of treeNodes) {
    const p = saved?.[n.id] ?? positions.get(n.id) ?? { x: 0, y: 0 };
    flowNodes.push({ id: n.id, type: n.type, position: p, data: { ...n.data, _node: n } });
  }

  const edgeStyle = { stroke: '#94a3b8', strokeWidth: 2 };
  const markerEnd = { type: MarkerType.ArrowClosed as const, color: '#94a3b8', width: 14, height: 14 };
  const flowEdges: Edge[] = [];
  if (opts.addRoot && roots.includes(ROOT_ID)) {
    (childMap.get(ROOT_ID) ?? []).forEach((t, i) => flowEdges.push({ id: `er-${i}`, source: ROOT_ID, target: t, sourceHandle: 'src', targetHandle: 'tgt', type: 'smoothstep', animated: false, style: edgeStyle, markerEnd }));
  }
  treeEdges.forEach((e, i) => flowEdges.push({ id: `e${i}`, source: e.source, target: e.target, sourceHandle: 'src', targetHandle: 'tgt', type: 'smoothstep', animated: false, style: edgeStyle, markerEnd }));
  return { nodes: flowNodes, edges: flowEdges };
}

/* ─── descendant helper ─── */
function getDescendantIds(nodeId: string, edges: Edge[]): Set<string> {
  const children = new Map<string, string[]>();
  for (const e of edges) { const a = children.get(e.source) ?? []; a.push(e.target); children.set(e.source, a); }
  const result = new Set<string>();
  const stack = [nodeId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const ch of children.get(cur) ?? []) { if (!result.has(ch)) { result.add(ch); stack.push(ch); } }
  }
  return result;
}

/* ─── handle styles ─── */
const handleBase: React.CSSProperties = { width: 14, height: 14, borderRadius: '50%', border: '3px solid #fff', zIndex: 10 };
const srcHandle: React.CSSProperties = { ...handleBase, background: '#6366f1', bottom: -7 };
const tgtHandle: React.CSSProperties = { ...handleBase, background: '#f97316', top: -7 };

/* ═══════════════ NODE COMPONENTS ═══════════════ */

function CompanyNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div style={{ minWidth: NODE_W, minHeight: NODE_H, background: 'linear-gradient(145deg,#1e293b,#334155)', borderRadius: 16, padding: '14px 18px', textAlign: 'center', color: '#fff', boxShadow: '0 8px 30px -8px rgba(15,23,42,.45)' }}>
      <Handle type="source" position={Position.Bottom} id="src" style={srcHandle} />
      <i className="ti ti-building-skyscraper d-block fs-3 mb-1" />
      <strong className="small">{String(data.label ?? 'Company')}</strong>
    </div>
  );
}

function DepartmentNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div style={{ minWidth: NODE_W, minHeight: NODE_H, background: 'linear-gradient(160deg,#eff6ff,#dbeafe)', border: '2px solid #3b82f6', borderRadius: 16, padding: '14px 16px', textAlign: 'center', color: '#1e40af', boxShadow: '0 4px 24px -4px rgba(59,130,246,.25)', cursor: 'pointer' }}>
      <Handle type="target" position={Position.Top} id="tgt" style={tgtHandle} />
      <Handle type="source" position={Position.Bottom} id="src" style={srcHandle} />
      <i className="ti ti-building d-block fs-3 mb-1" />
      <strong className="small d-block text-truncate">{String(data.label ?? '')}</strong>
      <span className="small" style={{ opacity: .6 }}>{String(data.code ?? '')}</span>
    </div>
  );
}

function TeamNode({ data }: { data: Record<string, unknown> }) {
  const color = (data.themeColor as string) || '#8b5cf6';
  const icon = (data.icon as string) || 'users-group';
  const leaderName = data.leadUserName as string | null;
  const hasLeader = data.leadUserId != null;
  return (
    <div style={{ minWidth: NODE_W, minHeight: NODE_H, background: `linear-gradient(160deg,${color}12,${color}25)`, border: `2px solid ${color}`, borderRadius: 16, padding: '12px 14px', textAlign: 'center', boxShadow: `0 4px 24px -4px ${color}40`, cursor: 'pointer' }}>
      <Handle type="target" position={Position.Top} id="tgt" style={tgtHandle} />
      <Handle type="source" position={Position.Bottom} id="src" style={srcHandle} />
      <i className={`ti ti-${icon} d-block fs-3 mb-1`} style={{ color }} />
      <div className="fw-semibold small text-truncate">{String(data.label ?? '')}</div>
      {leaderName ? (
        <div className="text-truncate" style={{ fontSize: 11, color: '#64748b' }}>
          <i className="ti ti-crown" style={{ color: '#eab308', fontSize: 11, marginRight: 3 }} />{leaderName}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#ef4444' }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 11, marginRight: 3 }} />No leader
        </div>
      )}
    </div>
  );
}

function UserNode({ data }: { data: Record<string, unknown> }) {
  const _node = data._node as OrgTreeNode | undefined;
  const userId = _node?.userId;
  const dept = data.departmentName as string | undefined;
  const desig = data.designationName as string | undefined;
  const isLeader = data.isLeader === true;
  const initials = String(data.label ?? '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const [imgErr, setImgErr] = useState(false);
  const photoSrc = userId ? `/user-photos/${userId}.jpg` : null;
  const borderColor = isLeader ? '#eab308' : '#22c55e';
  const bgGrad = isLeader ? 'linear-gradient(160deg,#fefce8,#fef9c3)' : 'linear-gradient(160deg,#f0fdf4,#dcfce7)';
  return (
    <div style={{ minWidth: NODE_W, minHeight: NODE_H, background: bgGrad, border: `2px solid ${borderColor}`, borderRadius: 16, padding: '10px 12px', boxShadow: `0 4px 24px -4px ${isLeader ? 'rgba(234,179,8,.35)' : 'rgba(34,197,94,.25)'}`, cursor: 'pointer', position: 'relative' }}>
      <Handle type="target" position={Position.Top} id="tgt" style={tgtHandle} />
      <Handle type="source" position={Position.Bottom} id="src" style={srcHandle} />
      {isLeader && (
        <div style={{ position: 'absolute', top: -10, right: -6, background: '#fbbf24', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,.15)' }}>
          <i className="ti ti-crown" style={{ fontSize: 12, color: '#fff' }} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#e2e8f0', border: `2px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {photoSrc && !imgErr ? (
            <img src={photoSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
          ) : (
            <span style={{ fontSize: 14, fontWeight: 700, color: isLeader ? '#a16207' : '#16a34a' }}>{initials}</span>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
          <div className="fw-semibold text-truncate" style={{ fontSize: 13, lineHeight: 1.3 }}>{String(data.label ?? '')}</div>
          {desig && <div className="text-truncate" style={{ fontSize: 11, color: '#64748b' }}>{desig}</div>}
          {dept && <div className="text-truncate" style={{ fontSize: 11, color: '#94a3b8' }}>{dept}</div>}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { company: CompanyNode, department: DepartmentNode, team: TeamNode, user: UserNode };

/* ═══════════════ MODAL STYLES ═══════════════ */
const backdrop: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 10000, backgroundColor: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const dialogSt: React.CSSProperties = { position: 'relative', zIndex: 10001, minWidth: 360, maxWidth: 500, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', color: '#212529', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' };
const mHeader: React.CSSProperties = { padding: '14px 20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 };
const mBody: React.CSSProperties = { padding: '20px', overflowY: 'auto', flex: '1 1 auto' };
const mFooter: React.CSSProperties = { padding: '14px 20px', borderTop: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' };

/* ═══════════════ INNER FLOW ═══════════════ */
function OrgFlowInner() {
  const { user: currentUser } = useAuth();
  const { currentBranch } = useBranch();
  const canEdit = (currentUser?.permissions ?? []).includes('HRMS.EDIT');
  const reactFlowInstance = useReactFlow();

  /* ─── state ─── */
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [tree, setTree] = useState<{ nodes: OrgTreeNode[]; edges: { source: string; target: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [unassignedUsers, setUnassignedUsers] = useState<UnassignedUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [initialFitDone, setInitialFitDone] = useState(false);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; node: OrgTreeNode } | null>(null);
  const [selectedNode, setSelectedNode] = useState<OrgTreeNode | null>(null);
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [moveUserOpen, setMoveUserOpen] = useState(false);
  const [userToMove, setUserToMove] = useState<OrgTreeNode | null>(null);
  const [deptForm, setDeptForm] = useState({ departmentCode: '', departmentName: '', sortOrder: 0 });
  const [teamForm, setTeamForm] = useState({ departmentId: '' as number | '', name: '', level: 1, parentTeamId: '' as number | '', leadUserId: '' as number | '', icon: '', themeColor: '#8b5cf6' });
  const [teamsForDept, setTeamsForDept] = useState<OrgTeam[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ userId: number; name: string }[]>([]);

  /* ─── viewport preservation ─── */
  const viewportRef = useRef<Viewport | null>(null);

  /* ─── filtered unassigned users ─── */
  const filteredUnassigned = useMemo(() => {
    if (!sidebarSearch.trim()) return unassignedUsers;
    const q = sidebarSearch.toLowerCase().trim();
    return unassignedUsers.filter(u =>
      u.name.toLowerCase().includes(q) ||
      (u.departmentName ?? '').toLowerCase().includes(q) ||
      (u.designationName ?? '').toLowerCase().includes(q)
    );
  }, [unassignedUsers, sidebarSearch]);

  /* ─── data loading (preserves viewport) ─── */
  const loadTree = useCallback(() => {
    try { viewportRef.current = reactFlowInstance.getViewport(); } catch { /* not initialized yet */ }
    setLoading(prev => prev ? true : false);
    setError(null);
    Promise.all([
      hrmsApi.getOrgTree(departmentId === '' ? undefined : Number(departmentId)),
      hrmsApi.listUnassignedUsers(),
    ]).then(([t, u]) => { setTree({ nodes: t.nodes, edges: t.edges }); setUnassignedUsers(u.data ?? []); })
      .catch(e => { setTree(null); setUnassignedUsers([]); setError(e?.message ?? 'Load failed'); })
      .finally(() => setLoading(false));
  }, [departmentId, reactFlowInstance, currentBranch]);

  useEffect(() => { hrmsApi.listOrgDepartments().then(r => setDepartments(r.data ?? [])).catch(() => setDepartments([])); }, []);
  useEffect(() => { setInitialFitDone(false); loadTree(); }, [loadTree]);

  /* ─── real-time ─── */
  const loadTreeRef = useRef(loadTree);
  loadTreeRef.current = loadTree;
  useEffect(() => {
    let socket: Socket | null = null;
    let mounted = true;
    api.get<{ success: boolean; token: string }>('/api/auth/socket-token')
      .then((res) => {
        if (!mounted || !res.token) return;
        const baseUrl = getSocketUrl();
        const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/realtime` : '/realtime';
        socket = io(url, { path: '/socket.io', auth: { token: res.token }, transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: 20, reconnectionDelay: 2000 });
        socket.on('org:changed', () => { loadTreeRef.current(); });
      }).catch(() => {});
    return () => { mounted = false; if (socket) { socket.disconnect(); socket = null; } };
  }, []);

  /* ─── layout computation (preserves positions on refresh) ─── */
  const scope = departmentId === '' ? 'all' : String(departmentId);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    if (!tree) return;
    const addRoot = departmentId === '' && tree.nodes.filter(n => n.type === 'department').length > 1;

    const currentPositions: Record<string, { x: number; y: number }> = {};
    nodesRef.current.forEach(n => { if (n.position) currentPositions[n.id] = { x: n.position.x, y: n.position.y }; });
    const savedFromStorage = loadPositions(scope);
    const hasCurrentPositions = Object.keys(currentPositions).length > 0;
    const hasSavedPositions = Object.keys(savedFromStorage).length > 0;
    const mergedSaved = hasCurrentPositions ? currentPositions : (hasSavedPositions ? savedFromStorage : null);

    const { nodes: n, edges: e } = buildLayout(tree.nodes, tree.edges, { addRoot, saved: mergedSaved });
    setNodes(n);
    setEdges(e);

    if (!initialFitDone) {
      setTimeout(() => {
        try { reactFlowInstance.fitView({ padding: 0.15, duration: 300 }); } catch { /* */ }
        setInitialFitDone(true);
      }, 80);
    } else if (viewportRef.current) {
      setTimeout(() => {
        try { reactFlowInstance.setViewport(viewportRef.current!); } catch { /* */ }
      }, 20);
    }
  }, [tree, departmentId, scope, setNodes, setEdges, reactFlowInstance, initialFitDone]);

  /* ─── auto re-arrange ─── */
  const autoArrange = useCallback(() => {
    if (!tree) return;
    clearPositions(scope);
    const addRoot = departmentId === '' && tree.nodes.filter(n => n.type === 'department').length > 1;
    const { nodes: n, edges: e } = buildLayout(tree.nodes, tree.edges, { addRoot, saved: null });
    setNodes(n);
    setEdges(e);
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.15, duration: 400 }), 50);
  }, [tree, scope, departmentId, setNodes, setEdges, reactFlowInstance]);

  /* ─── grouped drag ─── */
  const dragStartPos = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragDescendants = useRef<Set<string>>(new Set());

  const handleDragStart = useCallback((_evt: React.MouseEvent, node: Node) => {
    dragStartPos.current.clear();
    nodesRef.current.forEach(n => dragStartPos.current.set(n.id, { ...n.position }));
    dragDescendants.current = getDescendantIds(node.id, edges);
  }, [edges]);

  const handleDrag = useCallback((_evt: React.MouseEvent, node: Node) => {
    const desc = dragDescendants.current;
    if (desc.size === 0) return;
    const startPos = dragStartPos.current.get(node.id);
    if (!startPos) return;
    const dx = node.position.x - startPos.x;
    const dy = node.position.y - startPos.y;
    setNodes(prev => prev.map(n => {
      if (desc.has(n.id)) {
        const orig = dragStartPos.current.get(n.id);
        if (orig) return { ...n, position: { x: orig.x + dx, y: orig.y + dy } };
      }
      return n;
    }));
  }, [setNodes]);

  const handleDragStop = useCallback((_evt: React.MouseEvent, _node: Node) => {
    const pos: Record<string, { x: number; y: number }> = {};
    nodesRef.current.forEach(n => { if (n.position) pos[n.id] = { x: n.position.x, y: n.position.y }; });
    savePositions(scope, pos);
  }, [scope]);

  /* ─── connection logic ─── */
  const isValidConnection = useCallback((conn: Edge | Connection) => {
    if (!canEdit || !tree) return false;
    const { source, target } = conn;
    if (source === target) return false;
    const srcNode = tree.nodes.find(n => n.id === source);
    const tgtNode = tree.nodes.find(n => n.id === target);
    if (!srcNode || !tgtNode) return false;
    if (srcNode.type === 'user') {
      if (tgtNode.type !== 'team') return false;
      if (srcNode.departmentId != null && tgtNode.departmentId != null && srcNode.departmentId !== tgtNode.departmentId) return false;
      return true;
    }
    if (srcNode.type === 'team') return tgtNode.type === 'department' || tgtNode.type === 'team';
    return false;
  }, [canEdit, tree]);

  const onConnect = useCallback((conn: Connection) => {
    if (!canEdit || !tree) return;
    const srcNode = tree.nodes.find(n => n.id === conn.source);
    const tgtNode = tree.nodes.find(n => n.id === conn.target);
    if (!srcNode || !tgtNode) return;
    setSaving(true);
    let promise: Promise<unknown>;
    if (srcNode.type === 'user' && tgtNode.type === 'team' && tgtNode.teamId) {
      if (srcNode.departmentId != null && tgtNode.departmentId != null && srcNode.departmentId !== tgtNode.departmentId) {
        setError('Cannot move user to a team in a different department'); setSaving(false); return;
      }
      promise = hrmsApi.moveUserToTeam(srcNode.userId!, tgtNode.teamId);
    } else if (srcNode.type === 'team' && tgtNode.type === 'department' && tgtNode.departmentId) {
      promise = hrmsApi.updateOrgTeam(srcNode.teamId!, { departmentId: tgtNode.departmentId });
    } else if (srcNode.type === 'team' && tgtNode.type === 'team' && tgtNode.teamId) {
      promise = hrmsApi.updateOrgTeam(srcNode.teamId!, { parentTeamId: tgtNode.teamId });
    } else { setSaving(false); return; }
    promise.then(() => loadTree()).catch(e => setError(e?.message ?? 'Operation failed')).finally(() => setSaving(false));
  }, [canEdit, tree, loadTree]);

  const safeNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes.filter(c => c.type !== 'remove'));
  }, [onNodesChange]);

  /* ─── context menu ─── */
  const onNodeClick = useCallback((_evt: React.MouseEvent, node: Node) => {
    if (node.type === 'company') return;
    const orgNode = node.data?._node as OrgTreeNode | undefined;
    if (!orgNode) return;
    const rect = (_evt.target as HTMLElement)?.closest('.react-flow__node')?.getBoundingClientRect();
    const x = rect ? rect.right + 6 : _evt.clientX;
    const y = rect ? rect.top : _evt.clientY;
    setCtxMenu({ x: Math.min(x, window.innerWidth - 240), y: Math.min(y, window.innerHeight - 340), node: orgNode });
  }, []);

  /* ─── drop from sidebar ─── */
  const onDragOverCanvas = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const onDropCanvas = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const d = JSON.parse(e.dataTransfer.getData('application/reactflow')) as { userId?: number; orgDepartmentId?: number | null };
      if (typeof d.userId !== 'number') return;
      const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const userDeptId = d.orgDepartmentId ?? null;
      let closest: { teamId: number; dist: number } | null = null;
      for (const n of nodesRef.current) {
        const _nd = n.data?._node as OrgTreeNode | undefined;
        if (_nd?.type !== 'team' || !_nd.teamId) continue;
        if (userDeptId != null && _nd.departmentId != null && userDeptId !== _nd.departmentId) continue;
        const cx = n.position.x + NODE_W / 2;
        const cy = n.position.y + NODE_H / 2;
        const dist = Math.hypot(flowPos.x - cx, flowPos.y - cy);
        if (!closest || dist < closest.dist) closest = { teamId: _nd.teamId, dist };
      }
      if (closest && closest.dist < 500) {
        setSaving(true);
        hrmsApi.moveUserToTeam(d.userId, closest.teamId)
          .then(() => loadTree()).catch(e => setError(e?.message ?? 'Failed')).finally(() => setSaving(false));
      } else if (userDeptId != null) {
        setError('User can only be assigned to a team in their own department');
      }
    } catch { /* */ }
  }, [canEdit, reactFlowInstance, loadTree]);

  /* ─── close everything ─── */
  const closeAll = useCallback(() => { setSelectedNode(null); setAddDeptOpen(false); setAddTeamOpen(false); setAddUserOpen(false); setMoveUserOpen(false); setUserToMove(null); setCtxMenu(null); }, []);

  /* ─── context menu actions ─── */
  const ctxEdit = useCallback(() => { if (ctxMenu) { setSelectedNode(ctxMenu.node); setCtxMenu(null); } }, [ctxMenu]);
  const ctxAddTeam = useCallback(() => {
    if (!ctxMenu) return;
    const n = ctxMenu.node;
    setTeamForm({ departmentId: (n.departmentId ?? '') as number | '', name: '', level: 1, parentTeamId: n.type === 'team' && n.teamId ? n.teamId : '', leadUserId: '', icon: '', themeColor: '#8b5cf6' });
    setAddTeamOpen(true); setCtxMenu(null);
  }, [ctxMenu]);
  const ctxAddUser = useCallback(() => {
    if (!ctxMenu || ctxMenu.node.type !== 'team') return;
    setSelectedNode(ctxMenu.node); setAddUserOpen(true); setCtxMenu(null);
  }, [ctxMenu]);
  const ctxMoveUser = useCallback(() => {
    if (!ctxMenu || ctxMenu.node.type !== 'user') return;
    setUserToMove(ctxMenu.node); setMoveUserOpen(true); setCtxMenu(null);
  }, [ctxMenu]);
  const ctxSetLeader = useCallback(() => {
    if (!ctxMenu || ctxMenu.node.type !== 'user' || !ctxMenu.node.teamId || !ctxMenu.node.userId) return;
    setSaving(true);
    hrmsApi.updateOrgTeam(ctxMenu.node.teamId, { leadUserId: ctxMenu.node.userId })
      .then(() => loadTree()).catch(e => setError(e?.message ?? 'Failed')).finally(() => setSaving(false));
    setCtxMenu(null);
  }, [ctxMenu, loadTree]);

  /* ─── CRUD callbacks ─── */
  const saveDept = useCallback(() => {
    const d = selectedNode; if (!d || d.type !== 'department' || !deptForm.departmentCode.trim() || !deptForm.departmentName.trim()) return;
    setSaving(true);
    hrmsApi.updateOrgDepartment(d.departmentId!, { departmentCode: deptForm.departmentCode.trim(), departmentName: deptForm.departmentName.trim(), sortOrder: deptForm.sortOrder })
      .then(() => { closeAll(); loadTree(); }).catch(e => setError(e?.message ?? 'Failed')).finally(() => setSaving(false));
  }, [selectedNode, deptForm, closeAll, loadTree]);

  const deleteDept = useCallback(() => {
    const d = selectedNode; if (!d || d.type !== 'department' || !window.confirm('Delete this department?')) return;
    setSaving(true);
    hrmsApi.deleteOrgDepartment(d.departmentId!).then(() => { closeAll(); loadTree(); }).catch(e => setError(e?.message ?? 'Failed')).finally(() => setSaving(false));
  }, [selectedNode, closeAll, loadTree]);

  const saveTeam = useCallback(() => {
    const t = selectedNode; if (!t || t.type !== 'team' || !teamForm.name.trim()) return;
    setSaving(true);
    hrmsApi.updateOrgTeam(t.teamId!, {
      name: teamForm.name.trim(), level: teamForm.level,
      parentTeamId: teamForm.parentTeamId === '' ? null : teamForm.parentTeamId,
      leadUserId: teamForm.leadUserId === '' ? null : teamForm.leadUserId,
      icon: teamForm.icon.trim() || null, themeColor: teamForm.themeColor?.trim() || null,
    }).then(() => { closeAll(); loadTree(); }).catch(e => setError(e?.message ?? 'Failed')).finally(() => setSaving(false));
  }, [selectedNode, teamForm, closeAll, loadTree]);

  const deleteTeam = useCallback(() => {
    const t = selectedNode; if (!t || t.type !== 'team' || !window.confirm('Delete this team?')) return;
    setSaving(true);
    hrmsApi.deleteOrgTeam(t.teamId!).then(() => { closeAll(); loadTree(); }).catch(e => setError(e?.message ?? 'Failed')).finally(() => setSaving(false));
  }, [selectedNode, closeAll, loadTree]);

  const createDept = useCallback(() => {
    if (!deptForm.departmentCode.trim() || !deptForm.departmentName.trim()) return;
    setSaving(true);
    hrmsApi.createOrgDepartment({ departmentCode: deptForm.departmentCode.trim(), departmentName: deptForm.departmentName.trim(), sortOrder: deptForm.sortOrder })
      .then(() => { setAddDeptOpen(false); setDeptForm({ departmentCode: '', departmentName: '', sortOrder: departments.length }); loadTree(); }).catch(e => setError(e?.message ?? 'Failed')).finally(() => setSaving(false));
  }, [deptForm, departments.length, loadTree]);

  const createTeam = useCallback(() => {
    if (teamForm.departmentId === '' || !teamForm.name.trim()) return;
    setSaving(true);
    hrmsApi.createOrgTeam({
      departmentId: teamForm.departmentId, name: teamForm.name.trim(), level: teamForm.level,
      parentTeamId: teamForm.parentTeamId === '' ? null : teamForm.parentTeamId,
      leadUserId: teamForm.leadUserId === '' ? null : teamForm.leadUserId,
      icon: teamForm.icon.trim() || undefined, themeColor: teamForm.themeColor?.trim() || undefined,
    }).then(() => { setAddTeamOpen(false); setTeamForm({ departmentId: '', name: '', level: 1, parentTeamId: '', leadUserId: '', icon: '', themeColor: '#8b5cf6' }); loadTree(); }).catch(e => setError(e?.message ?? 'Failed')).finally(() => setSaving(false));
  }, [teamForm, loadTree]);

  const addUserToTeam = useCallback((userId: number) => {
    const t = selectedNode; if (!t || t.type !== 'team' || !t.teamId) return;
    setSaving(true);
    hrmsApi.addOrgTeamMember(t.teamId, userId)
      .then(() => { setAddUserOpen(false); setSelectedNode(null); loadTree(); }).catch(e => setError(e?.message ?? 'Failed')).finally(() => setSaving(false));
  }, [selectedNode, loadTree]);

  /* ─── sync forms ─── */
  useEffect(() => { if (selectedNode?.type === 'department' && selectedNode.data) setDeptForm({ departmentCode: String(selectedNode.data.code ?? ''), departmentName: String(selectedNode.data.label ?? ''), sortOrder: 0 }); }, [selectedNode]);
  useEffect(() => {
    if (selectedNode?.type === 'team' && selectedNode.data) {
      setTeamForm(p => ({ ...p, departmentId: selectedNode.departmentId ?? '', name: String(selectedNode.data.label ?? ''), level: Number(selectedNode.data.level ?? 1), parentTeamId: '', leadUserId: (selectedNode.data.leadUserId as number) ?? '', icon: String(selectedNode.data.icon ?? ''), themeColor: String(selectedNode.data.themeColor ?? '#8b5cf6') }));
      if (selectedNode.teamId) {
        const members = tree?.nodes.filter(n => n.type === 'user' && n.parentId === `team-${selectedNode.teamId}`) ?? [];
        setTeamMembers(members.map(m => ({ userId: m.userId!, name: String(m.data?.label ?? '') })));
      }
    }
  }, [selectedNode, tree]);
  useEffect(() => { if (addTeamOpen && teamForm.departmentId !== '') hrmsApi.listOrgTeams(teamForm.departmentId).then(r => setTeamsForDept(r.data ?? [])).catch(() => setTeamsForDept([])); else setTeamsForDept([]); }, [addTeamOpen, teamForm.departmentId]);

  /* ─── toolbar ─── */
  const openAddDept = useCallback(() => { setSelectedNode(null); setDeptForm({ departmentCode: '', departmentName: '', sortOrder: departments.length }); setAddDeptOpen(true); }, [departments.length]);
  const openAddTeam = useCallback(() => { setSelectedNode(null); setTeamForm({ departmentId: departmentId === '' ? (departments[0]?.id ?? '') : departmentId, name: '', level: 1, parentTeamId: '', leadUserId: '', icon: '', themeColor: '#8b5cf6' }); setAddTeamOpen(true); }, [departmentId, departments]);

  /* ─── all teams for move-to modal ─── */
  const allTeams = useMemo(() => {
    const teams = tree?.nodes.filter(n => n.type === 'team') ?? [];
    if (!userToMove || userToMove.departmentId == null) return teams;
    return teams.filter(t => t.departmentId == null || t.departmentId === userToMove.departmentId);
  }, [tree, userToMove]);

  const anyModalOpen = selectedNode != null || addDeptOpen || addTeamOpen || addUserOpen || moveUserOpen;

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="container-fluid py-4" style={{ position: 'relative' }}>
      {/* Toolbar */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3" style={{ zIndex: 10, position: 'relative' }}>
        <h4 className="mb-0"><i className="ti ti-sitemap me-2" />Org Structure</h4>
        <div className="d-flex flex-wrap align-items-center gap-2">
          {canEdit && <>
            <button type="button" className="btn btn-primary btn-sm" onClick={openAddDept}><i className="ti ti-plus me-1" />Department</button>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={openAddTeam}><i className="ti ti-users-plus me-1" />Team</button>
          </>}
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={autoArrange} title="Auto re-arrange"><i className="ti ti-layout-distribute-horizontal me-1" />Auto Arrange</button>
          <select className="form-select form-select-sm" style={{ width: 200 }} value={departmentId} onChange={e => setDepartmentId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">All departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.departmentName}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger alert-dismissible fade show">{error}<button type="button" className="btn-close" onClick={() => setError(null)} /></div>}
      {saving && <div className="text-center text-muted mb-2"><span className="spinner-border spinner-border-sm me-2" />Saving…</div>}

      {/* Context menu */}
      {ctxMenu && <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001 }} onClick={() => setCtxMenu(null)} />
        <div className="dropdown-menu show shadow-lg border-0 rounded-3 py-2" style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 10002, minWidth: 210 }}>
          {ctxMenu.node.type === 'user' ? <>
            {canEdit && ctxMenu.node.teamId != null && ctxMenu.node.data?.isLeader !== true && (
              <button className="dropdown-item py-2" onClick={ctxSetLeader}><i className="ti ti-crown me-2" style={{ color: '#eab308' }} />Set as Team Leader</button>
            )}
            <button className="dropdown-item py-2" onClick={ctxMoveUser}><i className="ti ti-transfer me-2 text-primary" />Move to team…</button>
            <button className="dropdown-item py-2" onClick={ctxEdit}><i className="ti ti-user me-2" />View profile</button>
          </> : <>
            <button className="dropdown-item py-2" onClick={ctxEdit}><i className="ti ti-edit me-2" />Edit</button>
            <div className="dropdown-divider" />
            <button className="dropdown-item py-2" onClick={ctxAddTeam}><i className="ti ti-folder-plus me-2 text-purple" />Add sub-team</button>
            {ctxMenu.node.type === 'team' && ctxMenu.node.teamId != null && (
              <button className="dropdown-item py-2" onClick={ctxAddUser}><i className="ti ti-user-plus me-2 text-success" />Add member</button>
            )}
          </>}
        </div>
      </>}

      {/* Main layout */}
      <div className="d-flex gap-3" style={{ position: 'relative', zIndex: 1 }}>
        <div className="rounded-4 overflow-hidden flex-grow-1 shadow" style={{ height: 700, background: 'linear-gradient(160deg,#f8fafc,#e2e8f0)' }}>
          {loading && nodes.length === 0 ? (
            <div className="d-flex align-items-center justify-content-center h-100 text-muted"><span className="spinner-border spinner-border-sm me-2" />Loading…</div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={safeNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              connectionMode={ConnectionMode.Loose}
              connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 3, strokeDasharray: '8 4' }}
              defaultEdgeOptions={{ type: 'smoothstep', animated: false }}
              nodesDraggable
              onNodeDragStart={handleDragStart}
              onNodeDrag={handleDrag}
              onNodeDragStop={handleDragStop}
              onNodeClick={onNodeClick}
              onPaneClick={() => setCtxMenu(null)}
              onDragOver={onDragOverCanvas}
              onDrop={onDropCanvas}
              proOptions={{ hideAttribution: true }}
              snapToGrid
              snapGrid={[16, 16]}
            >
              <Background color="#cbd5e1" gap={24} />
              <Controls className="rounded-3 shadow bg-white border-0" showInteractive={false} />
              <MiniMap className="rounded-3 shadow border-0" nodeColor={n => n.type === 'department' ? '#3b82f6' : n.type === 'team' ? '#8b5cf6' : n.type === 'user' ? '#22c55e' : '#1e293b'} maskColor="rgba(30,41,59,.08)" />
            </ReactFlow>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex-shrink-0 rounded-4 overflow-hidden shadow" style={{ width: 280, height: 700, display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#fffbeb,#fef3c7)', border: '2px solid #f59e0b55' }}>
          <div className="px-3 py-2 border-bottom small fw-semibold text-dark d-flex align-items-center gap-2" style={{ background: '#fbbf2430', flexShrink: 0 }}>
            <i className="ti ti-user-exclamation fs-5 text-warning" /> Unassigned ({unassignedUsers.length})
          </div>
          <div className="px-2 pt-2 pb-1" style={{ flexShrink: 0 }}>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0"><i className="ti ti-search text-muted" /></span>
              <input type="text" className="form-control border-start-0" placeholder="Search users…" value={sidebarSearch} onChange={e => setSidebarSearch(e.target.value)} />
              {sidebarSearch && <button type="button" className="btn btn-outline-secondary border-start-0" onClick={() => setSidebarSearch('')}><i className="ti ti-x" /></button>}
            </div>
          </div>
          <div className="p-2 overflow-auto flex-grow-1">
            {filteredUnassigned.length === 0 ? (
              <p className="small text-muted text-center mt-3">{sidebarSearch ? 'No matching users' : 'Everyone is assigned'}</p>
            ) : filteredUnassigned.map(u => (
              <div key={u.userId} draggable={canEdit}
                onDragStart={e => { if (canEdit) { e.dataTransfer.setData('application/reactflow', JSON.stringify({ userId: u.userId, orgDepartmentId: u.orgDepartmentId })); e.dataTransfer.effectAllowed = 'move'; } }}
                className="rounded-3 bg-white shadow-sm p-2 mb-2 d-flex align-items-center gap-2"
                style={{ cursor: canEdit ? 'grab' : 'default', border: '1.5px solid #f59e0b88', transition: 'box-shadow .15s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(245,158,11,.3)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
              >
                <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #f59e0b' }}>
                  <img src={`/user-photos/${u.userId}.jpg`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; const next = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement; if (next) next.style.display = 'flex'; }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#d97706', display: 'none', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>{u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="fw-semibold text-truncate" style={{ fontSize: 12 }}>{u.name}</div>
                  {u.departmentName && <div className="text-truncate" style={{ fontSize: 11, color: '#92400e' }}>{u.departmentName}</div>}
                  {u.designationName && <div className="text-truncate" style={{ fontSize: 11, color: '#a16207' }}>{u.designationName}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Help */}
      <div className="d-flex align-items-start gap-2 mt-2 px-1">
        <i className="ti ti-info-circle text-muted mt-1" />
        <p className="small text-muted mb-0">
          <strong>Connect nodes:</strong> Drag from a <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#6366f1', verticalAlign: 'middle' }} /> to a <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#f97316', verticalAlign: 'middle' }} /> handle.
          <strong> Click</strong> any node for options (edit, add team/member, set leader). <strong>Drag</strong> users from sidebar onto the canvas. <i className="ti ti-crown" style={{ color: '#eab308' }} /> = Team Leader.
        </p>
      </div>

      {/* ═══ MODALS ═══ */}
      {anyModalOpen && typeof document !== 'undefined' && createPortal(<>
        {/* Edit Department */}
        {selectedNode?.type === 'department' && selectedNode.departmentId != null && !addUserOpen && !moveUserOpen && (
          <div style={backdrop} onClick={closeAll}>
            <div style={dialogSt} onClick={e => e.stopPropagation()}>
              <div style={mHeader}><h6 className="mb-0 fw-semibold"><i className="ti ti-building me-2" />Edit Department</h6><button type="button" className="btn-close" onClick={closeAll} /></div>
              <div style={mBody}>
                <div className="mb-3"><label className="form-label small fw-medium">Code</label><input className="form-control" value={deptForm.departmentCode} onChange={e => setDeptForm(f => ({ ...f, departmentCode: e.target.value }))} /></div>
                <div className="mb-3"><label className="form-label small fw-medium">Name</label><input className="form-control" value={deptForm.departmentName} onChange={e => setDeptForm(f => ({ ...f, departmentName: e.target.value }))} /></div>
                <div><label className="form-label small fw-medium">Sort order</label><input type="number" className="form-control" value={deptForm.sortOrder} onChange={e => setDeptForm(f => ({ ...f, sortOrder: +e.target.value || 0 }))} /></div>
              </div>
              <div style={mFooter}><button className="btn btn-outline-danger me-auto" onClick={deleteDept} disabled={saving}>Delete</button><button className="btn btn-secondary" onClick={closeAll}>Cancel</button><button className="btn btn-primary" onClick={saveDept} disabled={saving}>Save</button></div>
            </div>
          </div>
        )}

        {/* Edit Team */}
        {selectedNode?.type === 'team' && selectedNode.teamId != null && !addUserOpen && !moveUserOpen && (
          <div style={backdrop} onClick={closeAll}>
            <div style={dialogSt} onClick={e => e.stopPropagation()}>
              <div style={mHeader}><h6 className="mb-0 fw-semibold"><i className="ti ti-users-group me-2" />Edit Team</h6><button type="button" className="btn-close" onClick={closeAll} /></div>
              <div style={mBody}>
                <div className="mb-3"><label className="form-label small fw-medium">Name</label><input className="form-control" value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="mb-3">
                  <label className="form-label small fw-medium"><i className="ti ti-crown me-1" style={{ color: '#eab308' }} />Team Leader</label>
                  <select className="form-select" value={teamForm.leadUserId} onChange={e => setTeamForm(f => ({ ...f, leadUserId: e.target.value === '' ? '' : +e.target.value }))}>
                    <option value="">— Select leader —</option>
                    {teamMembers.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
                  </select>
                  {teamForm.leadUserId === '' && <div className="form-text text-danger"><i className="ti ti-alert-triangle me-1" />Every team must have a leader</div>}
                </div>
                <div className="mb-3"><label className="form-label small fw-medium">Icon (Tabler, e.g. users-group)</label><input className="form-control" value={teamForm.icon} onChange={e => setTeamForm(f => ({ ...f, icon: e.target.value }))} /></div>
                <div className="mb-3"><label className="form-label small fw-medium">Theme color</label>
                  <div className="d-flex gap-2"><input type="color" className="form-control form-control-color" value={teamForm.themeColor} onChange={e => setTeamForm(f => ({ ...f, themeColor: e.target.value }))} style={{ width: 48 }} /><input className="form-control" value={teamForm.themeColor} onChange={e => setTeamForm(f => ({ ...f, themeColor: e.target.value }))} /></div>
                </div>
                <div><label className="form-label small fw-medium">Level</label><input type="number" className="form-control" value={teamForm.level} onChange={e => setTeamForm(f => ({ ...f, level: +e.target.value || 1 }))} min={1} /></div>
              </div>
              <div style={mFooter}><button className="btn btn-outline-danger me-auto" onClick={deleteTeam} disabled={saving}>Delete</button><button className="btn btn-secondary" onClick={closeAll}>Cancel</button><button className="btn btn-primary" onClick={saveTeam} disabled={saving}>Save</button></div>
            </div>
          </div>
        )}

        {/* View User */}
        {selectedNode?.type === 'user' && selectedNode.userId != null && !moveUserOpen && (
          <div style={backdrop} onClick={closeAll}>
            <div style={dialogSt} onClick={e => e.stopPropagation()}>
              <div style={mHeader}><h6 className="mb-0 fw-semibold"><i className="ti ti-user me-2" />Employee</h6><button type="button" className="btn-close" onClick={closeAll} /></div>
              <div style={mBody}>
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #22c55e' }}>
                    <img src={`/user-photos/${selectedNode.userId}.jpg`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; const next = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement; if (next) next.style.display = 'inline'; }} />
                    <i className="ti ti-user fs-2 text-muted" style={{ display: 'none' }} />
                  </div>
                  <div>
                    <p className="mb-1 fw-semibold">{selectedNode.data?.label && String(selectedNode.data.label)}</p>
                    {selectedNode.data?.isLeader && <span className="badge bg-warning text-dark mb-1"><i className="ti ti-crown me-1" />Team Leader</span>}
                    {selectedNode.data?.designationName && <p className="small text-muted mb-0">{String(selectedNode.data.designationName)}</p>}
                    {selectedNode.data?.departmentName && <p className="small text-muted mb-0">{String(selectedNode.data.departmentName)}</p>}
                  </div>
                </div>
              </div>
              <div style={mFooter}><button className="btn btn-secondary" onClick={closeAll}>Close</button><Link className="btn btn-primary" to={`/hrms/employees/${selectedNode.userId}`}>Open profile</Link></div>
            </div>
          </div>
        )}

        {/* Add Department */}
        {addDeptOpen && (
          <div style={backdrop} onClick={() => setAddDeptOpen(false)}>
            <div style={dialogSt} onClick={e => e.stopPropagation()}>
              <div style={mHeader}><h6 className="mb-0 fw-semibold"><i className="ti ti-building me-2" />Add Department</h6><button type="button" className="btn-close" onClick={() => setAddDeptOpen(false)} /></div>
              <div style={mBody}>
                <div className="mb-3"><label className="form-label small fw-medium">Code</label><input className="form-control" placeholder="e.g. ENG" value={deptForm.departmentCode} onChange={e => setDeptForm(f => ({ ...f, departmentCode: e.target.value }))} /></div>
                <div className="mb-3"><label className="form-label small fw-medium">Name</label><input className="form-control" placeholder="e.g. Engineering" value={deptForm.departmentName} onChange={e => setDeptForm(f => ({ ...f, departmentName: e.target.value }))} /></div>
                <div><label className="form-label small fw-medium">Sort order</label><input type="number" className="form-control" value={deptForm.sortOrder} onChange={e => setDeptForm(f => ({ ...f, sortOrder: +e.target.value || 0 }))} /></div>
              </div>
              <div style={mFooter}><button className="btn btn-secondary" onClick={() => setAddDeptOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={createDept} disabled={saving || !deptForm.departmentCode.trim() || !deptForm.departmentName.trim()}>Create</button></div>
            </div>
          </div>
        )}

        {/* Add Team */}
        {addTeamOpen && (
          <div style={backdrop} onClick={() => setAddTeamOpen(false)}>
            <div style={dialogSt} onClick={e => e.stopPropagation()}>
              <div style={mHeader}><h6 className="mb-0 fw-semibold"><i className="ti ti-users-plus me-2" />Add Team</h6><button type="button" className="btn-close" onClick={() => setAddTeamOpen(false)} /></div>
              <div style={mBody}>
                <div className="mb-3"><label className="form-label small fw-medium">Department</label>
                  <select className="form-select" value={teamForm.departmentId} onChange={e => setTeamForm(f => ({ ...f, departmentId: e.target.value === '' ? '' : +e.target.value }))}>
                    <option value="">Select…</option>{departments.map(d => <option key={d.id} value={d.id}>{d.departmentName}</option>)}
                  </select>
                </div>
                <div className="mb-3"><label className="form-label small fw-medium">Name</label><input className="form-control" placeholder="e.g. Backend" value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="mb-3"><label className="form-label small fw-medium">Icon</label><input className="form-control" value={teamForm.icon} onChange={e => setTeamForm(f => ({ ...f, icon: e.target.value }))} placeholder="users-group" /></div>
                <div className="mb-3"><label className="form-label small fw-medium">Color</label>
                  <div className="d-flex gap-2"><input type="color" className="form-control form-control-color" value={teamForm.themeColor} onChange={e => setTeamForm(f => ({ ...f, themeColor: e.target.value }))} style={{ width: 48 }} /><input className="form-control" value={teamForm.themeColor} onChange={e => setTeamForm(f => ({ ...f, themeColor: e.target.value }))} /></div>
                </div>
                <div className="mb-3"><label className="form-label small fw-medium">Level</label><input type="number" className="form-control" value={teamForm.level} onChange={e => setTeamForm(f => ({ ...f, level: +e.target.value || 1 }))} min={1} /></div>
                <div><label className="form-label small fw-medium">Parent team</label>
                  <select className="form-select" value={teamForm.parentTeamId} onChange={e => setTeamForm(f => ({ ...f, parentTeamId: e.target.value === '' ? '' : +e.target.value }))}>
                    <option value="">None (root)</option>{teamsForDept.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-text text-muted mt-2"><i className="ti ti-info-circle me-1" />You can assign a team leader after adding members.</div>
              </div>
              <div style={mFooter}><button className="btn btn-secondary" onClick={() => setAddTeamOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={createTeam} disabled={saving || teamForm.departmentId === '' || !teamForm.name.trim()}>Create</button></div>
            </div>
          </div>
        )}

        {/* Add User to Team */}
        {addUserOpen && selectedNode?.type === 'team' && selectedNode.teamId != null && (
          <div style={backdrop} onClick={() => { setAddUserOpen(false); setSelectedNode(null); }}>
            <div style={{ ...dialogSt, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
              <div style={mHeader}><h6 className="mb-0 fw-semibold"><i className="ti ti-user-plus me-2" />Add member to {selectedNode.data?.label}</h6><button type="button" className="btn-close" onClick={() => { setAddUserOpen(false); setSelectedNode(null); }} /></div>
              <div style={mBody}>
                {unassignedUsers.length === 0 ? <p className="small text-muted">All users are assigned to teams.</p> : (
                  <div className="d-flex flex-column gap-2">{unassignedUsers.map(u => (
                    <button key={u.userId} className="btn btn-outline-secondary btn-sm text-start d-flex align-items-center gap-2 p-2 rounded-3" onClick={() => addUserToTeam(u.userId)} disabled={saving}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={`/user-photos/${u.userId}.jpg`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; const next = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement; if (next) next.style.display = 'inline'; }} />
                        <i className="ti ti-user text-muted" style={{ display: 'none' }} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}><div className="small fw-semibold text-truncate">{u.name}</div>{(u.departmentName || u.designationName) && <div className="small text-muted text-truncate">{[u.departmentName, u.designationName].filter(Boolean).join(' · ')}</div>}</div>
                      <i className="ti ti-plus text-success" />
                    </button>
                  ))}</div>
                )}
              </div>
              <div style={mFooter}><button className="btn btn-secondary" onClick={() => { setAddUserOpen(false); setSelectedNode(null); }}>Close</button></div>
            </div>
          </div>
        )}

        {/* Move User to Team */}
        {moveUserOpen && userToMove?.type === 'user' && userToMove.userId != null && (
          <div style={backdrop} onClick={() => { setMoveUserOpen(false); setUserToMove(null); }}>
            <div style={{ ...dialogSt, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
              <div style={mHeader}><h6 className="mb-0 fw-semibold"><i className="ti ti-transfer me-2" />Move {userToMove.data?.label} to…</h6><button type="button" className="btn-close" onClick={() => { setMoveUserOpen(false); setUserToMove(null); }} /></div>
              <div style={mBody}>
                {allTeams.length === 0 ? <p className="small text-muted">No teams available.</p> : (
                  <div className="d-flex flex-column gap-2">{allTeams.map(t => (
                    <button key={t.id} className="btn btn-outline-primary btn-sm text-start d-flex align-items-center gap-2 p-2 rounded-3" disabled={saving} onClick={() => {
                      if (t.teamId != null) { setSaving(true); hrmsApi.moveUserToTeam(userToMove.userId!, t.teamId).then(() => loadTree()).catch(e => setError(e?.message ?? 'Failed')).finally(() => { setSaving(false); setMoveUserOpen(false); setUserToMove(null); }); }
                    }}>
                      <i className="ti ti-users-group text-primary flex-shrink-0" />
                      <span className="small fw-semibold text-truncate">{t.data?.label ?? `Team ${t.teamId}`}</span>
                      {t.departmentId && <span className="small text-muted ms-auto">{departments.find(d => d.id === t.departmentId)?.departmentName ?? ''}</span>}
                    </button>
                  ))}</div>
                )}
              </div>
              <div style={mFooter}><button className="btn btn-secondary" onClick={() => { setMoveUserOpen(false); setUserToMove(null); }}>Cancel</button></div>
            </div>
          </div>
        )}
      </>, document.body)}
    </div>
  );
}

/* ═══════════════ MAIN PAGE ═══════════════ */
export default function HRMSTeamsOrg() {
  return (
    <ReactFlowProvider>
      <OrgFlowInner />
    </ReactFlowProvider>
  );
}
