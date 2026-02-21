import { configureApi, configureStorage } from '@chemisttasker/shared-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSecureKey, secureGet, secureRemove, secureRemoveMany, secureSet } from '../utils/secureStorage';
import { Buffer } from 'buffer';

let refreshPromise: Promise<string | null> | null = null;

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    return typeof parsed?.exp === 'number' ? parsed.exp : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string, leewaySeconds = 30): boolean {
  const exp = decodeJwtExp(token);
  // If we cannot decode exp, treat as expired so refresh flow is used.
  if (!exp) return true;
  return Date.now() + leewaySeconds * 1000 >= exp * 1000;
}

async function getAccessWithRefresh(baseURL: string): Promise<string | null> {
  const existing = await secureGet('ACCESS_KEY');
  const refresh = await secureGet('REFRESH_KEY');

  if (!refresh) {
    return existing;
  }

  if (existing && !isTokenExpired(existing)) {
    return existing;
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
      if (!nextAccess) {
        throw new Error('Refresh response missing access token');
      }
      await secureSet('ACCESS_KEY', nextAccess);
      await secureSet('REFRESH_KEY', nextRefresh);
      return nextAccess as string;
    } catch {
      // Refresh failed: clear persisted auth to avoid permission-error loops with stale access.
      await secureRemoveMany(['ACCESS_KEY', 'REFRESH_KEY']).catch(() => null);
      await AsyncStorage.removeItem('user').catch(() => null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Configure shared-core to use mobile storage and API endpoint
configureStorage({
  getItem: (key: string) => (isSecureKey(key) ? secureGet(key) : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) => (isSecureKey(key) ? secureSet(key, value) : AsyncStorage.setItem(key, value)),
  removeItem: (key: string) => (isSecureKey(key) ? secureRemove(key) : AsyncStorage.removeItem(key)),
});
const baseURL = process.env.EXPO_PUBLIC_API_URL?.trim();
if (!baseURL) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set. Please set it to your backend base URL (e.g., https://yourdomain.com/api).'
  );
}
configureApi({
  baseURL,
  getToken: async () => {
    return await getAccessWithRefresh(baseURL);
  },
});
