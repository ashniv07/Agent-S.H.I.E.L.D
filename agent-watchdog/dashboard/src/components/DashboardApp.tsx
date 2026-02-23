import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import GppBadOutlinedIcon from '@mui/icons-material/GppBadOutlined';
import FeedOutlinedIcon from '@mui/icons-material/FeedOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import OutlinedFlagOutlinedIcon from '@mui/icons-material/OutlinedFlagOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PowerSettingsNewOutlinedIcon from '@mui/icons-material/PowerSettingsNewOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { RequestList } from './RequestList';
import { AuditLog } from './AuditLog';
import { ViolationCard } from './ViolationCard';
import { KillSwitch } from './KillSwitch';
import { EventFeed } from './EventFeed';
import { InsightsDashboard } from './InsightsDashboard';
import { ViolationsPanel } from './ViolationsPanel';
import { TopologyMap } from './TopologyMap';
import { MagicBento, MagicBentoCard } from './MagicBento';
import { ApiKeysManager } from './ApiKeysManager';
import { useWebSocket } from '../hooks/useWebSocket';
import botIcon from '../styles/icons/bot-icon.png';

interface Violation {
  id: string;
  type: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence?: string;
  suggestedFix?: string;
  detectedAt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface HomeStatsSummary {
  totalRequests: number;
  approvedRequests: number;
  flaggedRequests: number;
  killedRequests: number;
  totalViolations: number;
  blockedAgents: number;
  activeAgents: number;
}

type TabKey = 'home' | 'requests' | 'audits' | 'violations' | 'topology' | 'control' | 'chat' | 'integration';

interface Tab {
  key: TabKey;
  label: string;
  description: string;
  path: string;
  Icon: SvgIconComponent;
}

const tabs: Tab[] = [
  { key: 'home',       label: 'Overview',     description: 'Pipeline analytics and live stats',   path: '/dashboard/home',       Icon: HomeOutlinedIcon },
  { key: 'requests',   label: 'Requests',     description: 'Incoming and processed requests',     path: '/dashboard/requests',   Icon: ReceiptLongOutlinedIcon },
  { key: 'audits',     label: 'Audits',       description: 'Decision trail and reasoning',        path: '/dashboard/audits',     Icon: FactCheckOutlinedIcon },
  { key: 'violations', label: 'Violations',   description: 'Policy violations and details',       path: '/dashboard/violations', Icon: GppBadOutlinedIcon },
  { key: 'topology',   label: 'Topology',     description: 'Live agent network map',              path: '/dashboard/topology',   Icon: AccountTreeOutlinedIcon },
  { key: 'control',    label: 'Control',      description: 'Kill switch and live events',         path: '/dashboard/control',    Icon: PowerSettingsNewOutlinedIcon },
  { key: 'chat',       label: 'AI Assistant', description: 'Ask questions about system status',   path: '/dashboard/chat',       Icon: SmartToyOutlinedIcon },
  { key: 'integration',label: 'Integration',  description: 'API base URL, keys, and setup guide', path: '/dashboard/integration',Icon: AnalyticsOutlinedIcon },
];

// ── Animated counter ──────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900): number {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === prev.current) return;
    const from = prev.current;
    prev.current = target;
    const diff = target - from;
    if (diff === 0) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(from + diff * eased));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number;
  Icon: SvgIconComponent;
  color: string;       // hex
  glowRgb: string;     // "r,g,b"
  bars: number[];
  delta: string;
  positive: boolean;
}

