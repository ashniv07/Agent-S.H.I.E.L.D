import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';

const DASHBOARD_AUTH_KEY = 'aw_dashboard_api_key';
const nativeFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;
  const isPlatformApiRequest =
    url.startsWith('/api') ||
    url.startsWith('/v1') ||
    url.startsWith(window.location.origin);

  if (!isPlatformApiRequest) {
    return nativeFetch(input, init);
  }

  const key = localStorage.getItem(DASHBOARD_AUTH_KEY);
  if (!key) return nativeFetch(input, init);

  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (!headers.has('X-API-Key')) {
    headers.set('X-API-Key', key);
  }

  return nativeFetch(input, { ...init, headers });
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <div className="monochrome-theme">
        <App />
      </div>
    </BrowserRouter>
  </React.StrictMode>
);
