import { useEffect, useState, useCallback, useRef } from 'react';
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
        background: '#1e293b',
        border: '2px solid #475569',
        borderRadius: '50%',
        width: 90,
        height: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
        fontWeight: 'bold',
        fontSize: '10px',
        textAlign: 'center',
      },
    },
  ];

  const count = Math.max(agents.length, 1);
  const radius = Math.max(180, 80 + count * 25);

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
        label: `${agent.agentId}\n(${agent.violationCount} violation${agent.violationCount !== 1 ? 's' : ''})`,
      },
      style: {
        background: blocked ? '#111827' : `${color}18`,
        border: `2px solid ${blocked ? '#374151' : color}`,
        borderRadius: '8px',
        color: blocked ? '#4b5563' : color,
        fontSize: '10px',
        fontWeight: '600',
        minWidth: 100,
        textAlign: 'center' as const,
        whiteSpace: 'pre-line' as const,
        boxShadow: isFlashing
          ? `0 0 24px #ef4444, 0 0 8px #ef4444`
          : agent.violationCount >= 3
          ? `0 0 14px ${color}55`
          : 'none',
        opacity: blocked ? 0.45 : 1,
        transition: 'all 0.3s ease',
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
          strokeWidth: e.decision === 'KILL' ? 3 : e.decision === 'FLAG' ? 2 : 1,
          strokeDasharray: e.decision === 'KILL' ? '6 3' : undefined,
        },
      };
    });
}

export function TopologyMap() {
  const [agentData, setAgentData] = useState<TopologyNode[]>([]);
  const [edgeData, setEdgeData] = useState<TopologyEdge[]>([]);
  const [flashAgents, setFlashAgents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { lastEvent } = useWebSocket();
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const fetchTopology = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/topology/data');
      if (!res.ok) return;
      const data = (await res.json()) as { agents: TopologyNode[]; edges: TopologyEdge[] };
      setAgentData(data.agents || []);
      setEdgeData(data.edges || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mr-3" />
        Loading topology...
      </div>
    );
  }

  if (agentData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500 space-y-2">
        <span className="text-4xl">🗺️</span>
        <p className="font-medium">No agents registered yet</p>
        <p className="text-sm text-gray-600">Submit a request to populate the topology map</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400 px-1">
        <span className="font-semibold text-gray-300 mr-1">Edges:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-[#4ade80] inline-block rounded" /> APPROVE
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-[#facc15] inline-block rounded" /> FLAG
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-[#ef4444] inline-block rounded" style={{ borderTop: '2px dashed #ef4444', background: 'none', height: 0 }} /> KILL
        </span>
        <span className="font-semibold text-gray-300 mx-1">|  Nodes:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#22d3ee] inline-block" /> Clean
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#facc15] inline-block" /> 1–2 violations
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#f97316] inline-block" /> 3–5 violations
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block" /> 6+ violations
        </span>
      </div>

      {/* Canvas */}
      <div
        className="rounded-xl overflow-hidden border border-gray-700"
        style={{ height: '520px', background: '#0f172a' }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.35 }}
          nodesDraggable
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e293b" gap={24} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(n) => (n.id === 'watchdog' ? '#475569' : '#22d3ee')}
            style={{ background: '#0f172a', border: '1px solid #1e293b' }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
