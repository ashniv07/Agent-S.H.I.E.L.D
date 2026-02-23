import { useEffect, useMemo, useState } from 'react';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import GppBadOutlinedIcon from '@mui/icons-material/GppBadOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PowerSettingsNewOutlinedIcon from '@mui/icons-material/PowerSettingsNewOutlined';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardApp } from './components/DashboardApp';
import { AgentFlow } from './components/AgentFlow';
import { SpotlightCard } from './components/SpotlightCard';
import botIcon from './styles/icons/bot-icon.png';

const DASHBOARD_AUTH_KEY = 'aw_dashboard_api_key';

const typedTexts = [
  'Monitor every request through a multi-agent security pipeline.',
  'Classify risk, detect violations, and trigger kill-switch controls instantly.',
  'Audit every decision with traceable reasoning and live event streams.',
];

type LandingTab = 'get-key' | 'login';

interface IntegrationConfig {
  requiresApiKey: boolean;
  baseUrl: string;
  guardEndpoint: string;
}

interface NewKeyResponse {
  id: string;
  key: string;
  preview: string;
  name: string;
  createdAt: string;
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const started = location.pathname.startsWith('/dashboard');

  const [textIndex, setTextIndex] = useState(0);
  const [display, setDisplay] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [tab, setTab] = useState<LandingTab>('get-key');
  const [integrationConfig, setIntegrationConfig] = useState<IntegrationConfig>({
    requiresApiKey: false,
    baseUrl: '',
    guardEndpoint: '/v1/guard',
  });
  const [isDashboardAuthed, setIsDashboardAuthed] = useState(() => Boolean(localStorage.getItem(DASHBOARD_AUTH_KEY)));
  const [creatingKey, setCreatingKey] = useState(false);
  const [keyName, setKeyName] = useState('production-agent');
  const [createdKey, setCreatedKey] = useState<NewKeyResponse | null>(null);
  const [loginKey, setLoginKey] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/keys/auth/config');
        if (!res.ok) throw new Error('Failed to fetch integration config');
        const data = await res.json() as IntegrationConfig;
        setIntegrationConfig(data);
      } catch (error) {
        console.error(error);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (started && !isDashboardAuthed) {
      navigate('/', { replace: true });
    }
  }, [started, isDashboardAuthed, navigate]);

  useEffect(() => {
    if (started) return;

    const fullText = typedTexts[textIndex % typedTexts.length];
    const pauseMs = 1200;
    const typingSpeed = 42;
    const deletingSpeed = 28;

    if (!isDeleting && display === fullText) {
      const pauseTimer = setTimeout(() => setIsDeleting(true), pauseMs);
      return () => clearTimeout(pauseTimer);
    }

    if (isDeleting && display === '') {
      setIsDeleting(false);
      setTextIndex((prev) => (prev + 1) % typedTexts.length);
      return;
    }

    const nextValue = isDeleting
      ? fullText.slice(0, Math.max(0, display.length - 1))
      : fullText.slice(0, Math.min(fullText.length, display.length + 1));

    const timer = setTimeout(
      () => setDisplay(nextValue),
      isDeleting ? deletingSpeed : typingSpeed
    );

    return () => clearTimeout(timer);
  }, [display, isDeleting, started, textIndex]);

  const highlights = useMemo(() => ([
    {
      icon: <AccountTreeOutlinedIcon fontSize="small" />,
      title: 'Pipeline Intelligence',
      description:
        'Requests flow through orchestrator, monitoring, error analysis, severity classification, and decisioning.',
    },
    {
      icon: <GppBadOutlinedIcon fontSize="small" />,
      title: 'Violation Visibility',
      description:
        'Track policy breaches by severity with filtered views, evidence snapshots, and actionable remediation context.',
    },
    {
      icon: <FactCheckOutlinedIcon fontSize="small" />,
      title: 'Audit Assurance',
      description:
        'Each decision is logged with reasoning and processing path so governance teams can review complete history.',
    },
    {
      icon: <PowerSettingsNewOutlinedIcon fontSize="small" />,
      title: 'Kill-Switch Control',
      description:
        'Trigger targeted or emergency agent blocks, then restore safely with clear operational status in real time.',
    },
  ]), []);

  const demoProcessingPath = [
    'orchestrator',
    'workerMonitor',
    'errorAnalyzer',
    'severityClassifier',
    'fixProposer',
    'decisionEngine',
  ];

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  const handleCreateKey = async () => {
    if (!keyName.trim() || creatingKey) return;
    setCreatingKey(true);
    setAuthError('');

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName.trim() }),
      });
      if (!res.ok) throw new Error('Unable to create API key');
      const data = await res.json() as NewKeyResponse;
      setCreatedKey(data);
      setLoginKey(data.key);
      setTab('login');
      setIntegrationConfig((prev) => ({ ...prev, requiresApiKey: true }));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/keys/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: loginKey.trim() }),
      });
      const payload = await res.json() as {
        ok: boolean;
        requiresApiKey: boolean;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error ?? 'Authentication failed');
      }

      localStorage.setItem(DASHBOARD_AUTH_KEY, loginKey.trim() || 'session');
      setIsDashboardAuthed(true);
      navigate('/dashboard/integration');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  if (started) {
    return <DashboardApp />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1a1a_0%,_#101010_45%,_#050505_100%)] text-slate-100">
      <div className="flex min-h-screen w-full flex-col px-4 py-6 sm:px-5 md:px-10 md:py-10 lg:px-14">
        <header className="mb-5 flex items-start justify-between gap-3 text-cyan-300 sm:mb-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/35 bg-cyan-400/10 text-base font-bold">
              <img src={botIcon} alt="Agent Watchdog" className="h-5 w-5 object-contain" />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight text-slate-100">Agent Watchdog</p>
              <p className="text-xs text-slate-400">SaaS integration security for external AI agents</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('get-key')}
              className={`magic-button-sm ${tab === 'get-key' ? 'ring-1 ring-cyan-300/45' : ''}`}
            >
              Get API Key
            </button>
            <button
              onClick={() => setTab('login')}
              className={`magic-button-sm ${tab === 'login' ? 'ring-1 ring-cyan-300/45' : ''}`}
            >
              Login
            </button>
          </div>
        </header>

        <div
          className="mb-8 rounded-xl border border-cyan-400/20 bg-slate-950/70 p-4"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          {tab === 'get-key' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <label className="mb-1 block text-xs text-slate-400">Key Name</label>
                  <input
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="production-agent"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none"
                  />
                </div>
                <button
                  onClick={() => void handleCreateKey()}
                  disabled={!keyName.trim() || creatingKey}
                  className="magic-button-sm disabled:opacity-40"
                >
                  {creatingKey ? 'Generating...' : 'Generate Key'}
                </button>
              </div>

              <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
                <div className="rounded-md border border-slate-800 bg-slate-900/60 p-2">
                  <p className="text-slate-500">API Base URL</p>
                  <p className="font-mono">{integrationConfig.baseUrl || window.location.origin}</p>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900/60 p-2">
                  <p className="text-slate-500">Guard Endpoint</p>
                  <p className="font-mono">{integrationConfig.guardEndpoint}</p>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900/60 p-2">
                  <p className="text-slate-500">Auth Header</p>
                  <p className="font-mono">X-API-Key: aw_...</p>
                </div>
              </div>

              {createdKey && (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-emerald-300">
                      Save this key now. It will not be shown again.
                    </span>
                    <button
                      onClick={() => void copyText(createdKey.key)}
                      className="rounded border border-emerald-500/50 px-2 py-1 text-xs text-emerald-200"
                    >
                      Copy
                    </button>
                  </div>
                  <code className="block break-all text-xs text-emerald-200">{createdKey.key}</code>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Authenticate with your API key to access your Integration dashboard and connect external agents.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[260px] flex-1">
                  <label className="mb-1 block text-xs text-slate-400">API Key</label>
                  <input
                    value={loginKey}
                    onChange={(e) => setLoginKey(e.target.value)}
                    placeholder="aw_xxxxxxxxxxxxxxxxx"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none"
                  />
                </div>
                <button
                  onClick={() => void handleLogin()}
                  disabled={authLoading || (!loginKey.trim() && integrationConfig.requiresApiKey)}
                  className="magic-button-sm disabled:opacity-40"
                >
                  {authLoading ? 'Signing in...' : 'Login'}
                </button>
              </div>
              {!integrationConfig.requiresApiKey && (
                <p className="text-xs text-amber-300">
                  No active keys yet. Generate your first API key to activate secured integrations.
                </p>
              )}
            </div>
          )}

          {authError && (
            <p className="mt-3 text-xs text-red-300">{authError}</p>
          )}
        </div>

        <section className="relative w-full overflow-hidden">
          <header className="relative flex min-h-[62vh] items-center justify-center px-2 py-10 text-center sm:min-h-[66vh] sm:py-14 md:px-8">
            <div className="relative z-10 max-w-5xl">
              <h1 className="mb-5 text-3xl font-semibold leading-[1.08] text-slate-200 sm:text-4xl md:mb-10 md:text-6xl lg:text-7xl">
                Custom governance
                <br />
                for AI agent workflows
              </h1>
              <div className="mx-auto mb-7 max-w-2xl text-xs italic text-slate-300 sm:text-sm md:text-base">
                <span className="inline-flex items-center">
                  <span>{display}</span>
                  <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-cyan-300" />
                </span>
              </div>

              <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-400 md:mt-5 md:text-base">
                Deliver secure AI operations with clear controls, live insights, and complete auditability.
              </p>
              <div className="mt-8 flex justify-center md:mt-10">
                <button
                  onClick={() => {
                    if (isDashboardAuthed) navigate('/dashboard/home');
                    else setTab('login');
                  }}
                  className="magic-button"
                >
                  {isDashboardAuthed ? 'Enter Dashboard' : 'Login to Dashboard'}
                </button>
              </div>
            </div>
          </header>
        </section>

        <section className="mb-8 mt-8 w-full md:mt-5">
          <div className="mb-10 text-center">
            <h2 className="text-xl font-semibold text-slate-200 sm:text-2xl md:text-4xl">Platform Highlights</h2>
            <p className="m mt-2 text-sm text-slate-500 sm:text-base md:mt-3 md:text-lg">Core capabilities at a glance</p>
          </div>

          <div className="marquee-container">
            <div className="marquee-track">
              {[...highlights, ...highlights].map((item, index) => (
                <div key={`${item.title}-${index}`} className="marquee-item">
                  <SpotlightCard title={item.title} description={item.description} icon={item.icon}>
                    <p className="mt-5 text-xs uppercase tracking-[0.16em] text-cyan-300/80">
                      Agent Watchdog
                    </p>
                  </SpotlightCard>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 w-full md:mt-10">
          <div className="mb-4 text-center">
            <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl md:text-4xl">AI Flow Diagram</h2>
            <p className="mt-2 text-sm text-slate-500 sm:text-base md:mt-3 md:text-lg">Governance pipeline overview</p>
          </div>
          <div className="w-full">
            <AgentFlow processingPath={demoProcessingPath} />
          </div>
        </section>

        <footer className="mt-auto pt-8 text-center text-sm text-slate-500">copyright (cp) 2026 . Agent Watchdog</footer>
      </div>
    </div>
  );
}

export default App;
