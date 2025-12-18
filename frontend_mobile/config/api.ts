import { configureApi, configureStorage } from '@chemisttasker/shared-core';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure shared-core to use mobile storage and API endpoint
configureStorage({
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
});
configureApi({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.104:8000/api',
  getToken: async () => {
    return await AsyncStorage.getItem('ACCESS_KEY');
  },
});
