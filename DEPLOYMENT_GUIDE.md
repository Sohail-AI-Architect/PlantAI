# PlantAI — Deployment Guide

> ⚠️ **Status update (2026-11-25):** PlantAI's current production host is **Netlify Free** at <https://strong-mochi-e3869f.netlify.app>, connected to the GitHub `main` branch. That connection is a confirmed hosting fact; branch protection, deploy-preview behavior, required review/approval gates, build settings, Node image and rollback procedure are Netlify-dashboard settings and remain **owner-unverified**. No `netlify.toml` and no `.github/workflows` directory are committed, so those controls are not evidenced in this repository. The Vercel-specific instructions below are **historical reference only**; for the current path see `README.md`, `SECURITY.md`, and the owner's Netlify dashboard. The Supabase guidance in this document remains useful, subject to the owner-verification notes added below.
>
> **Auth cutover:** local `HEAD` is `0b17682` ("switch normal-use sign-in to Google OAuth"). It is one commit ahead of `origin/main`, not pushed to GitHub, and not deployed to Netlify. The existing Netlify production site therefore must **not** be described as already running the local Google OAuth implementation; production auth behavior and provider configuration require owner verification. See `SECURITY.md` and `docs/GOOGLE_OAUTH_SETUP.md`.
>
> **Security headers:** the five headers are implemented in `next.config.ts` (source-verified), but source configuration does not prove the response headers returned by the deployed Netlify site. Live header verification with `curl -I` remains an owner task.
>
> **Pl@ntNet status:** source behavior defaults to `mock` when `PLANTNET_MODE` is missing, blank or invalid, but the deployed Netlify `PLANTNET_MODE`, `PLANTNET_API_KEY` presence and live identification behavior are **owner-unverified**. Do not claim the live site is definitely mock or live without evidence; live activation remains a separate owner approval.
>
> Purpose: the original local-Windows-to-Vercel deployment plan, retained as a historical reference, plus Supabase setup, environment variables, pre-flight and post-deployment checklists, domains, rollback, backups, and hosting decisions. Current production is Netlify Free.
>
> **Facts rule:** historical Vercel quota/pricing claims trace to `docs/VERIFIED_FACTS.md`. Current Netlify commercial-use evidence comes only from Netlify's current official documentation (<https://netlify.com/solutions/web-applications/>). Anything not verified is marked **UNVERIFIED**. Dates in this file assume the verification date 2026-11-10 recorded in `docs/VERIFIED_FACTS.md` unless a newer source is cited.
>
> Related documents: `ENVIRONMENT_SETUP.md`, `SECURITY.md`, `DATABASE_SCHEMA.md`, `TESTING_PLAN.md`, `MONETIZATION_PLAN.md`, `SEO_STRATEGY.md`, `TASKS.md`, `CHANGELOG.md`.

---

## Table of Contents

