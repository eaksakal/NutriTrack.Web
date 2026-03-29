import client from './client';

export interface AuthResponse {
  token: string;
  expiresAt: string;
  email: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export const authApi = {
  register: (data: RegisterRequest) =>
    client.post<AuthResponse>('/api/auth/register', data),

  login: (data: LoginRequest) =>
    client.post<AuthResponse>('/api/auth/login', data),

  me: () => client.get<{ userId: string; email: string }>('/api/auth/me'),
};
