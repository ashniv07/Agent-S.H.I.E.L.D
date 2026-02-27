export const DASHBOARD_AUTH_KEY = 'aw_dashboard_api_key';

/** Fetch wrapper that adds the stored API key as an X-API-Key header. */
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const key = localStorage.getItem(DASHBOARD_AUTH_KEY);
  const headers = new Headers(options.headers);
  if (key && key !== 'session') {
    headers.set('X-API-Key', key);
  }
  return fetch(url, { ...options, headers });
}
