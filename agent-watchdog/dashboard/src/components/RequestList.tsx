import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../utils/api';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { TextType } from './TextType';

interface Request {
  id: string;
  agentId: string;
  action: string;
  target: string;
  status: string;
  decision?: 'APPROVE' | 'FLAG' | 'KILL';
  createdAt: string;
  processedAt?: string;
}

interface RequestListProps {
  onSelectRequest?: (request: Request) => void;
  refreshTrigger?: number;
}

const statusColors: Record<string, string> = {
  pending: 'bg-gray-500',
  processing: 'bg-blue-500 animate-pulse',
  approved: 'bg-green-500',
  flagged: 'bg-yellow-500',
  killed: 'bg-red-500',
};

const decisionLabels: Record<string, string> = {
  APPROVE: 'PASS',
  FLAG: 'WARN',
  KILL: 'FAIL',
};

const decisionIcons: Record<string, string> = {
  APPROVE: 'OK',
  FLAG: '!',
  KILL: 'X',
};

type SortKey = 'newest' | 'oldest' | 'agent' | 'status';

const sortLabels: Record<SortKey, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  agent: 'Agent',
  status: 'Status',
};

export function RequestList({ onSelectRequest, refreshTrigger }: RequestListProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');

  useEffect(() => {
    void fetchRequests();
  }, [refreshTrigger]);

  const fetchRequests = async () => {
    try {
      const response = await authFetch('/api/requests?limit=50');
      if (!response.ok) throw new Error('Failed to fetch requests');
      const data = await response.json() as { requests: Request[] };
      setRequests(data.requests);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    const fileValue = fileFilter.trim().toLowerCase();

    const filtered = requests.filter((request) => {
      const haystack = `${request.agentId} ${request.action} ${request.target} ${request.status} ${request.decision ?? ''}`.toLowerCase();
      const searchMatch = searchValue.length === 0 || haystack.includes(searchValue);
      const fileMatch = fileValue.length === 0 || request.target.toLowerCase().includes(fileValue);
      return searchMatch && fileMatch;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'agent') {
        return a.agentId.localeCompare(b.agentId);
      }
      return a.status.localeCompare(b.status);
    });

    return filtered;
  }, [fileFilter, requests, search, sortBy]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 p-4 text-red-300">
        Error: {error}
        <button
          onClick={() => void fetchRequests()}
          className="ml-4 bg-red-700 px-3 py-1 text-sm text-white hover:bg-red-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-100">Requests</h2>
        <TextType
          texts={[
            'Track incoming requests and see how each decision is made in real time.',
            'Search, filter by file target, and review request outcomes quickly.',
          ]}
          className="text-sm text-slate-300"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-12">
        <div className="md:col-span-5">
          <label className="sr-only" htmlFor="request-search">
            Search requests
          </label>
          <div className="flex items-center gap-2 border-b border-slate-700 px-2 py-2">
            <SearchOutlinedIcon fontSize="small" className="text-slate-400" />
            <input
              id="request-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by agent, action, status, or decision"
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="md:col-span-4">
          <label className="sr-only" htmlFor="request-file-filter">
            Filter by file
          </label>
          <div className="flex items-center gap-2 border-b border-slate-700 px-2 py-2">
            <DescriptionOutlinedIcon fontSize="small" className="text-slate-400" />
            <input
              id="request-file-filter"
              value={fileFilter}
              onChange={(event) => setFileFilter(event.target.value)}
              placeholder="File / target filter"
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="md:col-span-3">
          <label className="sr-only" htmlFor="request-sort">
            Sort requests
          </label>
          <div className="flex items-center gap-2 border-b border-slate-700 px-2 py-2">
            <SortRoundedIcon fontSize="small" className="text-slate-400" />
            <select
              id="request-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
              className="w-full bg-transparent text-sm text-slate-100 outline-none"
            >
              {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                <option key={key} value={key} className="bg-slate-900 text-slate-100">
                  {sortLabels[key]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          No matching requests found.
        </div>
      ) : (
        <div className="max-h-[620px] overflow-y-auto border-y border-slate-700/80">
          {filteredRequests.map((request, index) => {
            const rowTone = index % 2 === 0 ? 'bg-slate-950/10' : 'bg-slate-900/35';
            const decisionTone =
              request.decision === 'APPROVE'
                ? 'text-emerald-300'
                : request.decision === 'FLAG'
                ? 'text-amber-300'
                : request.decision === 'KILL'
                ? 'text-rose-300'
                : 'text-slate-500';

            return (
              <button
                type="button"
                key={request.id}
                onClick={() => onSelectRequest?.(request)}
                className={`grid w-full grid-cols-12 items-center gap-2 border-b border-slate-700/60 px-3 py-3 text-left transition-colors hover:bg-cyan-500/10 ${rowTone}`}
              >
                <div className="col-span-12 md:col-span-2">
                  <div className="inline-flex items-center gap-2 text-xs text-slate-300">
                    <span className={`h-2 w-2 rounded-full ${statusColors[request.status]}`}></span>
                    <span className="uppercase tracking-wide">{request.status}</span>
                  </div>
                </div>

                <div className="col-span-12 md:col-span-3">
                  <p className="text-sm font-medium text-slate-100">{request.agentId}</p>
                  <p className="text-xs text-slate-400">{request.action}</p>
                </div>

                <div className="col-span-12 truncate text-sm text-slate-300 md:col-span-4">
                  {request.target}
                </div>

                <div className="col-span-6 text-sm font-semibold md:col-span-1">
                  <span className={decisionTone}>
                    {request.decision ? `${decisionIcons[request.decision]} ${decisionLabels[request.decision]}` : 'PENDING'}
                  </span>
                </div>

                <div className="col-span-6 text-right text-xs text-slate-400 md:col-span-2">
                  {new Date(request.createdAt).toLocaleTimeString()}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
