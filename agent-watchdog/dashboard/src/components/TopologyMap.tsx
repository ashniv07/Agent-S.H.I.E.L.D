import { useEffect, useState, useCallback, useRef } from 'react';
import { authFetch } from '../utils/api';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWebSocket } from '../hooks/useWebSocket.js';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import GppBadOutlinedIcon from '@mui/icons-material/GppBadOutlined';

interface TopologyNode {
  agentId: string;
  isActive: number | boolean;
  violationCount: number;
}

interface TopologyEdge {
  id: string;
  agentId: string;
  decision: string | null;
  createdAt: string;
}

function getNodeColor(violationCount: number): string {
  if (violationCount >= 6) return '#ef4444';
  if (violationCount >= 3) return '#f97316';
  if (violationCount >= 1) return '#facc15';
  return '#22d3ee';
}

function getEdgeColor(decision: string | null): string {
  if (decision === 'KILL') return '#ef4444';
  if (decision === 'FLAG') return '#facc15';
  return '#4ade80';
}

function buildRFNodes(agents: TopologyNode[], flashAgents: Set<string>): Node[] {
  const nodes: Node[] = [
    {
      id: 'watchdog',
      type: 'default',
      position: { x: 0, y: 0 },
      data: { label: '🛡 WATCHDOG' },
      style: {
        background: 'linear-gradient(135deg, #0f172a, #1e293b)',
        border: '2px solid rgba(34,211,238,0.5)',
        borderRadius: '50%',
        width: 100,
        height: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#22d3ee',
        fontWeight: 'bold',
        fontSize: '11px',
        textAlign: 'center',
        boxShadow: '0 0 24px rgba(34,211,238,0.25), 0 0 8px rgba(34,211,238,0.1)',
      },
    },
  ];

  const count = Math.max(agents.length, 1);
  const radius = Math.max(200, 90 + count * 28);

  agents.forEach((agent, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    const isFlashing = flashAgents.has(agent.agentId);
    const color = isFlashing ? '#ef4444' : getNodeColor(agent.violationCount);
    const blocked = !agent.isActive;

    nodes.push({
      id: agent.agentId,
      type: 'default',
      position: { x, y },
      data: {
        label: `${agent.agentId}\n${agent.violationCount} violation${agent.violationCount !== 1 ? 's' : ''}`,
      },
      style: {
        background: blocked
          ? 'rgba(17,24,39,0.9)'
          : `linear-gradient(135deg, rgba(${color === '#22d3ee' ? '34,211,238' : color === '#facc15' ? '250,204,21' : color === '#f97316' ? '249,115,22' : '239,68,68'},0.08), rgba(15,23,42,0.95))`,
        border: `1.5px solid ${blocked ? '#374151' : color}`,
        borderRadius: '10px',
        color: blocked ? '#4b5563' : color,
        fontSize: '10px',
        fontWeight: '600',
        minWidth: 110,
        textAlign: 'center' as const,
        whiteSpace: 'pre-line' as const,
        boxShadow: isFlashing
          ? `0 0 28px #ef4444, 0 0 10px #ef4444`
          : !blocked && agent.violationCount >= 1
          ? `0 0 16px ${color}44`
          : 'none',
        opacity: blocked ? 0.4 : 1,
        transition: 'all 0.3s ease',
        padding: '10px 8px',
      },
    });
  });

  return nodes;
}

