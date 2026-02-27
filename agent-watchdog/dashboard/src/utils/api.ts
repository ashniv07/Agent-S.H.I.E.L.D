export const DASHBOARD_AUTH_KEY = 'aw_dashboard_api_key';
const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');

export function resolveApiUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith('/')) return url;
  return API_BASE_URL ? `${API_BASE_URL}${url}` : url;
}

export const WS_URL =
  ((import.meta.env.VITE_WS_URL as string | undefined)?.trim() ?? '') ||
  (API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin));

/** Fetch wrapper that adds the stored API key as an X-API-Key header. */
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const key = localStorage.getItem(DASHBOARD_AUTH_KEY);
  const headers = new Headers(options.headers);
  if (key && key !== 'session') {
    headers.set('X-API-Key', key);
  }
  return fetch(resolveApiUrl(url), { ...options, headers });
}
