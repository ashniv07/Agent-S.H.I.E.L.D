export const DASHBOARD_AUTH_KEY = 'aw_dashboard_api_key';
export const RUNTIME_API_BASE_KEY = 'aw_api_base_url';
const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');

export function getRuntimeApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return (localStorage.getItem(RUNTIME_API_BASE_KEY) ?? '').trim().replace(/\/+$/, '');
}

export function setRuntimeApiBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const normalized = url.trim().replace(/\/+$/, '');
  if (!normalized) {
    localStorage.removeItem(RUNTIME_API_BASE_KEY);
    return;
  }
  localStorage.setItem(RUNTIME_API_BASE_KEY, normalized);
}

export function getApiBaseUrl(): string {
  return getRuntimeApiBaseUrl() || API_BASE_URL;
}

export function resolveApiUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith('/')) return url;
  const base = getApiBaseUrl();
  return base ? `${base}${url}` : url;
}

export function resolveWsUrl(): string {
  const runtime = getRuntimeApiBaseUrl();
  const wsEnv = ((import.meta.env.VITE_WS_URL as string | undefined)?.trim() ?? '').replace(/\/+$/, '');
  if (wsEnv) return wsEnv;
  if (runtime) return runtime;
  if (API_BASE_URL) return API_BASE_URL;
  return import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin;
}

/** Fetch wrapper that adds the stored API key as an X-API-Key header. */
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const key = localStorage.getItem(DASHBOARD_AUTH_KEY);
  const headers = new Headers(options.headers);
  if (key && key !== 'session') {
    headers.set('X-API-Key', key);
  }
  return fetch(resolveApiUrl(url), { ...options, headers });
}
