import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { email, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">NutriTrack</Link>
          {/* Keine Seitennavigation mehr: Eintragen, Suchen und Ziele liegen im Overlay des
              Dashboards, das ueber das "+" aufgeht. Die Routen /ai, /search und /goals bleiben
              erreichbar, damit Lesezeichen und Deep-Links weiter funktionieren - sie sind hier
              nur nicht mehr verlinkt. */}
          <nav className="nav">
            <span className="user-email">{email}</span>
            <button onClick={handleLogout} className="btn-logout">Logout</button>
          </nav>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
