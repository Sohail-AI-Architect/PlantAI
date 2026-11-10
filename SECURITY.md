# PlantAI — Security Plan

> Scope: MVP security posture for PlantAI (Next.js App Router + Supabase + Pl@ntNet API v2, zero budget, deployed on Vercel). This document defines what we protect, how, and which risks we consciously accept.
> Facts about Pl@ntNet, Supabase, and the stack (quotas, plans, terms) are cited from [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md). Anything stated here without a source below is **UNVERIFIED** until checked at implementation time.
> Related: [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) · [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) · [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md) · [`LEGAL_AND_COMPLIANCE.md`](LEGAL_AND_COMPLIANCE.md) · [`TESTING_PLAN.md`](TESTING_PLAN.md)

---

## Table of Contents

1. [Threat model summary (STRIDE-lite)](#1-threat-model-summary-stride-lite)
2. [Secrets & environment variables](#2-secrets--environment-variables)
3. [Pl@ntNet API protection](#3-plantnet-api-protection)
4. [Authentication security](#4-authentication-security)
5. [Input validation](#5-input-validation)
6. [File upload security](#6-file-upload-security)
7. [Rate limiting & abuse protection](#7-rate-limiting--abuse-protection)
8. [Database security (RLS-first)](#8-database-security-rls-first)
9. [Privacy protection](#9-privacy-protection)
10. [OWASP Top 10 mapping](#10-owasp-top-10-mapping)
11. [Security headers & CSP](#11-security-headers--csp)
12. [Dependency security](#12-dependency-security)
13. [Incident response basics](#13-incident-response-basics)
14. [Non-goals & consciously accepted risks](#14-non-goals--consciously-accepted-risks)

---

## 1. Threat model summary (STRIDE-lite)

MVP-level threat model: we identify actor types, the main abuse per actor, and the mitigation that ships in the MVP. This is deliberately "lite" — a full STRIDE data-flow diagram is a Phase 5 refinement.

| Actor / asset | Spoofing | Tampering | Repudiation | Information disclosure | Denial of service | Elevation of privilege |
|---|---|---|---|---|---|---|
| **Anonymous visitor** | Can't fake server-side rate-limit counters (counters are server state, keyed by IP + user) | Upload tampered/hostile images → server re-validation antes | Upstream Pl@ntNet errors consume authenticated-server credits, not visitor's | Only public content served to visitors; no Supabase rows without auth | Enumeration of `/api/identify` → per-IP+per-user rate limit, 5/day anon (configurable) | None meaningful — no role, no DB rows without an account |
| **Authenticated user** | Supabase Auth issues real sessions; no custom session roll-your-own | Cannot override validation client-side (Server Actions validate server-side) | `identifications` rows record user_id + created_at | RLS on ALL tables — a user can only read their own rows (see [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md)) | 20/day authenticated identify limit; storage quota 1 GB total (Supabase Free, per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) so abuse harms abuser too | `role` column only writable via explicit RLS policy denying non-admin self-update; admin path only via `profiles.role = 'admin'` |
| **Admin** | Admin actions come from real authenticated sessions, auditable via `supabaseAudit`-style review (manual in MVP) | Admin UI v is minimal MVP; risk = admin account compromise → enforce strong password + 2FA in Supabase dashboard if available (UNVERIFIED availability) | Admin content changes visible via created_at/updated_at | Admin sees contact_messages via RLS `is_admin()` — that is by design but must not leak to public surfaces | n/a | Worst case = site defacement via blog/admin; mitigation: least number of admins (ideally 1) |
| **Pl@ntNet dependency** (upstream) | Upstream outage is not spoofable by attacker, but quota numbers returned could be misread — we log-only, never trust for gating beyond local counters | Upstream result normalization: never render raw API fields into HTML (XSS via malicious species names?) — normalize + validate shape | n/a | We never send user identity to Pl@ntNet (see §3) | Upstream 429 (quota, resets midnight UTC — [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) or upstream outage → served as 503 with cached/graceful fallback | None — upstream has no credentials into our system beyond our API key |
| **Photo abuse** (anyone) | — | Crafted images meant to exhaust our 500/day quota (errors ALSO consume 1 credit — [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) | — | EXIF/GPS in photos could leak user location → strip client-side where feasible; GPS not stored server-side in MVP | Image-bomb uploads (≤10 MB, ≤3 images) | — |

Key insight: the scarcest asset is the **shared Pl@ntNet quota (500/day)** — a single abuser can starve the whole free tier for everyone. Rate limiting + strict pre-validation is therefore our highest-value control.

---

## 2. Secrets & environment variables

### 2.1 Inventory

Canonical names are fixed in CANONICAL PROJECT DECISIONS #6. No name may be renamed without updating [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md) and [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md).

| Name | Where set | Exposure | Rotation notes |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `.env.local`, Vercel project env | Client (public by design) | No rotation needed (site URL, not a secret) |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel, Supabase dashboard → Project settings → API | Client (public by design; docs say anon key + URL are safe to expose *when RLS is on*) | Rotate only if project keys/scoped JWT settings change |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, Vercel, Supabase dashboard | Client (public; safe ONLY because every table has RLS) — **name updated 2026-11-10 per ADR-9 (new Supabase "Publishable key" naming; formerly `NEXT_PUBLIC_SUPABASE_ANON_KEY` in this doc's earlier versions)** | Rotate via Supabase "Regenerate key" if leaked; triggers brief client downtime until redeploy |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local`, Vercel (server-only), **never** in `NEXT_PUBLIC_*` | Server-only — bypasses RLS; treat as root credential | Rotate immediately on any suspected leak; consider scoped JWT/moving to Supabase Platform access tokens for automation (UNVERIFIED details) |
| `PLANTNET_API_KEY` | `.env.local`, Vercel (server-only), from my.plantnet.org → settings → API key | Server-only | Rotate in Pl@ntNet account settings; on leak, rotate + re-deploy; abusive usage of a leaked key is attributed to OUR account |
| `SUPABASE_DB_URL` (optional) | `.env.local` (dev only), Supabase dashboard | Server-only (local tooling) | Rotate password from dashboard if shared |

### 2.2 Rules (non-negotiable)

1. **Never commit real keys.** `.env.local` is gitignored; only `.env.example` with placeholder values is committed. CI/setup checklist greps for key-shaped strings before commit (see [`TESTING_PLAN.md`](TESTING_PLAN.md) § Security testing).
2. **`SUPABASE_SERVICE_ROLE_KEY` and `PLANTNET_API_KEY` must never appear in client bundles.** Enforcement with Next.js=prefix discipline:
   - In **Server Components / Route Handlers / Server Actions**, read via `process.env.X` — only code paths reachable from the server see them. Next.js bundles `process.env.NEXT_PUBLIC_*` replacements (string interpolation at build time) into client code but **omits non-public variables** from client bundles. The practical rule: **a secret is only ever referenced inside files marked `'use server'`, Route Handlers, or server-only modules**.
   - Belt-and-braces: install `server-only` package and import it at the top of the Pl@ntNet proxy module and any service-role client module — an import from a Client Component then fails the build. (Approach UNVERIFIED against the Next.js major version chosen at scaffold; verify in Phase 1.)
   - Additional check in CI: grep the `.next` build for the literal values of secrets (see [`TESTING_PLAN.md`](TESTING_PLAN.md)).
   - No CORS domain whitelisting exists on the Pl@ntNet free plan to make client-side calls "allowed" safely — the key is simply private, period ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)).
3. **`.env.example` (committed) contains placeholders only** — e.g. `PLANTNET_API_KEY=your_key_here` — plus comments on where to obtain each key. **`.env.local` (gitignored)** holds real values locally; production secrets live in Vercel project environment variables, never in the repo.
4. **Rotation procedure** (any key):
   1. Generate/obtain a new key at the provider (Supabase dashboard / my.plantnet.org).
   2. Update `.env.local` locally and Vercel environment variables.
   3. Redeploy (Vercel rolls env changes into a new deployment; no cache of old secrets by design).
   4. Invalidate/revoke the old key at the provider.
   5. Verify the app smoke-tests identify + login.
   6. If the leak reached a public git history: treat as burned; rotate immediately AND consider history rewrite for secrets (`git filter-repo` or fresh repo) — secrets in git history remain discoverable after commit deletion.

---

## 3. Pl@ntNet API protection

The API key is treated as the most abusable secret (its abuse directly consumes our shared free quota). Rules:

- **Server-only proxy.** All Pl@ntNet calls go through one server-side module (called from the `/api/identify` Route Handler and/or a Server Action). No client component may construct a Pl@ntNet URL. Rationale: free plan allows client-side CORS-whitelisted use, but PlantAI refuses that mode — key exposure + quota burn risk (per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)).
- **No CORS whitelisting** is performed on the Pl@ntNet side; we never enable browser-side calls.
- **Log-only remaining quota.** The response headers/fields (`remainingIdentificationRequests`) are logged server-side for dashboards; they are not a security control (attacker-controlled input can't spoof them to us, providing them as "truth" would invite spoofing).
- **Upstream errors map to 503, never 429 pass-through confusion.** Upstream HTTP 429 (quota exceeded, resets midnight UTC — [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) is returned to clients as **HTTP 503 Service Unavailable** with a user-friendly message ("Our daily plant-recognition budget is exhausted; try again tomorrow"). Upstream 500s/998s also → 503. Rationale: a genuine 429 envelope means *quota exhausted*, not "you personally are over your limit"; exposing upstream semantics invites probing.
- **Never send user PII upstream.** What IS sent to Pl@ntNet:
  - ✅ The 1–3 user images (required by the API), as multipart.
  - ✅ The Pl@ntNet project/flora slug (e.g. `world`) — application constant, not user input.
  - ❌ NOT sent: user ID, email, IP address, GPS coordinates, timezone, browser fingerprint, session tokens, anything else. GPS is not used in MVP at all (see §9).
- **Pre-validation before calling upstream** (strict): jpg/png only, ≤10 MB each per project decision (stricter than Pl@ntNet's 50 MB total), 1–3 images — because upstream *errors also consume 1 credit* ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)). Every rejected upload saves a shared credit.
- **One concurrency ceiling client-side is not enough**; the server holds a small in-flight counter and sheds extra requests with 503 rather than risking Pl@ntNet's 20-concurrent cap ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)). MVP implementation: simple counter, best-effort across serverless instances (documented limitation).

---

## 4. Authentication security

- **Provider: Supabase Auth only.** Email/password + magic link in MVP; Google OAuth explicitly deferred. **No custom password hashing scheme, no custom session tokens, no custom JWT handling** — we use Supabase's primitives.
- **Email confirmation required.** Supabase project setting: confirm-signup on. Signups with unconfirmed emails cannot log in and have no `profiles` row created (our DB trigger creates it only post-confirm — pattern to verify at scaffold; UNVERIFIED which exact trigger hook Supabase exposes).
- **Password policy.** Minimum length **8** enforced client + server side (Supabase has a min-length project setting too). Optional hardening: `zxcvbn` strength check UX-side (warn, don't block) — decision deferred; if added, it is a client-side library and must be judged fairly (adds bundle weight).
- **Login throttling.** Supabase Auth has built-in rate limiting / brute-force protection on auth endpoints (commonly cited as 1 req / 60 s on sensitive auth routes historically — **UNVERIFIED** value; verify current dashboard limits at scaffold). PlantAI additionally rate-limits the app's own login endpoints server-side as a defensive layer (see §7).
- **Session handling.**
  - Sessions are Supabase-issued JWTs with default refresh-token behavior; the app uses `@supabase/ssr`-style cookie-based session storage so tokens live in httpOnly cookies, not localStorage (XSS theft risk reduced).
  - Logout invalidates the local session cookie; Supabase `signOut()` also revokes the refresh token server-side.
  - Middleware performs lightweight session refresh and route protection; actual data protection is enforced by RLS, not just middleware (defense in depth: middleware is UX + a guard, RLS is the real wall).
- **Middleware route protection pattern** (canonical placeholder, exact imports finalized in Phase 1/2):

  ```ts
  // middleware.ts (sketch, imports finalized at scaffold)
  import { NextResponse, type NextRequest } from 'next/server'

  const PROTECTED = ['/dashboard', '/my-plants', '/saved']

  export async function middleware(req: NextRequest) {
    const res = NextResponse.next()
    // refresh Supabase session into cookies (pattern per supabase-ssr docs)
    // const { user } = await refreshAndGetUser(req, res)  // uses server client
    // if (!user && PROTECTED.some(p => req.nextUrl.pathname.startsWith(p))) {
    //   const url = req.nextUrl.clone()
    //   url.pathname = '/login'
    //   url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`
    //   return NextResponse.redirect(url)
    // }
    return res
  }

  export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
  }
  ```

  *(Sketch only — the working version lands in Phase 2 alongside the Supabase client setup. Do not copy-paste as-is into code.)*
- **Admin authorization.**
  - `profiles.role` values `'user' | 'admin'` only; an RLS trigger/policy rejects any update of `role` by non-admins.
  - A Postgres `SECURITY DEFINER` helper `is_admin()` (or equivalent claim + policy check — pattern decision documented in [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md)) provides the RLS gate for admin-only tables (`blog_posts` moderation, `contact_messages`, `app_settings`).
  - Admin surfaces additionally check `role` server-side (Server Actions never rely on client state).
- **Magic link expiry** uses Supabase defaults; we do not extend expiries for convenience.

---

## 5. Input validation

- **Zod schemas server-side everywhere.** Every Server Action and Route Handler validates an input object against an explicit Zod schema before touching Supabase or Pl@ntNet. Client-side schemas exist for UX feedback only and are treated as untrusted mirror copies.
- **Never trust the client.** Session/user IDs come from the Supabase session (server-derived), never from request bodies. Any `user_id` in a payload is ignored/overwritten server-side.
- **Multipart limits for `/api/identify`:**
  - Exactly 1–3 files; jpg/png only; ≤10 MB each (server re-check; Pl@ntNet's own cap of 50 MB total never reached).
  - Next.js Route Handlers: imposed size handling via `bodySizeLimit`/streaming checks at read time (exact config keyed to the Next.js version chosen in Phase 1 — UNVERIFIED until scaffold; if Route Handler streaming limits don't apply, enforce size during `formData()` parsing and reject early).
- **`next.config` protections** (proposed snippets, verify against chosen Next.js major at scaffold):
  - Disable `reactStrictMode` stays **on** (default true is fine).
  - No custom webpack hacks that weaken the sandbox.
  - Security headers added under `headers()` — see §11.
  - Image handling (`next/image`) restricted to allowed remote patterns (Supabase storage host only) — no arbitrary remote image loading.

---

## 6. File upload security

Follows CANONICAL DECISION #5 (jpg/png, ≤10 MB, 1–3 images, client resize/compress + EXIF strip).

| Control | How |
|---|---|
| **MIME sniff, not extension-only** | Server reads file header bytes (magic numbers: `FF D8 FF` for JPEG, `89 50 4E 47` for PNG) in addition to declared MIME type. A file renamed `cat.jpg` that is actually HTML/EXE is rejected. Implementation: tiny server-side magic-number check, no heavy dependency (hand-rolled ~20 lines; optionally a sniff lib if one is already in package.json for other reasons). |
| **Server-side size check** | Byte length is checked on the server before Upstream call AND before Storage upload (≤10 MB). Size from Content-Length is advisory; the parsed body length is authoritative. |
| **Bucket layout** | Private bucket `request-images` for identification uploads; public bucket `plant-images` only for curated/DAM-style plant library images (admin-uploaded or CC-safe library images suppressing per-user privacy risk). |
| **Path namespacing** | `request-images/{user_id}/{uuid}` for authenticated users; `request-images/anonymous/{uuid}` for visitor submissions. User-IDs never guessable cross-referenced against `identifications` (which stores user_id + image path). |
| **RLS storage policies** | Storage policies (not just public buckets) restrict `request-images` to owner-read + server-write (`service_role`); no wildcard anonymous read/write on the private bucket. Policy matrix in [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md). |
| **Serving** | Identification-time images are read via **signed URLs** (short expiry, e.g. 5 min, generated server-side) — never a public bucket. Public `plant-images` may use CDN/public URLs. No mixed-case: user content in `plant-images` is forbidden. |
| **No SVG uploads** | SVG can carry scripts → stored-XSS when inlined or loaded as document. Upstream Pl@ntNet only accepts jpg/png anyway; this rule primarily protects our own storage and any future gallery rendering. |
| **EXIF / GPS stripping** | Done client-side where feasible before upload (project decision #5). Note honestly: client-side stripping is best-effort (users can bypass with API calls); the privacy-critical rule is that **we do not extract, store, or expose EXIF/GPS server-side**, and Pl@ntNet receives the (already-decoded) image bytes it needs. Server-side re-strip could be added in Phase 5 if a need appears. |
| **Filename sanitization** | We **discard the client filename entirely** and store under our own `{uuid}.{ext}` — user-controlled names never touch the filesystem path (path traversal, Unicode tricks, and `.php` jokes all become non-issues). |

---

## 7. Rate limiting & abuse protection

Per CANONICAL DECISION #4: per-IP + per-user counters; anonymous 5/day, authenticated 20/day; configurable in `app_settings`; simple server-side counters in MVP.

- **Enforcement point:** the `/api/identify` Route Handler (and the identify Server Action if used) — counted before the Pl@ntNet call.
- **Counters:** in-memory Map keyed by `ip_hash` + retry-safe increments, PLUS optional Supabase `identifications` row count per user (per-user limits can be DB-backed from day 1 for free; per-IP stays in-memory). Honest limitation: serverless on Vercel is multi-instance — counters are per-instance and best-effort; they bleed across instances but guarantee no single-instance bypass. Phase 5 option: durable `rate_limits` table or free Redis (Upstash-style). **UNVERIFIED**: which durable option is available within zero budget at that time.
- **Contact form:** honeypot field (hidden input that bots fill) + time-to-submit heuristic (submitted <2 s after page render = likely bot → silently "accept-and-drop"), plus per-IP daily cap. No CAPTCHA in MVP (paid or privacy-heavy; defer).
- **Concurrent request ceiling:** small in-flight semaphore per §3 to honor Pl@ntNet's 20-concurrent cap.

### Abuse scenarios & mitigations

| Scenario | Vector | Mitigation in MVP | Residual risk |
|---|---|---|---|
| **Enumerable uploads** (flood files to eat global quota) | `/api/identify` from many IPs | Per-IP daily cap; server-side validation rejects junk *before* upstream (junk still costs 0 because it never reaches Pl@ntNet) | Distributed attack across many IPs still flattens quota; accepted (see §14) |
| **Storage stuffing** (upload infinite images to fill the 1 GB bucket) | valid-but-useless images to `request-images` | Only images paired with a *successful or attempted* identification are kept; per-user object cap (e.g. keep last N=10 uploads/user/day — configurable); Phase 4 auto-delete aligns with §9 retention | Anonymous bucket path unbounded by accounts — mitigated by per-IP identify cap that necessarily precedes storage writes |
| **Contact spam** | contact form | Honeypot + timing + per-IP cap | Targeted manual spam slips through; admin UI has bulk delete (Phase 4) |
| **ID guessing** (enumerate other users' identifications/data) | GET endpoints / storage paths | RLS everywhere + signed URLs with unguessable UUIDs; no sequential IDs exposed; object keys are UUIDs, not filenames | Low |
| **Login brute-force** | auth endpoints | Supabase built-in throttling (UNVERIFIED limits) + our own per-IP per-endpoint rate limit + 8-char min password + email confirm requirement | Credential stuffing on weak reused passwords; out of MVP scope |

---

## 8. Database security (RLS-first)

Principle: **RLS is on and enforced for every table; policies are written with a deny-by-default mindset; service-role key usage is rare and co-located in dedicated server modules.**

Reference table matrix (full DDL in [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md)):

| Table | Who can SELECT | Who can INSERT | Who can UPDATE | Who can DELETE |
|---|---|---|---|---|
| `profiles` | Owner (self) | Owner (self, role forced to `user` via DEFAULT/check) | Owner (name/avatar only), `admin` (role too) | Owner self-delete (Phase 4 "delete my data"), `admin` |
| `plant_library` | Everyone (public read) | `admin` | `admin` | `admin` |
| `identifications` | Owner (self) | Server context (user-scoped) only | — (immutable) | Owner (Phase 4), retention job (server) |
| `user_plants` | Owner | Owner | Owner | Owner |
| `care_reminders` | Owner | Owner | Owner | Owner |
| `saved_plants` | Owner | Owner | Owner | Owner |
| `blog_posts` | Everyone if `published` else `admin` | `admin` | `admin` | `admin` |
| `contact_messages` | `admin` | Anyone (form) but rate-limited | `admin` (status field) | `admin` |
| `app_settings` | Server-only via service role; public read for opt-in keys only (via a policy narrowing `is_public_key`) | `admin` | `admin` | `admin` |
| `identification_cache` (optional) | server-only (service role) | server-only | — | server-only |

- **Least privilege:** the anon key (client) can only reach rows a policy exposes; every client call must satisfy RLS directly. There is **no server-side "rails pattern" that lets the anon key bypass policy.**
- **Service-role usage policy:** allowed ONLY inside trusted server modules (Route Handler for Pl@ntNet proxy taking care of shared counters, retention cron, weeding/admin batch ops). Each usage requires a code comment referencing which table policy intentionally bypasses and why. Service-role code lives next to the `server-only` import guard.
- **No direct SQL from client.** All DB access goes through typed supabase-js modules; no dynamic SQL string building anywhere (see §10).
- **Identifications immutability:** the identification history cannot be edited by users (counts as honest usage records and prevents forged audit trails).
- **No direct table grants for `app_settings` secrets** — the table stores MVP knobs (rate limits), not credentials; credentials live in env vars only (§2).

---

## 9. Privacy protection

Minimum is the maximum security here — we simply don't collect what we don't need.

### Data minimization list (MVP)

| Data | Collected? | Purpose | Removed/anonymized |
|---|---|---|---|
| Email (Supabase Auth) | Yes, on signup | Login + magic link + password reset | On account deletion |
| Password hash | Yes (Supabase-managed) | Auth | On account deletion |
| Photo(s) (identification images) | Yes, transient | Pl@ntNet identify | **90-day retention default** → deleted from `request-images` by cleanup job or manual cron (decision: automated cron if Vercel Cron + a service-role endpoint is cheapest; manual dashboard cleanup as fallback — decision to finalize in Phase 4/5, 90 days is the default retention from today). EXIF/GPS stripped client-side best-effort, not stored server-side |
| Species result / confidence | Yes | Show results, save to plant library | On account deletion |
| Coarse location | **No in MVP.** GPS coordinates are excluded entirely; no explicit consent gating is needed for them — if future features (region-aware floras, disease coverage) need GPS, they will be added only behind **explicit user consent** UI toggle, opt-in, and deletable with account data | — |
| IP address (rate limiting) | Yes, transiently | Rate-limit counters | Not persisted server-side beyond in-memory scope; not sent to Pl@ntNet |
| User-submitted plant names/notes | Yes | My Plants feature | On account deletion |
| Contact message | Yes (form) | Support / feedback | Deleted after resolution (admin action) |

- **Delete-my-data (Phase 4):** account deletion action deletes `profiles` (cascade), `identifications`, `user_plants`, `saved_plants`, `care_reminders`, `saved_plants`, and `request-images/{user_id}/*` storage objects. Blog comments (if any ever exist) are pseudonymized rather than deleted when comments exist on others' posts (policy to spell out in [`LEGAL_AND_COMPLIANCE.md`](LEGAL_AND_COMPLIANCE.md)).
- **Photos of other users are never rendered on public pages** (they live in a private bucket, signed URLs only).

---

## 10. OWASP Top 10 mapping

| OWASP category (2021) | PlantAI exposure | Mitigation | Status |
|---|---|---|---|
| A01 Broken Access Control | Users reading others' data; admin reach | RLS on ALL tables + `is_admin()`; middleware as UX guard only; Server Actions re-check auth server-side | Core control |
| A02 Cryptographic Failures | Passwords, tokens | Handled by Supabase Auth (argon-something/bcrypt+drizzle of hash choices is ours to not break); HTTPS enforced by Vercel/Supabase defaults; no client-side crypto rollup | Inherited, don't break |
| A03 Injection | SQL, XSS | supabase-js parameterized queries; PostgREST operator filters; no string-concatenated SQL. XSS: React escapes by default; `dangerouslySetInnerHTML` only for sanitized blog body — sanitizer decision **deferred to Phase 4**, candidate `isomorphic-dompurify` (note: it brings DOMPurify + jsdom quirks; revisit then). No SVG file uploads (§6) | Control defined; sanitizer choice Phase 4 |
| A04 Insecure Design | Quota starvation, storage stuffing | §7 abuse table; graceful 503 with user-facing message | Design control |
| A05 Security Misconfiguration | Loose headers, open buckets §6 storage policies; security headers §11; no public `request-images` | Config review gate in [`TESTING_PLAN.md`](TESTING_PLAN.md) | Control defined |
| A06 Vulnerable Components | npm supply chain | Lockfile committed; `npm audit` in CI from Phase 5 (optional); "no random small deps" rule; fix-on-alert | Documented |
| A07 Identification & Authentication Failures | Brute force, session theft | Supabase auth + built-in throttling (limits UNVERIFIED) + our rate limit; httpOnly cookie sessions; email confirmation required | §4 |
| A08 Software & Data Integrity | Supply chain, tampered deploys | Vercel deploys from protected `main`; no auto-publish to prod without preview review; GitHub branch protection (free) | Documented |
| A09 Logging & Monitoring Failures | Silent abuse | MVP = console/Vercel logs of: identify requests (result + quota-remaining + rate-limit decisions), auth failures; not a full SIEM | Best-effort, accepted (§14) |
| A10 SSRF | Our server fetching attacker URLs | We never fetch arbitrary URLs; outbound calls only to Pl@ntNet (fixed host) and Supabase | Not applicable by design |

---

## 11. Security headers & CSP

Vercel applies some sane defaults; we add what's missing explicitly in `next.config` (exact header config lands in Phase 1 scaffold — snippet below is the baseline proposal).

```ts
// next.config.(ts|js) — headers() (Phase 1 snippet, verify syntax on chosen Next.js major)
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",   // inline bootstrap: Next.js needs this unless nonce-based CSP; upgrade later
      "style-src 'self' 'unsafe-inline'",    // Tailwind dev styles
      "img-src 'self' data: <SUPABASE_STORAGE_HOST>",
      "connect-src 'self' <SUPABASE_URL>",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ') },
]
```

- **Baseline CSP** is deliberately loose (no nonces, `unsafe-inline` for script/style) — it **evolves** in Phase 5 toward nonce/strict-dynamic once Vercel + Next.js middleware support for CSP nonces is verified.
- `Permissions-Policy` (camera for future PWA, geolocation off in MVP) added in Phase 6 alongside camera plumbing — not part of MVP baseline.
- CSP violation reporting in MVP: `console` only (no external logging service on zero budget).

---

## 12. Dependency security

- **Lockfile (`package-lock.json`) is committed** and CI installs with `npm ci` (when CI exists).
- **"No random small deps"** rule: every new dependency needs a one-line reason in its PR/commit; prefer first-party (`@supabase/*`, `next`, `react`, `tailwindcss`) + zod + (Phase 4) sanitizer.
- **`npm audit` in CI** is optional Phase 5 (deprioritized on zero budget — most audit noise is unpatchable low-severity; we don't let noise stop builds in MVP).
- **Known-risky lib pattern avoided:** `dangerouslySetInnerHTML` + untrusted content (see §10).
- Scheduled dependency bumps (Renovay/Dependabot free tier) proposed for Phase 5, not MVP.

---

## 13. Incident response basics

No pager, no on-call — just a calm runbook.

**If a secret key leaks (committed to git, shared in a chat, scraped):**

1. **Rotate immediately** per §2.4 rotation procedure (provider dashboard → revoke old → set new in Vercel → redeploy).
2. Assess exposure window: was it in a public git history or just in private dev files?
3. If public git history: rotate is mandatory; rewrite history only if the repo is public and secrets are in recent commits (`git filter-repo`) or push a fresh repo (simpler on zero budget).
4. Check provider dashboards for anomalous usage during exposure (Pl@ntNet quota, Supabase audit logs).
5. Add a `docs/RETRO-<date>.md` note — what leaked, when, what changed.

**If storage (Supabase) is abused — junk uploads or stuffing:**

1. Identify offending `user_id`/object paths via SQL query on `identifications` + `request-images` listing.
2. Purge: delete objects + `identifications` rows; optionally ban profile (RLS-only admin tool in MVP is direct SQL in Supabase SQL editor — acceptable for MVP admin, logged manually).
3. Tighten the knob in `app_settings` (lower daily cap) — proves the configurability requirement.
4. If public bucket `plant-images` is defaced with hostile images: `service_role` delete of offending objects, tighten admin-only write policy, restore known-good objects from a manual snapshot (Supabase Free has NO automatic backups — [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) — so we do manual SQL/db dumps during development; storage objects need ad-hoc export if valuable).

**If the Pl@ntNet key is throttled/used abusively upstream:** rotate key + tighten per-IP cap + add per-user cap if anonymous flood is the vector.

Escalation path is trivial (solo dev): owner = responsible for all steps above.

---

## 14. Non-goals & consciously accepted risks

**Explicit non-goals for MVP (and beyond unless re-scoped):**

- No WAF or paid DDoS service (zero budget; Vercel platform-level protection is what we get).
- No paid security scanners / pentests. Not affordable; basic checklist coverage in [`TESTING_PLAN.md`](TESTING_PLAN.md) instead.
- No full SSI/SOC2-style logging pipeline or real-time alerting.
- No hard bot CAPTCHA; honeypot only (§7).

**Residual risks consciously accepted (documented so we know we chose them):**

| Risk | Why accepted | Revisit when |
|---|---|---|
| Rate-limit counters are multi-instance best-effort (serverless) | Zero budget; MVP traffic; Supabase `identifications` count backstops per-user limits | Any real abuse observed → Phase 5 durable rate_limits table / Redis (availability UNVERIFIED) |
| Hashed junk uploads could still theoretically starve global quota via many-IP attack | Would need meaningful attacker investment for a 500/day API; graceful 503 UX exists | First sign of real abuse |
| Client-side EXIF stripping is best-effort; server does not re-strip | We don't store EXIF server-side; Pl@ntNet needs the image anyway | If GPS-in-images becomes a stored feature |
| CSP has `unsafe-inline` in MVP | Nonce-based CSP needs middleware plumbing; deferred to Phase 5 | Phase 5 |
| Anonymous free uploads mean obuser can spoof with many IPs | Product decision: keep anonymous 5/day as core UX | Phase 4 accounts / Phase 5 abuse data |
| Admin surfaces in MVP are skinny (no 2FA UI, no audit log UI) | MVP admin = owner; risk of owner compromise accepted; dashboard-level 2FA recommended manually | Phase 4 admin panel |

---

*Last updated: 2026-11-10 (Phase 0). Marked dependencies on chosen versions resolve at Phase 1 scaffold. Cross-references: [`PROJECT_PLAN.md`](PROJECT_PLAN.md) · [`REQUIREMENTS.md`](REQUIREMENTS.md) · [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) · [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) · [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) · [`TESTING_PLAN.md`](TESTING_PLAN.md) · [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)*
