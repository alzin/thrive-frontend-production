// frontend/src/services/authService.ts
import api from './api';

interface LoginResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  csrfToken: string;
}

interface CheckAuthResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async register(email: string, stripePaymentIntentId: string): Promise<void> {
    await api.post('/auth/register', { email, stripePaymentIntentId });
  },

  async refresh(): Promise<LoginResponse> {
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  async checkAuth(): Promise<CheckAuthResponse> {
    try {
      const response = await api.get('/auth/check');
      return response.data;
    } catch (error) {
      return { authenticated: false };
    }
  },
};