function StatCard({ label, value, Icon, color, glowRgb, bars, delta, positive }: StatCardProps) {
  const animated = useCountUp(value);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  return (
    <div className="aw-stat-card">
      {/* Background glow */}
      <div
        className="aw-glow"
        style={{ background: `rgba(${glowRgb}, 0.15)` }}
      />

      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `rgba(${glowRgb}, 0.12)`, border: `1px solid rgba(${glowRgb}, 0.2)` }}
        >
          <Icon style={{ fontSize: 13, color }} />
        </span>
      </div>

      {/* Value */}
      <p className="text-3xl font-bold font-mono tracking-tight mb-1" style={{ color }}>
        {animated.toLocaleString()}
      </p>

      {/* Delta */}
      <div className="flex items-center gap-1.5 mb-4">
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{
            background: positive ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
            color: positive ? '#6ee7b7' : '#fcd34d',
          }}
        >
          {delta}
        </span>
        <span className="text-[10px] text-slate-600">vs window</span>
      </div>

      {/* Sparkline */}
      <div className="h-9 flex items-end gap-0.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: mounted ? `${h}%` : '3%',
              background: `linear-gradient(to top, rgba(${glowRgb},0.55), rgba(${glowRgb},0.18))`,
              transition: `height 550ms cubic-bezier(0.34,1.56,0.64,1) ${i * 35}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── System health bar ─────────────────────────────────────────────────────────
function SystemHealthBar({ stats }: { stats: HomeStatsSummary }) {
  const total = Math.max(1, stats.totalRequests);
  const approveP = (stats.approvedRequests / total) * 100;
  const flagP    = (stats.flaggedRequests   / total) * 100;
  const killP    = (stats.killedRequests    / total) * 100;

  const risk =
    stats.killedRequests > 5  ? { label: 'HIGH RISK', color: '#ef4444', dot: '#ef4444' } :
    stats.flaggedRequests > 10 ? { label: 'ELEVATED',  color: '#f59e0b', dot: '#f59e0b' } :
                                 { label: 'NOMINAL',   color: '#10b981', dot: '#10b981' };

  return (
    <div className="magic-bento-card col-span-12">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            System Health
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: risk.dot }}
            />
            <span className="text-[11px] font-bold" style={{ color: risk.color }}>
              {risk.label}
            </span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[10px] text-slate-500">
          <span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
            Approved {approveP.toFixed(0)}%
          </span>
          <span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            Flagged {flagP.toFixed(0)}%
          </span>
          <span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
            Killed {killP.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: '#1e293b' }}>
        <div
          className="h-full transition-all duration-1000"
          style={{ width: `${approveP}%`, background: '#10b981' }}
        />
        <div
          className="h-full transition-all duration-1000"
          style={{ width: `${flagP}%`, background: '#f59e0b' }}
        />
        <div
          className="h-full transition-all duration-1000"
          style={{ width: `${killP}%`, background: '#ef4444' }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600">
        <span>{stats.activeAgents} active agents · {stats.blockedAgents} blocked</span>
        <span>{stats.totalViolations} violations detected</span>
      </div>
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────
function PageHeader({ tab, eventCount }: { tab: Tab; eventCount: number }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100 leading-tight">{tab.label}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{tab.description}</p>
      </div>
      <div className="flex items-center gap-2.5 mt-1">
        <span className="aw-live">LIVE</span>
        {eventCount > 0 && (
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'var(--c-surface-2, #161b22)', color: '#64748b', border: '1px solid var(--c-border)' }}
          >
            {eventCount} ev
          </span>
        )}
      </div>
    </div>
  );
}

// ── Dashboard app ─────────────────────────────────────────────────────────────
export function DashboardApp() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { isConnected, events, lastEvent } = useWebSocket();

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [violations, setViolations]         = useState<Violation[]>([]);
  const [homeStats, setHomeStats]           = useState<HomeStatsSummary | null>(null);
  const [homeStatsLoading, setHomeStatsLoading] = useState(true);
  const [chatInput, setChatInput]           = useState('');
  const [chatLoading, setChatLoading]       = useState(false);
  const [messages, setMessages]             = useState<ChatMessage[]>([{
    id: crypto.randomUUID(),
    role: 'assistant',
    text: 'Agent Watchdog AI is ready. Ask me anything about your live system — risk posture, blocked agents, recent violations, decision trends, or pipeline activity.',
    timestamp: new Date().toISOString(),
  }]);

  // WebSocket events → refresh triggers
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'request:processed' || lastEvent.type === 'killswitch:triggered') {
      setRefreshTrigger((p) => p + 1);
    }
    if (lastEvent.type === 'violation:detected') {
      const data = lastEvent.data as { violation?: Partial<Violation> };
      const v = data.violation;
      if (v?.type && v.description && v.severity) {
        setViolations((prev) => [{
          id: crypto.randomUUID(),
          type: v.type!,
          description: v.description!,
          severity: v.severity!,
          evidence: v.evidence,
          suggestedFix: v.suggestedFix,
          detectedAt: new Date().toISOString(),
        }, ...prev].slice(0, 8));
      }
    }
  }, [lastEvent]);

  // Load home stats
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/audit/stats/summary');
        if (!res.ok) throw new Error('Failed');
        setHomeStats((await res.json()) as HomeStatsSummary);
      } catch (err) {
        console.error(err);
      } finally {
        setHomeStatsLoading(false);
      }
    };
    setHomeStatsLoading(true);
    void load();
  }, [refreshTrigger]);

  const handleKillSwitch = useCallback(() => {
    setRefreshTrigger((p) => p + 1);
  }, []);

  const activeTab = tabs.find((t) => t.path === location.pathname)?.key ?? null;
  if (activeTab === null) return <Navigate to="/dashboard/home" replace />;
  const activeTabObj = tabs.find((t) => t.key === activeTab)!;

  // Stat card definitions
  const statCards: StatCardProps[] = homeStats ? [
    {
      label: 'Total Requests',
      value: homeStats.totalRequests,
      Icon: ReceiptLongOutlinedIcon,
      color: '#e2e8f0',
      glowRgb: '148,163,184',
      bars: [18, 26, 38, 44, 52, 66, 72, 80],
      delta: '+8.1%',
      positive: true,
    },
    {
      label: 'Approved',
      value: homeStats.approvedRequests,
      Icon: CheckCircleOutlineOutlinedIcon,
      color: '#6ee7b7',
      glowRgb: '16,185,129',
      bars: [24, 30, 34, 42, 50, 57, 65, 74],
      delta: '+5.6%',
      positive: true,
    },
    {
      label: 'Flagged',
      value: homeStats.flaggedRequests,
      Icon: OutlinedFlagOutlinedIcon,
      color: '#fcd34d',
      glowRgb: '245,158,11',
      bars: [70, 64, 58, 49, 46, 40, 33, 28],
      delta: '-2.3%',
      positive: false,
    },
    {
      label: 'Killed',
      value: homeStats.killedRequests,
      Icon: BlockOutlinedIcon,
      color: '#fca5a5',
      glowRgb: '239,68,68',
      bars: [35, 32, 34, 30, 26, 29, 27, 25],
      delta: '-1.4%',
      positive: true,
    },
  ] : [];

  // Chat helpers
  const getChatHistory = useCallback(() =>
    messages
      .filter((m, i) => !(m.role === 'assistant' && i === 0))
      .map((m) => ({ role: m.role, content: m.text })),
    [messages]
  );

  const sendMessage = useCallback(async () => {
    const input = chatInput.trim();
    if (!input || chatLoading) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: input, timestamp: new Date().toISOString() };
    setMessages((p) => [...p, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, history: getChatHistory() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? `Error ${res.status}`);
      }
      const data = await res.json() as { reply: string; timestamp: string };
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: 'assistant', text: data.reply, timestamp: data.timestamp }]);
    } catch (err) {
      setMessages((p) => [...p, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `Error: ${err instanceof Error ? err.message : 'Unknown error. Please try again.'}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, getChatHistory]);

  const sectionTitle = (label: string, Icon: SvgIconComponent) => (
    <span className="inline-flex items-center gap-2 text-slate-100">
      <Icon fontSize="small" style={{ color: '#22d3ee' }} />
      <span>{label}</span>
    </span>
  );

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--c-bg)' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="aw-sidebar">

        {/* Logo */}
        <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.18)' }}
            >
              <img src={botIcon} alt="AW" className="w-4 h-4 object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white leading-tight">Agent Watchdog</h1>
              <p className="text-[10px] leading-tight" style={{ color: '#475569' }}>Security Operations</p>
            </div>
          </div>
        </div>

        {/* Connection status */}
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--c-border)' }}>
          <div className="flex items-center justify-between">
            {isConnected ? (
              <span className="aw-live">LIVE</span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                OFFLINE
              </span>
            )}
            <span className="text-[10px] font-mono" style={{ color: '#475569' }}>
              {events.length} ev
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => navigate(tab.path)}
              className={`aw-nav-item${activeTab === tab.key ? ' active' : ''}`}
            >
              <tab.Icon style={{ fontSize: 15, flexShrink: 0 }} />
              <span className="truncate">{tab.label}</span>
              {activeTab === tab.key && <span className="aw-nav-dot" />}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--c-border)' }}>
          <p className="text-[10px] text-center" style={{ color: '#334155' }}>© Agent Watchdog</p>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 px-5 py-5 aw-grid overflow-auto">

        {/* ── HOME ── */}
        {activeTab === 'home' && (
          <div>
            <PageHeader tab={activeTabObj} eventCount={events.length} />

            {/* Stat cards */}
            {homeStatsLoading ? (
              <div className="magic-bento-grid mb-3.5">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="col-span-12 sm:col-span-6 lg:col-span-3 h-40 rounded-xl animate-pulse"
                    style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
                  />
                ))}
              </div>
            ) : (
              <div className="magic-bento-grid mb-3.5">
                {statCards.map((card) => (
                  <div key={card.label} className="col-span-12 sm:col-span-6 lg:col-span-3">
                    <StatCard {...card} />
                  </div>
                ))}
              </div>
            )}

            {/* System health */}
            {homeStats && (
              <div className="magic-bento-grid mb-3.5">
                <SystemHealthBar stats={homeStats} />
              </div>
            )}

            {/* Charts + events + violations */}
            <div className="magic-bento-grid">
              <MagicBentoCard
                className="col-span-12 lg:col-span-4"
                title={sectionTitle('Request Decisions', AnalyticsOutlinedIcon)}
                subtitle="Distribution by outcome"
              >
                <InsightsDashboard refreshTrigger={refreshTrigger} view="decisions" hideHeader />
              </MagicBentoCard>

              <MagicBentoCard
                className="col-span-12 lg:col-span-4"
                title={sectionTitle('Violation Severity', ReportProblemOutlinedIcon)}
                subtitle="Breakdown by risk level"
              >
                <div className="h-[220px] overflow-y-auto pr-1">
                  <InsightsDashboard refreshTrigger={refreshTrigger} view="severity" hideHeader />
                </div>
              </MagicBentoCard>

              <MagicBentoCard
                className="col-span-12 lg:col-span-4"
                title={sectionTitle('Event Stream', FeedOutlinedIcon)}
                subtitle="Real-time system activity"
              >
                <div className="h-[220px] overflow-y-auto pr-1">
                  <EventFeed events={events} isConnected={isConnected} />
                </div>
              </MagicBentoCard>

              <MagicBentoCard
                className="col-span-12"
                title={sectionTitle('Recent Violations', GppBadOutlinedIcon)}
                subtitle="Live policy and runtime exceptions"
              >
                {violations.length === 0 ? (
                  <div
                    className="flex items-center justify-center h-16 text-sm rounded-lg"
                    style={{ color: '#475569', border: '1px dashed var(--c-border)' }}
                  >
                    No live violations received yet
                  </div>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {violations.map((v) => <ViolationCard key={v.id} violation={v} />)}
                  </div>
                )}
              </MagicBentoCard>
            </div>
          </div>
        )}

        {/* ── REQUESTS ── */}
        {activeTab === 'requests' && (
          <div>
            <PageHeader tab={activeTabObj} eventCount={events.length} />
            <RequestList refreshTrigger={refreshTrigger} />
          </div>
        )}

        {/* ── AUDITS ── */}
        {activeTab === 'audits' && (
          <div>
            <PageHeader tab={activeTabObj} eventCount={events.length} />
            <MagicBentoCard subtitle="Full decision chain with Technical and Business views">
              <AuditLog refreshTrigger={refreshTrigger} />
            </MagicBentoCard>
          </div>
        )}

        {/* ── VIOLATIONS ── */}
        {activeTab === 'violations' && (
          <div>
            <PageHeader tab={activeTabObj} eventCount={events.length} />
            <MagicBentoCard subtitle="Filter by severity · Click Inspect to view full pipeline trace">
              <ViolationsPanel refreshTrigger={refreshTrigger} />
            </MagicBentoCard>
          </div>
        )}

        {/* ── TOPOLOGY ── */}
        {activeTab === 'topology' && (
          <div>
            <PageHeader tab={activeTabObj} eventCount={events.length} />
            <MagicBentoCard subtitle="Live network of agents, requests, and violations">
              <TopologyMap />
            </MagicBentoCard>
          </div>
        )}

        {/* ── CONTROL ── */}
        {activeTab === 'control' && (
          <div>
            <PageHeader tab={activeTabObj} eventCount={events.length} />
            <MagicBento>
              <MagicBentoCard className="col-span-12 lg:col-span-7" title="Kill Switch Controls">
                <KillSwitch onKillSwitch={handleKillSwitch} refreshTrigger={refreshTrigger} />
              </MagicBentoCard>
              <MagicBentoCard className="col-span-12 lg:col-span-5" title="Live Event Feed">
                <EventFeed events={events} isConnected={isConnected} />
              </MagicBentoCard>
            </MagicBento>
          </div>
        )}

        {/* ── CHAT ── */}
        {activeTab === 'integration' && (
          <div>
            <PageHeader tab={activeTabObj} eventCount={events.length} />
            <MagicBentoCard subtitle="Onboard external agents with secure API-key integration">
              <ApiKeysManager />
            </MagicBentoCard>
          </div>
        )}

        {activeTab === 'chat' && (
          <div>
            <PageHeader tab={activeTabObj} eventCount={events.length} />
            <MagicBentoCard subtitle="Powered by Claude — ask anything about your live system">
              <div className="flex h-[600px] flex-col gap-3">

                {/* Messages */}
                <div
                  className="flex-1 space-y-3 overflow-y-auto rounded-xl p-3"
                  style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}
                >
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm"
                        style={{
                          background: msg.role === 'user'
                            ? 'rgba(34,211,238,0.1)'
                            : 'var(--c-surface)',
                          border: `1px solid ${msg.role === 'user' ? 'rgba(34,211,238,0.18)' : 'var(--c-border)'}`,
                          color: msg.role === 'user' ? '#a5f3fc' : '#cbd5e1',
                        }}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                        ) : (
                          <p>{msg.text}</p>
                        )}
                        <p className="mt-1.5 text-[10px] font-mono" style={{ color: '#475569' }}>
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex justify-start">
                      <div
                        className="rounded-xl px-3.5 py-2.5"
                        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
                      >
                        <span className="inline-flex gap-1 text-slate-500">
                          {[0, 150, 300].map((delay) => (
                            <span
                              key={delay}
                              className="animate-bounce text-xs"
                              style={{ animationDelay: `${delay}ms` }}
                            >●</span>
                          ))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input row */}
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) void sendMessage(); }}
                    placeholder="Ask about risk posture, blocked agents, violations, trends…"
                    disabled={chatLoading}
                    className="flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                    style={{
                      background: 'var(--c-surface)',
                      border: '1px solid var(--c-border)',
                      color: '#e2e8f0',
                      transition: 'border-color 150ms',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.35)'; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--c-border)'; }}
                  />
                  <button
                    onClick={() => void sendMessage()}
                    disabled={chatLoading || !chatInput.trim()}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40"
                    style={{
                      background: 'rgba(34,211,238,0.1)',
                      border: '1px solid rgba(34,211,238,0.22)',
                      color: '#a5f3fc',
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </MagicBentoCard>
          </div>
        )}

      </main>
    </div>
  );
}
