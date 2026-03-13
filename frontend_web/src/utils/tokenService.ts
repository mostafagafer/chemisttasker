// src/utils/tokenService.ts
import axios from 'axios';
import { API_BASE_URL } from '../constants/api';

export const AUTH_TOKENS_CLEARED_EVENT = 'auth:tokens-cleared';
let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<{ access: string; refresh: string } | null> | null = null;

const decodeJwtPayload = (token: string): { exp?: number } | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export function isTokenExpired(token: string, leewaySeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  const expiresAtMs = payload.exp * 1000;
  return Date.now() + leewaySeconds * 1000 >= expiresAtMs;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  window.dispatchEvent(new Event(AUTH_TOKENS_CLEARED_EVENT));
}

export async function refreshCookieSession(force = false): Promise<{ access: string; refresh: string } | null> {
  if (!force && accessToken && !isTokenExpired(accessToken)) {
    return { access: accessToken, refresh: refreshToken ?? '' };
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/users/token/refresh/`,
        {},
        {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const data = response?.data ?? {};
      if (!data.access) {
        clearTokens();
        return null;
      }
      const nextRefresh = data.refresh ?? refreshToken ?? '';
      setTokens(data.access, nextRefresh);
      return { access: data.access, refresh: nextRefresh };
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
