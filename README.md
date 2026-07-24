# Arunaki

**Autonomous Workspace AI** - AI Assistant & Workspace Agent untuk pekerjaan berbasis dokumen.

## Features

- **AI Assistant** - Percakapan umum, brainstorming, writing, translation
- **Workspace Agent** - Memahami seluruh workspace, membuat laporan & artifact secara otomatis
- **Document Parsing** - PDF, DOCX, XLSX, CSV, TXT, Markdown
- **Smart Planning** - AI memecah Goal menjadi Task yang manageable

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, Tailwind CSS, shadcn/ui |
| Backend | NestJS 11, TypeScript |
| Database | SQLite + Prisma ORM |
| AI | OpenRouter (OpenAI Compatible) |
| Testing | Vitest, Playwright |

## Prerequisites

- [Node.js](https://nodejs.org/) v20+ 
- npm

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/JULIOSIRINGORINGO/Arunaki.git
cd Arunaki
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` and add your API key:

```env
AI_API_KEY=your-api-key-here
AI_MODEL=nvidia/nemotron-3-ultramot-550b-a55b:free
```

### 4. Setup Database

```bash
npx prisma db push
```

### 5. Run Development Server

```bash
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

## Project Structure

```
Arunaki/
├── apps/
│   ├── api/                # NestJS Backend
│   │   ├── prisma/         # Database schema
│   │   ├── src/            # Source code
│   │   └── .env            # Environment variables (not committed)
│   └── web/                # React + Vite Frontend
│       ├── src/
│       └── vite.config.ts
├── .env.example            # Template environment
├── ARCHITECTURE.md         # System architecture
├── PRD.md                  # Product requirements
├── VISION.md               # Product vision
├── UX_UI.md                # UX/UI specification
└── INTELLIGENCE.md         # AI behavior spec
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run both API & Web in dev mode |
| `npm run dev:api` | Run API only |
| `npm run dev:web` | Run Web only |
| `npm run build` | Build both apps |
| `npm run test` | Run API tests |
| `npm run lint` | Lint API code |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend API port | `3000` |
| `DATABASE_URL` | SQLite database path | `file:./dev.db` |
| `AI_PROVIDER` | AI provider (openrouter/openai) | `openrouter` |
| `AI_API_KEY` | API key for AI provider | - |
| `AI_BASE_URL` | AI API base URL | `https://openrouter.ai/api/v1` |
| `AI_MODEL` | AI model to use | `nvidia/nemotron-3-ultra-550b-a55b:free` |
| `STORAGE_PATH` | Local storage path | `./storage` |
| `LOG_LEVEL` | Logging level | `info` |

## Documentation

- [VISION.md](VISION.md) - Product vision & philosophy
- [PRD.md](PRD.md) - Product Requirements Document
- [UX_UI.md](UX_UI.md) - UX/UI specification
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [INTELLIGENCE.md](INTELLIGENCE.md) - AI behavior specification

## License

MIT
