import { useState, type ReactNode } from 'react';
import { authApi, type AuthResponse } from '../api/auth';
import { AuthContext } from './auth-context';

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
    const currentToken = localStorage.getItem('token');

    localStorage.removeItem('token');
    localStorage.removeItem('email');
    setToken(null);
    setEmail(null);

    // Abmelden im Browser allein wirft nur den localStorage weg - das ausgestellte Token bliebe
    // bis zum Ablauf gueltig. Dieser Aufruf dreht serverseitig den SecurityStamp weiter und macht
    // es damit sofort ungueltig. Bewusst ohne await: die Oberflaeche ist bereits abgemeldet, und
    // ein Netzfehler oder ein bereits abgelaufenes Token darf das nicht aufhalten.
    if (currentToken) {
      authApi.logout(currentToken).catch(() => undefined);
    }
  };

  return (
    <AuthContext.Provider value={{ token, email, isAuthenticated: !!token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
