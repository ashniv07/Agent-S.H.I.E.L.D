import type { WSEvent } from '../hooks/useWebSocket';

interface EventFeedProps {
  events: WSEvent[];
  isConnected: boolean;
}

const eventTypeStyles: Record<string, { icon: string; color: string }> = {
  'request:new': { icon: '📥', color: 'text-blue-400' },
  'request:processed': { icon: '✅', color: 'text-green-400' },
  'violation:detected': { icon: '🚨', color: 'text-red-400' },
  'killswitch:triggered': { icon: '🛑', color: 'text-red-500' },
  'agent:status': { icon: '🤖', color: 'text-purple-400' },
  connected: { icon: '🔗', color: 'text-green-400' },
};

export function EventFeed({ events, isConnected }: EventFeedProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-400">Live Events</h3>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          ></span>
          <span className="text-xs text-gray-500">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {events.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            Waiting for events...
          </div>
        ) : (
          events.map((event, index) => {
            const style = eventTypeStyles[event.type] || {
              icon: '📌',
              color: 'text-gray-400',
            };
            const data = event.data as Record<string, unknown>;

            return (
              <div
                key={`${event.timestamp}-${index}`}
                className="p-2 bg-gray-800/50 rounded text-sm animate-slide-in"
              >
                <div className="flex items-center gap-2">
                  <span>{style.icon}</span>
                  <span className={`font-medium ${style.color}`}>
                    {event.type}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {data && (
                  <div className="mt-1 text-xs text-gray-500 truncate">
                    {data.agentId != null && (
                      <span className="mr-2">Agent: {String(data.agentId)}</span>
                    )}
                    {data.decision != null && (
                      <span
                        className={
                          data.decision === 'APPROVE'
                            ? 'text-green-400'
                            : data.decision === 'FLAG'
                            ? 'text-yellow-400'
                            : 'text-red-400'
                        }
                      >
                        {String(data.decision)}
                      </span>
                    )}
                    {data.severity != null && (
                      <span className="ml-2 text-orange-400">
                        {String(data.severity)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
