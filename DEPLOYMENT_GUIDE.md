# PlantAI — Deployment Guide

> ⚠️ **Status update (2026-11-17):** production hosting has been decided and implemented — PlantAI is deployed on **Netlify Free** (<https://strong-mochi-e3869f.netlify.app>), chosen over Vercel Hobby because Vercel's Hobby plan is non-commercial-only (see below and the Phase 5 hosting decision). The Vercel-specific instructions in this guide are **historical reference only**; for the current deployment path, environment-variable scopes, and platform limits see the Stage 2A Netlify deployment checklist (kept internal to the project; the essentials are summarized in `README.md`). The Supabase guidance in this document remains accurate.
>
> Purpose: how PlantAI goes from local Windows dev to a live, non-commercial Vercel deployment — and how it evolves after that. Covers GitHub setup, Vercel dashboards, Supabase two-project flow, environment variables, pre-flight and post-deployment checklists, domains, rollback, backups, and the Phase 5 hosting decision.
>
> **Facts rule:** every third-party quota/pricing claim in this file traces to `docs/VERIFIED_FACTS.md` and is cited as such. Anything not verified there is marked **UNVERIFIED**. Dates in this file assume the verification date 2026-11-10 recorded in `docs/VERIFIED_FACTS.md`.
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
8. [Domain configuration](#8-domain-configation)
9. [Post-deployment verification](#9-post-deployment-verification)
10. [Upgrade path / hosting migration (Phase 5)](#10-upgrade-path--hosting-migration-phase-5)
11. [Backups & disaster recovery](#11-backups--disaster-recovery)
12. [Cost-drift monitoring plan](#12-cost-drift-monitoring-plan)
13. [Rollback strategy](#13-rollback-strategy)
14. [Quick reference: canonical commands](#14-quick-reference-canonical-commands)

---

## 1. Deployment philosophy

PlantAI deploys on a zero budget with hard external limits (per `docs/VERIFIED_FACTS.md`:

- **Vercel Hobby** — free, ~100 GB transfer / 1M function invocations per month, but **NON-COMMERCIAL ONLY**. AdSense on Hobby explicitly violates Vercel's fair-use rules (ads = commercial use, per `docs/VERIFIED_FACTS.md` §Vercel). Enforcement may disable the deployment without notice.
- **Supabase Free** — 500 MB DB / 1 GB storage / 50k MAU / unlimited API requests, **2 free projects**, paused after ~1 week of low DB activity (restorable within 1 year).
- **Pl@ntNet free** — 500 identifications/day, per account. **One free account per person is allowed**; multiple free accounts from one person/IP are forbidden (`docs/VERIFIED_FACTS.md` §Pl@ntNet).

### Principles

| Principle | Meaning in practice |
|---|---|
| **Ship small, ship often** | One feature → one PR → one preview deploy → merge. No big-bang releases. |
| **Preview deploys for every feature** | Every PR gets an automatic Vercel preview URL + its own env-var scope (see §4 and §6). Review the preview before merging. |
| **Never deploy broken `main`** | `main` must always pass `npm run build`, `npm run lint`, and the critical tests from `TESTING_PLAN.md` locally before push. Broken `main` = fix-forward or instant Vercel rollback (§13). |
| **Stay portable by design** | Standard Next.js App Router app with no vendor lock-in features (no Vercel-only edge APIs unless replaceable). This preserves the Phase 5 option to move to Netlify/Cloudflare. |
| **No secrets in the repo** | All secrets live in `.env.local` (git-ignored) and Vercel's encrypted env vars. See `SECURITY.md`. |
| **Free-tier friendly by default** | Dev minimizes Pl@ntNet real identifications (mock mode, §2). Supabase dev project is allowed to pause between sessions (that is normal and free to restore). |

### The single hosting constraint that shapes everything

> **Running ads (AdSense) on Vercel Hobby is a ToS violation.** PlantAI therefore deploys to Hobby **only while non-commercial**. At Phase 5 (monetization) the decision is: **upgrade Vercel Pro ($20/mo)** or **migrate** to a host whose terms allow commercial use on a free tier (Netlify/Cloudflare — **UNVERIFIED**, must be verified per §10). Source: `docs/VERIFIED_FACTS.md` §Vercel, §Alternative hosting.

---

## 2. Environment matrix

Three environments. Differences that actually matter:

| Aspect | Local (Windows) | Preview (Vercel per-PR) | Production (Vercel `main`) |
|---|---|---|---|
| **Branch** | any feature branch | PR branch | `main` |
| **URL** | `http://localhost:3000` | `plantai-git-<branch>-<team>.vercel.app` | `plantai-<name>.vercel.app` → custom domain at Phase 5 |
| **Supabase project** | `plantai-dev` (may pause between sessions — acceptable) | `plantai-dev` (same as local, so preview data matches local dev) | `plantai-prod` (kept awake by user traffic) |
| **Storage buckets** | same schema/buckets recreated in dev project | n/a (uses dev project) | `plant-images` (public), `request-images` (private) |
| **Pl@ntNet key** | shared free key, but app runs in **`PLANTNET_MODE=mock`** during development so no real API calls | shared free key, `PLANTNET_MODE=mock` (if a real test is needed, do it deliberately — see caution below) | shared free key, **real mode** |
| **`NEXT_PUBLIC_SITE_URL`** | `http://localhost:3000` | preview URL (set per branch in Vercel or computed) | production URL |
| **Env var scope in Vercel** | `.env.local` (git-ignored) | "Preview" environment in Vercel dashboard | "Production" environment in Vercel dashboard |
| **Auth redirect URLs** | `http://localhost:3000/**` in Supabase dashboard | each preview domain added to Supabase Auth redirect allowlist | `https://<prod-domain>/**` |
| **Error monitoring** | terminal / browser console | Vercel deploy logs | Vercel runtime logs (Hobby log retention is limited — **UNVERIFIED** exact hours; treat as very short. See §7.) |
| **Purpose** | build features | validate the PR in a production-like build | serve users |

### Pl@ntNet shared-quota caution (important)

Dev, preview and prod **SHARE the same 500/day key** (`docs/VERIFIED_FACTS.md` §Pl@ntNet: quota is per account/day). Creating a second free account is **NOT an option — Pl@ntNet terms allow one free account per person and forbid multiple free accounts submitting from the same IP** (`docs/VERIFIED_FACTS.md` §Pl@ntNet, Account rules).

**Decision:**
- **Prod owns the free key** (`my.plantnet.org` — create one account, one key, server-side only).
- **Dev and preview use the same key but in `PLANTNET_MODE=mock`** — an env flag that makes the `/identify` endpoint return canned fixture responses (saved sample Pl@ntNet JSON from `TESTING_PLAN.md` fixtures) instead of calling the API. Zero quota consumed normally.
- When a **real** dev-time identification is genuinely needed (e.g. verifying parsing against live data), set `PLANTNET_MODE=real` temporarily in `.env.local`, run 1–2 calls, then switch back. Log `remainingIdentificationRequests` from each real response to track remaining daily quota (route + header detail in `docs/VERIFIED_FACTS.md` §Pl@ntNet).
- Response **headers on 429**: quota resets at midnight UTC. If prod ever returns 429 in production, log and surface a friendly "daily limit reached — try tomorrow" state instead of an error.
- **Client-side validation happens BEFORE** calling Pl@ntNet: since 2026-02-13, errored identify requests **also consume 1 credit** on the free plan (`docs/VERIFIED_FACTS.md` §Pl@ntNet). Validate image count (1–5 images, same plant), file type (`image/jpeg` / `image/png`), and total POST size ≤ 50 MB server-side before proxying.

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

> **Always commit an `.env.example`** that lists every variable name with a placeholder value and a comment pointing to §6 of this file. This is the bridge between "secrets are secret" and "a new dev (or future you) knows what to set."

### 3.3 Git conventions

- Branch flow: feature branches → PR → squash-merge to `main`. Optional short-lived `dev` branch if needed; `main` is the source of production deploys.
- Conventional commits encouraged (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`), not enforced with tooling.
- Solo dev, keep protection simple: optionally require 1 PR before merging on `main`, and never push `--force` to `main`.
- Log significant deployments/decisions in `CHANGELOG.md`.

---

## 4. Vercel setup

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

> Next.js 15+ works out of the box on Vercel — no config needed for a standard app. If a Phase-5 migration ever happens, a standard Next.js app is portable by design (§10).

### 4.2 Env-var scopes in Vercel (dashboard step)

For each var defined in §6, pick one of three scopes in the Vercel "Environment Variables" panel:

| Scope | Applies to | PlantAI usage |
|---|---|---|
| **Production** | the `plantai-<name>.vercel.app` site ( deployments from `main`) | real Supabase prod keys, real Pl@ntNet key, prod `NEXT_PUBLIC_SITE_URL` |
| **Preview** | every PR preview URL | `plantai-dev` Supabase keys, `PLANTNET_MODE=mock`, preview-appropriate URL |
| **Development** | only used if running `vercel dev` locally — NOT used for plain `npm run dev` | generally unused; `.env.local` rules locally instead |

Per-branch overrides (e.g. a different `NEXT_PUBLIC_SITE_URL` for a feature branch preview) are done via the target-branch field on each env-var entry.

### 4.3 What Vercel encrypted env vars actually do

- Values are stored encrypted at rest and injected into the build/runtime as environment variables — they are **not** visible in logs and cannot be read back from the dashboard after saving (only replaced/deleted). Copy them into a password manager at the time of entry.
- Build-time-vs-runtime: `NEXT_PUBLIC_*` vars are **inlined into the client JS bundle at build time** — changing one requires a rebuild/redeploy. Server-only secrets (§6) are read at request runtime and are safe to swap without a rebuild (unless referenced during build).
- **Warning:** anything with the `NEXT_PUBLIC_` prefix is visible to anyone who views the deployed site's JS. Never put `SUPABASE_SERVICE_ROLE_KEY` or `PLANTNET_API_KEY` behind that prefix (§6).

---

## 5. Supabase setup for deployment

Canonical decision (`CAPACITOR...` note — ignore — canonical decisions in the project brief): **two projects** within the free tier's 2-project allowance.

### 5.1 Create both projects

| Project | Role | Region | Why |
|---|---|---|---|
| `plantai-dev` | local + preview deploys | nearest region to you (choose the same region as prod for identical behavior) | disposable, pausable |
| `plantai-prod` | production deploys | nearest to audience — candidates `ap-south-1` (Mumbai) or `eu-central-1`; user decides | low latency, keeps the DB awake via real traffic |

- Create both at supabase.com → **New project**. Record the passwords in a password manager (needed for `supabase db dump`/psql access).
- **Tradeoff note:** prod region affects latency for all users; if the audience is global-English with an Indian focus, `ap-south-1` is a reasonable default. If in doubt, stay in the region you can debug fastest. (Supabase free-tier region options are the same everywhere — no cost difference on Free.)

### 5.2 Apply migrations to prod

`DATABASE_SCHEMA.md` defines the SQL. Apply to the **prod** project either way:

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

### 5.3 Storage buckets

Create in the **prod** project (and mirror in dev):

| Bucket | Public? | Purpose | Access |
|---|---|---|---|
| `plant-images` | **public** | curated plant library / illustration images (rehosted, attribution-respecting forms; see image-licensing note in `docs/VERIFIED_FACTS.md` §Pl@ntNet) | read: anon; write: service role only |
| `request-images` | **private** | uploaded photos used by an identification request (disposable) | read/write: owner (authenticated user) only via RLS policies; bypassed by service role for server-side flow |

*Storage RLS/policy details in `DATABASE_SCHEMA.md` and `SECURITY.md` — make sure storage policies are applied alongside table RLS in the same step.*

### 5.4 Auth configuration

In each project (Dashboard → Authentication), configure:

- **Email confirmation: ON** ("Confirm email" toggle). This generates the standard signed-up-but-unconfirmed flow. Confirmations emails are sent by Supabase's built-in email service — rate limits on Free are **UNVERIFIED** (not stated in `docs/VERIFIED_FACTS.md`); PLANTAI assumes basic-limits-only behavior and accepts it for MVP volume. If deliverability becomes a problem, add custom SMTP credentials (free providers exist, e.g. a transactional free tier) — a config change, not a code change.
- **Redirect URLs** (Auth → URL Configuration) — allowlist **all** of:
  - `http://localhost:3000/**` (local)
  - every preview host: `https://plantai-git-*.vercel.app/**` (or the specific hostnames Vercel generates per PR)
  - production: `https://<prod-domain>/**` (update when custom domain lands, §8)
- **Site URL** field: production URL.
- **Signups:** keep open (do not disable), per project decision. If spam becomes an issue later, add a CAPTCHA/config rather than closing registration.
- Email templates: edit subject/body copy; keep the `{{ .ConfirmURL }}`/`{{ .Token }}` tokens intact.

### 5.5 Pausing behavior (documented, not feared)

- **Dev project may pause after ~1 week of low DB activity** (`docs/VERIFIED_FACTS.md` §Supabase). This is normal between dev sessions. Restore via the Supabase dashboard with all data intact; the restore window is 1 year.
- **Prod stays awake naturally** via user traffic (unlimited API requests on all plans per `docs/VERIFIED_FACTS.md`).
- If prod ever pauses (e.g. pre-launch with no users), just restore it from the dashboard — build a "restore prod" step into the §7 checklist before launch morning.

---

## 6. Environment configuration

### 6.1 Full env var table

Canonical names (do not rename — every doc uses these; see also `ENVIRONMENT_SETUP.md`):

| Variable | Where the value comes from | Client-accessible? | Local (`/ .env.local`) | Preview (Vercel) | Production (Vercel) |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | You construct it: local = `http://localhost:3000`; deploy = the Vercel URL; Phase-5 = custom domain | ✅ YES (by design — used by browser-visible canonical/meta URLs) | `http://localhost:3000` | the preview branch URL (per-branch override) | `https://plantai-<name>.vercel.app` → `https://<custom-domain>` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL | ✅ YES (anon traffic needs it to reach auth/storage) | dev project URL | dev project URL | prod project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase dashboard → Project Settings → API → **Publishable key** (new naming, ADR-9 2026-11-10; the doc's earlier "anon key" row refers to the same credential) | ✅ YES (by design — RLS is the real security boundary, `SECURITY.md`) | dev project publishable key | dev project publishable key | prod publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → `service_role` | ❌ NO — **server only, never `NEXT_PUBLIC_`-prefixed** | dev project service-role key (careful with it locally) | dev project service-role key (or omit if preview flow never needs it) | prod project service-role key |
| `PLANTNET_API_KEY` | your `my.plantnet.org` account (one account per person — `docs/VERIFIED_FACTS.md` §Pl@ntNet) — free plan, 500/day | ❌ NO — **server only** | same key, used in mock/real toggles | same key (+ `PLANTNET_MODE=mock`) | **the free key used by prod** |
| `PLANTNET_MODE` | Set it yourself: `mock` \| `real` | ❌ NO (server-only behavior flag) | `mock` (default during dev) | `mock` | `real` |
| *(Phase-5+)* `RESEND_API_KEY` etc. | any transactional email/paid service | ❌ NO | — | — | as needed |

### 6.2 Exposure rules (critical)

> **Never prefix a secret with `NEXT_PUBLIC_`.** `NEXT_PUBLIC_*` variables are literally written into the JavaScript bundle served to every visitor — anyone with DevTools can read them. `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely and `PLANTNET_API_KEY` is a private API key whose browser-side use is explicitly restricted by Pl@ntNet CORS rules (`docs/VERIFIED_FACTS.md` §Pl@ntNet). Both must stay server-only.
>
> The Supabase **anon key being public is fine — by design** — provided the relevant RLS policies are correct and validated (see `SECURITY.md` and the §9 anonymous-export test). The RLS policies, not the anon key, are the security boundary.

### 6.3 How `.env.local` mirrors Vercel

- `.env.local` (git-ignored per §3.2) holds local values identical to the "Development" ones used locally, with `NEXT_PUBLIC_SUPABASE_URL`+keys pointing at **`plantai-dev`**.
- Default `PLANTNET_MODE=mock` in `.env.local` so day-to-day dev doesn't burn the shared daily quota.
- `.env.example` (committed) mirrors var names with placeholder values + comments.
- When a variable is added/renamed, update **all three** in one commit: `.env.example`, `.env.local` locally, and the Vercel dashboard entries for Preview + Production scopes.

---

## 7. Production deployment checklist

Pre-flight — run top to bottom the day before / of enabling production traffic:

| # | Check | How | Blocked by failure? |
|---|---|---|---|
| 1 | `npm run build` + `npm run lint` clean on local `main` | PowerShell: `npm run build; npm run lint` | ✅ yes |
| 2 | Critical tests from `TESTING_PLAN.md` pass locally | `npm run test` (or project's chosen runner) | ✅ yes |
| 3 | Migrations applied to **prod** Supabase (all of `supabase/migrations/`) | SQL editor or `npx supabase db push` (§5.2); confirm via Table Editor row counts matching `DATABASE_SCHEMA.md` | ✅ yes |
| 4 | RLS policies enabled and validated on every table per `DATABASE_SCHEMA.md` + `SECURITY.md` | SQL editor: `SELECT relname, relrowsecurity FROM pg_class JOIN pg_namespace ...` (or Supabase dashboard "RLS enabled" indicator), plus manual anon-select query check | ✅ yes |
| 5 | Storage buckets exist with correct policies (`plant-images` public read; `request-images` owner-only) | Supabase Dashboard → Storage; attempt an anonymous read/write test | ✅ yes |
| 6 | Auth redirects allowlist includes the **prod URL** and email confirmation is ON | Supabase Auth settings (§5.4) | ✅ yes |
| 7 | Vercel env vars set with correct Per-Scope values; secret values are NOT `NEXT_PUBLIC_`-prefixed | Vercel Project → Settings → Environment Variables (§6) | ✅ yes |
| 8 | `robots.txt` serves and allows production crawling | `curl`/browser: `https://<prod-url>/robots.txt` | ✅ yes (SEO-blocking otherwise, see `SEO_STRATEGY.md`) |
| 9 | `sitemap.xml` reachable and lists current routes | `https://<prod-url>/sitemap.xml` | ✅ yes |
| 10 | Security headers configured (CSP, X-Frame-Options, Referrer-Policy, etc.) | deployed response headers via `curl -I` or the Vercel dashboard; full header list lives in `SECURITY.md` | ✅ yes |
| 11 | `/identify` smoke-tested **in mock mode first** then **1 real call** | deploy preview with `PLANTNET_MODE=mock` → verify; then flip prod var and do a single real identification; record `remainingIdentificationRequests` from the response | ✅ yes |
| 12 | Supabase prod project not paused, activity will be regular (real users) | dashboard status | ✅ yes |
| 13 | Error-monitoring plan noted | For MVP: **Vercel runtime logs only**. Log retention on Hobby is **UNVERIFIED** in `docs/VERIFIED_FACTS.md` — assume very short retention (hours), so treat logs as "look now, not later". If a longer lookback is needed at $0, a free-tier third-party (e.g. Sentry free tier) is the Phase-3+ option — add to `TASKS.md` when needed | — |

---

## 8. Domain configuration

**Phase-gated:** No domain is bought yet. Free `plantai-<name>.vercel.app` is fine during Phases 1–4; a custom domain is **strongly recommended before starting SEO/AdSense efforts** (Phase 3/5) — per the canonical project decision, Google indexes proper domains more reliably, and SEO tooling assumes it. Buying a domain is the *first* optional spend; price depends on TLD and registrar (no invented price — check the registrar at decision time per canonical decisions).

### 8.1 When a domain IS purchased

1. **At registrar:** add DNS records pointing to Vercel. Vercel shows the exact values on your project's Domains page; typical patterns are an `A` record to Vercel's IP and/or a `CNAME` to `cname.vercel-dns.com` — **use the exact values Vercel displays**, never a remembered value.
2. **In Vercel:** Project → Domains → Add the domain (e.g. `plantai.app`, `plantai.example`, or whatever was bought).
3. **www redirect policy:** pick one canonical form (bare `plantai.x` is the Vercel default suggestion; either is fine) and configure `www.<domain>` to redirect to it. Vercel handles the redirect automatically when both are added. All internal links must use the canonical form.
4. **SSL:** automatic — Vercel provisions and renews Let's Encrypt certs for you; no manual step.
5. **Update `NEXT_PUBLIC_SITE_URL`** (Production scope) to `https://<final-domain>` and redeploy so all meta/canonical/sitemap URLs reflect it.
6. **Google Search Console:** add the property (Domain or URL-prefix type), verify (usually via the DNS TXT record), then submit `sitemap.xml` there and in §9.
7. **Update Supabase redirect allowlist + Site URL** to the new domain (§5.4).
8. **Update sitemap base URL** in Next.js config so all generated URLs reflect the new domain.
9. Log the change + date in `CHANGELOG.md`.

---

## 9. Post-deployment verification

Run this immediately after the first production deploy (and again after any large feature):

| # | Check | Expected |
|---|---|---|
| 1 | Every primary route returns `200` | `/`, plant detail sample, about, contact, sitemap, robots | 
| 2 | `/identify` end-to-end **anonymous** | upload a photo → get a JSON response with results; anonymous rate per `SECURITY.md` |
| 3 | Auth loop works | sign up → receive confirmation email (Supabase built-in email; limits UNVERIFIED) → confirm → sign in → sign out |
| 4 | Contact form delivers | row appears in `contact_messages` in the prod Supabase table (see `DATABASE_SCHEMA.md`) |
| 5 | RLS holds from anonymous exports | `curl` the Supabase REST API with only the anon key and attempt a SELECT on a protected table (e.g. `user_plants`, `request-images`): expect empty/403, NOT data. Example: `curl "https://<ref>.supabase.co/rest/v1/user_plants?select=*" -H "apikey: <anon>" -H "Authorization: Bearer <anon>"` |
| 6 | Lighthouse quick run | Chrome DevTools → Lighthouse on the home page; record scores in `CHANGELOG.md`. Perf budget per `SEO_STRATEGY.md` |
| 7 | Search Console verify + sitemap submit | after domain is live (§8) |
| 8 | Verify prod Pl@ntNet headers | one real identify call; log `remainingIdentificationRequests` (quota detail in `docs/VERIFIED_FACTS.md` §Pl@ntNet) |
| 9 | Prod logs scanned for `console.log` of any secret | zero secret leaks (`SECURITY.md` rule) |

---

## 10. Upgrade path / hosting migration (Phase 5)

When PlantAI is ready to monetize (Phase 5, per `MONETIZATION_PLAN.md`) the Vercel Hobby plan can no longer host it (ads are explicitly commercial — `docs/VERIFIED_FACTS.md` §Vercel). Execute this decision procedure:

### Step 1 — Verify alternatives (do not skip; current claims UNVERIFIED)

For each candidate (Netlify, Cloudflare Pages), do the following and record in `docs/VERIFIED_FACTS.md` with the date:

1. Read the **actual current ToS/pricing pages on the vendor's own website** (not blogs or third-party reviews) — commercial-use clause, free-tier limits, function limits, Next.js support.
2. Note the **verification date**.
3. Record the exact quoting sentence, not the conclusion.

Update `docs/VERIFIED_FACTS.md` rows for "Netlify free tier commercial-use allowance" and "Cloudflare Pages free tier limits + Next.js/OpenNext compatibility" (currently UNVERIFIED pending Phase 5 verification).

### Step 2 — Decide

| Option | Path |
|---|---|
| **Stay on Vercel** (simplest) | Upgrade to **Pro ($20/mo per seat)** — first recurring cost. Re-verify env vars survive (they do — they are per-project); confirm paid-flag features (ads, premium) don't trigger other limits. Update `MONETIZATION_PLAN.md`. |
| **Migrate** (if a free tier's terms allow commercial use) | 1. Read the target's Next.js support notes (standard Next.js usually "just works"; Cloudflare Pages requires the **OpenNext adapter** — a build-layer change). 2. Adjust build adapter if needed. 3. Import repo on the new host. 4. Re-create env vars from the §6 table with per-scope scoping. 5. **Re-point DNS**: at the registrar, remove Vercel DNS records, add the new host's records, wait for TTL/propagation. 6. Re-validate §9 checklist on the new host. 7. Keep Vercel project around for 1–2 weeks as a fallback rollback target. 8. Update `CHANGELOG.md` + `docs/VERIFIED_FACTS.md`. |

The Next.js app should be portable by design — that is why no Vercel-only APIs were used in earlier phases (§1).

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
| **Secrets** | Recoverable from dashboards (Supabase API settings, my.plantnet.org account page, Vercel env-var UI — Vercel shows existing names but hides old values; keep a password-manager copy) | keep current copies in a password manager |
| **Vercel deployment history** | Instant rollbacks (§13) | no extra action |

---

## 12. Cost-drift monitoring plan

Zero-budget plan needs a monthly guard-rail — drift to **$0** is the whole point until Phase 5. The following are looked at **once a month** at minimum (calendar reminder), and more often whenever a change touches a quota-relevant path (upgrades to upload volume, new DB writes, SEO push).

| What to watch | Where | Target state |
|---|---|---|
| **Supabase** usage dashboard | Supabase Dashboard → project → Usage/Reports: DB size, egress, storage, MAU | under 500 MB DB / 5 GB egress / 1 GB storage / 50k MAU (`docs/VERIFIED_FACTS.md` §Supabase); pause state on dev is fine |
| **Vercel** usage page | Vercel Dashboard → Usage: bandwidth, function invocations, image transformations | under 100 GB transfer / 1M invocations / 5k image transforms (`docs/VERIFIED_FACTS.md` §Vercel); plan stays non-commercial |
| **Pl@ntNet** remaining quota | response headers from each identify call (`remainingIdentificationRequests`) — and remember exceeded quota returns HTTP 429 until midnight UTC midnight reset (`docs/VERIFIED_FACTS.md` §Pl@ntNet) | ideally under ~450/day; if prod alone approaches 500, that is a Phase-5 flag for paid Pl@ntNet plan (pricing UNVERIFIED, re-check at decision time) or request-throttling |
| **GitHub** | Actions minutes on private repos (not applicable — public repo) | n/a |
| **Domain** | no recurring spend yet | only the one-time Phase-3/5 registrar invoice when bought |
| **Spend-cap / overage protection** | Supabase Dashboard → Organization → Billing: ensure **spend-cap is set to $0** (no charges possible) so even accidental over-limit usage cannot bill the card. Exact UI wording/capability UNVERIFIED-at-facts — treat as a dashboard step to confirm, not a fact. Same idea on Vercel: Hobby is never billed beyond stays on Hobby without an upgrade (`docs/VERIFIED_FACTS.md` §Vercel — exceeding caps pauses features). | **hard rule: no paid plan is toggled without explicit user approval** — including "trial" toggles, seat additions, or anything that asks for a card |

Record each month's numbers in a short `CHANGELOG.md` line (e.g. "2026-12-01 — cost check: Supabase 21% DB / Vercel 8% bandwidth / Pl@ntNet 120 max diag/day").

---

## 13. Rollback strategy

| Layer | Rollback mechanism | Notes |
|---|---|---|
| **App (Vercel)** | **Instant rollbacks** — Vercel Dashboard → Deployments → pick the previous good deployment → "Promote to Production" / "Rollback". Every deployment is retained and can be re-promoted. | First response to a broken prod deploy. Then fix-forward on a branch, merge, and confirm new deploy. Re-running §9 checks is recommended after any rollback. |
| **DB migrations** | **Forward-only.** Write a new migration file that reverses the bad one (add-column → drop-column, etc.) rather than "restoring" the DB. | Keeps data safe and mirrors the Supabase CLI's model. Down-migration guidance: always pair every `.sql` in `supabase/migrations/` with a documented "reversal" note in `DATABASE_SCHEMA.md` (or a sibling `.down.sql` if the runner supports it). If a migration was destructive (dropped a table), restore from the last weekly DB dump (§11) and accept data loss after user communication. |
| **Feature flags** | Phased rollouts achievable via an `app_settings` table (see `DATABASE_SCHEMA.md`): server reads a boolean at request time and gates the feature. | Zero rebuild needed to disable a feature. Set `flag = false` in Supabase → the feature is off in prod within seconds. Used sparingly; MVP needs few flags. |
| **Secrets** | If a secret is compromised: rotate at the source (Supabase / Pl@ntNet dashboard regenerate) then update in Vercel env vars and redeploy. Supabase anon + service_role keys can be regenerated (`SECURITY.md`). | Log the rotation in `CHANGELOG.md` without ever recording the key itself. |
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
