// Centralized API configuration
// Vite proxy forwards /api → http://localhost:4096 (OpenCode engine)

export const API_BASE = "/api";

function withDirectory(url: string): string {
  if (!url.startsWith(`${API_BASE}/`)) return url;
  const folder = localStorage.getItem("arunaki_active_folder");
  if (!folder || url.includes("directory=")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}directory=${encodeURIComponent(folder)}`;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const apiKey = import.meta.env.VITE_ARUNAKI_API_KEY || "arunaki-dev-key";
  const headers = new Headers(init?.headers);
  if (apiKey) {
    headers.set("x-api-key", apiKey);
  }
  if (init?.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const resolved = typeof input === "string" ? withDirectory(input) : input;
  return fetch(resolved, { ...init, headers });
}

export function directoryQuery(): string {
  const folder = localStorage.getItem("arunaki_active_folder");
  return folder ? `?directory=${encodeURIComponent(folder)}` : "";
}
