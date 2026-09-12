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
          <nav className="nav">
            <Link to="/">Dashboard</Link>
            <Link to="/search">Suche</Link>
            <Link to="/goals">Ziele</Link>
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
