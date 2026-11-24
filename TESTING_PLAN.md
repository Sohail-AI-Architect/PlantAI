# PlantAI — Testing Plan

> Scope: free/open-source testing strategy for PlantAI, prioritizing the critical identify path while staying pragmatic (no 100%-coverage vanity). Follows CANONICAL PROJECT DECISIONS (phases, MVP exclusions, zero-budget tooling).
> Facts about third-party quotas/plans come from [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md); anything else stated here is **UNVERIFIED** until confirmed at scaffold time.
> Related: [`SECURITY.md`](SECURITY.md) · [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`REQUIREMENTS.md`](REQUIREMENTS.md) · [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) · [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) · [`DEVELOPMENT_ROADMAP.md`](DEVELOPMENT_ROADMAP.md) · [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md)

---

## Table of Contents

1. [Testing philosophy](#1-testing-philosophy)
2. [Tooling choices](#2-tooling-choices)
3. [Unit testing scope](#3-unit-testing-scope)
4. [Integration testing (Supabase local)](#4-integration-testing-supabase-local)
5. [API testing (/api/identify contract tests)](#5-api-testing-apiidentify-contract-tests)
6. [E2E scenarios (Playwright)](#6-e2e-scenarios-playwright)
7. [Manual test checklists](#7-manual-test-checklists)
8. [Security testing checklist](#8-security-testing-checklist)
9. [SEO testing](#9-seo-testing)
10. [Performance testing](#10-performance-testing)
11. [Acceptance testing (requirements traceability)](#11-acceptance-testing-requirements-traceability)
12. [Test data strategy](#12-test-data-strategy)
13. [Sprint-level test gates per phase](#13-sprint-level-test-gates-per-phase)
14. [Known gaps & accepted risks](#14-known-gaps--accepted-risks)

---

## 1. Testing philosophy

- **Test the critical path hard.** The one feature that makes or breaks PlantAI is: *user → image → Pl@ntNet → result → save*. Everything around it (auth halves, content pages) gets thinner coverage.
- **Pragmatic over exhaustive.** Target: meaningful coverage of pure functions, a handful of E2E flows, and a strict API contract suite. We explicitly do NOT chase a coverage number.
- **Deterministic first.** Anything calling a third party is mocked with offline fixtures (synthetic, documentation-derived, provenance-labeled — §12.1); anything calling a network in CI fails review.
- **Fast feedback.** Unit tests run in seconds; E2E runs only on-demand/CI, not per-save.
- **Zero budget.** Every tool below is free/open-source. No paid test platforms, no BrowserStack, no paid fakedata.

---

## 2. Tooling choices

| Tool | Role | Rationale | Status |
|---|---|---|---|
| **Vitest** | Unit/integration tests for pure TS functions | Fast, TS-native, Vite-based (matches Next.js dev stack), zero config cost, free MIT | Chosen — exact version picked at Phase 1 scaffold (**UNVERIFIED** until then) |
| **Playwright** | E2E + browser-level tests | Free, cross-browser (Chromium/Firefox/WebKit), officially Microsoft-maintained, built-in tracing/screenshot-on-fail | Chosen — version pinned at scaffold (**UNVERIFIED**) |
| **Supabase Local CLI** (`supabase start`, local Postgres + Auth + Storage emulation) | Integration tests for RLS policies and triggers, Phase 2+ | Free, official, runs real Postgres so RLS tests are trustworthy. **Requires Docker only if/when this phase starts** — Docker is NOT mandatory in Phase 0/1 | Phase 2+ |
| **Playwright + manual QA** for React Server Components | RSC renders async data; unit-testing RSC is high-friction | Honest trade-off: rely on E2E + manual spot-checks for RSC behavior (streaming, suspense) rather than trying to unit-test server components | Documented decision |
| **GitHub Actions** | CI (unit + API contract + build) | Free for public repos (minutes UNVERIFIED for 2026 — [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) research note #9); PlantAI repo is public | Phase 2+ optional |
| **Lighthouse (CI or CLI)** | Performance/accessibility audits | Free, Chrome-bundled | Phase 3+ (see §10) |
| Console/manual greps | Secret-leak checks | Free, zero setup | Immediate |

---

## 3. Unit testing scope

All unit tests target **pure functions** (deterministic, no I/O). Target suite runtime: seconds.

| # | Unit under test | Example cases |
|---|---|---|
| 1 | **Image validation** (`validateImageFile`) | jpg with correct magic bytes → ok; png with wrong magic → rejected; file renamed `.jpg` but bytes are PDF → rejected; 9.99 MB → ok; 10.01 MB → rejected; 0 images → rejected; 4 images → rejected; non-image MIME type → rejected; SVG masquerading as jpg → rejected |
| 2 | **Hash computation** (`combinedImageHash` in `src/lib/identify/hash.ts`, for identification_cache dedupe) | Same bytes → same hash; different image → different hash; empty buffer → error; >10 MB buffer → still stable; known-vector fixture pin (snapshot) |
| 3 | **PlantNet response normalizer** (`normalizeUpstreamResponse` in `src/lib/plantnet/normalize.ts`) with fixture JSON | Happy path fixture → normalized candidates with confidence 0–1; missing `score` → default/undefined handled; empty results → empty array; malformed id field (`gbif.id`/`powo.id` in v2 — legacy `node_id` naming here predates the Stage A1 verification) → skipped; negative score → clamped/flagged; extra unknown fields → ignored not crashed |
| 4 | **Care summary resolution** (phase 4) | plant with full care data → summary object; plant missing watering → falls back to library defaults; empty care data → safe "unknown" summary; multiple conflicting entries → deterministic tiebreak |
| 5 | **Rate-limit counter logic** (`RateLimiter` class) | Anonymous under 5/day → allowed; 5th anon request → denied; 6th authenticated request same day → allowed; 20th authenticated → allowed; 21st → denied; day rollover (fake clock) → counters reset; concurrent increments from two "instances" → both counted (best-effort semantics test); per-user and per-IP counters independent |
| 6 | **Reminder date math** (phase 4) | Watering every 7 days from today → correct next date; overdue reminder → negative days flag marked; leap year/Feb; DST-boundary non-crash; recomputation after "mark watered today" resets the cycle |

Fixtures live in `tests/fixtures/` (JSON for Pl@ntNet responses, see §12).

---

## 4. Integration testing (Supabase local)

Phase 2+. Uses Supabase local CLI (needs Docker, which is optional — not installed in Phase 0/1; revisit at Phase 2 kickoff per [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md) § Prerequisites).

### 4.1 RLS policy verification matrix

Executed as SQL tests against the local Postgres with `SET LOCAL role` / `SET LOCAL request.jwt.claims` per actor. Schema source of truth: [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md).

| Actor \ Table | profiles | plant_library | identifications | user_plants | care_reminders | saved_plants | blog_posts | contact_messages | app_settings |
|---|---|---|---|---|---|---|---|---|---|
| **anon (no JWT)** | read: own none; denied insert | read allowed; write denied | denied all | denied all | denied all | denied all | published read ok; write denied | insert-only via policy (form) | denied (unless public key) |
| **user A (JWT)** | read/update self only | read allowed; write denied | read/insert own; no cross-read; no update; delete own (Phase 4) | CRUD own only | CRUD own only | CRUD own only | read published; write denied | insert; cannot read others | denied |
| **user B (JWT)** | read self only (never A's) | read allowed | denied on A's rows | denied on A's rows | denied on A's rows | denied on A's rows | read published only | denied on A's messages | denied |
| **admin (JWT)** | read/update any (incl. role) | CRUD | read any; delete any (retention) | read any (moderation) | read any | read any | CRUD | read/update status; delete | read/update |
| **service_role** | full (explicit, documented) | full | full | full | full | full | full | full | full |

Every `?` verdict in this matrix must become a real assertion — no "probably".

### 4.2 Additional integration tests

- **Server Actions with auth mocks:** identify-save action, save-to-library action, contact-message action — each with (a) missing session → rejected, (b) valid session + Zod-valid input → success, (c) valid session + Zod-invalid input → 4xx-style failure, (d) attempt to set `user_id` of another user → silently overwritten/rejected.
- **Storage upload policy:** authenticated user uploads image to own namespace path → ok; attempts upload to another user's path → denied; upload `.svg` → denied by app layer; upload >10 MB → denied; anonymous upload to own anonymous path → ok and matches rate-limit gate.

---

## 5. API testing (/api/identify contract tests)

Route Handler contract tests via Vitest + Next.js request/response mocks (or `next test`-style utilities chosen at scaffold — pattern UNVERIFIED until Phase 1 picks versions). Local Supabase stubbed/mocked for this suite.

| # | Case | Input | Expected outcome |
|---|---|---|---|
| 1 | **Happy path** | 1 valid jpg (fixture) with mocked Pl@ntNet 200 via synthetic fixture | 200; normalized candidates in body; `identifications` row recorded (mocked); remaining-quota logged |
| 1b | Happy path 3 images (max) | 3 valid jpgs | 200; all forwarded; upstream receives 3 |
| 2 | **Oversized image** | jpg fixture 10.01 MB | 413/400; no Pl@ntNet call; no credit consumed |
| 3 | **Wrong MIME** | `.png`-named actually-PDF | 415; magic-number check fails; no upstream call |
| 4 | **Too many/few images** | 0 or 4 files | 400 |
| 5 | **Rate limit anon exceeded** | 6th call today (mocked counter) | 429 (our own limit, distinguishable from upstream path) with friendly message |
| 6 | **Quota-exceeded upstream mock** | Pl@ntNet returns 429 | API responds **503** with user-friendly body (per [`SECURITY.md`](SECURITY.md) §3); no retry storm |
| 7 | **Pl@ntNet 500 mock** | upstream 500 | 503; logged |
| 8 | **Missing/invalid payload** | malformed JSON | 400 |
| 9 | **Privacy assertion** | capture upstream request body | contains images + project slug ONLY — no email/IP/user_id/GPS fields (test asserts absence) |
| 10 | **No secret leak** | inspect response + route module | never contains PLANTNET_API_KEY value |

**Fixture policy:** Pl@ntNet responses used in CI are **synthetic,
documentation-derived fixtures** (Stage D, 2026-11-13). We **never call the real
Pl@ntNet API in CI** — the free 500/day quota is a shared resource and CI would
be unreliable too. Exactly **one manual smoke test per week against the live
Pl@ntNet API** is allowed, documented in the weekly test log (date, key
rotated?, result).

Provenance rules (Stage D):
- Every fixture explicitly declares its provenance
  (`tests/fixtures/plantnet/upstream-fixtures.ts` exports
  `FIXTURE_PROVENANCE`): field **shapes** mirror the verified Stage A1
  upstream contract, but **values** (species names, scores, authors, URLs,
  quota numbers) are invented offline placeholders.
- Synthetic fixtures are **NOT real recorded Pl@ntNet responses** and must
  never be presented or referenced as such. Image URLs use the RFC 2606
  `.invalid` TLD (never resolvable); only documented *header formats* and
  attribution wording are quoted verbatim.
- Real recorded responses require the separately authorized **Stage G live
  smoke**; when they land they must be stored under
  `tests/fixtures/plantnet/*.{json}` with their capture provenance recorded.
- Synthetic and actual recorded fixtures must never be misrepresented as one
  another — every fixture carries or is referenced with its correct kind.

---

## 6. E2E scenarios (Playwright)

Planned E2E scenarios (Playwright is **not installed/configured** in this repo; none of these have been executed). If implemented, Pl@ntNet must be **always mocked** at the route level (`page.route()` intercept) — never live.

| # | Scenario | Steps | Asserts |
|---|---|---|---|
| 1 | **Visitor identifies plant (anonymous)** | Open home → upload 1 fixture image → get result | Results shown; confidence rendered; no auth prompt needed; rate-limit message appears on 6th attempt (mocked) |
| 2 | **Authed user full loop** *(not run; needs owner-enabled provider and approved test account)* | Sign in with **Continue with Google** (no one-click anonymous sign-in exists) → identify → save result → open My Plants → see saved plant → delete it | End-to-end persistence via app surfaces only |
| 3 | **Library search** | Open Plant Library → type search term → filter matches → open plant detail | Search is a client/DB query (specifier per Architektur); no upstream call |
| 4 | **Login / logout** *(not run; needs owner-approved test user)* | Sign in → sign out → protected route bounce to `/login` → refresh cannot restore session | Proxy + server guards work |
| 5 | **Contact form** | Fill form → submit → success message → honeypot-triggered fake bot submission is silently dropped | No real email needed in MVP |
| 6 | **Blog page renders** | Visit /blog (Phase 3) → posts list → single post | RSC + rendering path smoke-tested |
| 7 | **PWA install** | *(deferred to Phase 6 per MVP exclusions — placeholder)* | — |

---

## 7. Manual test checklists

Executed before each phase gate and at launch.

### 7.1 Responsive spot-check (mobile priority)

Widths to eyeball: **360 / 390 / 768 / 1024** on real Chrome DevTools + (if available) one real phone.

| Width | Check |
|---|---|
| 360 | Identify hero + upload CTA visible; no horizontal scroll; buttons tappable |
| 390 | Result cards stack cleanly; no clipped text |
| 768 | Library grid reasonable; nav not cramped |
| 1024 | Dashboard/admin surfaces not wasted whitespace |

### 7.2 Keyboard-only navigation pass

Tab order logical; skip-to-content link present; focus visible on all interactive controls; upload CTA reachable and Enter/Space triggers; modal (if any) traps focus properly; no keyboard trap on library card.

### 7.3 Screen-reader pass (light)

Each page has a unique `<title>`; headings form a coherent outline; images have meaningful `alt` (or `alt=""` decorative); form errors announced (aria-live where appropriate). Light pass only — full audit is a Phase 6 candidate.

### 7.4 Cross-browser

| Browser | Version basis | Status |
|---|---|---|
| Chrome (desktop) | current stable | Primary target |
| Firefox (desktop) | current stable | Secondary |
| Safari (desktop) | current on macOS (if available — UNVERIFIED availability on this Windows dev box; if no Mac, rely on WebKit in Playwright) | Best-effort |
| Edge (Windows) | current stable | Same engine as Chrome but test once |
| Mobile Chrome (Android) | real device if available | Best-effort |

### 7.5 Low-battery / throttled-network spot check

Chrome DevTools throttling: "Slow 4G" + 4× CPU — identify flow remains usable and doesn't hang UI; skeleton/loading states show; no unhandled promise rejection noise. PWA/low-battery-specific optimizations are Phase 6 per MVP exclusions.

---

## 8. Security testing checklist

Mirrors controls defined in [`SECURITY.md`](SECURITY.md). Admin/owner runs this before each phase gate.

- [ ] **Headers present on `/`, `/login`, `/api/identify`** via `curl -I`: HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, CSP baseline (§11 snippet shipped).
- [ ] **No secret in client bundle:** grep the built `.next` output for `PLANTNET_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and for suspicious `sk-` / long-base64 blobs. Must return zero hits.
- [ ] **`server-only` import guard works:** attempting to import Pl@ntNet proxy from a Client Component fails the build (temporary test commit or unit check on the module graph).
- [ ] **RLS probes (manual via Supabase SQL editor / local CLI):** anon + user-B JWT read attempt on user A's `identifications` returns 0 rows; update/delete attempt denied; `profiles.role` unprivileged update denied.
- [ ] **Rate limit behavior:** fire 6 vendored anonymous identify calls from same IP → 6th returns 429 locally (or best-effort note if multi-instance test on Vercel preview).
- [ ] **Storage abuse probe:** attempt upload >10 MB → rejected; SVG upload → rejected; write to another user's `request-images/` path → denied.
- [ ] **SVG/XSS:** try submitting text containing `<script>` into every text input → rendered escaped, not executed.
- [ ] **Contact form honeypot:** fill hidden field → submit silently dropped (visible only in logs).
- [ ] **`/api/identify` returns 503, not raw upstream 429/500 strings**, when Pl@ntNet is mocked to fail (already unit-level; repeat in deployed preview).
- [ ] **`plant-images` public bucket** contains no user-submitted identification photos (spot check path list).

---

## 9. SEO testing

Phase 3+ (content/SEO phase). MVP identifies pages ship with sensible metadata but SEO testing overhead is intentionally deferred.

- **Google Search Console coverage** — checked **after launch** (requires domain ownership); track: pages indexed, mobile usability, structured data errors.
- **Meta presence lint** — small script (Phase 3) asserting every public route has `<title>` and `<meta name="description">`; run in CI or as a Playwright check.
- **Schema validation** — any JSON-LD for individuals or plants validated against Google **Rich Results Test URL** (https://search.google.com/test/rich-results) — manual paste of deployed page URL, per-release checklist. (Tool is free; no API automation in MVP.)
- `robots.txt` + `sitemap.xml` existence checked at Phase 3 gate per [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md).

---

## 10. Performance testing

Free tools; thresholds are **proposals** to confirm/adjust after first Lighthouse run on a deployed preview (not localhost, which skews optimistic).

### Lighthouse CI threshold proposal

```jsonc
// lighthouserc.json (proposed, tuned in Phase 3)
{
  "ci": {
    "collect": { "url": ["https://<preview-url>/", "/library"] },
    "assert": {
      "assertions": {
        "categories:performance":  ["error", { "minScore": 0.85 }],
        "categories:accessibility": ["error", { "minScore": 0.90 }],
        "categories:best-practices": ["error", { "minScore": 0.90 }],
        "categories:seo": ["error", { "minScore": 0.90 }]
      }
    }
  }
}
```

(Mobile form-factor defaults; performance >85, a11y >90, SEO >90 as required. exact config syntax UNVERIFIED until the Lighthouse CI version is picked in Phase 3.)

### Budget list

| Metric | Budget (mobile, Slow 4G — proposed) |
|---|---|
| Identify page LCP | < 2.5 s |
| Total JS on identify page | < 200 KB gzip |
| Home LCP | < 2.0 s |
| Image payloads (plant library) | lazy-loaded, no full library in one response |
| No blocking third-party scripts in MVP | zero ads/trackers until Phase 5 |

Manual `next build` size check after each feature is the MVP proxy for bandbudget.

---

## 11. Acceptance testing (requirements traceability)

Map [`REQUIREMENTS.md`](REQUIREMENTS.md) FR/NFR IDs → test artifacts. Maintained as a living table starting Phase 2; updated per feature merge. Definition of done per feature: **(a) FR implemented, (b) matching test(s) green, (c) relevant item from §7/§8 manual checklists executed, (d) docs cross-references still accurate.**

| Requirement ID | What it is | Test artifact |
|---|---|---|
| FR-ID + user can identify plant anonymously | Core UX | E2E #1; API contract tests §5 #1,2,3,4 |
| FR-ID + authenticated identify flow | Core UX | E2E #2; integration §4.2 |
| FR-RATE + per-IP/per-user limits | Abuse resistance | Unit #5; API contract #5; Security checklist item |
| FR-UPLOAD + only jpg/png ≤10 MB 1–3 images | Input gate | Unit #1; API contract #2,3,4 |
| FR-AUTH + Google OAuth + PKCE callback + safe `next` | Account gate | Offline OAuth contracts (`tests/google-oauth.test.ts`); integration §4.1 matrix; E2E #4 (owner-only) |
| FR-LIBRARY + plant library public browse | Content | E2E #3; RLS matrix read row |
| FR-SAVE + save identifications / My Plants | Phase 4 | E2E #2; RLS matrix user rows |
| FR-CONTACT + contact form | Content/SEO | E2E #5; abuse checklist |
| NFR-PERF + responsive/mobile-fast | UX | Lighthouse thresholds §10; responsive checklist §7.1 |
| NFR-A11Y + keyboard/screen-reader basic | UX | Manual §7.2–7.3 |
| NFR-SEC + secrets never client-side, RLS on all | Security | Security checklist §8; contract test #10 |
| NFR-SEO + metadata per page | Discoverability | SEO lint §9 |

*(Exact FR/NFR numbering lives in [`REQUIREMENTS.md`](REQUIREMENTS.md); populate the ID column when that file lands. This table is the tracking skeleton, not a claim of current coverage.)*

---

## 12. Test data strategy

### 12.1 Fixture image library (committed to `tests/fixtures/images/`)

At least: **10 common plant photos** (clear species, varied angles — dandelion, tomato leaf, rose, monstera, sunflower, basil, maple leaf, lavender, fern, orchid), **1 unreadable/corrupt** file (truncated bytes), **1 oversized** (>10 MB jpg), **1 clearly-not-a-plant** photo (e.g. a keyboard). Sources: self-shot or CC0 sources; never store copyrighted photos in the public repo.

| Fixture | Used for |
|---|---|
| 10 plant photos | happy-path contract + E2E; they do not need genuine Pl@ntNet accuracy since responses are mocked |
| unreadable file | validation rejection path |
| >10 MB file | size rejection path |
| not-a-plant photo | normalizer robustness (upstream returns **HTTP 404 "Species not found"** for non-plant images — verified 2026-11-12; the normalizer/error path must map this to `no_match_found`, while other unexpected upstream 4xx values remain a distinct error path) |

**Fixture shape policy (Stage A1/A2 alignment, 2026-11-12; provenance clarified Stage D):** fixtures
— synthetic, documentation-derived, provenance-labeled (see §5 fixture policy) — must mirror the
**verified upstream contract** in [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) /
[`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) §2.8 — host `https://my-api.plantnet.org`, endpoint
`POST /v2/identify/{project}`, default project **`all`**, repeated `organs` form values (one per
image, in image order; values `leaf`/`flower`/`fruit`/`bark`/`auto`), response body with
`results[]` (`score` 0–1, `species.*`, `commonNames`, optional `gbif.id`/`powo.id`),
`predictedOrgans`, `bestMatch`, `remainingIdentificationRequests`, headers
`RateLimit-Policy`/`RateLimit`/`Retry-After`, per-image `images[]` with **actual**
`author`/`license`/`citation` fields (license may vary/be missing — fixtures must include a
missing-license case since unknown licenses prevent display). Fixtures written before Stage A1
carrying `allplants`/`lateral`/`root`/singular `organ` assumptions are obsolete and must not be
used as reference shapes.

### 12.2 CI setup

- **GitHub Actions on a public repo** = free (minutes/billing specifics UNVERIFIED for 2026 — [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) research note #9; costs could matter only if repo went private, which it won't in MVP).
- CI workflow (Phase 2+): `npm ci` → `vitest run` (unit + contract) → `next build` → optional Playwright on a schedule (not per-push, to stay in free-minutes budget — cadence decided at Phase 2).
- **Playwright browsers cached** (`@actions/cache`) to keep run time low.

---

## 13. Sprint-level test gates per phase

| Phase | Test gate to exit |
|---|---|
| 0 Planning | Docs align; no code (no test gate) |
| 1 Env & Scaffold | `next build` passes; lockfile committed; none of: real keys in `.env.local` committed accidentally (grep check) |
| 2 MVP Identification + auth | **All critical-path tests green**: unit #1,3,5 + API contract §5 full + RLS matrix §4.1 + E2E #1,2,4; weekly Pl@ntNet manual smoke executed and logged; `npm audit` reviewed (informational) |
| 3 Content/SEO | SEO lint passes; Lighthouse thresholds §10 met on deployed preview; E2E #6 green |
| 4 My Plants / Saved / Dashboard | E2E #2 extended (save/edit/delete pan), RLS matrices re-run after any new policy; delete-my-data action tested on local Supabase |
| 5 Prod Deployment + Monetization prep | Security checklist §8 fully green in production; incident runbook re-read; (optional) `npm audit` in CI enabled; rate limit behavior verified against real multi-instance Vercel (best-effort documented) |
| 6 PWA/Launch | Full manual checklists §7 re-run on staging; SEO listed in Search Console; Lighthouse re-run on prod |
| 7 Future | Scope re-evaluated (Android load testing, visual regression etc. — not scheduled) |

---

## 14. Known gaps & accepted risks

Explicit non-goals within testing, so nobody pretends we have them:

- **No visual regression testing** (Playwright screenshot diffing is possible for free but adds flaky maintenance; MVP does not pay that tax) — accepted.
- **No load/stress testing infrastructure** (k6 locally possible but pointless against upstream 500/day quota; no production load test on Vercel Hobby — UNVERIFIED whether harness spawning is allowed) — accepted.
- **No paid pentest** — replaced by [`SECURITY.md`](SECURITY.md) checklist self-review; a real pentest is a future-money feature if the product grows.
- **RSC behavior not unit-tested** — covered by E2E + manual per §2 note.
- **Multi-instance rate-limit behavior is not perfectly testable** on a local machine; production test on deployed preview is best-effort (matches [`SECURITY.md`](SECURITY.md) §14 documented limitation).
- **No automated E2E on Safari/native iOS** — best-effort via WebKit engine in Playwright only; real-device pass depends on hardware availability (UNVERIFIED on this Windows setup).

---

*Last updated: 2026-11-10 (Phase 0). Cross-references: [`REQUIREMENTS.md`](REQUIREMENTS.md) · [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`SECURITY.md`](SECURITY.md) · [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) · [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) · [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) · [`DEVELOPMENT_ROADMAP.md`](DEVELOPMENT_ROADMAP.md) · [`TASKS.md`](TASKS.md) · [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)*
