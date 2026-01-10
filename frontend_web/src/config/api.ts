import { configureApi, configureStorage } from '@chemisttasker/shared-core';
import { getAccessToken, getRefreshToken, setTokens, clearTokens, isTokenExpired } from '../utils/tokenService';

let configured = false;
let refreshPromise: Promise<string | null> | null = null;

async function getAccessWithRefresh(baseURL: string) {
  const existing = getAccessToken();
  if (existing && !isTokenExpired(existing)) return existing;

  const refresh = getRefreshToken();
  if (!refresh) {
    if (existing) {
      clearTokens();
    }
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${baseURL}/users/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!response.ok) {
        throw new Error(`Refresh failed with status ${response.status}`);
      }
      const data = await response.json().catch(() => ({}));
      const nextAccess = data.access;
      const nextRefresh = data.refresh ?? refresh;
      if (nextAccess) {
        setTokens(nextAccess, nextRefresh);
        return nextAccess;
      }
    } catch (err) {
      console.error('Failed to refresh token for shared-core', err);
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
    getToken: async () => getAccessWithRefresh(baseURL),
  });
  configured = true;
}
