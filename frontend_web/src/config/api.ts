import { configureApi, configureStorage } from '@chemisttasker/shared-core';
import { getAccessToken, setTokens, clearTokens, isTokenExpired } from '../utils/tokenService';

let configured = false;
let refreshPromise: Promise<string | null> | null = null;

async function getAccessWithRefresh(baseURL: string) {
  const existing = getAccessToken();
  if (existing && !isTokenExpired(existing)) return existing;

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${baseURL}/users/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (response.status === 400 || response.status === 401) {
        clearTokens();
        return null;
      }
      if (!response.ok) {
        throw new Error(`Refresh failed with status ${response.status}`);
      }
      const data = await response.json().catch(() => ({}));
      const nextAccess = data.access;
      if (nextAccess) {
        setTokens(nextAccess, data.refresh ?? '');
        return nextAccess;
      }
    } catch (err) {
      console.error('Unexpected refresh failure for shared-core', err);
      clearTokens();
    } finally {
      refreshPromise = null;
    }
    return null;
  })();

  return refreshPromise;
}

export function initSharedCoreApi() {
  if (configured) return;
  const baseURL = import.meta.env.VITE_API_URL;
  if (!baseURL) {
    throw new Error('VITE_API_URL is not defined');
  }
  configureStorage({
    getItem: (key: string) => localStorage.getItem(key),
    setItem: (key: string, value: string) => localStorage.setItem(key, value),
    removeItem: (key: string) => localStorage.removeItem(key),
  });
  configureApi({
    baseURL,
    credentials: 'include',
    getToken: async () => getAccessWithRefresh(baseURL),
  });
  configured = true;
}
