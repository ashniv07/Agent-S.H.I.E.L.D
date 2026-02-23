import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { AuditTechnicalView } from './AuditTechnicalView.js';
import { AuditBusinessView } from './AuditBusinessView.js';

interface AuditLogEntry {
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

interface AuditLogProps {
  refreshTrigger?: number;
}

type ViewMode = 'technical' | 'business';

const decisionStyles: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  APPROVE: { bg: 'bg-green-900/30',  text: 'text-green-400',  border: 'border-green-600',  badge: 'bg-green-600'  },
  FLAG:    { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-600', badge: 'bg-yellow-600' },
  KILL:    { bg: 'bg-red-900/30',    text: 'text-red-400',    border: 'border-red-600',    badge: 'bg-red-600'    },
};

function fetchFullLog(id: string): Promise<AuditLogEntry | null> {
  return fetch(`/api/audit/${id}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

export function AuditLog({ refreshTrigger }: AuditLogProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullData, setFullData] = useState<Record<string, AuditLogEntry>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('technical');
  const { lastEvent } = useWebSocket();

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/audit?limit=30');
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      setLogs(data.logs);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [refreshTrigger, fetchLogs]);

  // Real-time: refresh when a new request is processed
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'request:processed') {
      void fetchLogs();
    }
  }, [lastEvent, fetchLogs]);

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!fullData[id]) {
      const full = await fetchFullLog(id);
      if (full) setFullData((prev) => ({ ...prev, [id]: full }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (logs.length === 0) {
    return <div className="text-center py-8 text-gray-500">No audit logs yet.</div>;
  }

  return (
    <div className="space-y-3">
      {/* View toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">View:</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          <button
            onClick={() => setViewMode('technical')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'technical'
                ? 'bg-cyan-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Technical
          </button>
          <button
            onClick={() => setViewMode('business')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'business'
                ? 'bg-cyan-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Business
          </button>
        </div>
      </div>

      {/* Log list */}
      <div className="max-h-[580px] space-y-2 overflow-y-auto pr-1">
        {logs.map((log) => {
          const style = decisionStyles[log.decision] ?? decisionStyles.FLAG;
          const isExpanded = expandedId === log.id;
          const rich = fullData[log.id];

          return (
            <div
              key={log.id}
              className={`${style.bg} border-l-4 ${style.border} rounded-lg overflow-hidden`}
            >
              <div
                onClick={() => handleExpand(log.id)}
                className="p-3 cursor-pointer hover:bg-white/5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${style.badge} text-white`}>
                      {log.decision}
                    </span>
                    <span className="font-mono text-sm text-gray-300">{log.agentId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                    <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                <div className="mt-1 text-sm text-gray-400">
                  {log.action}
                  {log.requestId && log.requestId !== 'system' && (
                    <span className="text-gray-600 ml-2">#{log.requestId.slice(0, 8)}</span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-700/50">
                  <div className="mt-3">
                    {viewMode === 'technical' ? (
                      <AuditTechnicalView
                        entry={{
                          id: log.id,
                          requestId: log.requestId,
                          agentId: log.agentId,
                          action: log.action,
                          decision: log.decision,
                          reasoning: log.reasoning,
                          timestamp: log.timestamp,
                          pipelinePath: rich?.pipelinePath ?? log.pipelinePath,
                          monitorResult: rich?.monitorResult ?? log.monitorResult,
                          analysisResult: rich?.analysisResult ?? log.analysisResult,
                          severityResult: rich?.severityResult ?? log.severityResult,
                          fixResult: rich?.fixResult ?? log.fixResult,
                        }}
                      />
                    ) : (
                      <AuditBusinessView
                        entry={{
                          id: log.id,
                          requestId: log.requestId,
                          agentId: log.agentId,
                          action: log.action,
                          decision: log.decision,
                          reasoning: log.reasoning,
                          timestamp: log.timestamp,
                          monitorResult: (rich?.monitorResult ?? log.monitorResult) as Parameters<typeof AuditBusinessView>[0]['entry']['monitorResult'],
                          analysisResult: (rich?.analysisResult ?? log.analysisResult) as Parameters<typeof AuditBusinessView>[0]['entry']['analysisResult'],
                          severityResult: (rich?.severityResult ?? log.severityResult) as Parameters<typeof AuditBusinessView>[0]['entry']['severityResult'],
                          fixResult: (rich?.fixResult ?? log.fixResult) as Parameters<typeof AuditBusinessView>[0]['entry']['fixResult'],
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
