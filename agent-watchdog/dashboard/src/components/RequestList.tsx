import { useState, useEffect } from 'react';

interface Request {
  id: string;
  agentId: string;
  action: string;
  target: string;
  status: string;
  decision?: string;
  createdAt: string;
  processedAt?: string;
}

interface RequestListProps {
  onSelectRequest?: (request: Request) => void;
  refreshTrigger?: number;
}

const statusColors: Record<string, string> = {
  pending: 'bg-gray-600',
  processing: 'bg-blue-600 animate-pulse',
  approved: 'bg-green-600',
  flagged: 'bg-yellow-600',
  killed: 'bg-red-600',
};

const decisionIcons: Record<string, string> = {
  APPROVE: '✓',
  FLAG: '⚠',
  KILL: '✕',
};

export function RequestList({ onSelectRequest, refreshTrigger }: RequestListProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [refreshTrigger]);

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/requests?limit=50');
      if (!response.ok) throw new Error('Failed to fetch requests');
      const data = await response.json();
      setRequests(data.requests);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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

  if (error) {
    return (
      <div className="p-4 bg-red-900/50 rounded-lg text-red-400">
        Error: {error}
        <button
          onClick={fetchRequests}
          className="ml-4 px-3 py-1 bg-red-600 rounded text-white text-sm hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No requests yet. Submit a request to see it here.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {requests.map((request) => (
        <div
          key={request.id}
          onClick={() => onSelectRequest?.(request)}
          className="p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors border border-gray-700 hover:border-gray-600"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${statusColors[request.status]}`}
              ></span>
              <span className="font-mono text-sm text-gray-300">
                {request.agentId}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {request.decision && (
                <span
                  className={`text-lg ${
                    request.decision === 'APPROVE'
                      ? 'text-green-500'
                      : request.decision === 'FLAG'
                      ? 'text-yellow-500'
                      : 'text-red-500'
                  }`}
                >
                  {decisionIcons[request.decision]}
                </span>
              )}
              <span className="text-xs text-gray-500">
                {new Date(request.createdAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
          <div className="text-sm">
            <span className="text-blue-400">{request.action}</span>
            <span className="text-gray-500 mx-1">→</span>
            <span className="text-gray-400 truncate">{request.target}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