function buildRFEdges(rawEdges: TopologyEdge[], agentIds: Set<string>): Edge[] {
  const seen = new Set<string>();
  return rawEdges
    .filter((e) => {
      if (!agentIds.has(e.agentId)) return false;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .slice(0, 30)
    .map((e) => {
      const color = getEdgeColor(e.decision);
      return {
        id: e.id,
        source: e.agentId,
        target: 'watchdog',
        animated: e.decision === 'KILL' || e.decision === 'FLAG',
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: {
          stroke: color,
          strokeWidth: e.decision === 'KILL' ? 3 : e.decision === 'FLAG' ? 2 : 1.5,
          strokeDasharray: e.decision === 'KILL' ? '6 3' : undefined,
          opacity: 0.85,
        },
      };
    });
}

export function TopologyMap() {
  const [agentData, setAgentData] = useState<TopologyNode[]>([]);
  const [edgeData, setEdgeData] = useState<TopologyEdge[]>([]);
  const [flashAgents, setFlashAgents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { lastEvent } = useWebSocket();
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const fetchTopology = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await authFetch('/api/agents/topology/data');
      if (!res.ok) return;
      const data = (await res.json()) as { agents: TopologyNode[]; edges: TopologyEdge[] };
      setAgentData(data.agents || []);
      setEdgeData(data.edges || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchTopology();
  }, [fetchTopology]);

  // Rebuild ReactFlow nodes/edges when data changes
  useEffect(() => {
    const agentIds = new Set(agentData.map((a) => a.agentId));
    setNodes(buildRFNodes(agentData, flashAgents));
    setEdges(buildRFEdges(edgeData, agentIds));
  }, [agentData, edgeData, flashAgents, setNodes, setEdges]);

  // React to WebSocket events
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'request:processed') {
      const data = lastEvent.data as { agentId?: string; decision?: string; id?: string };
      if (data.agentId && data.id) {
        const newEdge: TopologyEdge = {
          id: data.id,
          agentId: data.agentId,
          decision: data.decision || null,
          createdAt: lastEvent.timestamp,
        };
        setEdgeData((prev) => [newEdge, ...prev].slice(0, 50));

        if (data.decision === 'KILL' || data.decision === 'FLAG') {
          setAgentData((prev) =>
            prev.map((a) =>
              a.agentId === data.agentId
                ? { ...a, violationCount: a.violationCount + 1 }
                : a
            )
          );
        }
      }
    }

    if (lastEvent.type === 'violation:detected') {
      const data = lastEvent.data as { agentId?: string };
      if (data.agentId) {
        const agentId = data.agentId;
        setFlashAgents((prev) => new Set([...prev, agentId]));
        const existing = flashTimers.current.get(agentId);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          setFlashAgents((prev) => {
            const next = new Set(prev);
            next.delete(agentId);
            return next;
          });
          flashTimers.current.delete(agentId);
        }, 2000);
        flashTimers.current.set(agentId, timer);
      }
    }

    if (lastEvent.type === 'killswitch:triggered') {
      void fetchTopology();
    }
  }, [lastEvent, fetchTopology]);

  // Compute summary stats
  const totalAgents = agentData.length;
  const activeAgents = agentData.filter((a) => a.isActive).length;
  const blockedAgents = agentData.filter((a) => !a.isActive).length;
  const totalViolations = agentData.reduce((sum, a) => sum + a.violationCount, 0);

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl"
        style={{ height: '560px', background: '#0b1120', border: '1px solid var(--c-border)' }}
      >
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin mb-3" />
        <p className="text-sm text-slate-500">Loading topology…</p>
      </div>
    );
  }

  if (agentData.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl space-y-3"
        style={{ height: '560px', background: '#0b1120', border: '1px solid var(--c-border)' }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.15)' }}
        >
          <GroupOutlinedIcon style={{ fontSize: 28, color: '#22d3ee', opacity: 0.5 }} />
        </div>
        <p className="text-sm font-medium text-slate-400">No agents registered yet</p>
        <p className="text-xs text-slate-600">Submit a request to populate the topology map</p>
        <button
          onClick={() => void fetchTopology(true)}
          className="mt-2 flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors"
          style={{
            background: 'rgba(34,211,238,0.08)',
            border: '1px solid rgba(34,211,238,0.2)',
            color: '#67e8f9',
          }}
        >
          <RefreshOutlinedIcon style={{ fontSize: 14 }} />
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* ── Stats summary bar ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          {
            label: 'Total Agents',
            value: totalAgents,
            Icon: GroupOutlinedIcon,
            color: '#e2e8f0',
            rgb: '148,163,184',
          },
          {
            label: 'Active',
            value: activeAgents,
            Icon: CheckCircleOutlineIcon,
            color: '#6ee7b7',
            rgb: '16,185,129',
          },
          {
            label: 'Blocked',
            value: blockedAgents,
            Icon: BlockOutlinedIcon,
            color: '#fca5a5',
            rgb: '239,68,68',
          },
          {
            label: 'Total Violations',
            value: totalViolations,
            Icon: GppBadOutlinedIcon,
            color: '#fcd34d',
            rgb: '245,158,11',
          },
        ].map(({ label, value, Icon, color, rgb }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background: `rgba(${rgb}, 0.06)`,
              border: `1px solid rgba(${rgb}, 0.15)`,
            }}
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `rgba(${rgb}, 0.1)`, border: `1px solid rgba(${rgb}, 0.2)` }}
            >
              <Icon style={{ fontSize: 15, color }} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
              <p className="text-xl font-bold font-mono leading-tight" style={{ color }}>
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Legend + refresh ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
          <span className="text-slate-500 font-semibold">Edges:</span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-5 h-0.5 bg-[#4ade80] inline-block rounded" /> APPROVE
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-5 h-0.5 bg-[#facc15] inline-block rounded" /> FLAG
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-5 inline-block" style={{ borderTop: '2px dashed #ef4444' }} /> KILL
          </span>
          <span className="text-slate-500 font-semibold ml-1">Nodes:</span>
          {[
            { color: '#22d3ee', label: 'Clean' },
            { color: '#facc15', label: '1–2 violations' },
            { color: '#f97316', label: '3–5 violations' },
            { color: '#ef4444', label: '6+ violations' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-slate-400">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                style={{ background: color, boxShadow: `0 0 6px ${color}88` }}
              />
              {label}
            </span>
          ))}
        </div>

        <button
          onClick={() => void fetchTopology(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all disabled:opacity-40"
          style={{
            background: 'rgba(34,211,238,0.07)',
            border: '1px solid rgba(34,211,238,0.18)',
            color: '#67e8f9',
          }}
        >
          <RefreshOutlinedIcon
            style={{ fontSize: 13, transition: 'transform 0.4s', transform: refreshing ? 'rotate(360deg)' : 'none' }}
          />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Canvas ────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          height: '500px',
          background: 'linear-gradient(135deg, #070d1a 0%, #0b1120 50%, #070d1a 100%)',
          border: '1px solid rgba(34,211,238,0.12)',
          boxShadow: 'inset 0 1px 0 rgba(34,211,238,0.06)',
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e293b" gap={28} size={1} />
          <Controls
            style={{
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(34,211,238,0.15)',
              borderRadius: '10px',
            }}
          />
          <MiniMap
            nodeColor={(n) => (n.id === 'watchdog' ? '#22d3ee' : '#475569')}
            style={{
              background: 'rgba(7,13,26,0.95)',
              border: '1px solid rgba(34,211,238,0.12)',
              borderRadius: '8px',
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
