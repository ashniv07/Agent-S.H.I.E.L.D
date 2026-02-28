import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '../utils/api';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';

interface ApiKey {
  id: string;
  preview: string;
  name: string;
  isActive: number;
  createdAt: string;
  lastUsedAt: string | null;
}

interface IntegrationConfig {
  requiresApiKey: boolean;
  baseUrl: string;
  guardEndpoint: string;
}

const CODE_TABS = ['cURL', 'Python', 'TypeScript'] as const;
type CodeTab = (typeof CODE_TABS)[number];

function snippet(tab: CodeTab, baseUrl: string, endpointPath: string): string {
  const endpoint = `${baseUrl}${endpointPath}`;
  if (tab === 'Python') return `import requests

response = requests.post(
    "${endpoint}",
    json={
        "agentId": "my-agent-v1",
        "action": "read_file",
        "target": "/etc/config.yaml",
    },
    headers={"X-API-Key": "YOUR_API_KEY"},
    timeout=10
)
print(response.json())`;

  if (tab === 'TypeScript') return `const res = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "YOUR_API_KEY",
  },
  body: JSON.stringify({
    agentId: "my-agent-v1",
    action: "read_file",
    target: "/etc/config.yaml",
  }),
});
const result = await res.json();`;

  return `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"agentId":"my-agent-v1","action":"read_file","target":"/etc/config.yaml"}'`;
}

export function ApiKeysManager() {
  const [keys, setKeys]               = useState<ApiKey[]>([]);
  const [loading, setLoading]         = useState(true);
  const [copied, setCopied]           = useState<string | null>(null);
  const [codeTab, setCodeTab]         = useState<CodeTab>('cURL');
  const [config, setConfig]           = useState<IntegrationConfig>({
    requiresApiKey: false,
    baseUrl: '',
    guardEndpoint: '/v1/guard',
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await authFetch('/api/keys/auth/config');
      if (res.ok) setConfig(await res.json() as IntegrationConfig);
    } catch { /* ignore */ }
  }, []);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await authFetch('/api/keys');
      if (res.ok) {
        const data = await res.json() as { keys: ApiKey[] };
        setKeys(data.keys);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void fetchConfig();
    void fetchKeys();
  }, [fetchConfig, fetchKeys]);

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const deleteKey = async (id: string) => {
    await authFetch(`/api/keys/${id}`, { method: 'DELETE' });
    await fetchKeys();
    await fetchConfig();
  };

  const baseUrl     = config.baseUrl || window.location.origin;
  const endpoint    = config.guardEndpoint || '/v1/guard';
  const codeSnippet = useMemo(() => snippet(codeTab, baseUrl, endpoint), [codeTab, baseUrl, endpoint]);

  return (
    <div className="space-y-5">

      {/* ── Endpoint info ─────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Base URL',        value: baseUrl,           copyId: 'base-url' },
          { label: 'Guard Endpoint',  value: endpoint,          copyId: 'endpoint' },
          { label: 'Auth Header',     value: 'X-API-Key: aw_…', copyId: null },
        ].map(({ label, value, copyId }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#475569' }}>
              {label}
            </p>
            <p className="font-mono text-xs break-all text-slate-200">{value}</p>
            {copyId && (
              <button
                onClick={() => copy(value, copyId)}
                className="mt-2 flex items-center gap-1 text-[11px] transition-colors"
                style={{ color: copied === copyId ? '#22d3ee' : '#475569' }}
              >
                {copied === copyId
                  ? <><CheckOutlinedIcon style={{ fontSize: 11 }} /> Copied</>
                  : <><ContentCopyOutlinedIcon style={{ fontSize: 11 }} /> Copy</>}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Active keys ───────────────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--c-border)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}
        >
          <div>
            <p className="text-sm font-semibold text-slate-100">API Keys</p>
            <p className="text-[11px] mt-0.5" style={{ color: '#475569' }}>
              {keys.filter(k => k.isActive).length} active
            </p>
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm" style={{ color: '#475569' }}>Loading…</div>
        ) : keys.length === 0 ? (
          <div className="px-4 py-6 text-sm" style={{ color: '#475569' }}>No keys found.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--c-border)' }}>
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
                style={{ background: key.isActive ? 'transparent' : 'rgba(239,68,68,0.03)' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-slate-200 truncate">{key.name}</p>
                    <span
                      className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={key.isActive
                        ? { background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.2)' }
                        : { background: 'rgba(239,68,68,0.1)',  color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }
                      }
                    >
                      {key.isActive ? 'active' : 'revoked'}
                    </span>
                  </div>
                  <p className="font-mono text-xs" style={{ color: '#475569' }}>{key.preview}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#334155' }}>
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleString()}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => copy(key.preview, `preview-${key.id}`)}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors"
                    style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.15)', color: '#67e8f9' }}
                    title="Copy preview"
                  >
                    {copied === `preview-${key.id}`
                      ? <CheckOutlinedIcon style={{ fontSize: 12 }} />
                      : <ContentCopyOutlinedIcon style={{ fontSize: 12 }} />}
                  </button>
                  <button
                    onClick={() => void deleteKey(key.id)}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5' }}
                    title="Delete key"
                  >
                    <DeleteOutlineOutlinedIcon style={{ fontSize: 12 }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Integration quickstart ─────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--c-border)' }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}
        >
          <p className="text-sm font-semibold text-slate-100">Quickstart</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {CODE_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCodeTab(tab)}
                  className="rounded-md px-2.5 py-1 text-xs transition-all"
                  style={{
                    background: codeTab === tab ? 'rgba(34,211,238,0.12)' : 'transparent',
                    border:     `1px solid ${codeTab === tab ? 'rgba(34,211,238,0.25)' : 'var(--c-border)'}`,
                    color:       codeTab === tab ? '#67e8f9' : '#64748b',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              onClick={() => copy(codeSnippet, 'snippet')}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] transition-colors"
              style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.15)', color: '#67e8f9' }}
            >
              {copied === 'snippet'
                ? <><CheckOutlinedIcon style={{ fontSize: 12 }} /> Copied</>
                : <><ContentCopyOutlinedIcon style={{ fontSize: 12 }} /> Copy</>}
            </button>
          </div>
        </div>
        <div style={{ background: '#020617' }}>
          <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-slate-300 whitespace-pre">
            {codeSnippet}
          </pre>
        </div>
      </div>

    </div>
  );
}
