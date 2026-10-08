const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const getStoredAuth = () => {
  try { return JSON.parse(localStorage.getItem('personalTrackerAuth') || 'null'); }
  catch { return null; }
};

export const setStoredAuth = (auth) => localStorage.setItem('personalTrackerAuth', JSON.stringify(auth));
export const clearStoredAuth = () => localStorage.removeItem('personalTrackerAuth');
let refreshPromise = null;

async function parseResponse(response) {
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const message = body?.message || body?.error || body?.detail || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function sendRequest(path, options, auth) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (auth?.access_token) headers.set('Authorization', `Bearer ${auth.access_token}`);
  if (auth?.sessionId) headers.set('sessionId', auth.sessionId);
  return parseResponse(await fetch(`${API_BASE_URL}${path}`, { ...options, headers }));
}

function dispatchAuthEvent(name, detail) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function refreshAuth(auth) {
  const latestAuth = getStoredAuth();
  if (latestAuth?.access_token && latestAuth.access_token !== auth?.access_token) return latestAuth;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const headers = new Headers();
      if (auth?.access_token) headers.set('Authorization', `Bearer ${auth.access_token}`);
      if (auth?.sessionId) headers.set('sessionId', auth.sessionId);
      const result = await parseResponse(await fetch(`${API_BASE_URL}/auth/v1/refresh_token`, { method: 'GET', headers }));
      if (!result?.access_token) throw new Error('Token refresh did not return an access token.');
      const refreshedAuth = { ...auth, ...result };
      setStoredAuth(refreshedAuth);
      dispatchAuthEvent('personal-tracker-auth-refreshed', refreshedAuth);
      return refreshedAuth;
    })();
  }
  try {
    return await refreshPromise;
  } catch (error) {
    clearStoredAuth();
    dispatchAuthEvent('personal-tracker-auth-expired');
    throw error;
  } finally {
    refreshPromise = null;
  }
}

export async function apiRequest(path, options = {}, authOverride = null) {
  const auth = authOverride || getStoredAuth();
  try {
    return await sendRequest(path, options, auth);
  } catch (error) {
    if (error.status !== 401 || !auth?.access_token || path.startsWith('/auth/')) throw error;
    let refreshedAuth;
    try {
      refreshedAuth = await refreshAuth(auth);
    } catch {
      throw error;
    }
    try {
      return await sendRequest(path, options, refreshedAuth);
    } catch (retryError) {
      if (retryError.status === 401) {
        clearStoredAuth();
        dispatchAuthEvent('personal-tracker-auth-expired');
      }
      throw retryError;
    }
  }
}

export const signIn = (email, password) => apiRequest('/auth/v1/sign_in', { method: 'POST', body: JSON.stringify({ email, password }) }, null);
export const refreshToken = (auth) => refreshAuth(auth);
export const signOut = () => apiRequest('/auth/v1/sign_out', { method: 'DELETE' });

export const usersApi = {
  list: (params = {}) => apiRequest(`/api/v1/users?${new URLSearchParams(params)}`),
  create: (payload) => apiRequest('/api/v1/users', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) => apiRequest(`/api/v1/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  status: (id, is_active) => apiRequest(`/api/v1/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),
  changePassword: (payload) => apiRequest('/api/v1/users/change_password', { method: 'PATCH', body: JSON.stringify(payload) })
};

export const lookupsApi = {
  list: (params = {}) => apiRequest(`/api/v1/lookups?${new URLSearchParams(params)}`),
  create: (payload) => apiRequest('/api/v1/lookups', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) => apiRequest(`/api/v1/lookups/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id) => apiRequest(`/api/v1/lookups/${id}`, { method: 'DELETE' })
};

export const transactionsApi = {
  list: (payload = {}) => apiRequest('/api/v1/transactions', { method: 'QUERY', body: JSON.stringify(payload) }),
  create: (payload) => apiRequest('/api/v1/transactions', { method: 'POST', body: JSON.stringify(payload) }),
  get: (id) => apiRequest(`/api/v1/transactions/${id}`),
  update: (id, payload) => apiRequest(`/api/v1/transactions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id) => apiRequest(`/api/v1/transactions/${id}`, { method: 'DELETE' }),
  summary: (payload) => apiRequest('/api/v1/transactions/summary', { method: 'QUERY', body: JSON.stringify(payload) })
};

export { API_BASE_URL };
