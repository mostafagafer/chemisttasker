import { Platform } from 'react-native';

type SslPinningInitializer = (config: Record<string, { includeSubdomains?: boolean; publicKeyHashes: string[] }>) => Promise<void>;

const normalizeApiBaseUrl = (value?: string) => {
  const trimmed = (value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const PINNING_ENABLED = process.env.EXPO_PUBLIC_SSL_PINNING_ENABLED;
const PUBLIC_KEY_HASHES = (process.env.EXPO_PUBLIC_SSL_PINNED_PUBLIC_KEY_HASHES || '')
  .split(',')
  .map((hash) => hash.trim())
  .filter(Boolean);

let initPromise: Promise<void> | null = null;

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');
}

function isPrivateIp(hostname: string): boolean {
  return /^(10\.|127\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(hostname);
}

function shouldEnablePinning(hostname: string, protocol: string): boolean {
  if (Platform.OS === 'web' || __DEV__) {
    return false;
  }
  if (PINNING_ENABLED === 'false') {
    return false;
  }
  if (protocol !== 'https:' || isLocalHost(hostname) || isPrivateIp(hostname)) {
    return false;
  }
  return PUBLIC_KEY_HASHES.length > 0;
}

export async function initializeMobileSslPinning(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const baseURL = normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
    if (!baseURL) {
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(baseURL);
    } catch {
      console.warn('SSL pinning skipped: invalid EXPO_PUBLIC_API_URL');
      return;
    }

    if (!shouldEnablePinning(parsed.hostname, parsed.protocol)) {
      if (!__DEV__ && parsed.protocol === 'https:' && !isLocalHost(parsed.hostname) && !isPrivateIp(parsed.hostname) && PUBLIC_KEY_HASHES.length === 0) {
        console.warn('SSL pinning skipped: EXPO_PUBLIC_SSL_PINNED_PUBLIC_KEY_HASHES is not configured.');
      }
      return;
    }

    try {
      const pinningModule = require('react-native-ssl-public-key-pinning') as {
        initializeSslPinning?: SslPinningInitializer;
      };
      if (typeof pinningModule.initializeSslPinning !== 'function') {
        console.warn('SSL pinning skipped: native pinning module is unavailable.');
        return;
      }

      await pinningModule.initializeSslPinning({
        [parsed.hostname]: {
          includeSubdomains: true,
          publicKeyHashes: PUBLIC_KEY_HASHES,
        },
      });
    } catch (error) {
      console.error('SSL pinning initialization failed', error);
      throw error;
    }
  })();

  return initPromise;
}
