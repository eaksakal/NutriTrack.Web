import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Login fehlgeschlagen. Bitte prüfe deine Zugangsdaten.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Login</h1>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>
            E-Mail
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <label>
            Passwort
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Wird eingeloggt...' : 'Einloggen'}
          </button>
        </form>
        <p className="auth-switch">
          Noch kein Konto? <Link to="/register">Registrieren</Link>
        </p>
      </div>
    </div>
  );
}
