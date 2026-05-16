# ZivaBI

> Intelligent finance and operations automation platform — zero manual work, 100% automation.

ZivaBI is a multi-tenant SaaS BI platform serving both **individuals** (personal finance) and **businesses** (full ERP-style finance and operations). Same codebase, two distinct experiences determined by account type.

## Current Status

**Milestone 1 — Foundation deployed.** Monorepo scaffold committed, auto-deploy pipeline configured on Render. No application features yet.

See `docs/MASTER_CONTEXT.md` for the complete project context, build plan, and status.

## Repository Structure

```
ziva-bi/
├── frontend/    Next.js 15 + TailwindCSS + ShadCN UI
├── backend/     Python 3.12 + FastAPI + PostgreSQL
├── docs/        PRDs and architecture documents
└── render.yaml  Render deployment config
```

## Tech Stack

- **Frontend:** Next.js 15 (App Router), React 19, TailwindCSS v4, ShadCN UI, TypeScript strict
- **Backend:** FastAPI, SQLAlchemy (async), Alembic, Pydantic, asyncpg
- **Database:** PostgreSQL (Render managed)
- **File Storage:** Cloudflare R2
- **Deployment:** Render — GitHub push triggers auto-deploy for both services

## Quick Start (local dev)

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # fill in DATABASE_URL
uvicorn app.main:app --reload --port 8000
# API docs: http://localhost:8000/api/docs
```

### Frontend
```bash
cd frontend
cp .env.example .env.local       # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
# App: http://localhost:3000
```

## Deployment

Render is configured via `render.yaml`. Every push to `main` triggers an automatic deploy of both services and runs `alembic upgrade head` before starting the backend.

Environment variables (secrets) are managed in the Render dashboard — nothing sensitive is stored in this repo.

## Documentation

All product requirements, architecture decisions, and working context live in `docs/`. Start with:

1. `docs/MASTER_CONTEXT.md` — what ZivaBI is, who it's for, current status
2. `docs/MASTER_INSTRUCTION.md` — coding standards and working rules
3. `docs/MASTER_SYSTEM_SUMMARY.md` — architecture overview and build plan
