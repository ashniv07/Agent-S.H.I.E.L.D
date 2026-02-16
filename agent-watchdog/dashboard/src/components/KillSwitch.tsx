import { useState, useEffect } from 'react';

interface Agent {
  agentId: string;
  isActive: boolean;
  blockedAt?: string;
  blockedReason?: string;
}

interface KillSwitchProps {
  onKillSwitch?: (agentId: string, reason: string) => void;
  refreshTrigger?: number;
}

export function KillSwitch({ onKillSwitch, refreshTrigger }: KillSwitchProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, [refreshTrigger]);

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data = await response.json();
      setAgents(data.agents);
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKillSwitch = async () => {
    if (!selectedAgent || !reason) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/agents/${selectedAgent}/killswitch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) throw new Error('Failed to trigger kill switch');

      onKillSwitch?.(selectedAgent, reason);
      setSelectedAgent('');
      setReason('');
      fetchAgents();
    } catch (err) {
      console.error('Error triggering kill switch:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (agentId: string) => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual restoration via dashboard' }),
      });

      if (!response.ok) throw new Error('Failed to restore agent');
      fetchAgents();
    } catch (err) {
      console.error('Error restoring agent:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmergencyKillAll = async () => {
    if (!confirm('Are you sure you want to block ALL agents? This will stop all agent activity.')) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/agents/emergency/kill-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Emergency kill all triggered via dashboard' }),
      });

      if (!response.ok) throw new Error('Failed to trigger emergency kill');
      fetchAgents();
    } catch (err) {
      console.error('Error triggering emergency kill:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const activeAgents = agents.filter((a) => a.isActive);
  const blockedAgents = agents.filter((a) => !a.isActive);

  return (
    <div className="space-y-4">
      {/* Emergency Kill All Button */}
      <button
        onClick={handleEmergencyKillAll}
        disabled={submitting || activeAgents.length === 0}
        className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-colors flex items-center justify-center gap-2"
      >
        <span className="text-xl">⚠</span>
        EMERGENCY: KILL ALL AGENTS
      </button>

      {/* Individual Kill Switch */}
      <div className="p-4 bg-gray-800 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">
          Kill Switch - Single Agent
        </h3>
        <div className="space-y-3">
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-gray-100 focus:border-red-500 focus:outline-none"
          >
            <option value="">Select an agent...</option>
            {activeAgents.map((agent) => (
              <option key={agent.agentId} value={agent.agentId}>
                {agent.agentId}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for blocking..."
            className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-gray-100 focus:border-red-500 focus:outline-none"
          />

          <button
            onClick={handleKillSwitch}
            disabled={!selectedAgent || !reason || submitting}
            className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white font-semibold transition-colors"
          >
            {submitting ? 'Processing...' : 'Trigger Kill Switch'}
          </button>
        </div>
      </div>

      {/* Blocked Agents */}
      {blockedAgents.length > 0 && (
        <div className="p-4 bg-red-900/20 rounded-lg border border-red-800">
          <h3 className="text-sm font-semibold text-red-400 mb-3">
            Blocked Agents ({blockedAgents.length})
          </h3>
          <div className="space-y-2">
            {blockedAgents.map((agent) => (
              <div
                key={agent.agentId}
                className="flex items-center justify-between p-2 bg-gray-800/50 rounded"
              >
                <div>
                  <span className="font-mono text-red-400">
                    {agent.agentId}
                  </span>
                  {agent.blockedReason && (
                    <p className="text-xs text-gray-500 mt-1">
                      {agent.blockedReason}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRestore(agent.agentId)}
                  disabled={submitting}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded text-sm text-white transition-colors"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Agents List */}
      {!loading && activeAgents.length > 0 && (
        <div className="p-4 bg-gray-800/50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">
            Active Agents ({activeAgents.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {activeAgents.map((agent) => (
              <span
                key={agent.agentId}
                className="px-2 py-1 bg-green-900/30 border border-green-700 rounded text-sm text-green-400"
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
