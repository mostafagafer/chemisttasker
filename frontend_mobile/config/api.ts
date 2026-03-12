import { configureApi, configureStorage } from '@chemisttasker/shared-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSecureKey, secureGet, secureRemove, secureRemoveMany, secureSet } from '../utils/secureStorage';
let refreshPromise: Promise<string | null> | null = null;

async function getAccessWithRefresh(baseURL: string): Promise<string | null> {
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
        return null;
      }
      if (!response.ok) {
        throw new Error(`Refresh failed with status ${response.status}`);
      }
      const data = await response.json().catch(() => ({}));
      const nextAccess = data.access;
      if (!nextAccess) {
        throw new Error('Refresh response missing access token');
      }
      return nextAccess as string;
    } catch {
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
  credentials: 'include',
  getToken: async () => {
    return await getAccessWithRefresh(baseURL);
  },
});
