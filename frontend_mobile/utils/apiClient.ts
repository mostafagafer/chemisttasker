// utils/apiClient.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureGet, secureRemoveMany, secureSet } from './secureStorage';

// Prefer an env-driven base URL so the app can talk to the backend from devices/emulators.
// Set EXPO_PUBLIC_API_URL for Expo (e.g. http://192.168.1.10:8000/api).
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.trim();

if (!API_BASE_URL) {
    // Fail fast in development so we don't silently point to localhost on devices.
    // Configure EXPO_PUBLIC_API_URL in your env (e.g., .env or project settings).
    throw new Error(
        'EXPO_PUBLIC_API_URL is not set. Please set it to your backend base URL (e.g., http://192.168.x.x:8000/api).'
    );
}

// Create axios instance
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    async (config) => {
        try {
            const token = await secureGet('ACCESS_KEY');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.error('Error getting token:', error);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling and token refresh
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If 401 and we haven't retried yet, try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = await secureGet('REFRESH_KEY');
                if (refreshToken) {
                    const response = await axios.post(`${API_BASE_URL}/users/token/refresh/`, {
                        refresh: refreshToken,
                    });

                    const { access, refresh, user } = response.data || {};
                    await secureSet('ACCESS_KEY', access);
                    // Preserve refresh rotation from backend (SIMPLE_JWT ROTATE_REFRESH_TOKENS=True).
                    if (refresh) {
                        await secureSet('REFRESH_KEY', refresh);
                    }
                    if (user) {
                        await AsyncStorage.setItem('user', JSON.stringify(user));
                    }

                    // Retry original request with new token
                    originalRequest.headers.Authorization = `Bearer ${access}`;
                    return apiClient(originalRequest);
                }
            } catch (refreshError) {
                // Only clear auth on confirmed invalid/expired token responses.
                const status = (refreshError as any)?.response?.status;
                const code = (refreshError as any)?.response?.data?.code;
                const shouldClear =
                    status === 401 ||
                    status === 403 ||
                    (status === 400 && code === 'token_not_valid');
                if (shouldClear) {
                    await secureRemoveMany(['ACCESS_KEY', 'REFRESH_KEY']);
                    await AsyncStorage.removeItem('user');
                }
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;
