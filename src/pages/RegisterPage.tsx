import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiErrorMessage } from '../api/errors';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    try {
      await register(email, password);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err, 'Registrierung fehlgeschlagen.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Registrieren</h1>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>
            E-Mail
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <label>
            Passwort
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          </label>
          <label>
            Passwort bestätigen
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Wird registriert...' : 'Registrieren'}
          </button>
        </form>
        <p className="auth-switch">
          Bereits ein Konto? <Link to="/login">Einloggen</Link>
        </p>
      </div>
    </div>
  );
}
