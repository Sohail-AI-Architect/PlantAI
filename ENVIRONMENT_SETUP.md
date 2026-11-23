# PlantAI — Environment Setup Guide (Windows)

> Step-by-step local environment setup for PlantAI on Windows 10/11. Phase 0 = documentation only; no app code or dependencies exist yet. Commands below marked *future* become real at Phase 1 scaffold (see [`DEVELOPMENT_ROADMAP.md`](DEVELOPMENT_ROADMAP.md)).
> Facts about third-party quotas/pricing come from [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md); anything else **UNVERIFIED** is flagged inline.
> Related: [`PROJECT_PLAN.md`](PROJECT_PLAN.md) · [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`TASKS.md`](TASKS.md) · [`SECURITY.md`](SECURITY.md) · [`ENVIRONMENT_SETUP.md` (this file)](#)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Step-by-step Windows setup](#2-step-by-step-windows-setup)
3. [Supabase setup](#3-supabase-setup)
4. [Pl@ntNet setup](#4-plantnet-setup)
5. [Environment variables](#5-environment-variables)
6. [OpenCode usage](#6-opencode-usage)
7. [Local dev workflow (future)](#7-local-dev-workflow-future)
8. [Verification checklist](#8-verification-checklist)
9. [Common Windows issues](#9-common-windows-issues)
10. [What NOT to do now (Phase 0)](#10-what-not-to-do-now-phase-0)
11. [Next steps → Phase 1](#11-next-steps--phase-1)

---

## 1. Prerequisites

| Component | Version / note | Mandatory? | Where |
|---|---|---|---|
| Windows | 10 or 11 | Yes | — |
| Node.js | LTS, ~22.x (exact LTS version **UNVERIFIED** — confirm current LTS at Phase 1) | Yes | nodejs.org (official MSI) |
| npm | Bundled with Node 22.x | Yes | Same |
| Git | Recent stable (2.40+ reasonable) | Yes | git-scm.com |
| VS Code | Current stable | Yes (recommended IDE) | code.visualstudio.com |
| VS Code extensions | See 2.5 | Recommended | Marketplace |
| GitHub account | Free | Yes | github.com |
| OpenCode CLI | Installed per OpenCode docs (**UNVERIFIED** install method — user already has it) | Yes | opencode.ai |
| Docker | **Not required initially.** Needed only if/when Supabase local tests start (Phase 2+, per [`TESTING_PLAN.md`](TESTING_PLAN.md)) | Optional | Docker Desktop |
| Supabase CLI | Optional Phase 2+ (local DB tests); not needed for MVP dashboard-only usage | Optional | supabase.com/docs/guides/cli |

---

## 2. Step-by-step Windows setup

### 2.1 Node.js (official MSI — keep it simple)

No nvm-windows in the baseline; the project targets one Node LTS line. If you later need multiple versions, add [nvm-windows](https://github.com/coreybutler/nvm-windows) manually — out of scope here.

Install via the official installer: https://nodejs.org (choose LTS). Or with winget from an elevated PowerShell:

```powershell
# Option A (recommended, simplest): download the LTS MSI from nodejs.org and run it.
# Option B (winget, run as Administrator):
winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
```

Verify (open a NEW PowerShell window after installing):

```powershell
node -v   # expect v22.x or current LTS — confirm exact expected version at Phase 1
npm -v    # expect 10.x+ bundled
```

### 2.2 Git

```powershell
# Option A: official installer from https://git-scm.com/download/win (use defaults; enable "Git from the command line" so PATH is set)
# Option B (winget):
winget install Git.Git
```

First-run identity config (do this once, globally):

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global core.longpaths true   # avoids long-path pain on Windows (see §9)
```

Verify:

```powershell
git --version
```

### 2.3 GitHub account + PlantAI repo

1. Create/sign-in a GitHub account (free).
2. Create a new repository named **`PlantAI`** — public (per project decision; public repo, commercial-use-friendly hosting, simple CI later).
3. Initialize with a **`.gitignore` template = Node** and add a short README (one paragraph). Do NOT initialize with a license yet unless you decide one (a licensing decision is a separate [`LEGAL_AND_COMPLIANCE.md`](LEGAL_AND_COMPLIANCE.md) topic — flag it).
4. Clone locally:

```powershell
cd C:\Users\supersohail
git clone https://github.com/<your-username>/PlantAI.git
cd PlantAI
```

> Note: the repo has been cloned next to the working docs folder; if docs were written before cloning, move them into the clone before committing (the current working directory `C:\Users\supersohail\PlantAI` should BE the clone root).

### 2.4 VS Code

Install VS Code: https://code.visualstudio.com/ (or `winget install Microsoft.VisualStudioCode`), then install extensions.

### 2.5 Recommended VS Code extensions

| Extension | Why |
|---|---|
| **Tailwind CSS IntelliSense** (bradlc.vscode-tailwindcss) | Class autocompletion + class-color hints; matches Tailwind setup decided in [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| **ESLint** (dbaeumer.vscode-eslint) | Inline linting while coding; matches the Next.js eslint preset chosen in Phase 1 |
| **Prettier** (esbenp.prettier-vscode) | Optional — pick "code formatter on save" policy in Phase 1; do not have both Prettier and ESLint fight over formatting |
| Supabase VS Code extension | Optional — handy for browsing the Supabase DB locally without the dashboard; skip on zero-attention days |
| Tailwind Headwind (raw imports ordering) | Optional; only if it fits Phase 1 style rules |

Workspace settings to consider (`.vscode/settings.json`, added in Phase 1 scaffold):

```jsonc
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.workingDirectories": [{ "mode": "auto" }],
  "typescript.tsdk": "node_modules/typescript/lib"   // once node_modules exists
}
```

---

## 3. Supabase setup

Zero-budget note: per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md), Supabase Free allows **2 active free projects**. Recommendation (canonical project decision #6): **create one dev project and one prod project** — best practice, fits inside the free quota (paused projects don't count either).

1. Create a free account at https://supabase.com (magic-link or email; no payment method needed on Free).
2. **Create the dev project** — name suggestion `plantai-dev`.
   - **Choose a region near your target audience** (service latency matters for the identify call and auth). If audience is uncertain, pick the same region you'd choose for production traffic (e.g. western EU or US-east based on plant-library SEO plan) — decision documented in [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) later.
   - Record from **Project Settings → API**:
     - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
     - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (SECRET — see [`SECURITY.md`](SECURITY.md) §2)
   - Password for the DB is shown at project creation → store it if you ever need `SUPABASE_DB_URL`.
3. (Later, at Phase 5 deployment) Create a **second** project `plantai-prod` and repeat the key recording steps.
4. Enable **Email auth** in Authentication → Providers → Email → enable. This covers email/password + magic-link signup flows.
5. **Do NOT enable third-party OAuth providers in MVP** (Google OAuth is deferred per canonical project decision #1).
6. Note that Free projects **pause after ~1 week of inactivity** and there are **no automatic backups on Free** — plan manual SQL dumps during development (per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)).

> Naming convention: `plantai-*` (lowercase) so both projects are visually adjacent in the dashboard.

**Copy keys carefully** — copy vs `type`/`cat`-view and paste into `.env.local`; no manual re-typing (typos in keys are the #1 setup bug). Never paste real keys into chat, docs, or commit messages.

---

## 4. Pl@ntNet setup

1. Create an account at **https://my.plantnet.org** (one free account per person — per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md); do NOT create multiple/second accounts).
2. Generate your private API key: **Account settings → API key** (`https://my.plantnet.org/settings/api-key`).
3. Record it as `PLANTNET_API_KEY`.
4. Note the free-plan constraints (direct quotes and exact values live in [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)):
   - **500 identifications/day**, resets at midnight UTC.
   - **Errors also consume 1 credit** (since 2026-02-13) — this is why PlantAI's pre-validation is strict ([`SECURITY.md`](SECURITY.md) §5–6).
   - The key is **private**: no browser-side usage, no CORS whitelisting in PlantAI — all calls are server-side ([`SECURITY.md`](SECURITY.md) §3).
5. Keep the key out of any client code, client docs, or screenshots you share.
6. **API host (verified 2026-11-12):** identification requests target **`https://my-api.plantnet.org`** — the `my.plantnet.org` site referenced above is the account/portal/docs site, NOT the API host. Authentication is the **`api-key` query parameter**, so the key is embedded in request URLs: **full request URLs must never be logged** (`SECURITY.md` §3). No live-mode instructions are provided here — live identification stays gated on owner approval.

---

## 5. Environment variables

> **Phase 1 update (2026-11-10):** the values below reflect what was actually
> installed and verified live — Node **v24.22.0** (LTS), npm **12.2.1**, git
> **2.56**, Next.js **16.4.6**, React 19.3, Tailwind **4.3.3**, Supabase SDKs
> `@supabase/supabase-js@^2.119` + `@supabase/ssr@^0.12`. The scaffold itself
> is committed; setup sections 1–2 below remain the historical reference.

### 5.1 Canonical inventory

| Name | Source | Client-visible? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | You choose later (`http://localhost:3000` for dev) | Yes (public by design) | Used by auth email links and metadata |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Yes (public by design) | Points at `plantai-dev` (region `ap-south-1`) for local dev |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API → **Publishable key** | Yes (public by design) | **ADR-9 (2026-11-10):** new Supabase naming; replaces the older `NEXT_PUBLIC_SUPABASE_ANON_KEY` in this doc — same credential. Safe only because RLS is on for all tables ([`SECURITY.md`](SECURITY.md) §8) |
| `SUPABASE_SECRET_KEY` | Supabase → **Project Settings → API Keys** — SECRET (server-only), format `sb_secret_...` | **No — server-only** | Bypasses RLS (resolves to the `service_role` Postgres role); never `NEXT_PUBLIC_`; needed for identifications persistence + `identification_cache`. **Canonical name per current Supabase docs (Phase 2.5, 2026-11-12)** — legacy `anon`/`service_role` JWT keys are deprecated by end of 2026 |
| `SUPABASE_SERVICE_ROLE_KEY` (legacy) | Supabase → Project Settings → API Keys — SECRET (server-only), legacy JWT | **No — server-only** | **Deprecated by Supabase by end of 2026.** Still accepted by this codebase as a fallback when `SUPABASE_SECRET_KEY` is unset. **Phase 2 finding:** the value in `.env.local` was rejected by Supabase ("Invalid API key") — replace it with a valid `SUPABASE_SECRET_KEY` (see `PHASE_2_SUPABASE_SECRET_KEY_REPORT.md`) |
| `PLANTNET_API_KEY` | my.plantnet.org → settings → API key — SECRET | **No — server-only** | Never leave server context; needed from Phase 2 |
| `PLANTNET_MODE` | Developer switch (`real` / `mock`) | **No — server-only** | `mock` for all local dev/preview (protect the shared 500/day quota). **Phase 2 implemented:** `mock` is the enforced default — `live` without a valid `PLANTNET_API_KEY` fails safe back to mock; live identification additionally requires explicit owner approval |
| `IP_HASH_SALT` | Generate once: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | **No — server-only** | **Phase 2 (new):** salt for the salted-SHA-256 IP hash used by the anonymous identify counter — raw IPs are never logged (SECURITY.md §7/§9). Unset ⇒ per-process ephemeral salt (counters stay correct within an instance; differ across instances/restarts). Add to `.env.example` (done) and set on the host for stable per-IP counters |
| `SUPABASE_DB_URL` (optional) | Supabase → Project Settings → Database | **No — server-only (tooling)** | Only if Migrations/psql tooling is used |

### 5.2 `NEXT_PUBLIC_` prefix exposure rule

Anything under `NEXT_PUBLIC_*` is **string-interpolated at build time into the client bundle** — anyone can read it in DevTools or the deployed JS. Anything WITHOUT the prefix is invisible to the client and only readable in Node(server-side) code. Practical consequence: `SUPABASE_SERVICE_ROLE_KEY` and `PLANTNET_API_KEY` must NEVER be renamed with a `NEXT_PUBLIC_` prefix, must never appear in a client component's file, and every module importing them should import `server-only` at the top of the file ([`SECURITY.md`](SECURITY.md) §2 enforcement).

### 5.3 `.env.local` template (local, gitignored — do NOT commit real values)

```bash
# PlantAI — local environment. NEVER commit this file. Committed template lives in .env.example.

# --- App (safe to be public) ---
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# --- Supabase (public-by-design pair) ---
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>

# --- Supabase privileged key (SECRET, server-only) ---
# Recommended: sb_secret_... from Dashboard → Project Settings → API Keys
SUPABASE_SECRET_KEY=<sb_secret_...>
# Legacy fallback (deprecated by Supabase by end of 2026; still accepted):
# SUPABASE_SERVICE_ROLE_KEY=<legacy-service-role-jwt>

# --- Pl@ntNet (SECRET, server-only) ---
PLANTNET_API_KEY=<your-private-key>

# --- Optional: DB URL for local tooling ---
# SUPABASE_DB_URL=postgresql://postgres:<db-password>@db.<your-ref>.supabase.co:5432/postgres
```

**How the owner inserts their saved real values (Notepad → `.env.local`), safely:**

1. In the repo run: `Copy-Item .env.example .env.local` (creates the private file; `.env*` is already git-ignored — verify with `git check-ignore .env.local`, which must print the path).
2. Open only `.env.local` (VS Code). Paste your real values **only** into these lines — no values belong in chat, screenshots, or committed files:
   - `NEXT_PUBLIC_SUPABASE_URL` = your plantai-dev Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = your plantai-dev Publishable key
   - `SUPABASE_SECRET_KEY` = your plantai-dev `sb_secret_...` key (Phase 2.5 — see `PHASE_2_SUPABASE_SECRET_KEY_REPORT.md` §4; never paste it in chat)
3. Save and never commit: `git status` must NOT list `.env.local`.
4. Tell the agent/assistant privately only *whether* values are set — never paste them.

**Local config status (2026-11-10, Phase 1.1):** `.env.local` exists locally
(created from the `.env.example` template; git-ignored; never committed, no
commits touch it). At scan time the two primary values were still the
template placeholders — the owner pastes the real Project URL and Publishable
key directly into the file (view with `code .env.local` in VS Code or any
editor; do NOT paste keys into chat or terminal). Verification method on
record: a mask-only script checks presence/placeholder-state/`sb_publishable_`
prefix and prints at most the first and last 4 characters of a value — full
contents are never displayed or logged. Database connectivity is **not**
verified until a real query runs (Phase 2).

### 5.4 `.env.example` (committed — placeholders ONLY)

A committed `.env.example` with placeholder values lives inside the repo; no real keys ever. Created at Phase 1 scaffold (see [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) production env vars). Same variable names, placeholder values like `your_key_here`, comments pointing at §3 and §4 of this file for where to obtain each key, and a warning banner.

---

## 6. OpenCode usage

- Open OpenCode with the **repo root** as working directory (i.e. `C:\Users\supersohail\PlantAI` once the git clone is there), so file references are stable.
- **Phase 0 = docs only.** This phase produces planning documents; OpenCode sessions may write to `/docs`, `/ARCHITECTURE.md`, `/SECURITY.md`, `/TESTING_PLAN.md`, `/REQUIREMENTS.md`, etc., but NOT initialize the Next.js app.
- Phase planning and task sequencing live in [`TASKS.md`](TASKS.md) — do not duplicate phase lists here.
- Model/provider choice is up to the user (OpenCode is provider-agnostic; costs depend on the LLM provider you pick — no project budget assumption, per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)).

---

## 7. Local dev workflow (future)

These commands are **the intended workflow**, defined in Phase 1 scaffold. Don't expect them to work in Phase 0.

```powershell
npm install            # Phase 1+ — after package.json exists
npm run dev            # Phase 1+ — Next.js dev server at http://localhost:3000
npm run build          # Phase 1+ — production build check
npm run lint           # Phase 1+ — ESLint
npm test               # Phase 2+ — Vitest per TESTING_PLAN.md
npx playwright test    # Phase 2+ — E2E per TESTING_PLAN.md
```

---

## 8. Verification checklist after setup

Run through and tick:

- [ ] `node -v` prints a 22.x-style LTS version (confirm the exact expected version at Phase 1).
- [ ] `npm -v` prints 10.x or newer.
- [ ] `git --version` prints a version; `git config --global user.name` and `user.email` are non-empty.
- [ ] GitHub repo `PlantAI` exists; `git clone` of it succeeds locally.
- [ ] Supabase dashboard (`https://supabase.com/dashboard`) reachable; `plantai-dev` project active (green "Active" badge, not paused).
- [ ] Email auth enabled in Supabase (Authentication → Providers).
- [ ] Pl@ntNet account active at https://my.plantnet.org; API key generated and visible in Settings.
- [ ] `.env.local` (created in Phase 1, not before) holds all 5 canonical variables — nothing else.
- [ ] `.env.local` is listed in `.gitignore` (Phase 1 file) — verify with `git check-ignore .env.local`.

---

## 9. Common Windows issues

### PowerShell execution policy (scripts blocked)

If `npm`, `pnpm`, or project scripts fail with "running scripts is disabled":

```powershell
# Run once, in an elevated (Administrator) PowerShell:
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

`RemoteSigned` (not `Unrestricted`) keeps downloaded-script signing checks.

### Long path enablement

Node / git sometimes trip on >260-char paths (deep `node_modules` trees). Fix with one of:

```powershell
git config --global core.longpaths true          # fixes git-side limit
# Or Windows-level (elevated, then reboot):
# New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -Value 1 -PropertyType DWord -Force
```

### Line endings — CRLF/LF

Use **LF** everywhere repo-side; Windows editors/co-pilots sometimes write CRLF. Standard approach via `.gitattributes` in the repo root (added in Phase 1 scaffold):

```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.jpeg binary
```

And in Editors: VS Code default `files.eol: "\n"` if you want belt-and-braces:

```jsonc
// .vscode/settings.json
{ "files.eol": "\n" }
```

If you've already committed CRLF, easiest fix on a fresh repo is `git add --renormalize .` after the `.gitattributes` exists.

### node-gyp caveat (only if ever needed)

Some older npm packages need native builds (node-gyp) which on Windows requires Visual Studio Build Tools + Python. **PlantAI avoids this scenario by not depending on native-build libraries** (Supabase JS, Next.js, Tailwind, zod, Playwright don't need node-gyp in normal installs). If you ever hit one, the canonical fix is:

```powershell
# Run in elevated PowerShell at that future time (NOT now):
# winget install Microsoft.VisualStudio.2022.BuildTools
# winget install Python.Python.3.12
# npm install --global windows-build-tools   # (deprecated; prefer the two winget installs above)
```

Do not pre-install this "just in case" — skip until a real install demands it.

---

## 10. What NOT to do now (Phase 0)

- ❌ **Do not run `create-next-app` / scaffold the app** — the app init happens in Phase 1 after scaffold approval (per [`DEVELOPMENT_ROADMAP.md`](DEVELOPMENT_ROADMAP.md)).
- ❌ **Do not `npm install` anything and no `package.json` should exist yet** — zero dependencies until Phase 1 approved.
- ❌ **Do not create `.env.local` with real keys yet** — templates in §5.3 are there for Phase 1; producing a real `.env.local` too early usually means the file rots before Supabase/Pl@ntNet values exist anyway.
- ❌ **Do not run the Supabase CLI or Docker** — those are Phase 2+ tools.
- ❌ **Do not commit secrets to the (future) repo** — read [`SECURITY.md`](SECURITY.md) §2 before touching any key.
- ❌ **Do not enable Google OAuth in Supabase config** — deferred to post-MVP, per canonical project decisions.
- ✅ DO: write docs, read [`VERIFIED_FACTS`](docs/VERIFIED_FACTS.md), and finalize decisions in [`TASKS.md`](TASKS.md).

---

## 11. Next steps → Phase 1

When Phase 0 doc set is reviewed/approved, continue to **Phase 1 Env & Scaffold** per [`DEVELOPMENT_ROADMAP.md`](DEVELOPMENT_ROADMAP.md), where:

1. `create-next-app` runs (App Router, TS strict, Tailwind) and the `package.json`/lockfile is born.
2. `.env.example`, `.gitattributes`, `.vscode/settings.json`, and lint/format tooling land.
3. First commit/push of the scaffold to GitHub; CI stub is considered (optional).
4. `.env.local` is finally created with the real values from §3–§4 above.

The setup steps in this file are drag-free reference material for that scaffold step — you're done with this guide once everything in §8 is ticked (except `.env.local`, which belongs to Phase 1).

---

*Last updated: 2026-11-10 (Phase 0). Cross-references: [`PROJECT_PLAN.md`](PROJECT_PLAN.md) · [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`REQUIREMENTS.md`](REQUIREMENTS.md) · [`SECURITY.md`](SECURITY.md) · [`TESTING_PLAN.md`](TESTING_PLAN.md) · [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) · [`DEVELOPMENT_ROADMAP.md`](DEVELOPMENT_ROADMAP.md) · [`TASKS.md`](TASKS.md) · [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)*
