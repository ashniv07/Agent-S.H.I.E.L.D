import { useState, useEffect } from 'react';
import { authFetch } from '../utils/api';

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

interface StatsProps {
  refreshTrigger?: number;
}

export function Stats({ refreshTrigger }: StatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const fetchStats = async () => {
    try {
      const response = await authFetch('/api/audit/stats/summary');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-slate-700 bg-slate-900/60"
          ></div>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Requests',
      value: stats.totalRequests,
      icon: '📊',
      color: 'text-blue-400',
      bg: 'bg-blue-900/30',
    },
    {
      label: 'Approved',
      value: stats.approvedRequests,
      icon: '✓',
      color: 'text-green-400',
      bg: 'bg-green-900/30',
    },
    {
      label: 'Flagged',
      value: stats.flaggedRequests,
      icon: '⚠',
      color: 'text-yellow-400',
      bg: 'bg-yellow-900/30',
    },
    {
      label: 'Killed',
      value: stats.killedRequests,
      icon: '✕',
      color: 'text-red-400',
      bg: 'bg-red-900/30',
    },
  ];

  const secondaryStats: Array<{
    label: string;
    value: number;
    critical?: number;
    blocked?: number;
  }> = [
    {
      label: 'Total Violations',
      value: stats.totalViolations,
      critical: stats.criticalViolations,
    },
    {
      label: 'Active Agents',
      value: stats.activeAgents,
      blocked: stats.blockedAgents,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className={`${stat.bg} rounded-xl border border-slate-700 p-4`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{stat.icon}</span>
              <span className={`text-3xl font-bold ${stat.color}`}>
                {stat.value}
              </span>
            </div>
            <span className="text-sm text-gray-400">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {secondaryStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-700 bg-slate-900/70 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-400">{stat.label}</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-gray-100">
                  {stat.value}
                </span>
                {stat.critical != null && stat.critical > 0 && (
                  <span className="ml-2 text-sm text-red-400">
                    ({stat.critical} critical)
                  </span>
                )}
                {stat.blocked != null && stat.blocked > 0 && (
                  <span className="ml-2 text-sm text-red-400">
                    ({stat.blocked} blocked)
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
