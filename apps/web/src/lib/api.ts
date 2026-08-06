// Centralized API configuration
// In development: Vite proxy forwards /api → http://localhost:3000
// In production: reverse proxy (nginx) does the same
// In Electron: also works because BrowserWindow loads http://127.0.0.1:5173

export const API_BASE = "/api/v1";

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const apiKey = import.meta.env.VITE_ARUNAKI_API_KEY;
  const headers = new Headers(init?.headers);
  if (apiKey) {
    headers.set('x-api-key', apiKey);
  }
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers });
}
