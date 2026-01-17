import * as SecureStore from 'expo-secure-store';

const SECURE_KEYS = new Set(['ACCESS_KEY', 'REFRESH_KEY']);

export const isSecureKey = (key: string) => SECURE_KEYS.has(key);

export const secureGet = (key: string) => SecureStore.getItemAsync(key);

export const secureSet = (key: string, value: string) => SecureStore.setItemAsync(key, value);

export const secureRemove = (key: string) => SecureStore.deleteItemAsync(key);

export const secureRemoveMany = async (keys: string[]) => {
  await Promise.all(keys.map((key) => secureRemove(key)));
};
