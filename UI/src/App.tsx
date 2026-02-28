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
import {
  authFetch,
  DASHBOARD_AUTH_KEY,
} from './utils/api';

const typedTexts = [
  'Monitor every request through a multi-agent security pipeline.',
  'Classify risk, detect violations, and trigger kill-switch controls instantly.',
  'Audit every decision with traceable reasoning and live event streams.',
];

type AuthModal = 'get-key' | 'login' | null;

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
  const loginRequiredMessage = 'Please login to access dashboard pages.';
  const location = useLocation();
  const navigate = useNavigate();
  const started = location.pathname.startsWith('/dashboard');

  const [textIndex, setTextIndex] = useState(0);
  const [display, setDisplay] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [authModal, setAuthModal] = useState<AuthModal>(null);
  const [integrationConfig, setIntegrationConfig] = useState<IntegrationConfig>({
    requiresApiKey: false,
    baseUrl: '',
    guardEndpoint: '/v1/guard',
  });
  const [isDashboardAuthed, setIsDashboardAuthed] = useState(() => Boolean(localStorage.getItem(DASHBOARD_AUTH_KEY)));
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKey, setCreatedKey] = useState<NewKeyResponse | null>(null);
  const [loginKey, setLoginKey] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Keep auth state in sync with persisted key (covers same-tab logout/login).
  useEffect(() => {
    const authed = Boolean(localStorage.getItem(DASHBOARD_AUTH_KEY));
    if (authed !== isDashboardAuthed) {
      setIsDashboardAuthed(authed);
    }
  }, [location.pathname, isDashboardAuthed]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authFetch('/api/keys/auth/config');
        if (!res.ok) throw new Error('Failed to fetch integration config');
        const data = await res.json() as IntegrationConfig;
        setIntegrationConfig(data);
      } catch (error) {
        console.error(error);
        setAuthError('Backend not reachable. Set Backend URL below, then try again.');
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!isDashboardAuthed && started) {
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
    if (creatingKey) return;
    setCreatingKey(true);
    setAuthError('');
    const generatedName = `external-agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      const res = await authFetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: generatedName }),
      });
      if (!res.ok) throw new Error('Unable to create API key');
      const data = await res.json() as NewKeyResponse;
      setCreatedKey(data);
      setLoginKey(data.key);
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
      const res = await authFetch('/api/keys/auth', {
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
      setAuthModal(null);
      navigate('/dashboard/integration');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  if (started && isDashboardAuthed) {
    return <DashboardApp />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1a1a_0%,_#101010_45%,_#050505_100%)] text-slate-100">
      <div className="flex min-h-screen w-full flex-col px-4 py-6 sm:px-5 md:px-10 md:py-10 lg:px-14">
        <header className="mb-5 flex items-start justify-between gap-3 text-cyan-300 sm:mb-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/35 bg-cyan-400/10 text-base font-bold">
              <img src={botIcon} alt="agent S.H.I.E.L.D" className="h-5 w-5 object-contain" />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight text-slate-100">agent S.H.I.E.L.D</p>
              <p className="text-xs text-slate-400">Visibility into every decision your AI makes.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAuthError('');
                setAuthModal('get-key');
              }}
              className="magic-button-sm"
            >
              Get API Key
            </button>
            <button
              onClick={() => {
                setAuthError('');
                setAuthModal('login');
              }}
              className="magic-button-sm"
            >
              Login
            </button>
          </div>
        </header>

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
                    else {
                      setAuthError(loginRequiredMessage);
                      setAuthModal('login');
                    }
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
                      agent S.H.I.E.L.D
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

        <footer className="mt-auto pt-8 text-center text-sm text-slate-500">copyright (cp) 2026 . agent S.H.I.E.L.D</footer>
      </div>

      {authModal === 'get-key' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-cyan-400/25 bg-slate-950 p-8">
            <div className="mx-auto w-full max-w-[720px]">
            <div className="flex items-center justify-between px-5 py-5">
              <h2 className="mt-4  text-3xl font-semibold text-slate-100">Get API Key</h2>
              <button onClick={() => setAuthModal(null)} className="pr-6 pl-5 ml-4 mr-4 text-2xl text-slate-400">X</button>
            </div>

            <p className="mb-10 mt-8 px-2 text-center text-[30px] text-slate-400">
              Key name is generated automatically. Use this key in your external app via <code>X-API-Key</code>.
            </p>

            <div className="mb-5 grid gap-6 px-3 text-sm text-slate-300 sm:grid-cols-3">
              <div className="min-h-[140px] rounded-md border border-slate-800 bg-slate-900/60 p-4">
                <p className="mb-3 text-sm text-slate-500">API Base URL</p>
                <p className="font-mono text-sm break-all">{integrationConfig.baseUrl || window.location.origin}</p>
              </div>
              <div className="min-h-[140px] rounded-md border border-slate-800 bg-slate-900/60 p-4">
                <p className="mb-3 text-sm text-slate-500">Guard Endpoint</p>
                <p className="font-mono text-sm break-all">{integrationConfig.guardEndpoint}</p>
              </div>
              <div className="min-h-[140px] rounded-md border border-slate-800 bg-slate-900/60 p-4">
                <p className="mb-3 text-sm text-slate-500">Auth Header</p>
                <p className="font-mono text-sm break-all">X-API-Key: aw_...</p>
              </div>
            </div>

            <div className="mb-4  flex justify-center px-6">
              <button
                onClick={() => void handleCreateKey()}
                disabled={creatingKey}
                className="magic-button-sm px-5 py-5 text-s disabled:opacity-40"
              >
                {creatingKey ? 'Generating...' : 'Generate Key'}
              </button>
            </div>

            {createdKey && (
  <div className="mt-5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-6">
    <div className="flex items-center justify-between mb-6">
      <span className="text-sm font-semibold text-emerald-300">
        Save this key now. It will not be shown again.
      </span>
      <button
        onClick={() => void copyText(createdKey.key)}
        className="rounded border border-emerald-500/50 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20 transition-colors"
      >
        Copy
      </button>
    </div>
    
    <div className="mb-6">
      <code className="block break-all rounded bg-emerald-500/5 p-4 text-sm text-emerald-200 border border-emerald-500/20">
        {createdKey.key}
      </code>
    </div>
    
    <button
      onClick={() => {
        setAuthError('');
        setAuthModal('login');
      }}
      className="magic-button-sm w-full py-3.5 text-sm font-medium"
    >
      Continue to Login
    </button>
  </div>
)}

            {authError && <p className="mt-10 text-sm text-red-300">{authError}</p>}
            </div>
          </div>
        </div>
      )}

      {authModal === 'login' && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
    <div className="w-full max-w-md rounded-2xl border border-cyan-400/25 bg-slate-950 shadow-2xl shadow-cyan-900/10">
      <div className="p-12">
        <div className="flex items-center justify-between pb-8 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-slate-100">Login</h2>
          <button onClick={() => setAuthModal(null)} className="text-sm text-slate-400 hover:text-slate-300 transition-colors">
            Close
          </button>
        </div>

        <div className="space-y-8 pt-10">
          <p className="text-sm text-slate-400 leading-relaxed">
            Authenticate with your API key to access the integration dashboard.
          </p>

          <div className="space-y-3">
            <label className="block text-sm text-slate-300 font-medium">API Key</label>
            <input
              value={loginKey}
              onChange={(e) => setLoginKey(e.target.value)}
              placeholder="aw_xxxxxxxxxxxxxxxxx"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-4 text-base text-slate-100 outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50 transition-all"
            />
          </div>

          <button
            onClick={() => void handleLogin()}
            disabled={authLoading || (!loginKey.trim() && integrationConfig.requiresApiKey)}
            className="magic-button-sm w-full py-4 text-sm font-medium disabled:opacity-40 mt-2"
          >
            {authLoading ? 'Signing in...' : 'Login'}
          </button>

          <button
            onClick={() => {
              setAuthError('');
              setAuthModal('get-key');
            }}
            className="mx-auto block text-sm text-slate-300 underline underline-offset-4 transition-colors hover:text-cyan-200"
          >
            Don't have an API key? Get one
          </button>
          
          {authError && (
            <div className="p-5 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-300">
                {authError}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

export default App;
