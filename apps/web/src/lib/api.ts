// Centralized API configuration
// Vite proxy forwards /api → http://localhost:4096 (OpenCode engine)

export const API_BASE = "/api";

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const apiKey = import.meta.env.VITE_ARUNAKI_API_KEY || 'arunaki-dev-key';
  const headers = new Headers(init?.headers);
  if (apiKey) {
    headers.set('x-api-key', apiKey);
  }
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers });
}
