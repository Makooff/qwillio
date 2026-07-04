import axios from 'axios';

const rawUrl = (import.meta.env.VITE_API_URL || 'https://qwillio.onrender.com').replace(/\/$/, '');
const baseURL = rawUrl.endsWith('/api') ? rawUrl : `${rawUrl}/api`;

const api = axios.create({
  baseURL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    ...(import.meta.env.DEV ? { 'ngrok-skip-browser-warning': 'true' } : {}),
  },
});

// Interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to handle 401 errors — clear token, let React route guards handle redirect
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/register' && path !== '/auth/confirm') {
        localStorage.removeItem('token');
        // Don't hard-redirect — let React Router handle it via checkAuth / route guards
      }
    }
    return Promise.reject(error);
  }
);

export default api;
