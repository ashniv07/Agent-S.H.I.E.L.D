import { useCallback, useEffect, useMemo, useState } from 'react';

interface ApiKey {
  id: string;
  preview: string;
  name: string;
  isActive: number;
  createdAt: string;
  lastUsedAt: string | null;
}

interface NewKey extends ApiKey {
  key: string;
}

interface IntegrationConfig {
  requiresApiKey: boolean;
  baseUrl: string;
  guardEndpoint: string;
}

const CODE_TABS = ['cURL', 'Python', 'TypeScript'] as const;
type CodeTab = (typeof CODE_TABS)[number];

function integrationSnippet(tab: CodeTab, baseUrl: string, endpointPath: string, apiKey: string): string {
  const endpoint = `${baseUrl}${endpointPath}`;
  const keyValue = apiKey || 'YOUR_API_KEY';

  if (tab === 'Python') {
    return `import requests

BASE_URL = "${baseUrl}"
API_KEY = "${keyValue}"

payload = {
    "agentId": "my-agent-v1",
    "action": "read_file",
    "target": "/etc/config.yaml",
    "context": {"purpose": "load app settings"}
}

response = requests.post(
    "${endpoint}",
    json=payload,
    headers={"X-API-Key": API_KEY, "Content-Type": "application/json"},
    timeout=10
)
response.raise_for_status()
print(response.json())`;
  }

  if (tab === 'TypeScript') {
    return `const API_BASE_URL = "${baseUrl}";
const API_KEY = "${keyValue}";

const payload = {
  agentId: "my-agent-v1",
  action: "read_file",
  target: "/etc/config.yaml",
  context: { purpose: "load app settings" },
};

const response = await fetch(\`\${API_BASE_URL}${endpointPath}\`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
  },
  body: JSON.stringify(payload),
});

if (!response.ok) throw new Error(\`Guard request failed: \${response.status}\`);
const result = await response.json();
console.log(result);`;
  }

  return `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${keyValue}" \\
  -d '{
    "agentId": "my-agent-v1",
    "action": "read_file",
    "target": "/etc/config.yaml",
    "context": { "purpose": "load app settings" }
  }'`;
}

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('production-agent');
  const [revealed, setRevealed] = useState<NewKey | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<CodeTab>('cURL');
  const [integrationConfig, setIntegrationConfig] = useState<IntegrationConfig>({
    requiresApiKey: false,
    baseUrl: '',
    guardEndpoint: '/v1/guard',
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/keys/auth/config');
      if (!res.ok) throw new Error('Failed to load integration config');
      const data = await res.json() as IntegrationConfig;
      setIntegrationConfig(data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/keys');
      if (!res.ok) throw new Error('Failed to load API keys');
      const data = await res.json() as { keys: ApiKey[] };
      setKeys(data.keys);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
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

  const createKey = async () => {
    if (!newKeyName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create API key');
      const data = await res.json() as NewKey;
      setRevealed(data);
      setNewKeyName('production-agent');
      await fetchKeys();
      await fetchConfig();
    } catch (error) {
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    await fetch(`/api/keys/${id}/revoke`, { method: 'PATCH' });
    await fetchKeys();
  };

  const deleteKey = async (id: string) => {
    if (!confirm('Delete this key permanently?')) return;
    await fetch(`/api/keys/${id}`, { method: 'DELETE' });
    await fetchKeys();
    await fetchConfig();
  };

  const rotateKey = async (id: string, name: string) => {
    try {
      const nextName = `${name} ${new Date().toISOString().slice(0, 10)}`;
      const res = await fetch(`/api/keys/${id}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${nextName} (rotated)` }),
      });
      if (!res.ok) throw new Error('Failed to rotate key');
      const data = await res.json() as NewKey;
      setRevealed(data);
      await fetchKeys();
    } catch (error) {
      console.error(error);
    }
  };

  const apiBaseUrl = integrationConfig.baseUrl || window.location.origin;
  const endpointPath = integrationConfig.guardEndpoint || '/v1/guard';
  const displayKey = revealed?.key ?? 'YOUR_API_KEY';
  const snippet = useMemo(
    () => integrationSnippet(codeTab, apiBaseUrl, endpointPath, displayKey),
    [apiBaseUrl, codeTab, displayKey, endpointPath]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">API Base URL</p>
          <p className="mt-2 break-all font-mono text-sm text-slate-100">{apiBaseUrl}</p>
          <button onClick={() => copy(apiBaseUrl, 'base-url')} className="mt-3 text-xs text-cyan-300">
            {copied === 'base-url' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Guard Endpoint</p>
          <p className="mt-2 font-mono text-sm text-slate-100">{endpointPath}</p>
          <p className="mt-3 text-xs text-slate-400">Method: POST</p>
          <p className="text-xs text-slate-400">Header: X-API-Key</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Auth Status</p>
          <p className="mt-2 text-sm text-slate-100">
            {integrationConfig.requiresApiKey ? 'API-key auth enabled' : 'Open mode until first key is created'}
          </p>
          <p className="mt-3 text-xs text-slate-400">Use this key to connect your external codebase agents.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
        <h3 className="text-sm font-semibold text-slate-200">Get API Key</h3>
        <p className="mt-1 text-xs text-slate-400">Create a unique key per environment or service.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-[11px] text-slate-400">Key name</label>
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder='production-agent'
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <button
            onClick={() => void createKey()}
            disabled={creating || !newKeyName.trim()}
            className="rounded-md border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 disabled:opacity-40"
          >
            {creating ? 'Generating...' : 'Generate Key'}
          </button>
        </div>

        {revealed && (
          <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-emerald-300">Save this key now. It is shown only once.</p>
              <button onClick={() => copy(revealed.key, 'new-key')} className="text-xs text-emerald-200">
                {copied === 'new-key' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <code className="mt-2 block break-all text-xs text-emerald-100">{revealed.key}</code>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-700">
        <div className="border-b border-slate-700 bg-slate-900/50 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-200">API Keys</h3>
          <p className="text-xs text-slate-400">Rotate regularly and revoke unused keys.</p>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading keys...</div>
        ) : keys.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No keys yet.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {keys.map((key) => (
              <div key={key.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm text-slate-100">{key.name}</p>
                  <p className="font-mono text-xs text-slate-400">{key.preview}</p>
                  <p className="text-[11px] text-slate-500">
                    Created {new Date(key.createdAt).toLocaleString()}
                    {key.lastUsedAt ? ` | Last used ${new Date(key.lastUsedAt).toLocaleString()}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {key.isActive === 1 && (
                    <button
                      onClick={() => void rotateKey(key.id, key.name)}
                      className="rounded border border-cyan-500/35 px-2 py-1 text-xs text-cyan-200"
                    >
                      Rotate
                    </button>
                  )}
                  {key.isActive === 1 && (
                    <button
                      onClick={() => void revokeKey(key.id)}
                      className="rounded border border-amber-500/35 px-2 py-1 text-xs text-amber-200"
                    >
                      Revoke
                    </button>
                  )}
                  <button
                    onClick={() => void deleteKey(key.id)}
                    className="rounded border border-rose-500/35 px-2 py-1 text-xs text-rose-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-700">
        <div className="border-b border-slate-700 bg-slate-900/50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-200">Integration Quickstart</h3>
            <button
              onClick={() => copy(snippet, 'snippet')}
              className="rounded border border-cyan-500/35 px-2 py-1 text-xs text-cyan-200"
            >
              {copied === 'snippet' ? 'Copied' : 'Copy snippet'}
            </button>
          </div>
          <div className="mt-3 flex gap-1">
            {CODE_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setCodeTab(tab)}
                className="rounded-md px-2.5 py-1 text-xs"
                style={{
                  background: codeTab === tab ? 'rgba(34,211,238,0.12)' : 'transparent',
                  border: `1px solid ${codeTab === tab ? 'rgba(34,211,238,0.25)' : 'rgba(51,65,85,0.55)'}`,
                  color: codeTab === tab ? '#67e8f9' : '#94a3b8',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-[#020617] p-4">
          <pre className="overflow-x-auto whitespace-pre text-xs leading-relaxed text-slate-200">{snippet}</pre>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
          <p className="text-xs font-semibold text-slate-200">1. Create key</p>
          <p className="mt-1 text-xs text-slate-400">Generate a key per service or environment.</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
          <p className="text-xs font-semibold text-slate-200">2. Call guard endpoint</p>
          <p className="mt-1 text-xs text-slate-400">Send each sensitive action to POST {endpointPath} first.</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
          <p className="text-xs font-semibold text-slate-200">3. Enforce decision</p>
          <p className="mt-1 text-xs text-slate-400">Proceed on APPROVE, alert on FLAG, stop on KILL.</p>
        </div>
      </div>
    </div>
  );
}
