// Thin fetch wrapper: attaches JWT, parses JSON, normalises errors
const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'taskflow_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach server. Is the backend running on port 5000?');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    tokenStore.clear();
    window.dispatchEvent(new Event('auth:logout'));
  }
  if (!res.ok) {
    const detail = Array.isArray(data.details) ? `: ${data.details.join(', ')}` : '';
    throw new Error((data.message || `Request failed (${res.status})`) + detail);
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
};
