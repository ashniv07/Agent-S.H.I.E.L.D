import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { authFetch } from '../utils/api';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';

interface Agent {
  agentId: string;
  isActive: boolean;
  blockedAt?: string;
  blockedReason?: string;
}

interface KillSwitchProps {
  refreshTrigger?: number;
}

export function KillSwitch({ refreshTrigger }: KillSwitchProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const { lastEvent } = useWebSocket();

  const fetchAgents = useCallback(async () => {
    try {
      const response = await authFetch('/api/agents');
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data = await response.json() as { agents: Agent[] };
      setAgents(data.agents);
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAgents();
  }, [refreshTrigger, fetchAgents]);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'killswitch:triggered' || lastEvent.type === 'agent:status') {
      void fetchAgents();
    }
  }, [lastEvent, fetchAgents]);

  const handleRestore = async (agentId: string) => {
    setRestoring(agentId);
    try {
      const response = await authFetch(`/api/agents/${agentId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Restored via dashboard after review' }),
      });
      if (!response.ok) throw new Error('Failed to restore agent');
      void fetchAgents();
    } catch (err) {
      console.error('Error restoring agent:', err);
    } finally {
      setRestoring(null);
    }
  };

  const activeAgents  = agents.filter((a) =>  a.isActive);
  const blockedAgents = agents.filter((a) => !a.isActive);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ border: '1px dashed var(--c-border)', color: '#475569' }}
      >
        <p className="text-sm">No agents registered yet</p>
        <p className="text-xs mt-1" style={{ color: '#334155' }}>
          Agents appear here once they submit their first request
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Live badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#475569' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live — auto-updates
        </div>
        <button
          onClick={() => void fetchAgents()}
          className="flex items-center gap-1 text-[11px] transition-colors"
          style={{ color: '#475569' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#475569'; }}
        >
          <RefreshOutlinedIcon style={{ fontSize: 13 }} />
          Refresh
        </button>
      </div>

      {/* Blocked agents */}
      {blockedAgents.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(239,68,68,0.18)' }}
        >
          {/* Section header */}
          <div
            className="flex items-center gap-2 px-4 py-2.5"
            style={{ background: 'rgba(239,68,68,0.07)', borderBottom: '1px solid rgba(239,68,68,0.12)' }}
          >
            <BlockOutlinedIcon style={{ fontSize: 13, color: '#ef4444' }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#ef4444' }}>
              Blocked by Pipeline
            </span>
            <span
              className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}
            >
              {blockedAgents.length}
            </span>
          </div>

          <div>
            {blockedAgents.map((agent, index) => (
              <div
                key={agent.agentId}
                className="flex items-start justify-between gap-3 px-4 py-3"
                style={{
                  background: 'rgba(239,68,68,0.03)',
                  borderTop: index > 0 ? '1px solid rgba(239,68,68,0.08)' : undefined,
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold" style={{ color: '#fca5a5' }}>
                    {agent.agentId}
                  </p>
                  {agent.blockedReason && (
                    <p className="text-[11px] mt-0.5 leading-snug" style={{ color: '#7f1d1d' }}>
                      {agent.blockedReason}
                    </p>
                  )}
                  {agent.blockedAt && (
                    <p className="text-[10px] font-mono mt-1" style={{ color: '#4b1a1a' }}>
                      Blocked {new Date(agent.blockedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => void handleRestore(agent.agentId)}
                  disabled={restoring === agent.agentId}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-40"
                  style={{
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.2)',
                    color: '#6ee7b7',
                  }}
                >
                  {restoring === agent.agentId ? '…' : 'Restore'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active agents */}
      {activeAgents.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(16,185,129,0.12)' }}
        >
          {/* Section header */}
          <div
            className="flex items-center gap-2 px-4 py-2.5"
            style={{ background: 'rgba(16,185,129,0.05)', borderBottom: '1px solid rgba(16,185,129,0.08)' }}
          >
            <CheckCircleOutlineIcon style={{ fontSize: 13, color: '#10b981' }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#10b981' }}>
              Active Agents
            </span>
            <span
              className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}
            >
              {activeAgents.length}
            </span>
          </div>

          <div className="px-4 py-3 flex flex-wrap gap-2">
            {activeAgents.map((agent) => (
              <span
                key={agent.agentId}
                className="px-2.5 py-1 rounded-lg font-mono text-xs font-medium"
                style={{
                  background: 'rgba(16,185,129,0.07)',
                  border: '1px solid rgba(16,185,129,0.15)',
                  color: '#6ee7b7',
                }}
              >
                {agent.agentId}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
