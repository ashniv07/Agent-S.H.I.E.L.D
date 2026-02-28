import { useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface AgentFlowProps {
  activeNodes?: string[];
  processingPath?: string[];
}

const nodeStyle = {
  default: {
    background: '#1f2937',
    color: '#f3f4f6',
    border: '2px solid #4b5563',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '12px',
    fontWeight: 500,
  },
  active: {
    background: '#1e3a5f',
    border: '2px solid #3b82f6',
    boxShadow: '0 0 10px #3b82f6',
  },
  completed: {
    background: '#14532d',
    border: '2px solid #22c55e',
  },
};

const initialNodes: Node[] = [
  {
    id: 'incoming',
    position: { x: 50, y: 150 },
    data: { label: 'Incoming Request' },
    style: { ...nodeStyle.default, background: '#374151' },
  },
  {
    id: 'orchestrator',
    position: { x: 200, y: 150 },
    data: { label: 'Orchestrator' },
    style: nodeStyle.default,
  },
  {
    id: 'workerMonitor',
    position: { x: 400, y: 100 },
    data: { label: 'Worker Monitor' },
    style: nodeStyle.default,
  },
  {
    id: 'errorAnalyzer',
    position: { x: 600, y: 100 },
    data: { label: 'Error Analyzer' },
    style: nodeStyle.default,
  },
  {
    id: 'severityClassifier',
    position: { x: 800, y: 100 },
    data: { label: 'Severity Classifier' },
    style: nodeStyle.default,
  },
  {
    id: 'fixProposer',
    position: { x: 800, y: 200 },
    data: { label: 'Fix Proposer' },
    style: nodeStyle.default,
  },
  {
    id: 'decision',
    position: { x: 1000, y: 150 },
    data: { label: 'Decision Engine' },
    style: nodeStyle.default,
  },
  {
    id: 'approve',
    position: { x: 1150, y: 50 },
    data: { label: 'APPROVE' },
    style: { ...nodeStyle.default, background: '#14532d', border: '2px solid #22c55e' },
  },
  {
    id: 'flag',
    position: { x: 1150, y: 150 },
    data: { label: 'FLAG' },
    style: { ...nodeStyle.default, background: '#713f12', border: '2px solid #eab308' },
  },
  {
    id: 'kill',
    position: { x: 1150, y: 250 },
    data: { label: 'KILL' },
    style: { ...nodeStyle.default, background: '#7f1d1d', border: '2px solid #ef4444' },
  },
];

const initialEdges: Edge[] = [
  {
    id: 'e-incoming-orchestrator',
    source: 'incoming',
    target: 'orchestrator',
    animated: true,
    style: { stroke: '#4b5563' },
  },
  {
    id: 'e-orchestrator-workerMonitor',
    source: 'orchestrator',
    target: 'workerMonitor',
    style: { stroke: '#4b5563' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' },
  },
  {
    id: 'e-workerMonitor-errorAnalyzer',
    source: 'workerMonitor',
    target: 'errorAnalyzer',
    style: { stroke: '#4b5563' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' },
  },
  {
    id: 'e-errorAnalyzer-severityClassifier',
    source: 'errorAnalyzer',
    target: 'severityClassifier',
    style: { stroke: '#4b5563' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' },
  },
  {
    id: 'e-severityClassifier-fixProposer',
    source: 'severityClassifier',
    target: 'fixProposer',
    style: { stroke: '#4b5563' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' },
  },
  {
    id: 'e-severityClassifier-decision',
    source: 'severityClassifier',
    target: 'decision',
    style: { stroke: '#4b5563', strokeDasharray: '5,5' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' },
  },
  {
    id: 'e-fixProposer-decision',
    source: 'fixProposer',
    target: 'decision',
    style: { stroke: '#4b5563' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' },
  },
  {
    id: 'e-decision-approve',
    source: 'decision',
    target: 'approve',
    style: { stroke: '#22c55e' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
  },
  {
    id: 'e-decision-flag',
    source: 'decision',
    target: 'flag',
    style: { stroke: '#eab308' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#eab308' },
  },
  {
    id: 'e-decision-kill',
    source: 'decision',
    target: 'kill',
    style: { stroke: '#ef4444' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
  },
];

export function AgentFlow({ activeNodes = [], processingPath = [] }: AgentFlowProps) {
  const normalizedPath = useMemo(
    () => processingPath.map((nodeId) => (nodeId === 'decisionEngine' ? 'decision' : nodeId)),
    [processingPath]
  );

  const processedNodes = useMemo(() => {
    return initialNodes.map((node) => {
      const isActive = activeNodes.includes(node.id);
      const isCompleted = normalizedPath.includes(node.id);

      let style = { ...node.style };
      if (isActive) {
        style = { ...style, ...nodeStyle.active };
      } else if (isCompleted) {
        style = { ...style, ...nodeStyle.completed };
      }

      return { ...node, style };
    });
  }, [activeNodes, normalizedPath]);

  const processedEdges = useMemo(() => {
    return initialEdges.map((edge) => {
      const sourceCompleted = normalizedPath.includes(edge.source);
      const targetCompleted = normalizedPath.includes(edge.target);

      if (sourceCompleted && targetCompleted) {
        return {
          ...edge,
          animated: true,
          style: { ...edge.style, stroke: '#22c55e' },
        };
      }
      return edge;
    });
  }, [normalizedPath]);

  return (
    <div className="h-[360px] w-full overflow-hidden">
      <ReactFlow
        nodes={processedNodes}
        edges={processedEdges}
        className="h-full w-full"
        fitView
        fitViewOptions={{ padding: 0.16 }}
        minZoom={0.65}
        maxZoom={1.1}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnDrag={false}
        panOnScroll={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background color="#374151" gap={16} />
      </ReactFlow>
    </div>
  );
}
