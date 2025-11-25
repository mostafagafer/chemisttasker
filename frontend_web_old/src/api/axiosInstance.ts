// src/api/axiosInstance.ts

import axios, {
    AxiosResponse,
    InternalAxiosRequestConfig
  } from 'axios';
  import {
    API_BASE_URL,
    API_ENDPOINTS
  } from '../constants/api';
  
  // Storage keys
  const ACCESS_KEY  = 'access';
  const REFRESH_KEY = 'refresh';
  const TS_KEY      = 'token_timestamp';
  
  // Helpers to get/set tokens
  function getAccessToken() {
    return localStorage.getItem(ACCESS_KEY);
  }
  function getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY);
  }
  function setAccessToken(token: string) {
    localStorage.setItem(ACCESS_KEY, token);
    localStorage.setItem(TS_KEY, Date.now().toString());
  }
  function setRefreshToken(token: string) {
    localStorage.setItem(REFRESH_KEY, token);
  }
  
  interface RetryConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
  }
  
  // Create instance
  const api = axios.create({ baseURL: API_BASE_URL });
  
  // Attach bearer token to every request
  api.interceptors.request.use(
    config => {
      const token = getAccessToken();
      if (token) {
        config.headers = config.headers ?? {};
        (config.headers as any).Authorization = `Bearer ${token}`;
      }
      return config;
    },
    err => Promise.reject(err)
  );
  
  // Refresh logic
  let isRefreshing = false;
  let failedQueue: {
    resolve: (value: AxiosResponse) => void;
    reject: (error: any) => void;
    config: RetryConfig;
  }[] = [];
  
  function processQueue(error: any, newToken: string | null = null) {
    failedQueue.forEach(prom => {
      if (error) prom.reject(error);
      else {
        prom.config.headers = prom.config.headers ?? {};
        (prom.config.headers as any).Authorization = `Bearer ${newToken}`;
        api(prom.config).then(prom.resolve).catch(prom.reject);
      }
    });
    failedQueue = [];
  }
  
  api.interceptors.response.use(
    res => res,
    err => {
      const original = err.config as RetryConfig;
      if (
        err.response?.status === 401 &&
        !original._retry &&
        getRefreshToken()
      ) {
        original._retry = true;
        if (isRefreshing) {
          return new Promise<AxiosResponse>((resolve, reject) => {
            failedQueue.push({ resolve, reject, config: original });
          });
        }
        isRefreshing = true;
        return new Promise<AxiosResponse>((resolve, reject) => {
          axios
            .post(`${API_BASE_URL}${API_ENDPOINTS.refresh}`, {
              refresh: getRefreshToken()!
            })
            .then(({ data }) => {
              setAccessToken(data.access);
              setRefreshToken(data.refresh);
              processQueue(null, data.access);
              original.headers = original.headers ?? {};
              (original.headers as any).Authorization = `Bearer ${data.access}`;
              resolve(api(original));
            })
            .catch(refreshErr => {
              processQueue(refreshErr, null);
              reject(refreshErr);
            })
            .finally(() => {
              isRefreshing = false;
            });
        });
      }
      return Promise.reject(err);
    }
  );
  
  export default api;
  