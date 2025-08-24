// frontend/src/services/api.ts

import axios from 'axios';
import { store } from '../store/store';
import { logout, setCSRFToken } from '../store/slices/authSlice';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for cookies
});

// ---------- CSRF Token Setup in Request Interceptor ----------
api.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const csrfToken = state.auth.csrfToken;

    if (
      csrfToken &&
      !['GET', 'HEAD', 'OPTIONS'].includes(config.method?.toUpperCase() || '')
    ) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ---------- Token Refresh Coordination ----------
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// ---------- Response Interceptor with Token Refresh Logic ----------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if response is 401 and hasn't been retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // First request to refresh the token
      if (!isRefreshing) {
        isRefreshing = true;

        try {
          const response = await axios.post(
            `${API_URL}/auth/refresh`,
            {},
            { withCredentials: true }
          );

          const newCsrfToken = response.data.csrfToken;

          // Save the new CSRF token in the store
          store.dispatch(setCSRFToken(newCsrfToken));

          // Notify all subscribers waiting for the refresh
          onRefreshed(newCsrfToken);

          return api(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          refreshSubscribers = [];

          // Redirect to login
          store.dispatch(logout());
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // If a refresh is already in progress, wait for it to finish
      return new Promise((resolve) => {
        subscribeTokenRefresh((newCsrfToken: string) => {
          originalRequest.headers['X-CSRF-Token'] = newCsrfToken;
          resolve(api(originalRequest));
        });
      });
    }

    return Promise.reject(error);
  }
);

export default api;
