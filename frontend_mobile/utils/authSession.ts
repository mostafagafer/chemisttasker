import AsyncStorage from '@react-native-async-storage/async-storage';

type StoredUserSession = {
  access?: string | null;
  refresh?: string | null;
  tokens?: {
    access?: string | null;
    refresh?: string | null;
  };
  user?: unknown;
};

const USER_STORAGE_KEY = 'user';
const TOKEN_REFRESH_PATH = '/users/token/refresh/';

let refreshPromise: Promise<string | null> | null = null;
let inMemorySession: StoredUserSession | null = null;

function normalizeToken(value: unknown): string | null {
  return typeof value === 'string' && value && value !== 'cookie-session' ? value : null;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(padded);
  }
  const bufferCtor = (globalThis as any).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(padded, 'base64').toString('utf-8');
  }
  throw new Error('Base64 decoder unavailable');
}

function isJwtExpired(token: string): boolean {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return true;
    }
    const parsed = JSON.parse(decodeBase64Url(payload));
    const exp = typeof parsed?.exp === 'number' ? parsed.exp : null;
    if (!exp) {
      return false;
    }
    return exp <= Math.floor(Date.now() / 1000) + 30;
  } catch {
    return true;
  }
}

export async function readStoredSession(): Promise<StoredUserSession | null> {
  if (inMemorySession) {
    return inMemorySession;
  }
  try {
    const raw = await AsyncStorage.getItem(USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    inMemorySession = JSON.parse(raw) as StoredUserSession;
    return inMemorySession;
  } catch {
    return null;
  }
}

export async function writeStoredSession(next: StoredUserSession): Promise<void> {
  const current = (await readStoredSession()) || {};
  const merged = {
    ...current,
    ...next,
    tokens: {
      access: normalizeToken(next.access ?? next.tokens?.access ?? current.access ?? current.tokens?.access),
      refresh: normalizeToken(next.refresh ?? next.tokens?.refresh ?? current.refresh ?? current.tokens?.refresh),
    },
    access: normalizeToken(next.access ?? next.tokens?.access ?? current.access ?? current.tokens?.access),
    refresh: normalizeToken(next.refresh ?? next.tokens?.refresh ?? current.refresh ?? current.tokens?.refresh),
    user: next.user ?? current.user ?? null,
  };
  inMemorySession = merged;
  await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(merged));
}

export async function clearStoredSession(): Promise<void> {
  inMemorySession = null;
  await AsyncStorage.removeItem(USER_STORAGE_KEY).catch(() => null);
}

export async function refreshAccessToken(baseURL: string): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const session = await readStoredSession();
    const refresh = normalizeToken(session?.refresh ?? session?.tokens?.refresh);
    if (!refresh) {
      return null;
    }

    try {
      const response = await fetch(`${baseURL}${TOKEN_REFRESH_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });

      if (response.status === 400 || response.status === 401) {
        await clearStoredSession();
        return null;
      }

      if (!response.ok) {
        throw new Error(`Refresh failed with status ${response.status}`);
      }

      const data = await response.json().catch(() => ({}));
      const nextAccess = normalizeToken(data.access);
      const nextRefresh = normalizeToken(data.refresh) ?? refresh;
      if (!nextAccess) {
        throw new Error('Refresh response missing access token');
      }

      await writeStoredSession({
        access: nextAccess,
        refresh: nextRefresh,
      });

      return nextAccess;
    } catch {
      await clearStoredSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function getValidAccessToken(baseURL: string): Promise<string | null> {
  const session = inMemorySession || (await readStoredSession());
  const access = normalizeToken(session?.access ?? session?.tokens?.access);
  if (access && !isJwtExpired(access)) {
    return access;
  }
  return refreshAccessToken(baseURL);
}

export function primeInMemorySession(session: StoredUserSession | null): void {
  inMemorySession = session;
}
