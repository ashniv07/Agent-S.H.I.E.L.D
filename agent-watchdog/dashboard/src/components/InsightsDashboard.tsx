import { useEffect, useMemo, useState } from 'react';

interface StatsData {
  totalRequests: number;
  approvedRequests: number;
  flaggedRequests: number;
  killedRequests: number;
  totalViolations: number;
  criticalViolations: number;
  activeAgents: number;
  blockedAgents: number;
}

interface Violation {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface Request {
  decision?: 'APPROVE' | 'FLAG' | 'KILL';
}

interface InsightsDashboardProps {
  refreshTrigger?: number;
  view?: 'all' | 'decisions' | 'severity';
  hideHeader?: boolean;
}

const severityOrder: Array<Violation['severity']> = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const severityConfig: Record<Violation['severity'], { color: string; glow: string; label: string }> = {
  CRITICAL: { color: '#ef4444', glow: 'rgba(239,68,68,0.25)',   label: 'Critical' },
  HIGH:     { color: '#f97316', glow: 'rgba(249,115,22,0.25)',  label: 'High'     },
  MEDIUM:   { color: '#f59e0b', glow: 'rgba(245,158,11,0.25)',  label: 'Medium'   },
  LOW:      { color: '#10b981', glow: 'rgba(16,185,129,0.25)',  label: 'Low'      },
};

const decisionConfig = [
  { key: 'APPROVE' as const, color: '#10b981', label: 'Approved' },
  { key: 'FLAG'    as const, color: '#f59e0b', label: 'Flagged'  },
  { key: 'KILL'    as const, color: '#ef4444', label: 'Killed'   },
  { key: 'PENDING' as const, color: '#475569', label: 'Pending'  },
];

// Circumference of r=40 circle
const CIRCUM = 2 * Math.PI * 40; // ≈ 251.33

export function InsightsDashboard({
  refreshTrigger = 0,
  view = 'all',
  hideHeader = false,
}: InsightsDashboardProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Trigger bar animations after first paint
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 120);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, vRes, rRes] = await Promise.all([
          fetch('/api/audit/stats/summary'),
          fetch('/api/audit/violations/all?limit=150'),
          fetch('/api/requests?limit=150'),
        ]);
        if (!sRes.ok || !vRes.ok || !rRes.ok) throw new Error('Failed');
        setStats((await sRes.json()) as StatsData);
        setViolations(((await vRes.json()) as { violations: Violation[] }).violations || []);
        setRequests(((await rRes.json()) as { requests: Request[] }).requests || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    setLoading(true);
    void load();
  }, [refreshTrigger]);

  const severityCounts = useMemo(() => {
    const c: Record<Violation['severity'], number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const v of violations) c[v.severity] += 1;
    return c;
  }, [violations]);

  const decisionDist = useMemo(() => {
    const counts = { APPROVE: 0, FLAG: 0, KILL: 0, PENDING: 0 };
    for (const r of requests) {
      if (!r.decision) counts.PENDING += 1;
      else counts[r.decision] += 1;
    }
    const total = Math.max(1, requests.length);
    let offset = 0;
    const segments = decisionConfig.map((d) => {
      const pct = (counts[d.key] / total) * 100;
      const seg = { ...d, count: counts[d.key], pct, offset };
      offset += pct;
      return seg;
    });
    return { counts, segments, total };
  }, [requests]);

  if (loading || !stats) {
    return (
      <div
        className="h-44 rounded-xl animate-pulse"
        style={{ background: 'var(--c-surface-2, #161b22)', border: '1px solid var(--c-border)' }}
      />
    );
  }

  const totalViol = Math.max(1, stats.totalViolations);

  // ── Donut chart ────────────────────────────────────────────────────────────
  const DonutChart = ({ size = 104 }: { size?: number }) => {
    let strokeOffset = 0;
    return (
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Track */}
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="11" />
          {/* Segments */}
          {decisionDist.segments.map((seg) => {
            const dash = (seg.pct / 100) * CIRCUM;
            const gap  = CIRCUM - dash;
            const off  = -strokeOffset;
            strokeOffset += dash;
            return (
              <circle
                key={seg.key}
                cx="50" cy="50" r="40"
                fill="none"
                stroke={seg.color}
                strokeWidth="11"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={off}
                style={{ transition: 'stroke-dasharray 800ms ease' }}
              />
            );
          })}
        </svg>
        {/* Center label */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <span className="font-bold font-mono text-white leading-none" style={{ fontSize: 15 }}>
            {stats.totalRequests}
          </span>
          <span className="text-slate-500 uppercase tracking-wide" style={{ fontSize: 8 }}>
            total
          </span>
        </div>
      </div>
    );
  };

  // ── decisions view ─────────────────────────────────────────────────────────
  if (view === 'decisions') {
    return (
      <section className="space-y-4">
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200">Decision Distribution</span>
            <span className="text-xs text-slate-500">{requests.length} requests</span>
          </div>
        )}
        <div className="flex items-center gap-5">
          <DonutChart />
          <div className="flex-1 space-y-2.5">
            {decisionDist.segments.map((seg) => (
              <div key={seg.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: seg.color }}
                  />
                  <span className="text-xs text-slate-400">{seg.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-200">{seg.count}</span>
                  <span className="text-[10px] text-slate-600 w-7 text-right">
                    {seg.pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // ── severity view ──────────────────────────────────────────────────────────
  if (view === 'severity') {
    return (
      <section className="space-y-4">
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200">Violation Severity</span>
            <span className="text-xs text-slate-500">{stats.totalViolations} total</span>
          </div>
        )}
        <div className="space-y-3.5">
          {severityOrder.map((sev) => {
            const count = severityCounts[sev];
            const pct = (count / totalViol) * 100;
            const cfg = severityConfig[sev];
            return (
              <div key={sev}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: cfg.color }}
                    />
                    <span className="text-xs text-slate-400">{cfg.label}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-300">{count}</span>
                </div>
                <div className="aw-progress-track">
                  <div
                    className="aw-progress-fill"
                    style={{
                      width: mounted ? `${pct}%` : '0%',
                      background: `linear-gradient(90deg, ${cfg.color}70, ${cfg.color})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // ── all view ───────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Decisions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-slate-200">Decisions</span>
          <span className="text-xs text-slate-500">{requests.length}</span>
        </div>
        <div className="flex items-center gap-5">
          <DonutChart size={96} />
          <div className="flex-1 space-y-2.5">
            {decisionDist.segments.map((seg) => (
              <div key={seg.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: seg.color }} />
                  <span className="text-xs text-slate-400">{seg.label}</span>
                </div>
                <span className="text-xs font-mono text-slate-300">{seg.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Severity */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-slate-200">Violations</span>
          <span className="text-xs text-slate-500">{stats.totalViolations}</span>
        </div>
        <div className="space-y-3">
          {severityOrder.map((sev) => {
            const count = severityCounts[sev];
            const pct = (count / totalViol) * 100;
            const cfg = severityConfig[sev];
            return (
              <div key={sev}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                    <span className="text-xs text-slate-400">{cfg.label}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-300">{count}</span>
                </div>
                <div className="aw-progress-track">
                  <div
                    className="aw-progress-fill"
                    style={{
                      width: mounted ? `${pct}%` : '0%',
                      background: `linear-gradient(90deg, ${cfg.color}70, ${cfg.color})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
