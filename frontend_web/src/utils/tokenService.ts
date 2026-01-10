// src/utils/tokenService.ts

const ACCESS_TOKEN_KEY = 'access';
const REFRESH_TOKEN_KEY = 'refresh';
const USER_KEY = 'user'; // <-- ADD THIS LINE
export const AUTH_TOKENS_CLEARED_EVENT = 'auth:tokens-cleared';

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
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY); // <-- ENSURE THIS CLEARS THE USER AS WELL!
  window.dispatchEvent(new Event(AUTH_TOKENS_CLEARED_EVENT));
}
