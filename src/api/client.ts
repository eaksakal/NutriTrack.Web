import axios from 'axios';

// `??` und NICHT `||`: Ein LEERER String ist der beabsichtigte Produktionswert (Dockerfile,
// docker-compose.yml und .env.example setzen VITE_API_URL bewusst leer) und bedeutet
// "same origin, relative Pfade" — die API liefert die SPA selbst aus. Mit `||` waere der leere
// String falsy gewesen und das Produktions-Bundle haette fest auf die Entwickler-URL
// https://localhost:7209 gezeigt, also auf den Rechner des Besuchers.
// Der Entwicklungswert steht ausschliesslich in NutriTrack.Web/.env (VITE_API_URL=https://localhost:7209),
// die per .dockerignore nicht in den Build-Kontext gelangt.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Ein 401 auf dem Anmeldeweg selbst ist eine FACHLICHE Antwort ("Passwort falsch"), kein
// abgelaufenes Token. Wuerde der Interceptor auch dort umleiten, loeste die Zuweisung an
// window.location einen vollstaendigen Reload aus und die gerade gesetzte Fehlermeldung der
// LoginPage verschwaende — der Nutzer saehe ein leeres Formular ohne jede Rueckmeldung und
// probierte blind weiter (bis in die Identity-Lockout-Sperre, denn /login zaehlt Fehlversuche).
const AUTH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/logout'];

const isAuthRequest = (url?: string) =>
  !!url && AUTH_PATHS.some((path) => url.startsWith(path) || url.includes(path));

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest(error.config?.url)) {
      localStorage.removeItem('token');
      // Schon auf der Anmeldeseite: ein Reload wuerde nur den Zustand der Seite wegwerfen.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
