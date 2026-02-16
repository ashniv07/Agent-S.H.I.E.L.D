import { useState, useEffect, useCallback } from 'react';
import { AgentFlow } from './components/AgentFlow';
import { RequestList } from './components/RequestList';
import { AuditLog } from './components/AuditLog';
import { ViolationCard } from './components/ViolationCard';
import { KillSwitch } from './components/KillSwitch';
import { Stats } from './components/Stats';
import { EventFeed } from './components/EventFeed';
import { useWebSocket } from './hooks/useWebSocket';

interface Violation {
  id: string;
  type: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence?: string;
  suggestedFix?: string;
  detectedAt: string;
}

function App() {
  const { isConnected, events, lastEvent } = useWebSocket();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [activeTab, setActiveTab] = useState<'requests' | 'audit'>('requests');
  const [processingPath, setProcessingPath] = useState<string[]>([]);

  // Refresh data when relevant events occur
  useEffect(() => {
    if (lastEvent) {
      if (
        lastEvent.type === 'request:processed' ||
        lastEvent.type === 'killswitch:triggered'
      ) {
        setRefreshTrigger((prev) => prev + 1);
      }

      if (lastEvent.type === 'violation:detected') {
        const data = lastEvent.data as { violation?: Violation };
        if (data.violation) {
          setViolations((prev) => [
            { ...data.violation!, id: crypto.randomUUID(), detectedAt: new Date().toISOString() },
            ...prev,
          ].slice(0, 20));
        }
      }

      if (lastEvent.type === 'request:processed') {
        const data = lastEvent.data as { processingPath?: string[] };
        if (data.processingPath) {
          setProcessingPath(data.processingPath);
        }
      }
    }
  }, [lastEvent]);

  const handleKillSwitch = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <h1 className="text-xl font-bold">Agent Watchdog</h1>
              <p className="text-sm text-gray-400">
                AI Governance & Security Layer
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  isConnected
                    ? 'bg-green-500 animate-pulse-glow'
                    : 'bg-red-500'
                }`}
                style={{ color: isConnected ? '#22c55e' : '#ef4444' }}
              ></span>
              <span className="text-sm text-gray-400">
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Stats */}
        <section>
          <Stats refreshTrigger={refreshTrigger} />
        </section>

        {/* Agent Flow Visualization */}
        <section className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Agent Pipeline</h2>
          <AgentFlow processingPath={processingPath} />
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Requests/Audit */}
          <div className="col-span-5">
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="flex border-b border-gray-700">
                <button
                  onClick={() => setActiveTab('requests')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'requests'
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Requests
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'audit'
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Audit Log
                </button>
              </div>
              <div className="p-4">
                {activeTab === 'requests' ? (
                  <RequestList refreshTrigger={refreshTrigger} />
                ) : (
                  <AuditLog refreshTrigger={refreshTrigger} />
                )}
              </div>
            </div>
          </div>

          {/* Center Column - Violations */}
          <div className="col-span-4">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 h-full">
              <h2 className="text-lg font-semibold mb-4">Recent Violations</h2>
              {violations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No violations detected yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {violations.map((violation) => (
                    <ViolationCard key={violation.id} violation={violation} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Kill Switch & Events */}
          <div className="col-span-3 space-y-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h2 className="text-lg font-semibold mb-4">Kill Switch</h2>
              <KillSwitch
                onKillSwitch={handleKillSwitch}
                refreshTrigger={refreshTrigger}
              />
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 h-64">
              <EventFeed events={events} isConnected={isConnected} />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 px-6 py-3 mt-6">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Agent Watchdog v1.0.0</span>
          <span>Powered by LangGraph + Anthropic Claude</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
