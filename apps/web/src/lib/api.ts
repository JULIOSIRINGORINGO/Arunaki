// Centralized API configuration
// In development: Vite proxy forwards /api → http://localhost:3000
// In production: reverse proxy (nginx) does the same
// In Electron: also works because BrowserWindow loads http://127.0.0.1:5173

export const API_BASE = "/api/v1";
