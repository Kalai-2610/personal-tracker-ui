import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearStoredAuth, getStoredAuth, refreshToken, setStoredAuth, signIn, signOut as apiSignOut } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(getStoredAuth);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (auth) setStoredAuth(auth); }, [auth]);

  useEffect(() => {
    const handleRefresh = (event) => setAuth(event.detail);
    const handleExpiry = () => {
      clearStoredAuth();
      setAuth(null);
    };
    window.addEventListener('personal-tracker-auth-refreshed', handleRefresh);
    window.addEventListener('personal-tracker-auth-expired', handleExpiry);
    return () => {
      window.removeEventListener('personal-tracker-auth-refreshed', handleRefresh);
      window.removeEventListener('personal-tracker-auth-expired', handleExpiry);
    };
  }, []);

  useEffect(() => {
    if (!auth?._expire_on) return undefined;
    const expiresAt = typeof auth._expire_on === 'number'
      ? (auth._expire_on < 1e12 ? auth._expire_on * 1000 : auth._expire_on)
      : Date.parse(auth._expire_on);
    if (!Number.isFinite(expiresAt)) return undefined;
    const expireSession = () => {
      clearStoredAuth();
      setAuth(null);
    };
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      expireSession();
      return undefined;
    }
    const timeout = window.setTimeout(expireSession, delay);
    return () => window.clearTimeout(timeout);
  }, [auth]);

  const login = async (email, password) => {
    setLoading(true);
    try { const result = await signIn(email, password); setAuth(result); return result; }
    finally { setLoading(false); }
  };

  const logout = async () => {
    try { if (auth) await apiSignOut(); } catch { /* local sign-out still proceeds */ }
    clearStoredAuth(); setAuth(null);
  };

  const refresh = async () => {
    if (!auth) return null;
    const result = await refreshToken(auth);
    const next = { ...auth, ...result };
    setAuth(next); return next;
  };

  const value = useMemo(() => ({ auth, user: auth, isAuthenticated: !!auth?.access_token, loading, login, logout, refresh }), [auth, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
