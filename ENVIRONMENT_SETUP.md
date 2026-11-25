# PlantAI — Environment Setup Guide (Windows)

> Step-by-step local environment setup for PlantAI on Windows 10/11.
> **Historical-status note:** the original Phase 0 text below was written when no
> app code existed; the project is now implemented and deployed. Sections marked
> *future*, “Phase 0”, or “What NOT to do now” are retained as a setup record, not
> the current project state. The canonical names in §5 are current. Real values
> belong only in `.env.local` or host settings and are never shown here.
> **Production status:** Netlify Free is the current production host
> (<https://strong-mochi-e3869f.netlify.app>). Production environment-variable
> presence and values, build image and dashboard settings require owner
> verification in Netlify; this document does not prove them. Local `HEAD` `0b17682` contains the
> Google OAuth cutover but is not pushed or deployed, so do not assume production
> auth matches the local code.
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
7. [Local dev workflow](#7-local-dev-workflow)
8. [Verification checklist](#8-verification-checklist)
9. [Common Windows issues](#9-common-windows-issues)
10. [Historical Phase 0 “do not do yet” list](#10-historical-phase-0-do-not-do-yet-list)
11. [Next steps → Phase 1](#11-next-steps--phase-1)

---

## 1. Prerequisites

| Component | Version / note | Mandatory? | Where |
|---|---|---|---|
| Windows | 10 or 11 | Yes | — |
| Node.js | Use a supported LTS line per current official status. As of 2026-11-25, Node 20 is **EOL**; Node 24 is Maintenance LTS (current security release **v24.22.3**) and Node 26 is Active LTS (**v26.13.1**) per [Node.js releases](https://nodejs.org/en/about/previous-releases) and [November 2026 security releases](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases). The recorded local baseline is **v24.22.0** (historical patch record). `package.json` has no `engines` pin; Node 26 is not claimed tested here, and no major upgrade is forced. Netlify build image/Node version is a dashboard setting requiring owner verification. | Yes | nodejs.org (official MSI) |
| npm | Bundled with the installed Node release (recorded local baseline: **12.2.1**; historical, not a pin) | Yes | Same |
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

Install via the official installer: https://nodejs.org (choose a supported LTS). Or with winget from an elevated PowerShell:

```powershell
# Option A (recommended, simplest): download an LTS MSI from nodejs.org and run it.
# Option B (winget, run as Administrator): installs the current LTS line.
winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
```

As of 2026-11-25, **Node 20 is EOL**; Node 24 is Maintenance LTS and Node 26 is Active LTS. Current security releases are `v24.22.3` and `v26.13.1` ([release table](https://nodejs.org/en/about/previous-releases); [November 2026 security releases](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases)). The repository's recorded local compatibility baseline is Node **v24.22.0** / npm **12.2.1**; that patch is a historical record, not a claim that it is the newest 24.x security release. Node 26 is **not** claimed to have been tested against this repository, and this documentation change does not force a Node major upgrade. `package.json` has no `engines` pin; the Netlify build image remains an owner-unverified dashboard setting.

Verify (open a NEW PowerShell window after installing):

```powershell
node -v   # supported LTS; recorded baseline v24.22.0 (historical patch; no package.json engines pin)
npm -v    # bundled npm; recorded baseline 12.2.1 (historical; Node 26 not tested here)
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
   - Record from **Project Settings → API / API Keys**:
     - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
     - `Publishable key` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (earlier docs used `NEXT_PUBLIC_SUPABASE_ANON_KEY`; current `src/lib/env.ts` reads **only** the publishable-key name, so an old anon-key name will not satisfy the app)
     - `Secret key` (`sb_secret_...`, resolves to `service_role`) → `SUPABASE_SECRET_KEY` (SECRET — see [`SECURITY.md`](SECURITY.md) §2); legacy `SUPABASE_SERVICE_ROLE_KEY` JWT is a deprecated fallback only
   - Password for the DB is shown at project creation → store it if you ever need the optional `SUPABASE_DB_URL` tooling value.
3. If a separate production project is used, create `plantai-prod` and repeat the key recording steps. The production project's existence, name, region and current state remain owner-unverified, not proven by this repository.
4. Keep **Email auth** enabled for rollback/outstanding links; it is no longer
   the normal-use sign-in UI.
5. Enable **Google** per [`docs/GOOGLE_OAUTH_SETUP.md`](docs/GOOGLE_OAUTH_SETUP.md).
   This is an owner-only dashboard step: Google Cloud OAuth client → Supabase
   provider → Supabase callback URL → redirect allowlist. No Google credential
   belongs in PlantAI source or `.env.local`.
6. Note that Free projects **pause after ~1 week of inactivity** and there are **no automatic backups on Free** — plan manual SQL dumps during development (per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)).

> **Local vs deployed auth:** local `HEAD` `0b17682` contains the Google OAuth cutover but is not pushed to GitHub and not deployed to Netlify. The live Netlify site's auth/provider state requires owner verification; do not describe the local implementation as already deployed, and do not assume the production Supabase provider configuration matches the repository.

> Naming convention: `plantai-*` (lowercase) so both projects are visually adjacent in the dashboard.

**Copy keys carefully** — copy vs `type`/`cat`-view and paste into `.env.local`; no manual re-typing (typos in keys are the #1 setup bug). Never paste real keys into chat, docs, or commit messages.

---

## 4. Pl@ntNet setup

1. Create an account at **https://my.plantnet.org** (one free account per person — per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md); do NOT create multiple/second accounts).
2. Generate your private API key: **Account settings → API key** (`https://my.plantnet.org/settings/api-key`).
3. Record it as `PLANTNET_API_KEY`; by itself it never enables live identification.
4. Note the free-plan constraints (direct quotes and exact values live in [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)):
   - **500 identifications/day**, resets at midnight UTC.
   - **Errors also consume 1 credit** (since 2026-02-13) — this is why PlantAI's pre-validation is strict ([`SECURITY.md`](SECURITY.md) §5–6).
   - The key is **private**: no browser-side usage, no CORS whitelisting in PlantAI — all calls are server-side ([`SECURITY.md`](SECURITY.md) §3).
5. Keep the key out of any client code, client docs, or screenshots you share.
6. **API host (verified 2026-11-12):** identification requests target **`https://my-api.plantnet.org`** — the `my.plantnet.org` site referenced above is the account/portal/docs site, NOT the API host. Authentication is the **`api-key` query parameter**, so the key is embedded in request URLs: **full request URLs must never be logged** (`SECURITY.md` §3). Live identification requires explicit owner approval and **both** `PLANTNET_MODE=live` and a valid server-only key; keep `PLANTNET_MODE=mock` otherwise.

---

## 5. Environment variables

> **Phase 1 update (2026-11-10; historical local baseline):** the values below
> reflect what was actually installed at that time — Node **v24.22.0** (recorded
> patch, not a current patch recommendation), npm **12.2.1**, git **2.56**,
> Next.js **16.4.6**, React 19.3, Tailwind **4.3.3**, Supabase SDKs
> `@supabase/supabase-js@^2.119` + `@supabase/ssr@^0.12`. As of 2026-11-25 Node
> 20 is EOL, Node 24 is Maintenance LTS and Node 26 is Active LTS; no Node 26
> compatibility test is claimed. The scaffold itself is committed; setup
> sections 1–2 above remain the historical reference.

### 5.1 Canonical inventory

| Name | Required / optional | Source | Client-visible? | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Optional locally; recommended in production | You choose (`http://localhost:3000` for dev) | Yes (public by design) | Canonical/meta/sitemap URLs. `src/app/layout.tsx` and `src/app/sitemap.ts` fall back to `http://localhost:3000` when unset. OAuth `redirectTo` uses the browser origin, which must be allowlisted in Supabase. |
| `NEXT_PUBLIC_SUPABASE_URL` | Conditional — required for Supabase-backed features | Supabase → Project Settings → API | Yes (public by design) | `getPublicSupabaseConfig()` throws if the URL or publishable key is missing. Local dev normally points at `plantai-dev`; the project name/region are dashboard facts, not repository facts. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Conditional — required with the URL | Supabase → Project Settings → API → **Publishable key** | Yes (designed to be public) | **ADR-9 (2026-11-10)** name. Earlier docs used `NEXT_PUBLIC_SUPABASE_ANON_KEY`, but current source has **no anon-key fallback**. Supabase publishable keys are designed for browser use; actual database protection depends on correct **deployed** RLS policies and grants. Migration-defined RLS is documented, but deployed policy/grant state remains owner-unverified; migration files alone do not prove production data is protected ([`SECURITY.md`](SECURITY.md) §8). |
| `SUPABASE_SECRET_KEY` | Conditional — required for service-role writes; preferred over legacy | Supabase → **Project Settings → API Keys** — secret (`sb_secret_...`) | **No — server-only** | Bypasses RLS (resolves to the `service_role` Postgres role); never `NEXT_PUBLIC_`; needed for identification persistence + `identification_cache` when persistence is enabled. |
| `SUPABASE_SERVICE_ROLE_KEY` (legacy fallback) | Legacy only | Supabase → Project Settings → API Keys — legacy JWT | **No — server-only** | Read only when `SUPABASE_SECRET_KEY` is unset (`getServerSupabaseSecretKey()`). Supabase is deprecating legacy JWT keys; migrate to `SUPABASE_SECRET_KEY`. A legacy value was previously rejected by Supabase; see [`SECURITY.md`](SECURITY.md) §2. |
| `PLANTNET_API_KEY` | Optional; required for live identification | my.plantnet.org → settings → API key — SECRET | **No — server-only** | Never leave server context; a blank/whitespace value is treated as missing. Required for live mode only when paired with `PLANTNET_MODE=live`; a key alone never enables live identification. |
| `PLANTNET_MODE` | Optional; defaults to `mock` | Explicit switch (`live` / `mock`) | **No — server-only** | `mock` for all local dev/preview (protect the shared 500/day quota). Missing, blank, invalid or `mock` → mock, even when a key is present. `live` requires a non-blank key; otherwise it fails safe to mock with a value-free diagnostic. The deployed Netlify value, key presence and live behavior are **owner-unverified**; source defaults do not prove production mode, and live activation needs separate owner approval. |
| `PLANTAI_PERSISTENCE_ENABLED` | Optional; defaults to OFF | Server-side environment | **No — server-only** | Only the exact string `true` enables automatic identification writes. `false`, blank, `TRUE`, `1`, etc. stay disabled. Database reads are unaffected. Activation is a separate owner decision. |
| `IP_HASH_SALT` | Optional; recommended in production | Generate once: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | **No — server-only** | Salt for the salted-SHA-256 IP hash used by the anonymous identify counter and contact limiter — raw IPs are never logged ([`SECURITY.md`](SECURITY.md) §7/§9). If unset, `getIpHashSalt()` uses a process-scoped fallback (`__ephemeral__<pid>`), not a stable secret; set a real value in production for stable per-IP counters. |
| `SUPABASE_DB_URL` (optional tooling) | Optional; not read by application code | Supabase → Project Settings → Database | **No — server-only (tooling)** | Only for manual dumps/psql/supabase CLI. It is intentionally **not** in the committed `.env.example`; never add it to client code. |

> **Narrow source-verified behavior (not a Supabase-free claim):** the mock Pl@ntNet provider can be selected without `PLANTNET_API_KEY`, but `/api/identify` creates a Supabase server client at request start. `getPublicSupabaseConfig()` requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and throws when either is missing; the proxy, browser/server Supabase clients, and DB-backed routes rely on that pair. This does **not** establish that authentication, saved plants, database-backed features, all routes or a complete production build work without Supabase public credentials. No full-app or full-build claim is made here without a separate safe verification.

### 5.2 `NEXT_PUBLIC_` prefix exposure rule

Anything under `NEXT_PUBLIC_*` is **string-interpolated at build time into the client bundle** — anyone can read it in DevTools or the deployed JS. Anything WITHOUT the prefix is invisible to the client and only readable in Node (server-side) code. Practical consequence: `SUPABASE_SECRET_KEY` (and its deprecated fallback `SUPABASE_SERVICE_ROLE_KEY`), `PLANTNET_API_KEY`, `PLANTAI_PERSISTENCE_ENABLED` and `IP_HASH_SALT` must NEVER be renamed with a `NEXT_PUBLIC_` prefix and must never appear in a client component.

**Current server-only guard:** the `server-only` package is **not installed** and no module imports `import "server-only"`. Instead, `requireServerOnly()` in `src/lib/env.ts` throws when `window` is defined; it is covered by one unit test. This is a runtime guard, not a build-time import failure ([`SECURITY.md`](SECURITY.md) §2).

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
# Live requires BOTH PLANTNET_MODE=live and a valid key. Key alone never enables live.
PLANTNET_MODE=mock
PLANTNET_API_KEY=<your-private-key>

# --- Identification persistence (server-only) ---
# SAFE DEFAULT: OFF. Only the exact string "true" enables automatic writes.
PLANTAI_PERSISTENCE_ENABLED=false

# --- Rate-limiting privacy salt (server-only) ---
# Optional locally; set a real random value in production.
IP_HASH_SALT=<random-hex>

# --- Optional: DB URL for local tooling (not in .env.example; app code does not read it) ---
# SUPABASE_DB_URL=postgresql://postgres:<db-password>@db.<your-ref>.supabase.co:5432/postgres
```

**How the owner inserts their saved real values (Notepad → `.env.local`), safely:**

1. In the repo run: `Copy-Item .env.example .env.local` (creates the private file; `.env*` is already git-ignored — verify with `git check-ignore .env.local`, which must print the path).
2. Open only `.env.local` (VS Code). Paste your real values **only** into these lines — no values belong in chat, screenshots, or committed files:
   - `NEXT_PUBLIC_SUPABASE_URL` = your plantai-dev Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = your plantai-dev Publishable key
   - `SUPABASE_SECRET_KEY` = your plantai-dev `sb_secret_...` key (see [`SECURITY.md`](SECURITY.md) §2; never paste it in chat)
3. Save and never commit: `git status` must NOT list `.env.local`.
4. Tell the agent/assistant privately only *whether* values are set — never paste them.

**Local config status:** the current contents and placeholder state of
`.env.local` are intentionally **not** inspected, printed or asserted by this
document. `.env.local` is git-ignored and must never be committed. Database and
auth connectivity are not proven by the presence of a file; verify them by
running the app's real flows. Never paste values into chat, docs, terminal
history or screenshots.

### 5.4 `.env.example` (committed — placeholders ONLY)

A committed `.env.example` with placeholder/empty values lives inside the repo; no real keys ever. Created at Phase 1 scaffold (see [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) production env vars). Same canonical names, safe examples such as `PLANTNET_MODE=mock`, empty `PLANTNET_API_KEY=`, `PLANTAI_PERSISTENCE_ENABLED=false`, and an empty `IP_HASH_SALT=`, comments explaining where to obtain each value, and a warning banner. `SUPABASE_DB_URL` is intentionally omitted because application code does not read it. Real credentials must remain private and server-side in `.env.local` or host environment variables; never commit them.

---

## 6. OpenCode usage

- Open OpenCode with the **repo root** as working directory (i.e. `C:\Users\supersohail\PlantAI` once the git clone is there), so file references are stable.
- **Historical Phase 0 rule:** this phase originally produced planning documents only; the app now exists. Keep this bullet as a record of the original boundary, not current state.
- Phase planning and task sequencing live in [`TASKS.md`](TASKS.md) — do not duplicate phase lists here.
- Model/provider choice is up to the user (OpenCode is provider-agnostic; costs depend on the LLM provider you pick — no project budget assumption, per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)).

---

## 7. Local dev workflow

These commands are the current scaffold workflow; earlier revisions marked this section future-only because the app did not yet exist.

```powershell
npm install            # install dependencies from package.json
npm run dev            # Next.js dev server at http://localhost:3000
npm run build          # production build check (`next build`)
npm run lint           # ESLint
npm run typecheck      # `tsc --noEmit`
npm test               # package.json: "test": "vitest run"
# Playwright E2E is not installed in package.json; add it only if the testing plan requires it.
```

---

## 8. Verification checklist after setup

Run through and tick:

- [ ] `node -v` reports a supported LTS line per current official status (as of 2026-11-25: Node 24 Maintenance LTS or Node 26 Active LTS; Node 20 is EOL). The recorded baseline v24.22.0 is a historical patch, not a forced target.
- [ ] `npm -v` reports the bundled npm for that Node release (recorded baseline: 12.2.1; Node 26 not tested here).
- [ ] `git --version` prints a version; `git config --global user.name` and `user.email` are non-empty.
- [ ] GitHub repo `PlantAI` exists; `git clone` of it succeeds locally.
- [ ] Supabase dashboard (`https://supabase.com/dashboard`) reachable; `plantai-dev` project active (green "Active" badge, not paused).
- [ ] Email auth still enabled for rollback; Google enabled per
      [`docs/GOOGLE_OAUTH_SETUP.md`](docs/GOOGLE_OAUTH_SETUP.md), with local and
      production origins allowlisted.
- [ ] Pl@ntNet account active at https://my.plantnet.org; API key generated and visible in Settings.
- [ ] `.env.local` holds the canonical variables from §5.1 that your local flows need (`NEXT_PUBLIC_SITE_URL`, the two public Supabase values, the server-only Supabase key, `PLANTNET_MODE`/`PLANTNET_API_KEY`, `PLANTAI_PERSISTENCE_ENABLED`, `IP_HASH_SALT`). Never commit it.
- [ ] `.env.local` is listed in `.gitignore` (Phase 1 file) — verify with `git check-ignore .env.local`.
- [ ] Production environment variables, live response headers and provider settings are verified in the Netlify/Supabase dashboards by the owner — not asserted by this document.

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

Some older npm packages need native builds (node-gyp) which on Windows requires Visual Studio Build Tools + Python. **PlantAI avoids this scenario by not depending on native-build libraries** (the currently installed dependencies — Supabase JS, Next.js, Tailwind, zod — don't need node-gyp in normal installs). If you ever hit one, the canonical fix is:

```powershell
# Run in elevated PowerShell at that future time (NOT now):
# winget install Microsoft.VisualStudio.2022.BuildTools
# winget install Python.Python.3.12
# npm install --global windows-build-tools   # (deprecated; prefer the two winget installs above)
```

Do not pre-install this "just in case" — skip until a real install demands it.

---

## 10. Historical Phase 0 “do not do yet” list

> Retained as a historical record; the app and dependencies now exist. Do not
> read these bullets as current instructions.

- ❌ **Do not run `create-next-app` / scaffold the app** — the app init happened in Phase 1 after scaffold approval (per [`DEVELOPMENT_ROADMAP.md`](DEVELOPMENT_ROADMAP.md)).
- ❌ **Do not `npm install` anything and no `package.json` should exist yet** — zero dependencies until Phase 1 approved.
- ❌ **Do not create `.env.local` with real keys yet** — templates in §5.3 are there for Phase 1; producing a real `.env.local` too early usually means the file rots before Supabase/Pl@ntNet values exist anyway.
- ❌ **Do not run the Supabase CLI or Docker** — those are Phase 2+ tools.
- ❌ **Do not commit secrets to the (future) repo** — read [`SECURITY.md`](SECURITY.md) §2 before touching any key.
- ❌ **Do not put Google client IDs/secrets in app code, `.env.local`, docs or chat** — provider configuration is owner-only in Google Cloud + Supabase (`docs/GOOGLE_OAUTH_SETUP.md`). This Phase-0 note is historical; the current normal-use flow is Google OAuth.
- ✅ DO: write docs, read [`VERIFIED_FACTS`](docs/VERIFIED_FACTS.md), and finalize decisions in [`TASKS.md`](TASKS.md).

---

## 11. Next steps → Phase 1

Historical next-step note: Phase 0 was approved and the app was scaffolded. The list below records what **Phase 1 Env & Scaffold** covered per [`DEVELOPMENT_ROADMAP.md`](DEVELOPMENT_ROADMAP.md); see [`TASKS.md`](TASKS.md) and [`CHANGELOG.md`](CHANGELOG.md) for current status.

1. `create-next-app` runs (App Router, TS strict, Tailwind) and the `package.json`/lockfile is born.
2. `.env.example`, `.gitattributes`, `.vscode/settings.json`, and lint/format tooling land.
3. First commit/push of the scaffold to GitHub; CI stub is considered (optional).
4. `.env.local` is finally created with the real values from §3–§4 above.

The setup steps in this file are drag-free reference material for the current scaffold — you're done with this guide once the §8 checklist items that apply to your local setup are ticked.

---

*Last updated: 2026-11-10 (Phase 0; historical). Canonical env names, deployed-RLS caveats, narrow mock-provider scope, current Node-version status, server-only guard and production-status notes corrected 2026-11-25. Cross-references: [`PROJECT_PLAN.md`](PROJECT_PLAN.md) · [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`REQUIREMENTS.md`](REQUIREMENTS.md) · [`SECURITY.md`](SECURITY.md) · [`TESTING_PLAN.md`](TESTING_PLAN.md) · [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) · [`DEVELOPMENT_ROADMAP.md`](DEVELOPMENT_ROADMAP.md) · [`TASKS.md`](TASKS.md) · [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)*