1. [Deployment philosophy](#1-deployment-philosophy)
2. [Environment matrix](#2-environment-matrix)
3. [Repository → GitHub](#3-repository--github)
4. [Vercel setup](#4-vercel-setup)
5. [Supabase setup for deployment](#5-supabase-setup-for-deployment)
6. [Environment configuration](#6-environment-configuration)
7. [Production deployment checklist](#7-production-deployment-checklist)
8. [Domain configuration (Netlify application only)](#8-domain-configuration-netlify-application-only)
9. [Post-deployment verification](#9-post-deployment-verification)
10. [Upgrade path / hosting migration (Phase 5 — historical decision record)](#10-upgrade-path--hosting-migration-phase-5--historical-decision-record)
11. [Backups & disaster recovery](#11-backups--disaster-recovery)
12. [Cost-drift monitoring plan](#12-cost-drift-monitoring-plan)
13. [Rollback strategy](#13-rollback-strategy)
14. [Quick reference: canonical commands](#14-quick-reference-canonical-commands)

---

## 1. Deployment philosophy

> **Historical section:** the Vercel Hobby details below document the original
> plan. Current production is Netlify Free; treat Vercel dashboard steps and
> limits as superseded unless the owner reopens that path.

PlantAI was designed for a zero budget with hard external limits (per `docs/VERIFIED_FACTS.md`):

- **Vercel Hobby (historical)** — free, ~100 GB transfer / 1M function invocations per month, but **NON-COMMERCIAL ONLY**. AdSense on Hobby explicitly violates Vercel's fair-use rules (ads = commercial use, per `docs/VERIFIED_FACTS.md` §Vercel). Enforcement may disable the deployment without notice.
- **Supabase Free** — 500 MB DB / 1 GB storage / 50k MAU / unlimited API requests, **2 free projects**, paused after ~1 week of low DB activity (restorable within 1 year).
- **Pl@ntNet free** — 500 identifications/day, per account. **One free account per person is allowed**; multiple free accounts from one person/IP are forbidden (`docs/VERIFIED_FACTS.md` §Pl@ntNet).

### Principles

| Principle | Meaning in practice |
|---|---|
| **Ship small, ship often** | One feature → one PR → review (and a preview deploy where the host provides one) → merge. No big-bang releases. |
| **Preview deploys for review** | Historically every PR got an automatic Vercel preview URL + its own env-var scope (see §4 and §6). On the current Netlify host, preview-deploy, review and approval behavior is dashboard-configured and **owner-unverified**; preview origins must be verified before use in auth allowlists. |
| **Never deploy broken `main`** | `main` must always pass `npm run build`, `npm run lint`, and the critical tests from `TESTING_PLAN.md` locally before push. Broken `main` = fix-forward or host rollback (§13). |
| **Stay portable by design** | Standard Next.js App Router app with no vendor lock-in features (no Vercel-only edge APIs unless replaceable). This preserved the option to move to Netlify/Cloudflare. |
| **No secrets in the repo** | All secrets live in `.env.local` (git-ignored) and host environment settings (currently Netlify; historical Vercel encrypted env vars). See `SECURITY.md`. |
| **Free-tier friendly by default** | Dev minimizes Pl@ntNet real identifications (mock mode, §2). Supabase dev project is allowed to pause between sessions (that is normal and free to restore). |

### The single hosting constraint that shapes everything

> **Historical Vercel constraint:** running ads (AdSense) on Vercel Hobby violates its non-commercial rule (`docs/VERIFIED_FACTS.md` §Vercel). Current production is Netlify Free. Netlify's current official FAQ states that the Free plan has no restriction on commercial use within the plan's credit limit (<https://netlify.com/solutions/web-applications/>); this is a previously verified external-fact check, while the older row in `docs/VERIFIED_FACTS.md` still says UNVERIFIED and should be updated when that file is next approved for editing. AdSense approval, active ad serving, and revenue are not claimed; Cloudflare claims remain **UNVERIFIED**.

---

## 2. Environment matrix

> **Historical section:** this matrix was written around Vercel previews and
> production deploys. Current production is Netlify; preview origins are
> owner-configured and are not assumed in this repository.

The matrix records the intended environment separation, not verified dashboard state. Only production is connected to `main`; preview origins, Supabase project provisioning, bucket state, auth redirect allowlists and platform limits require owner verification in the relevant dashboards.

| Aspect | Local (Windows) | Preview (historical Vercel / owner-configured Netlify) | Production (current Netlify site; historical Vercel `main`) |
|---|---|---|---|
| **Branch** | any feature branch | PR branch | `main` |
| **URL** | `http://localhost:3000` | exact Netlify preview origin configured by the owner | `https://strong-mochi-e3869f.netlify.app` → optional custom domain |
| **Supabase project** | `plantai-dev` (may pause between sessions — acceptable) | `plantai-dev` (same as local, so preview data matches local dev) | `plantai-prod` (planned production project; exact provisioning, region and pause state remain owner-unverified) |
| **Storage buckets** | buckets recreated in the dev project | n/a (uses dev project) | `plant-images` (public) and `request-images` (private) are the intended buckets; production provisioning and policies are owner-unverified, and request-image upload/cleanup is not implemented |
| **Pl@ntNet mode/key** | `PLANTNET_MODE=mock` recommended locally; key may be present but no live calls | `PLANTNET_MODE=mock` recommended even if a key is present; do not call the API | Actually deployed `PLANTNET_MODE` / `PLANTNET_API_KEY` presence and behavior are **owner-unverified**. Source defaults to `mock` when mode is missing/blank/invalid; in production a missing key returns a 503 rather than fake results. `live` requires explicit mode + a valid server-only key and separate owner approval |
| **`NEXT_PUBLIC_SITE_URL`** | `http://localhost:3000` | preview origin configured by the owner | production URL |
| **Env var scope** | `.env.local` (git-ignored) | host preview env (historical Vercel "Preview" scope; current Netlify preview env owner-configured) | host production env (currently Netlify site env; historical Vercel "Production" scope) |
| **Auth redirect URLs** | `http://127.0.0.1:3000/**` and `http://localhost:3000/**` configured in the Supabase dashboard | each exact Netlify preview origin the owner configures and verifies; no preview hostname is assumed here | expected `https://strong-mochi-e3869f.netlify.app/**` (or later canonical domain); actual dashboard allowlist remains owner-unverified |
| **Error monitoring** | terminal / browser console | host deploy logs (historical Vercel note) | host runtime logs (currently Netlify; exact retention/fields require owner verification; historical Vercel Hobby retention was **UNVERIFIED**) |
| **Purpose** | build features | validate the PR in a production-like build | serve users |

### Pl@ntNet shared-quota caution (important)

If live mode is enabled in more than one environment, those environments **SHARE the same 500/day account quota** (`docs/VERIFIED_FACTS.md` §Pl@ntNet: quota is per account/day). Creating a second free account is **NOT an option — Pl@ntNet terms allow one free account per person and forbid multiple free accounts submitting from the same IP** (`docs/VERIFIED_FACTS.md` §Pl@ntNet, Account rules).

**Decision:**
- **Production owns the free key if live mode is ever activated** (`my.plantnet.org` — one account, one key, server-side only). A key alone never enables live identification. **Source-verified behavior:** missing/blank/invalid `PLANTNET_MODE` selects the mock provider; in a production build a missing server key returns HTTP 503 `provider_unavailable` instead of fake matches; `live` requires both `PLANTNET_MODE=live` and a non-blank server-only `PLANTNET_API_KEY`. The deployed Netlify mode, key presence and real identification behavior are **owner-unverified**; production live activation requires separate owner approval and is not claimed here.
- **Local dev and any preview should use `PLANTNET_MODE=mock`** — the `/identify` endpoint then returns canned fixture responses (saved sample Pl@ntNet JSON from `TESTING_PLAN.md` fixtures) instead of calling the API. Missing, blank or invalid mode also defaults to mock, even when a key is present. This is source behavior/configuration guidance, not evidence of the deployed production setting. Mock calls do not consume the upstream quota.
- When a **live** dev-time identification is genuinely needed (e.g. verifying parsing against live data), temporarily set **both** `PLANTNET_MODE=live` and a valid server-only `PLANTNET_API_KEY`, run 1–2 calls, then switch back to `PLANTNET_MODE=mock`. Log `remainingIdentificationRequests` from each live response to track remaining daily quota (route + header detail in `docs/VERIFIED_FACTS.md` §Pl@ntNet). Production live activation requires separate owner approval.
- Response **headers on 429**: quota resets at midnight UTC. If prod ever returns 429 in production, log and surface a friendly "daily limit reached — try tomorrow" state instead of an error.
- **Validation is server-authoritative; client checks are UX only:** the identify widget checks JPEG/PNG, per-file size and up to 3 images before submit to reduce failed uploads, but those browser checks can be bypassed and are **not** the security boundary. The `/api/identify` Route Handler re-validates before any Pl@ntNet request: Zod checks `organ` and latitude/longitude fields, the handler rejects invalid `images[]` counts and non-file entries, and `validateUploadedImage()` rejects unsupported MIME/signatures by sniffing JPEG/PNG magic bytes instead of trusting the declared type. Source defaults are 3 images maximum (`identify.images.max`, configurable up to 5) and 10 MB per image (`identify.image.max_bytes`, configurable up to 25 MB); `next.config.ts` caps the proxied request body at 34 MB and the route has its own body guard. Invalid requests are rejected before the upstream call because errored identify requests **also consume 1 credit** on the free plan (`docs/VERIFIED_FACTS.md` §Pl@ntNet). Same-plant guidance remains UX advice, while live `app_settings` overrides are owner/database-verified.

---

## 3. Repository → GitHub

### 3.1 Create the repo

1. On GitHub: **New repository** → name `PlantAI`, public (keeps GitHub Actions minutes a non-issue; the plan is a public repo per `docs/VERIFIED_FACTS.md` §Open-source stack), no README auto-init if the repo already has commits locally.
2. From the project root (PowerShell):

```powershell
# one-time init (skip if already a repo)
git init
git branch -M main

# commit everything except ignored files (see .gitignore below)
git add .
git commit -m "chore: initial project scaffold and planning docs"

# connect and push (adjust remote URL to your account)
git remote add origin https://github.com/<your-username>/PlantAI.git
git push -u origin main
```

### 3.2 Suggested `.gitignore` (Next.js standard + project specifics)

```gitignore
# dependencies
node_modules/

# next.js build output
.next/
out/

# production
build/

# env files — NEVER commit secrets (see SECURITY.md)
.env
.env.*
!.env.example

# logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
*.log

# testing
coverage/

# misc OS/editor
.DS_Store
Thumbs.db
*.suo
*.user
.vscode/*          # keep team-shared settings via !.vscode/settings.json if wanted
.idea/

# supabase local artifacts
supabase/.temp/
supabase/.branches/

# misc
*.tsbuildinfo
.vercel
```

> **Always commit an `.env.example`** that lists every application-read variable name with a placeholder value and a comment pointing to §6 of this file. Optional tooling values such as `SUPABASE_DB_URL` may be documented in comments without being part of the committed template. This is the bridge between "secrets are secret" and "a new dev (or future you) knows what to set."

### 3.3 Git conventions

- Branch flow: feature branches → PR → squash-merge to `main`. Optional short-lived `dev` branch if needed; `main` is the source of production deploys.
- Conventional commits encouraged (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`), not enforced with tooling.
- Solo dev, keep protection simple: optionally require 1 PR before merging on `main`, and never push `--force` to `main`. This is a recommendation; GitHub branch protection and required-review rules are not evidenced in-repo and require owner verification.
- Log significant deployments/decisions in `CHANGELOG.md`.

---

## 4. Vercel setup (historical reference only)

> Do not use this section for current production. PlantAI is deployed on Netlify
> Free; Vercel commands below are retained for historical/rollback context only.

**Repository-verified build facts (current):** `package.json` defines `build` as `next build`, pins Next.js `16.4.6`, and has no `engines` field. `README.md` still says Node 20+ (Node 24 recommended), but as of 2026-11-25 **Node 20 is EOL**; treat that wording as historical, not a currently supported-LTS recommendation. Node 24 is Maintenance LTS (current security release `v24.22.3`) and Node 26 is Active LTS (`v26.13.1`) per the [Node.js release table](https://nodejs.org/en/about/previous-releases) and [November 2026 security releases](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases). The recorded local compatibility baseline is Node `v24.22.0` / npm `12.2.1`, described as a historical patch record; Node 26 is **not** claimed to have been tested against this repository, and no major-version upgrade is required by this documentation change. Netlify's actual build command, publish directory, Node image, plugin/adapter and Next.js runtime are dashboard settings; this repository contains no `netlify.toml`, so those values are **owner-unverified**. A successful local `npm run build` does not by itself prove a successful, current or matching production deployment.

### 4.1 Account + import

1. Create a free account at vercel.com (Hobby plan, per `docs/VERIFIED_FACTS.md` §Vercel).
2. Dashboard → **Add New → Project** → import the GitHub repo `PlantAI` (install the Vercel GitHub app when prompted).
3. Framework auto-detect: **Next.js** is detected automatically. Default build settings are correct for a standard Next.js App Router app:
   - Build command: `next build` (default)
   - Install command: `npm install` (or your chosen package manager lockfile-identical equivalent)
   - Output directory: Next.js default (`.next`, managed by Vercel)
   - Root directory: leave default unless monorepo changes this later
4. Click **Deploy** with an empty env-var list first if you want to see a first build, but better to **set env vars BEFORE the first deploy** (§6) so the first preview deployment is fully functional.
5. First deploy produces `plantai-<name>.vercel.app` — record this URL; it becomes `NEXT_PUBLIC_SITE_URL` for production until a custom domain is bought (§8).

> Historical Vercel note: Next.js 15+ worked out of the box on Vercel — no config needed for a standard app. The app is standard Next.js and portable by design (§10); current production is Netlify.

### 4.2 Env-var scopes in Vercel (dashboard step)

For each var defined in §6, pick one of three scopes in the Vercel "Environment Variables" panel:

| Scope | Applies to | PlantAI usage |
|---|---|---|
| **Production** | the `plantai-<name>.vercel.app` site (deployments from `main`) | real Supabase prod keys, real Pl@ntNet key, prod `NEXT_PUBLIC_SITE_URL` |
| **Preview** | every PR preview URL | `plantai-dev` Supabase keys, `PLANTNET_MODE=mock` even if a key is present, preview-appropriate URL |
| **Development** | only used if running `vercel dev` locally — NOT used for plain `npm run dev` | generally unused; `.env.local` rules locally instead |

Per-branch overrides (e.g. a different `NEXT_PUBLIC_SITE_URL` for a feature branch preview) are done via the target-branch field on each env-var entry.

### 4.3 What Vercel encrypted env vars actually do

- Values are stored encrypted at rest and injected into the build/runtime as environment variables — they are **not** visible in logs and cannot be read back from the dashboard after saving (only replaced/deleted). Copy them into a password manager at the time of entry.
- Build-time-vs-runtime: `NEXT_PUBLIC_*` vars are **inlined into the client JS bundle at build time** — changing one requires a rebuild/redeploy. Server-only secrets (§6) are read at request runtime and are safe to swap without a rebuild (unless referenced during build).
- **Warning:** anything with the `NEXT_PUBLIC_` prefix is visible to anyone who views the deployed site's JS. Never put `SUPABASE_SECRET_KEY`, the deprecated `SUPABASE_SERVICE_ROLE_KEY` fallback, or `PLANTNET_API_KEY` behind that prefix (§6).

---

## 5. Supabase setup for deployment

Canonical decision: **two projects** within the free tier's 2-project allowance. Production project provisioning and naming remain owner-unverified, not repository facts.

### 5.1 Create both projects

| Project | Role | Region | Why |
|---|---|---|---|
| `plantai-dev` | local + preview deploys | nearest region to you (choose the same region as prod for identical behavior) | disposable, pausable |
| `plantai-prod` (planned name) | production deploys | nearest to audience — candidates `ap-south-1` (Mumbai) or `eu-central-1`; owner decides | low latency; regular production traffic normally keeps the DB awake. Exact project name, region and pause state remain owner-unverified, not repository facts |

- Create both at supabase.com → **New project**. Record the passwords in a password manager (needed for `supabase db dump`/psql access).
- **Tradeoff note:** prod region affects latency for all users; if the audience is global-English with an Indian focus, `ap-south-1` is a reasonable default. If in doubt, stay in the region you can debug fastest. (Supabase free-tier region options are the same everywhere — no cost difference on Free.)

### 5.2 Apply migrations to prod

`DATABASE_SCHEMA.md` defines the SQL. Apply to the **prod** project only after confirming that project exists and is the intended target (its state remains owner-unverified, not proven here):

**Option A — Dashboards SQL Editor (simplest for now):**
1. Open `plantai-prod` → SQL Editor.
2. Paste the contents of each file in `supabase/migrations/` in timestamp order and run.
3. Record in `CHANGELOG.md` which migrations were applied and when.

**Option B — CLI (better as soon as flows are repeatable):**

```powershell
cd C:\Users\supersohail\PlantAI
npx supabase login

# link to prod project (get ref from dashboard URL: https://supabase.com/dashboard/project/<ref>)
npx supabase link --project-ref <prod-project-ref>
npx supabase db push
```

Later, the same `supabase db push` command slots into CI (Phase 2+, optional — see `TASKS.md`).

> **Migration status:** `README.md` records migrations 000–004 as applied to the development project and migration 005 as pending; it does not verify production migration state. Do not read this checklist as evidence that production migrations have been applied. Verify the production Supabase project before relying on any schema claim.

### 5.3 Storage buckets

Create in the **prod** project (and mirror in dev):

| Bucket | Public? | Purpose | Access |
|---|---|---|---|
| `plant-images` | **public** | curated plant library / illustration images (rehosted, attribution-respecting forms; see image-licensing note in `docs/VERIFIED_FACTS.md` §Pl@ntNet) | read: anon; write: service role only |
| `request-images` | **private** | uploaded photos used by an identification request (disposable) | read/write: owner (authenticated user) only via RLS policies; bypassed by service role for server-side flow |

*Storage RLS/policy details in `DATABASE_SCHEMA.md` and `SECURITY.md` — make sure storage policies are applied alongside table RLS in the same step.*

> **Implementation scope:** the table describes the intended bucket design. `request-images` is private and request-image uploads, signed-URL delivery, automated cleanup, account deletion and 90-day retention are **not implemented**. Exact bucket provisioning and storage policies in production require owner verification.

### 5.4 Auth configuration

Normal-use auth in the current **local repository** is direct Supabase Google OAuth. The complete owner-only Google Cloud/Supabase provider checklist is in [`docs/GOOGLE_OAUTH_SETUP.md`](docs/GOOGLE_OAUTH_SETUP.md). This describes the local implementation, not the deployed production site: local `HEAD` `0b17682` has not been pushed or deployed, so the live Netlify site's current auth behavior must be verified by the owner rather than assumed.

The redirect values below are the allowlist the owner must configure; their presence in the Supabase dashboard is not verified by this repository. In each Supabase project (Dashboard → Authentication), the owner must:

- Enable **Google** with the owner-created OAuth client ID/secret and use the
  exact Supabase callback URL shown in the provider form.
- **Redirect URLs** (Auth → URL Configuration) — allowlist **all** origins that
  can start the flow:
  - local: `http://127.0.0.1:3000/**` and `http://localhost:3000/**`
  - every exact Netlify preview origin the owner configures and verifies; no
    preview hostname is invented or assumed in this repository
  - production: `https://strong-mochi-e3869f.netlify.app/**` (and any later
    custom domain, §8)
- Set the **Site URL** to the canonical production origin. The app builds
  `redirectTo` from the browser's current origin, so that origin must be
  allowlisted. Vercel preview patterns in earlier revisions were historical.
- Keep **Email** enabled for rollback and keep **signups** open. Do not delete
  users, identities, profiles, RLS policies or Storage policies.
- Legacy email templates/callbacks remain for outstanding links only; they are
  not part of normal-use UI.

No Google credential is stored in PlantAI source or environment variables.
Real Google sign-in success, deployed callback behavior, and automatic identity
linking are **not** claimed by local/offline tests; they remain owner E2E
checks.

### 5.5 Pausing behavior (documented, not feared)

- **Dev project may pause after ~1 week of low DB activity** (`docs/VERIFIED_FACTS.md` §Supabase). This is normal between dev sessions. Restore via the Supabase dashboard with all data intact; the restore window is 1 year.
- **Prod normally stays awake** via regular user traffic (unlimited API requests on all plans per `docs/VERIFIED_FACTS.md`); a pre-launch site with no traffic can still pause. Current pause state requires owner verification.
- If prod ever pauses (e.g. pre-launch with no users), just restore it from the dashboard — build a "restore prod" step into the §7 checklist before launch morning.

---

## 6. Environment configuration

> **Canonical names are current; Vercel scopes below are historical.** Current
> production secrets live in Netlify site environment variables. Preview
> origins and their env scopes are owner-configured and require verification.

### 6.1 Full env var table

Canonical names (do not rename — see also `ENVIRONMENT_SETUP.md` and `src/lib/env.ts`):

| Variable | Where the value comes from | Client-accessible? | Local (`.env.local`) | Preview (historical Vercel / owner-configured Netlify) | Production (current Netlify site; historical Vercel) |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | You construct it: local = `http://localhost:3000`; deploy = the site URL; future = custom domain | ✅ YES (by design — used by browser-visible canonical/meta URLs) | `http://localhost:3000` | the preview origin configured by the owner | `https://strong-mochi-e3869f.netlify.app` → `https://<custom-domain>` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL | ✅ YES (anon traffic needs it to reach auth/storage) | dev project URL | dev project URL | prod project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase dashboard → Project Settings → API → **Publishable key** (ADR-9 2026-11-10; earlier docs used `NEXT_PUBLIC_SUPABASE_ANON_KEY`, but current source has no anon-key fallback) | ✅ YES (designed to be public; intended protection depends on correctly deployed RLS policies and grants, not migration files alone, `SECURITY.md`) | dev project publishable key | dev project publishable key | prod publishable key |
| `SUPABASE_SECRET_KEY` | Supabase dashboard → Project Settings → **API Keys** → secret key (`sb_secret_...`) | ❌ NO — **server only, never `NEXT_PUBLIC_`-prefixed** | dev project secret key | dev project secret key (or omit if preview flow never needs it) | prod project secret key |
| `SUPABASE_SERVICE_ROLE_KEY` (legacy fallback) | Supabase dashboard → Project Settings → **API Keys** → legacy `service_role` JWT | ❌ NO — **server only, never `NEXT_PUBLIC_`-prefixed** | accepted only when `SUPABASE_SECRET_KEY` is unset | same fallback rule | same fallback rule; migrate to `SUPABASE_SECRET_KEY` |
| `PLANTNET_API_KEY` | your `my.plantnet.org` account (one account per person — `docs/VERIFIED_FACTS.md` §Pl@ntNet) — free plan, 500/day | ❌ NO — **server only** | optional locally (empty = sample data; key alone never enables live) | optional, but keep mode `mock` to avoid live calls | owner-managed free key if live mode is approved; key presence is owner-unverified |
| `PLANTNET_MODE` | Explicit `live` / `mock` switch; missing, blank or invalid defaults to `mock`, and `mock` wins even with a key | ❌ NO (server-only behavior flag) | `mock` recommended | `mock` recommended | Deployed value and behavior are **owner-unverified**; source default is `mock` when missing/blank/invalid. `live` only after owner approval with `PLANTNET_MODE=live` and a valid server-only key |
| `PLANTAI_PERSISTENCE_ENABLED` | Server-only write switch; only the exact string `true` enables automatic identification writes | ❌ NO — **server only** | `false` (safe default) | `false` unless the preview specifically needs writes | `false` unless separately owner-approved; default is OFF |
| `IP_HASH_SALT` | Owner-generated random value, server-only | ❌ NO — **server only** | optional; set for stable local counters | set if stable preview counters are needed | recommended for stable per-IP counters; actual presence is owner-unverified |
| `SUPABASE_DB_URL` (optional tooling) | Supabase dashboard → Project Settings → Database | ❌ NO — **server-only/local tooling** | only for manual dumps/psql | usually unused | usually unused; not read by application code |
| *(planned, not configured)* `RESEND_API_KEY` etc. | any future transactional email/paid service | ❌ NO | — | — | not part of the current zero-budget baseline |

> Presence and values of production environment variables remain owner-unverified; check the Netlify dashboard. This table documents names and intended scopes only. Narrow source-verified behavior: the mock Pl@ntNet provider can be selected without `PLANTNET_API_KEY`, but `/api/identify` creates a Supabase server client at request start, and `getPublicSupabaseConfig()` requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and throws when either is missing. That does **not** prove authentication, saved plants, database-backed features, all routes or a complete production build work without Supabase public credentials. No full-app or full-build claim is made here without a separate safe verification.

### 6.2 Exposure rules (critical)

> **Never prefix a secret with `NEXT_PUBLIC_`.** `NEXT_PUBLIC_*` variables are literally written into the JavaScript bundle served to every visitor — anyone with DevTools can read them. `SUPABASE_SECRET_KEY` (and the deprecated `SUPABASE_SERVICE_ROLE_KEY` fallback) bypasses RLS entirely, and `PLANTNET_API_KEY` is a private API key whose browser-side use is explicitly restricted by Pl@ntNet CORS rules (`docs/VERIFIED_FACTS.md` §Pl@ntNet). All must stay server-only.
>
> The Supabase **publishable/anon key is designed to be public**. Actual protection depends on correct deployed RLS policies and grants; migration-defined policies are documented, but deployed Supabase policy/grant state remains owner-unverified. Do not treat migration files alone as proof that production data is protected (see `SECURITY.md` and the §9 anonymous-export check).

### 6.3 How `.env.local` mirrors host environment settings

- `.env.local` (git-ignored per §3.2) is the local file for values; point `NEXT_PUBLIC_SUPABASE_URL` and its keys at the development project when working locally. Its current contents are not inspected or asserted by this guide.
- Default `PLANTNET_MODE=mock` in `.env.local` so day-to-day dev doesn't burn the shared daily quota; an API key by itself never enables live mode.
- `.env.example` (committed) mirrors var names with placeholder values + comments.
- When a variable is added/renamed, update **all three** in one commit: `.env.example`, `.env.local` locally, and the current host's dashboard entries (Netlify site env; historical Vercel Preview + Production scopes). Include `PLANTAI_PERSISTENCE_ENABLED` and `IP_HASH_SALT` in that check; neither belongs in client code.

---

## 7. Production deployment checklist

Pre-flight — run top to bottom the day before / of enabling production traffic. This table mixes repository checks with dashboard actions; a green local build is not proof of production state. Items involving Netlify, Supabase or Google settings require owner verification.

| # | Check | How | Blocked by failure? |
|---|---|---|---|
| 1 | `npm run build` + `npm run lint` clean on local `main` | PowerShell: `npm run build; npm run lint` | ✅ yes |
| 2 | Critical tests from `TESTING_PLAN.md` pass locally | `npm run test` (or project's chosen runner) | ✅ yes |
| 3 | Migrations applied to **prod** Supabase (all of `supabase/migrations/`) | SQL editor or `npx supabase db push` (§5.2); confirm via Table Editor row counts matching `DATABASE_SCHEMA.md` | ✅ yes |
| 4 | RLS policies enabled and validated on every table per `DATABASE_SCHEMA.md` + `SECURITY.md` | SQL editor: `SELECT relname, relrowsecurity FROM pg_class JOIN pg_namespace ...` (or Supabase dashboard "RLS enabled" indicator), plus manual anon-select query check | ✅ yes |
| 5 | Storage buckets exist with correct policies (`plant-images` public read; `request-images` owner-only) | Supabase Dashboard → Storage; attempt an anonymous read/write test | ✅ yes |
| 6 | Google provider enabled, Supabase callback registered, and redirects allowlist includes the **prod origin** | Supabase Auth settings (§5.4 + `docs/GOOGLE_OAUTH_SETUP.md`); Email provider still enabled for rollback | ✅ yes |
| 7 | Host env vars set with correct values; secret values are NOT `NEXT_PUBLIC_`-prefixed | Current Netlify site → Site configuration → Environment variables (historical Vercel scopes in §6) | ✅ yes |
| 8 | `robots.txt` serves and allows production crawling | `curl`/browser: `https://<prod-url>/robots.txt` | ✅ yes (SEO-blocking otherwise, see `SEO_STRATEGY.md`) |
| 9 | `sitemap.xml` reachable and lists current routes | `https://<prod-url>/sitemap.xml` | ✅ yes |
| 10 | Security headers configured (CSP, X-Frame-Options, Referrer-Policy, etc.) | implemented in `next.config.ts`; verify deployed response headers via `curl -I` on the current host; full header list lives in `SECURITY.md` | ✅ yes |
| 11 | `/identify` smoke-tested **in mock mode first** | deploy preview with `PLANTNET_MODE=mock` → verify sample-data response. Live check only after separate owner approval: set both `PLANTNET_MODE=live` and a valid server-only key, then do a single live identification and record `remainingIdentificationRequests`. The deployed Netlify mode, key presence and live behavior remain **owner-unverified**; source defaults do not prove the live setting | ✅ yes |
| 12 | Supabase prod project not paused, activity will be regular (real users) | dashboard status | ✅ yes |
| 13 | Error-monitoring plan noted | For MVP: host runtime logs only (currently Netlify; exact retention/fields require owner verification). Historical Vercel Hobby retention was **UNVERIFIED** in `docs/VERIFIED_FACTS.md`; treat logs as "look now, not later" until the owner confirms otherwise | — |

---

## 8. Domain configuration (Netlify application only)

> **Current host is Netlify:** the steps below use the Netlify dashboard rather
> than the original Vercel DNS flow. Current production uses
> `https://strong-mochi-e3869f.netlify.app`; custom-domain setup is an owner
> decision to verify in the Netlify dashboard. This section concerns **only the
> Netlify-hosted PlantAI application**. The separate `PlantAI Garden Guide`
> Blogger/Blogspot site at <https://plantai-garden-guide.blogspot.com/> has its
> own URL and its own AdSense review. A custom domain for the Netlify app is
> **not a prerequisite** for that Blogger site's AdSense review, and these steps
> are not instructions to change Blogger configuration or buy a Blogger domain.

**Phase-gated:** No custom domain for the Netlify application is evidenced or required here. The current free Netlify site URL is in use; a Netlify custom domain remains **optional** and owner-gated for the application. Keep the zero-budget baseline: no price, ranking benefit, AdSense approval or Blogger-site domain purchase is claimed; check the registrar and current official guidance only if the owner chooses this optional app-domain path.

### 8.1 When a Netlify app domain IS purchased (current Netlify path)

1. **At the registrar:** add the DNS records shown in the Netlify dashboard for the site. Use the exact values Netlify displays; do not reuse historical Vercel `A`/`CNAME` values from earlier revisions.
2. **In Netlify:** Site configuration → Domain management → add the domain and follow the dashboard's verification steps.
3. **www redirect policy:** choose one canonical form (apex or `www`) and configure the other to redirect in the Netlify dashboard; verify the redirect after DNS propagates. All internal links must use the canonical form.
4. **TLS:** confirm certificate status in the Netlify dashboard; do not assume a specific provisioning or renewal flow without checking.
5. **Update `NEXT_PUBLIC_SITE_URL`** in the Netlify production environment to `https://<final-domain>` and redeploy so metadata, canonical URLs and sitemap reflect it.
6. **Google Search Console:** add the property (Domain or URL-prefix type), verify ownership (usually via a DNS TXT record), then submit `sitemap.xml` there and in §9.
7. **Update the Supabase redirect allowlist and Site URL** to the new domain (§5.4), and re-verify the Google provider configuration.
8. **Confirm the sitemap base URL:** `src/app/sitemap.ts` reads `NEXT_PUBLIC_SITE_URL` and falls back to `http://localhost:3000`; verify the deployed output uses the final domain.
9. Log the change + date in `CHANGELOG.md`.

> This repository contains no `netlify.toml`; domain and TLS settings are dashboard-managed and require owner verification. Historical Vercel DNS instructions are superseded.

---

## 9. Post-deployment verification

Run this immediately after the first production deploy (and again after any large feature):

| # | Check | Expected |
|---|---|---|
| 1 | Every primary route returns `200` | `/`, plant detail sample, about, contact, sitemap, robots | 
| 2 | `/identify` end-to-end **anonymous** | upload a photo → get a JSON response with results; anonymous rate per `SECURITY.md` |
| 3 | Google auth loop works | `/login` and `/signup` → Continue with Google → verified callback + cookies → protected `?next=` → sign out → protected route redirects; owner-only E2E |
| 4 | Contact form delivers | row appears in `contact_messages` in the prod Supabase table (see `DATABASE_SCHEMA.md`) |
| 5 | RLS holds from anonymous exports | `curl` the Supabase REST API with only the anon key and attempt a SELECT on a protected table (e.g. `user_plants`): expect empty/403, NOT data. Example: `curl "https://<ref>.supabase.co/rest/v1/user_plants?select=*" -H "apikey: <anon>" -H "Authorization: Bearer <anon>"` |
| 6 | Lighthouse quick run | Chrome DevTools → Lighthouse on the home page; record scores in `CHANGELOG.md`. Perf budget per `SEO_STRATEGY.md` |
| 7 | Search Console verify + sitemap submit | after domain is live (§8) |
| 8 | Verify prod Pl@ntNet headers **only if live mode is separately approved and enabled** | one real identify call; log `remainingIdentificationRequests` (quota detail in `docs/VERIFIED_FACTS.md` §Pl@ntNet). Deployed mode/key/live behavior is owner-unverified; skip unless the owner explicitly confirms approved live mode |
| 9 | Prod logs scanned for `console.log` of any secret | zero secret leaks (`SECURITY.md` rule); Netlify log fields/retention remain owner-unverified |

> Production header, auth, provider and live-identification results require owner verification. This guide does not claim those checks have already been run.

---

## 10. Upgrade path / hosting migration (Phase 5 — historical decision record)

> **Historical section:** PlantAI already migrated from the original Vercel Hobby
> plan to Netlify Free. Keep this as the decision record; do not treat the Vercel
> options below as the current production path.

The Vercel Hobby commercial-use constraint is historical (`docs/VERIFIED_FACTS.md` §Vercel). If hosting is revisited, the owner must re-verify current terms before relying on them.

### Step 1 — Verify alternatives

For each candidate, do the following and record in `docs/VERIFIED_FACTS.md` with the date:

1. Read the **actual current ToS/pricing pages on the vendor's own website** (not blogs or third-party reviews) — commercial-use clause, free-tier limits, function limits, Next.js support.
2. Note the **verification date**.
3. Record the exact quoting sentence, not the conclusion.

Netlify's current official FAQ was checked previously and states that the Free
plan has no restriction on commercial use within the plan's credit limit
(<https://netlify.com/solutions/web-applications/>). This is a previously
verified external fact, not a claim about the live site's AdSense approval or
revenue. The older row in `docs/VERIFIED_FACTS.md` still marks it UNVERIFIED and
should be updated when that file is next approved for editing. Cloudflare Pages
free-tier limits and Next.js/OpenNext compatibility remain **UNVERIFIED** in
that record.

### Step 2 — Decide (historical options)

| Option | Path |
|---|---|
| **Stay on Vercel** (historical option) | Upgrade to Pro — first recurring cost; the historical `$20/mo per seat` price must be re-verified and is **not** a requirement of this guide. Re-verify env vars survive; confirm paid-flag features don't trigger other limits. Update `MONETIZATION_PLAN.md`. |
| **Migrate** (if a free tier's terms allow commercial use) | 1. Read the target's Next.js support notes (standard Next.js usually "just works"; Cloudflare Pages requires the **OpenNext adapter** — a build-layer change). 2. Adjust build adapter if needed. 3. Import repo on the new host. 4. Re-create env vars from the §6 table with per-scope scoping. 5. **Re-point DNS**: at the registrar, remove Vercel DNS records, add the new host's records, wait for TTL/propagation. 6. Re-validate §9 checklist on the new host. 7. Keep Vercel project around for 1–2 weeks as a fallback rollback target. 8. Update `CHANGELOG.md` + `docs/VERIFIED_FACTS.md`. |

The Next.js app should be portable by design — that is why no Vercel-only APIs were used in earlier phases (§1).

> **Zero-budget rule:** paid upgrades in this historical table are options, not requirements. No paid plan, trial, seat addition or card-requiring change is to be enabled without explicit owner approval (§12).

---

## 11. Backups & disaster recovery

| Asset | Backup status on free tiers | Action |
|---|---|---|
| **Supabase DB (`plantai-prod`)** | ⚠️ **NO automatic backups on Free** (`docs/VERIFIED_FACTS.md` §Supabase). Weekly manual dump required until a paid tier or CI job replaces it. | Weekly (or before every migration): PowerShell into a repo-external folder (e.g. your code drive — NOT inside the git repo, it's binary-ish data): `npx supabase db dump --db-url "<prod-connection-string>" --file C:\backups\plantai\plantai-prod-<yyyy-MM-dd>.sql` — keep a password-manager-protected copy location documented. Quota reset dates in `docs/VERIFIED_FACTS.md`. |
| **Supabase DB (`plantai-dev`)** | Same — but lower value; can be re-seeded from prod or fixtures | dump before large test migrations only |
| **Supabase Auth data** | Included in the DB dump | same weekly dump covers it |
| **Supabase Storage (`plant-images`)** | ⚠️ Not backed up automatically on Free | decide per canonical decision: re-hostable — either (a) keep the source images under `supabase/` or in a public sources folder in the repo and re-upload on crash, or (b) bucket dump monthly (effort UNVERIFIED). Choose (a) for simplicity — "plant library images are re-fetchable/rehostable". Upload script lives in a Phase-2+ task per `TASKS.md`. |
| **Supabase Storage (`request-images`)** | Disposable by design — user identification uploads are transient per privacy stance (`SECURITY.md`) | no backup needed |
| **Code + docs** | Git — push regularly to GitHub | automatic |
| **Secrets** | Recoverable from dashboards (Supabase API settings, my.plantnet.org account page, current host env-var UI — Netlify site env; historical Vercel env UI hid old values; keep a password-manager copy) | keep current copies in a password manager |
| **Host deployment history** | Current Netlify deployment history; exact rollback procedure requires owner verification (historical Vercel instant rollbacks in §13) | no extra action |

---

## 12. Cost-drift monitoring plan

Zero-budget plan needs a monthly guard-rail — drift to **$0** is the whole point until Phase 5. The following are looked at **once a month** at minimum (calendar reminder), and more often whenever a change touches a quota-relevant path (upgrades to upload volume, new DB writes, SEO push).

| What to watch | Where | Target state |
|---|---|---|
| **Supabase** usage dashboard | Supabase Dashboard → project → Usage/Reports: DB size, egress, storage, MAU | under 500 MB DB / 5 GB egress / 1 GB storage / 50k MAU (`docs/VERIFIED_FACTS.md` §Supabase); pause state on dev is fine |
| **Host** usage page | Netlify dashboard usage/billing (current); historical Vercel Dashboard → Usage limits were 100 GB transfer / 1M invocations / 5k image transforms (`docs/VERIFIED_FACTS.md` §Vercel) | stay within the current plan's verified limits; no commercial-use assumption is made for a host without current official evidence |
| **Pl@ntNet** remaining quota | response headers from each identify call (`remainingIdentificationRequests`) — and remember exceeded quota returns HTTP 429 until the midnight UTC reset (`docs/VERIFIED_FACTS.md` §Pl@ntNet) | ideally under ~450/day; if prod alone approaches 500, that is a Phase-5 flag for paid Pl@ntNet plan (pricing UNVERIFIED, re-check at decision time) or request-throttling |
| **GitHub** | Actions minutes on private repos (not applicable — public repo) | n/a |
| **Domain** | no recurring spend yet | only the one-time Phase-3/5 registrar invoice when bought |
| **Spend-cap / overage protection** | Supabase Dashboard → Organization → Billing: ensure **spend-cap is set to $0** (no charges possible) so even accidental over-limit usage cannot bill the card. Exact UI wording/capability UNVERIFIED-at-facts — treat as a dashboard step to confirm, not a fact. Confirm the current Netlify plan's overage behavior in the owner's dashboard; historical Vercel Hobby exceeded-cap behavior is in `docs/VERIFIED_FACTS.md` §Vercel. | **hard rule: no paid plan is toggled without explicit user approval** — including "trial" toggles, seat additions, or anything that asks for a card |

Record each month's numbers in a short `CHANGELOG.md` line (e.g. "2026-12-01 — cost check: Supabase 21% DB / host 8% bandwidth / Pl@ntNet 120 max diag/day").

---

## 13. Rollback strategy

| Layer | Rollback mechanism | Notes |
|---|---|---|
| **App (current Netlify; historical Vercel)** | Use the current host's deployment history to redeploy the last known-good deployment; exact Netlify rollback procedure requires owner verification. Historical Vercel instant rollbacks: Dashboard → Deployments → previous good deployment → "Promote to Production" / "Rollback". | First response to a broken prod deploy. Then fix-forward on a branch, merge, and confirm new deploy. Re-running §9 checks is recommended after any rollback. |
| **DB migrations** | **Forward-only.** Write a new migration file that reverses the bad one (add-column → drop-column, etc.) rather than "restoring" the DB. | Keeps data safe and mirrors the Supabase CLI's model. Down-migration guidance: always pair every `.sql` in `supabase/migrations/` with a documented "reversal" note in `DATABASE_SCHEMA.md` (or a sibling `.down.sql` if the runner supports it). If a migration was destructive (dropped a table), restore from the last weekly DB dump (§11) and accept data loss after user communication. |
| **Feature flags** | Phased rollouts achievable via an `app_settings` table (see `DATABASE_SCHEMA.md`): server reads a boolean at request time and gates the feature. | Zero rebuild needed to disable a feature. Set `flag = false` in Supabase → the feature is off in prod within seconds. Used sparingly; MVP needs few flags. |
| **Secrets** | If a secret is compromised: rotate at the source (Supabase / Pl@ntNet dashboard regenerate) then update in current host env vars (Netlify site env) and redeploy. Supabase publishable/anon + secret/service-role keys can be regenerated (`SECURITY.md`). | Log the rotation in `CHANGELOG.md` without ever recording the key itself. |
| **DNS/Domain** | Bad change at the registrar → remove the wrong record, re-add the §8-documented values. TTL wait applies. | Keep a copy of the working DNS records in a password-manager note. |

---

## 14. Quick reference: canonical commands

PowerShell, from `C:\Users\supersohail\PlantAI`:

```powershell
# --- Local sanity pre-push (§3, §7) ---
npm run lint
npm run build
npm run test

# --- Git flow (§3) ---
git status; git add .; git commit -m "feat: <short description>"; git push

# --- Supabase (§5) ---
npx supabase login
npx supabase link --project-ref <prod-ref>
npx supabase db push                              # apply all pending migrations to prod
npx supabase db dump --db-url "<prod-conn-string>" --file C:\backups\plantai\plantai-prod-2026-11-10.sql  # §11 weekly backup

# --- Quick live checks from PowerShell (§7, §9) ---
curl https://<prod-url>/robots.txt
curl https://<prod-url>/sitemap.xml
curl -I https://<prod-url>                        # headers incl. security headers
curl "https://<ref>.supabase.co/rest/v1/user_plants?select=*" -H "apikey: <anon-key>"   # §9#5 — must NOT return protected rows
```

> Keep this file in sync with reality. When deployment reality changes (new env var, new bucket, changed hosting), update **this file and `docs/VERIFIED_FACTS.md` in the same commit**. Cross-check `TASKS.md` for the next deployment step and `CHANGELOG.md` for the log of what was actually deployed when.
