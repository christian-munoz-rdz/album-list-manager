# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Album List Manager ("Listen Later") — a monorepo web app for creating and sharing curated album lists. Users authenticate via Spotify OAuth, search for albums, and organize them into shareable lists with drag-and-drop reordering and personal notes.

## Commands

### Development

```bash
# Install all dependencies (root + client + server)
npm run install:all

# Start both frontend and backend concurrently
npm run dev

# Start individually
cd client && npm run dev   # Vite on port 3000
cd server && npm run dev   # ts-node-dev on port 3001
```

### Build

```bash
npm run build              # Build both workspaces
cd client && npm run build # tsc + vite
cd server && npm run build # tsc to dist/
```

### Linting

```bash
cd client && npm run lint
```

### Database

```bash
# Start PostgreSQL (Docker required)
docker-compose up -d

# Schema is auto-applied from server/src/db/schema.sql on first run
```

## Architecture

### Monorepo Layout

- `client/` — React 18 + Vite + TypeScript frontend
- `server/` — Express + TypeScript backend
- `docker-compose.yml` — PostgreSQL 16 database

### Frontend (`client/src/`)

- **`api/client.ts`** — Axios instance with all API methods; the single point of contact with the backend
- **`contexts/AuthContext.tsx`** — Auth state via React Context + React Query; wraps the whole app
- **`App.tsx`** — React Router setup with protected routes (`/dashboard`, `/lists/:id`) and public routes (`/`, `/shared/:slug`)
- **`types/index.ts`** — Shared TypeScript interfaces (User, List, Album, etc.)
- React Query (`@tanstack/react-query`) handles all server state; dnd-kit handles drag-and-drop reordering
- Tailwind uses a Spotify-themed palette: `spotify-green` (#1DB954), `spotify-black` (#191414), `spotify-dark` (#121212), `spotify-gray` (#282828)
- Vite dev server proxies `/api/*` → `http://localhost:3001`

### Backend (`server/src/`)

- **`index.ts`** — Express app with CORS, express-session (PostgreSQL-backed via connect-pg-simple), and route mounting
- **`db/index.ts`** — PostgreSQL pool + typed `query()` helper
- **`db/schema.sql`** — Single source of truth for database schema
- **`middleware/auth.ts`** — `requireAuth` middleware checks `req.session.userId`
- **`routes/`** — `auth.ts` (Spotify OAuth), `lists.ts` (list CRUD), `albums.ts` (search, add/remove, reorder, notes)
- **`services/spotify.ts`** — Spotify OAuth + API calls; **`services/lastfm.ts`** — Last.fm integration

### Auth Flow

Spotify OAuth 2.0: `GET /api/auth/spotify` → redirect to Spotify → callback at `/api/auth/spotify/callback` → session cookie set (30-day max, httpOnly). State parameter is validated against session to prevent CSRF.

### Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/spotify` | Initiate Spotify login |
| GET | `/api/auth/me` | Get current session user |
| GET | `/api/lists` | Get user's lists |
| GET | `/api/lists/shared/:slug` | Public list view |
| GET | `/api/albums/search?q=` | Search albums via Spotify |
| PUT | `/api/albums/reorder` | Drag-and-drop reorder |
| PUT | `/api/albums/note` | Add/update personal note |

## Environment Setup

Copy `.env.example` to `.env` in the project root. Required variables:

- `DATABASE_URL` — PostgreSQL connection string (default: `postgres://...@localhost:5432/listen_later`)
- `SESSION_SECRET` — Random secret for session signing
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` / `SPOTIFY_REDIRECT_URI` — From Spotify Developer Dashboard
- `LASTFM_API_KEY` — From Last.fm API account
- `FRONTEND_URL` — e.g. `http://localhost:3000`
