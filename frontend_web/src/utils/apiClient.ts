// src/utils/apiClient.ts
import axios, {
    AxiosError,
    AxiosResponse,
    InternalAxiosRequestConfig
  } from 'axios';
  import { getAccessToken, clearTokens } from './tokenService';
  import { API_BASE_URL } from '../constants/api';
  
  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});
  
  // Request interceptor uses the internal config type:
  apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getAccessToken();
      if (token) {
        // Ensure headers object exists
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    }
  );
  
  // Response interceptor remains unchanged
  apiClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        clearTokens();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );
  
  export default apiClient;
  