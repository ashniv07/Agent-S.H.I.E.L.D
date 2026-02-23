import { useEffect, useMemo, useState, useCallback } from 'react';
import { ViolationCard } from './ViolationCard.js';
import { useWebSocket } from '../hooks/useWebSocket.js';

interface Violation {
  id: string;
  requestId: string;
  type: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence?: string;
  suggestedFix?: string;
  detectedAt: string;
}

interface ViolationsPanelProps {
  refreshTrigger?: number;
}

const filters: Array<Violation['severity'] | 'ALL'> = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const filterColors: Record<string, string> = {
  ALL:      'text-gray-300',
  LOW:      'text-green-300',
  MEDIUM:   'text-yellow-300',
  HIGH:     'text-orange-300',
  CRITICAL: 'text-red-300',
};

export function ViolationsPanel({ refreshTrigger = 0 }: ViolationsPanelProps) {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState<Violation['severity'] | 'ALL'>('ALL');
  const { lastEvent } = useWebSocket();

  const fetchViolations = useCallback(async () => {
    try {
      const response = await fetch('/api/audit/violations/all?limit=120');
      if (!response.ok) throw new Error('Failed to fetch violations');
      const data = (await response.json()) as { violations: Violation[] };
      setViolations(data.violations || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void fetchViolations();
  }, [refreshTrigger, fetchViolations]);

  // Real-time: prepend new violations instantly from WebSocket
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'violation:detected') {
      const data = lastEvent.data as {
        requestId?: string;
        violation?: Partial<Violation>;
        severity?: Violation['severity'];
      };
      const v = data.violation;
      if (v?.type && v.description && v.severity) {
        const incoming: Violation = {
          id: crypto.randomUUID(),
          requestId: data.requestId ?? '',
          type: v.type,
          description: v.description,
          severity: v.severity,
          evidence: v.evidence,
          suggestedFix: v.suggestedFix,
          detectedAt: new Date().toISOString(),
        };
        setViolations((prev) => {
          // Avoid duplicates by requestId+type
          const exists = prev.some(
            (p) => p.requestId === incoming.requestId && p.type === incoming.type
          );
          return exists ? prev : [incoming, ...prev];
        });
      }
    }
  }, [lastEvent]);

  const filtered = useMemo(() => {
    if (selectedSeverity === 'ALL') return violations;
    return violations.filter((item) => item.severity === selectedSeverity);
  }, [selectedSeverity, violations]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: violations.length };
    for (const v of violations) {
      c[v.severity] = (c[v.severity] ?? 0) + 1;
    }
    return c;
  }, [violations]);

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {violations.length} violation{violations.length !== 1 ? 's' : ''} total
          <span className="ml-1 w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" title="Live" />
        </span>
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedSeverity(filter)}
              className={`rounded-full px-3 py-1 text-xs transition flex items-center gap-1 ${
                selectedSeverity === filter
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/40'
                  : `bg-slate-800 hover:bg-slate-700 ${filterColors[filter]}`
              }`}
            >
              {filter}
              {counts[filter] !== undefined && (
                <span className="text-gray-500 text-xs">({counts[filter]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="py-8 text-center text-slate-400">Loading violations...</div>}
      {!loading && filtered.length === 0 && (
        <div className="py-8 text-center text-slate-400">No violations for this filter.</div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
          {filtered.map((violation) => (
            <ViolationCard key={violation.id} violation={violation} />
          ))}
        </div>
      )}
    </div>
  );
}
