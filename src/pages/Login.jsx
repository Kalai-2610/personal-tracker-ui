import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

const validEmail = /^(Administrator|[^\s@]+@[^\s@]+\.[^\s@]+)$/;
export default function Login({ theme, onToggleTheme }) {
  const { isAuthenticated, login, loading } = useAuth();
  const navigate = useNavigate(); const location = useLocation();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  if (isAuthenticated) return <Navigate to={location.state?.from?.pathname || '/home'} replace />;
  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (!validEmail.test(email.trim())) return setError('Enter a valid email address.');
    if (!password) return setError('Password is required.');
    try { const result = await login(email.trim(), password); navigate(result.isSystem ? '/users' : '/home', { replace: true }); }
    catch (err) { setError(err.message || 'Unable to sign in.'); }
  };
  return <div className="login-page">
    <ThemeToggle theme={theme} onToggle={onToggleTheme}/>
    <div className="login-card">
      <h1>Personal Tracker</h1>
      <form onSubmit={submit} noValidate>
        <label>Email<input autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email"/></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"/></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-btn" disabled={loading}>{loading ? 'Signing In…' : 'Sign In'}</button>
      </form>
    </div>
  </div>;
}
