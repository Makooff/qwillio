import { create } from 'zustand';
import api from '../services/api';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  googleLogin: (token: string, type?: 'credential' | 'token') => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

/**
 * Auth POST resilient to Render/Neon cold starts: the first request after the
 * backend slept can exceed the default 20s timeout. Retry only when no usable
 * response arrived (timeout, network error, 502-504 from the platform) —
 * these auth endpoints are idempotent so a replay is safe.
 */
async function postAuthWithWakeRetry(url: string, body: unknown) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await api.post(url, body, { timeout: 35000 });
    } catch (err) {
      const e = err as { code?: string; response?: { status?: number } };
      const status = e.response?.status;
      const retriable = !e.response || e.code === 'ECONNABORTED' || (status !== undefined && status >= 502 && status <= 504);
      lastErr = err;
      if (!retriable || attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,

  login: async (email: string, password: string) => {
    const { data } = await postAuthWithWakeRetry('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token, isLoading: false });
  },

  register: async (email: string, password: string, name: string) => {
    const { data } = await api.post('/auth/register', { email, password, name });
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token, isLoading: false });
  },

  googleLogin: async (token: string, type: 'credential' | 'token' = 'credential') => {
    const body = type === 'token' ? { access_token: token } : { credential: token };
    const { data } = await postAuthWithWakeRetry('/auth/google', body);
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');

      // Validate response is a real user object (not HTML from ngrok interstitial)
      if (!data || typeof data !== 'object' || !data.id || !data.email) {
        throw new Error('Invalid auth response');
      }

      // Save fresh JWT if returned (auto-corrects stale role in token)
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      set({ user: data, token: data.token || token, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false });
    }
  },
}));
