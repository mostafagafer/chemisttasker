import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api';

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: {
  resolve: (value: AxiosResponse) => void;
  reject: (error: unknown) => void;
  config: RetryConfig;
}[] = [];

function processQueue(error: unknown) {
  failedQueue.forEach((pending) => {
    if (error) {
      pending.reject(error);
      return;
    }
    api(pending.config).then(pending.resolve).catch(pending.reject);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const original = err.config as RetryConfig;
    if (err.response?.status === 401 && !original?._retry) {
      original._retry = true;
      if (isRefreshing) {
        return new Promise<AxiosResponse>((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: original });
        });
      }
      isRefreshing = true;
      return new Promise<AxiosResponse>((resolve, reject) => {
        axios
          .post(`${API_BASE_URL}${API_ENDPOINTS.refresh}`, {}, { withCredentials: true })
          .then(() => {
            processQueue(null);
            resolve(api(original));
          })
          .catch((refreshErr) => {
            processQueue(refreshErr);
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
