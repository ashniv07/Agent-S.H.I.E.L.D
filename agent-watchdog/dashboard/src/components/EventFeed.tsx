import type { WSEvent } from '../hooks/useWebSocket';

interface EventFeedProps {
  events: WSEvent[];
  isConnected: boolean;
}

const eventConfig: Record<string, {
  label: string;
  bg: string;
  text: string;
  borderColor: string;
}> = {
  'request:new':         { label: 'NEW',  bg: 'rgba(96,165,250,0.15)',   text: '#93c5fd', borderColor: '#3b82f6' },
  'request:processed':   { label: 'DONE', bg: 'rgba(16,185,129,0.15)',   text: '#6ee7b7', borderColor: '#10b981' },
  'violation:detected':  { label: 'VIOL', bg: 'rgba(239,68,68,0.15)',    text: '#fca5a5', borderColor: '#ef4444' },
  'killswitch:triggered':{ label: 'KILL', bg: 'rgba(220,38,38,0.2)',     text: '#fecaca', borderColor: '#dc2626' },
  'agent:status':        { label: 'AGNT', bg: 'rgba(167,139,250,0.15)',  text: '#c4b5fd', borderColor: '#8b5cf6' },
  connected:             { label: 'CONN', bg: 'rgba(16,185,129,0.15)',   text: '#6ee7b7', borderColor: '#10b981' },
};

const defaultConfig = {
  label: 'EVT',
  bg: 'rgba(100,116,139,0.15)',
  text: '#94a3b8',
  borderColor: '#475569',
};

function DecisionChip({ value }: { value: string }) {
  const map: Record<string, string> = {
    APPROVE: '#10b981',
    FLAG:    '#f59e0b',
    KILL:    '#ef4444',
  };
  const color = map[value] ?? '#64748b';
  return (
    <span style={{ color, fontWeight: 700, fontSize: 10 }}>{value}</span>
  );
}

export function EventFeed({ events, isConnected }: EventFeedProps) {
  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Event Stream
        </span>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="aw-live">LIVE</span>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              OFFLINE
            </span>
          )}
          <span className="text-[10px] font-mono text-slate-600">{events.length}</span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ border: '1px solid var(--c-border)' }}
            >
              <span className="text-slate-600 text-xs font-mono">—</span>
            </div>
            <p className="text-slate-600 text-xs">Awaiting events…</p>
          </div>
        ) : (
          events.map((event, index) => {
            const cfg = eventConfig[event.type] ?? defaultConfig;
            const data = event.data as Record<string, unknown>;

            return (
              <div
                key={`${event.timestamp}-${index}`}
                className="aw-event"
                style={{ borderLeftColor: cfg.borderColor }}
              >
                {/* Type badge */}
                <div
                  className="aw-event-icon"
                  style={{ background: cfg.bg, color: cfg.text }}
                >
                  {cfg.label}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="text-[11px] font-semibold truncate"
                      style={{ color: cfg.text }}
                    >
                      {event.type}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 flex-shrink-0">
                      {new Date(event.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  {data && (
                    <div className="mt-0.5 flex items-center gap-2">
                      {data.agentId != null && (
                        <span className="text-[11px] font-mono text-slate-500 truncate max-w-[110px]">
                          {String(data.agentId)}
                        </span>
                      )}
                      {data.decision != null && (
                        <DecisionChip value={String(data.decision)} />
                      )}
                      {data.severity != null && (
                        <span className="text-[10px] font-semibold text-amber-500">
                          {String(data.severity)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
