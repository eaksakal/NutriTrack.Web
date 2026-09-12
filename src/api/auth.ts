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

  // Das Token wird ausdruecklich mitgegeben, statt es dem Request-Interceptor aus dem
  // localStorage lesen zu lassen: der Aufrufer raeumt den localStorage sofort auf, und
  // Interceptoren laufen erst im Promise-Durchlauf danach - der Aufruf ginge dann ohne
  // Authorization-Header raus und wuerde den Token serverseitig nie entwerten.
  logout: (token: string) =>
    client.post<void>('/api/auth/logout', null, {
      headers: { Authorization: `Bearer ${token}` },
    }),
};
