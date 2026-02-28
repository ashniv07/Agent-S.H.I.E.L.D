import { useState, useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import GppBadOutlinedIcon from '@mui/icons-material/GppBadOutlined';
import FeedOutlinedIcon from '@mui/icons-material/FeedOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import OutlinedFlagOutlinedIcon from '@mui/icons-material/OutlinedFlagOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PowerSettingsNewOutlinedIcon from '@mui/icons-material/PowerSettingsNewOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { authFetch, DASHBOARD_AUTH_KEY } from '../utils/api';
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
import { ChatWidget } from './ChatWidget';
import { KillAlertOverlay } from './KillAlertOverlay';
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

interface HomeStatsSummary {
  totalRequests: number;
  approvedRequests: number;
  flaggedRequests: number;
  killedRequests: number;
  totalViolations: number;
  blockedAgents: number;
  activeAgents: number;
}

type TabKey = 'home' | 'requests' | 'audits' | 'violations' | 'topology' | 'control' | 'integration';

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
  { key: 'control',    label: 'Control',      description: 'Agent status and live event stream',  path: '/dashboard/control',    Icon: PowerSettingsNewOutlinedIcon },
  { key: 'integration',label: 'Integration',  description: 'API base URL, keys, and setup guide', path: '/dashboard/integration',Icon: AnalyticsOutlinedIcon },
];

// ── Animated counter ──────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900): number {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    if (target === from) {
      setCount(target);
      return;
    }
    const diff = target - from;
    const start = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (progress >= 1) {
        setCount(target);
        prev.current = target;
        clearInterval(timer);
        return;
      }
      setCount(Math.round(from + diff * eased));
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
  // Use only processed requests so the bar fills to 100%
  const processed = Math.max(1, stats.approvedRequests + stats.flaggedRequests + stats.killedRequests);
  const approveP = (stats.approvedRequests / processed) * 100;
  const flagP    = (stats.flaggedRequests   / processed) * 100;
  const killP    = (stats.killedRequests    / processed) * 100;

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

  // Load home stats — also auto-polls every 10 s so numbers always stay fresh
  useEffect(() => {
    const load = async () => {
      try {
        const res = await authFetch('/api/audit/stats/summary');
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
    const poll = setInterval(() => { void load(); }, 10_000);
    return () => clearInterval(poll);
  }, [refreshTrigger]);

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
              <h1 className="text-sm font-bold text-white leading-tight">Agent S.H.I.E.L.D</h1>
              <p className="text-[10px] leading-tight" style={{ color: '#475569' }}>Visibility into every decision your AI makes.</p>
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
        <div className="px-3 py-3 space-y-2" style={{ borderTop: '1px solid var(--c-border)' }}>
          <button
            onClick={() => {
              localStorage.removeItem(DASHBOARD_AUTH_KEY);
              navigate('/');
            }}
            className="aw-nav-item w-full text-rose-400 hover:text-rose-300"
            style={{ justifyContent: 'flex-start' }}
          >
            <LogoutOutlined style={{ fontSize: 15, flexShrink: 0 }} />
            <span className="truncate">Logout</span>
          </button>
          <p className="text-[10px] text-center" style={{ color: '#334155' }}>© Agent S.H.I.E.L.D</p>
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
              <MagicBentoCard className="col-span-12 lg:col-span-7" title="Agent Status">
                <KillSwitch refreshTrigger={refreshTrigger} />
              </MagicBentoCard>
              <MagicBentoCard className="col-span-12 lg:col-span-5" title="Live Event Feed">
                <EventFeed events={events} isConnected={isConnected} />
              </MagicBentoCard>
            </MagicBento>
          </div>
        )}

        {/* ── INTEGRATION ── */}
        {activeTab === 'integration' && (
          <div>
            <PageHeader tab={activeTabObj} eventCount={events.length} />
            <MagicBentoCard subtitle="Onboard external agents with secure API-key integration">
              <ApiKeysManager />
            </MagicBentoCard>
          </div>
        )}

      </main>

      {/* ── Floating AI chat widget ───────────────────────────────────── */}
      <ChatWidget />

      {/* ── Kill alert overlay ────────────────────────────────────────── */}
      <KillAlertOverlay />
    </div>
  );
}
