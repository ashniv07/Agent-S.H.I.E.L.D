import { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import GppBadOutlinedIcon from '@mui/icons-material/GppBadOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';

interface CriticalAlert {
  id: string;
  agentId: string;
  reason: string;
  timestamp: string;
}

export function KillAlertOverlay() {
  const { lastEvent } = useWebSocket();
  const [alerts, setAlerts] = useState<CriticalAlert[]>([]);

  useEffect(() => {
    if (!lastEvent || lastEvent.type !== 'killswitch:triggered') return;
    const data = lastEvent.data as { agentId?: string; reason?: string; timestamp?: string };
    setAlerts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        agentId: data.agentId ?? 'Unknown Agent',
        reason: data.reason ?? 'Critical behaviour detected.',
        timestamp: data.timestamp ?? new Date().toISOString(),
      },
    ]);
  }, [lastEvent]);

  if (alerts.length === 0) return null;

  const current = alerts[0];
  const shortReason = current.reason.length > 90
    ? current.reason.slice(0, 90).trimEnd() + '…'
    : current.reason;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}
    >
      <div
        className="relative w-[340px] rounded-2xl px-5 py-5"
        style={{
          background: '#110606',
          border: '1px solid rgba(239,68,68,0.35)',
          boxShadow: '0 0 32px rgba(239,68,68,0.18), 0 16px 40px rgba(0,0,0,0.7)',
          animation: 'awPop 0.18s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Close */}
        <button
          onClick={() => setAlerts((p) => p.slice(1))}
          className="absolute top-3 right-3 rounded-lg p-1 transition-colors"
          style={{ color: '#6b2323' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fca5a5'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#6b2323'; }}
        >
          <CloseOutlinedIcon style={{ fontSize: 15 }} />
        </button>

        {/* Icon + title */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <GppBadOutlinedIcon style={{ fontSize: 18, color: '#ef4444' }} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#ef4444' }}>
              Critical Alert
            </p>
            <p className="text-xs font-mono font-semibold mt-0.5" style={{ color: '#fca5a5' }}>
              {current.agentId}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs leading-relaxed" style={{ color: '#f87171', opacity: 0.8 }}>
          {shortReason}
        </p>

        {/* Timestamp + queue count */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] font-mono" style={{ color: '#4b1a1a' }}>
            {new Date(current.timestamp).toLocaleTimeString()}
          </span>
          {alerts.length > 1 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
              +{alerts.length - 1} more
            </span>
          )}
        </div>
      </div>

      <style>{`
        @keyframes awPop {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
