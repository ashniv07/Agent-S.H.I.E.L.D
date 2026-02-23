import { useState } from 'react';

interface AuditEntry {
  id: string;
  requestId: string;
  agentId: string;
  action: string;
  decision: 'APPROVE' | 'FLAG' | 'KILL';
  reasoning: string;
  timestamp: string;
  pipelinePath?: string[];
  monitorResult?: unknown;
  analysisResult?: unknown;
  severityResult?: unknown;
  fixResult?: unknown;
}

interface AuditTechnicalViewProps {
  entry: AuditEntry;
}

function JsonTree({ label, data }: { label: string; data: unknown }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <div className="border border-gray-700 rounded overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-750 text-left"
      >
        <span className="text-xs font-mono font-semibold text-cyan-400">{label}</span>
        <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="p-3 bg-gray-900/50 text-xs font-mono text-gray-300 overflow-auto max-h-64">
          <pre className="whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

const decisionColors = {
  APPROVE: 'bg-green-700',
  FLAG:    'bg-yellow-600',
  KILL:    'bg-red-700',
};

export function AuditTechnicalView({ entry }: AuditTechnicalViewProps) {
  return (
    <div className="space-y-3 p-1">
      {/* Header metadata */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-800/60 rounded p-2">
          <span className="text-gray-500 block">Audit ID</span>
          <span className="font-mono text-gray-200">{entry.id}</span>
        </div>
        <div className="bg-gray-800/60 rounded p-2">
          <span className="text-gray-500 block">Request ID</span>
          <span className="font-mono text-gray-200">{entry.requestId}</span>
        </div>
        <div className="bg-gray-800/60 rounded p-2">
          <span className="text-gray-500 block">Agent</span>
          <span className="font-mono text-cyan-400">{entry.agentId}</span>
        </div>
        <div className="bg-gray-800/60 rounded p-2">
          <span className="text-gray-500 block">Action</span>
          <span className="font-mono text-gray-200">{entry.action}</span>
        </div>
        <div className="bg-gray-800/60 rounded p-2">
          <span className="text-gray-500 block">Decision</span>
          <span className={`inline-block px-2 py-0.5 rounded text-white font-bold text-xs ${decisionColors[entry.decision] || 'bg-gray-600'}`}>
            {entry.decision}
          </span>
        </div>
        <div className="bg-gray-800/60 rounded p-2">
          <span className="text-gray-500 block">Timestamp</span>
          <span className="font-mono text-gray-200">{new Date(entry.timestamp).toLocaleString()}</span>
        </div>
      </div>

      {/* Pipeline path */}
      {entry.pipelinePath && entry.pipelinePath.length > 0 && (
        <div className="bg-gray-800/60 rounded p-2 text-xs">
          <span className="text-gray-500 block mb-1">Pipeline Path</span>
          <div className="flex flex-wrap gap-1">
            {entry.pipelinePath.map((step, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="px-2 py-0.5 bg-blue-900/50 border border-blue-700 rounded font-mono text-blue-300">{step}</span>
                {i < entry.pipelinePath!.length - 1 && <span className="text-gray-600">→</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Decision reasoning */}
      <div className="bg-gray-800/60 rounded p-2 text-xs">
        <span className="text-gray-500 block mb-1">Decision Reasoning</span>
        <p className="text-gray-300 font-mono whitespace-pre-wrap">{entry.reasoning}</p>
      </div>

      {/* Collapsible JSON sections */}
      <JsonTree label="monitor_result" data={entry.monitorResult} />
      <JsonTree label="analysis_result" data={entry.analysisResult} />
      <JsonTree label="severity_result" data={entry.severityResult} />
      <JsonTree label="fix_result" data={entry.fixResult} />
    </div>
  );
}
