# PlantAI

AI-assisted plant identification and plant-care platform (responsive web, PWA-ready).

**Planning documentation lives at the repository root** (`PROJECT_PLAN.md`,
`ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, the full doc set) plus the research
log in [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md). Those documents are
the single source of truth — read `DEVELOPMENT_ROADMAP.md` before starting any
phase, and `TASKS.md` for the live task board.

## Current status

- **Phase 1 (Environment & Project Scaffold)** — scaffold complete, awaiting
  owner-side steps (GitHub push, Supabase migration application, Vercel
  deploy). See `PHASE_1_COMPLETION_REPORT.md`.

## Stack

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict)
- Tailwind CSS 4 (CSS-first tokens)
- Supabase (Postgres + Auth + Storage, Free plan) — migrations in `supabase/migrations/`
- ES modules ESLint 9 (flat config) + Prettier

## Local development (after owner env setup)

```powershell
npm install        # once
npm run dev        # http://localhost:3000
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

Environment variables: copy `.env.example` → `.env.local` (never commit it) and
fill the real values from the Supabase dashboard — details in
`ENVIRONMENT_SETUP.md` §5.
