import { createContext, useContext, useState, type ReactNode } from 'react';
import { authApi, type AuthResponse } from '../api/auth';

interface AuthState {
  token: string | null;
  email: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [email, setEmail] = useState<string | null>(localStorage.getItem('email'));

  const handleAuth = (data: AuthResponse) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('email', data.email);
    setToken(data.token);
    setEmail(data.email);
  };

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    handleAuth(res.data);
  };

  const register = async (email: string, password: string) => {
    const res = await authApi.register({ email, password, confirmPassword: password });
    handleAuth(res.data);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    setToken(null);
    setEmail(null);
  };

  return (
    <AuthContext.Provider value={{ token, email, isAuthenticated: !!token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
