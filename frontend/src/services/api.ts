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

// Interceptor to handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const errMsg = error.response?.data?.error;
    const path = window.location.pathname;

    if (status === 401) {
      if (path !== '/login' && path !== '/register' && path !== '/auth/confirm') {
        localStorage.removeItem('token');
      }
    }

    // No client profile — backend reset onboardingCompleted, redirect to onboarding
    if (status === 404 && errMsg === 'onboarding_required' && path.startsWith('/dashboard')) {
      window.location.href = '/onboard';
    }

    return Promise.reject(error);
  }
);

export default api;
