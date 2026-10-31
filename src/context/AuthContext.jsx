import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearStoredAuth, getStoredAuth, refreshToken, setStoredAuth, signIn, signOut as apiSignOut } from '../services/api';
import { clearStoredEncryptionKeys } from '../services/encryption';

const AuthContext = createContext(null);
const SESSION_WARNING_SECONDS = 5 * 60;

function parseExpiry(value) {
  if (!value) return null;
  const expiresAt = typeof value === 'number'
    ? (value < 1e12 ? value * 1000 : value)
    : Date.parse(value);
  return Number.isFinite(expiresAt) ? expiresAt : null;
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(getStoredAuth);
  const [loading, setLoading] = useState(false);
  const [sessionMessage, setSessionMessage] = useState('');
  const [sessionSecondsRemaining, setSessionSecondsRemaining] = useState(null);

  useEffect(() => { if (auth) setStoredAuth(auth); }, [auth]);

  useEffect(() => {
    const handleRefresh = (event) => setAuth(event.detail);
    const handleExpiry = () => {
      clearStoredAuth();
      setAuth(null);
      setSessionSecondsRemaining(null);
      setSessionMessage('Your session has expired. Please sign in again.');
    };
    window.addEventListener('personal-tracker-auth-refreshed', handleRefresh);
    window.addEventListener('personal-tracker-auth-expired', handleExpiry);
    return () => {
      window.removeEventListener('personal-tracker-auth-refreshed', handleRefresh);
      window.removeEventListener('personal-tracker-auth-expired', handleExpiry);
    };
  }, []);

  useEffect(() => {
    const expiresAt = parseExpiry(auth?._expire_on);
    if (!expiresAt) {
      setSessionSecondsRemaining(null);
      return undefined;
    }
    const expireSession = () => {
      clearStoredAuth();
      setAuth(null);
      setSessionSecondsRemaining(null);
      setSessionMessage('Your session has expired. Please sign in again.');
    };
    const updateCountdown = () => {
      const secondsRemaining = Math.ceil((expiresAt - Date.now()) / 1000);
      if (secondsRemaining <= 0) {
        expireSession();
        return;
      }
      setSessionSecondsRemaining(secondsRemaining);
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [auth]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const loginEmail = email.trim();
      const result = await signIn(loginEmail, password);
      const nextAuth = { ...result, loginEmail: result.email || result.loginEmail || loginEmail };
      clearStoredEncryptionKeys();
      setSessionMessage('');
      setSessionSecondsRemaining(null);
      setAuth(nextAuth);
      return nextAuth;
    }
    finally { setLoading(false); }
  };

  const logout = async () => {
    try { if (auth) await apiSignOut(); } catch { /* local sign-out still proceeds */ }
    setSessionMessage('');
    setSessionSecondsRemaining(null);
    clearStoredAuth(); setAuth(null);
  };

  const refresh = async () => {
    if (!auth) return null;
    const result = await refreshToken(auth);
    const next = { ...auth, ...result };
    setAuth(next); return next;
  };

  const clearSessionMessage = () => setSessionMessage('');
  const value = useMemo(() => ({
    auth,
    user: auth,
    isAuthenticated: !!auth?.access_token,
    loading,
    sessionMessage,
    sessionSecondsRemaining,
    clearSessionMessage,
    login,
    logout,
    refresh
  }), [auth, loading, sessionMessage, sessionSecondsRemaining]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
