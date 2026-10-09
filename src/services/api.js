import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const getStoredAuth = () => {
  try { return JSON.parse(localStorage.getItem('personalTrackerAuth') || 'null'); }
  catch { return null; }
};

export const setStoredAuth = (auth) => localStorage.setItem('personalTrackerAuth', JSON.stringify(auth));
export const clearStoredAuth = () => localStorage.removeItem('personalTrackerAuth');
let refreshPromise = null;

const apiClient = axios.create({ baseURL: API_BASE_URL });

function normalizeHeaders(headers = {}) {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  return { ...headers };
}

function normalizeBody(body) {
  if (!body || body instanceof FormData) return body;
  if (typeof body !== 'string') return body;
  try { return JSON.parse(body); } catch { return body; }
}

function normalizeAxiosError(error) {
  if (!axios.isAxiosError(error)) throw error;
  const body = error.response?.data;
  const message = body?.message || body?.error || body?.detail || error.message || `Request failed (${error.response?.status || 'network'})`;
  const normalized = new Error(message);
  normalized.status = error.response?.status;
  normalized.body = body;
  throw normalized;
}

async function sendRequest(path, options, auth) {
  const data = normalizeBody(options.body);
  const headers = normalizeHeaders(options.headers);
  if (data && !(data instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (auth?.access_token) headers.Authorization = `Bearer ${auth.access_token}`;
  if (auth?.sessionId) headers.sessionId = auth.sessionId;
  try {
    const response = await apiClient.request({ url: path, method: options.method || 'GET', headers, data });
    return response.data;
  } catch (error) {
    normalizeAxiosError(error);
  }
}

function dispatchAuthEvent(name, detail) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function refreshAuth(auth) {
  const latestAuth = getStoredAuth();
  if (latestAuth?.access_token && latestAuth.access_token !== auth?.access_token) return latestAuth;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const headers = {};
      if (auth?.access_token) headers.Authorization = `Bearer ${auth.access_token}`;
      if (auth?.sessionId) headers.sessionId = auth.sessionId;
      let result;
      try {
        const response = await apiClient.get('/auth/v1/refresh_token', { headers });
        result = response.data;
      } catch (error) {
        normalizeAxiosError(error);
      }
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
  list: (payload = {}) => apiRequest('/api/v1/transactions/list', { method: 'POST', body: JSON.stringify(payload) }),
  create: (payload) => apiRequest('/api/v1/transactions', { method: 'POST', body: JSON.stringify(payload) }),
  get: (id) => apiRequest(`/api/v1/transactions/${id}`),
  update: (id, payload) => apiRequest(`/api/v1/transactions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id) => apiRequest(`/api/v1/transactions/${id}`, { method: 'DELETE' }),
  summary: (payload) => apiRequest('/api/v1/transactions/summary', { method: 'POST', body: JSON.stringify(payload) })
};

export { API_BASE_URL };
