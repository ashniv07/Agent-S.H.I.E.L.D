import { useState, useEffect } from 'react';

interface AuditLogEntry {
  id: string;
  requestId: string;
  agentId: string;
  action: string;
  decision: 'APPROVE' | 'FLAG' | 'KILL';
  reasoning: string;
  timestamp: string;
}

interface AuditLogProps {
  refreshTrigger?: number;
}

const decisionStyles: Record<string, { bg: string; text: string; border: string }> = {
  APPROVE: {
    bg: 'bg-green-900/30',
    text: 'text-green-400',
    border: 'border-green-600',
  },
  FLAG: {
    bg: 'bg-yellow-900/30',
    text: 'text-yellow-400',
    border: 'border-yellow-600',
  },
  KILL: {
    bg: 'bg-red-900/30',
    text: 'text-red-400',
    border: 'border-red-600',
  },
};

export function AuditLog({ refreshTrigger }: AuditLogProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [refreshTrigger]);

  const fetchLogs = async () => {
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
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No audit logs yet.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {logs.map((log) => {
        const style = decisionStyles[log.decision];
        const isExpanded = expandedId === log.id;

        return (
          <div
            key={log.id}
            className={`${style.bg} border-l-4 ${style.border} rounded-lg overflow-hidden`}
          >
            <div
              onClick={() => setExpandedId(isExpanded ? null : log.id)}
              className="p-3 cursor-pointer hover:bg-white/5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded ${
                      log.decision === 'APPROVE'
                        ? 'bg-green-600'
                        : log.decision === 'FLAG'
                        ? 'bg-yellow-600'
                        : 'bg-red-600'
                    } text-white`}
                  >
                    {log.decision}
                  </span>
                  <span className="font-mono text-sm text-gray-300">
                    {log.agentId}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 text-sm text-gray-400">
                {log.action}
                {log.requestId !== 'system' && (
                  <span className="text-gray-600 ml-2">
                    #{log.requestId.slice(0, 8)}
                  </span>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="px-3 pb-3 border-t border-gray-700/50">
                <div className="mt-2 p-2 bg-gray-800/50 rounded text-sm">
                  <span className="text-gray-500">Reasoning: </span>
                  <span className="text-gray-300">{log.reasoning}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
