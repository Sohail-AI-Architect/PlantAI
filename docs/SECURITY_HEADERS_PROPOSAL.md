# PlantAI — Security Headers Implementation Proposal (Stage 2 candidate)

> **Document:** `docs/SECURITY_HEADERS_PROPOSAL.md` · **Date:** 2026-11-15
> **Status:** Implemented 2026-11-15 (Stage: Fast MVP completion — `next.config.ts` `headers()` block added exactly per this proposal's baseline). Verification evidence: production build + header inspection recorded in the stage report. The proposal below is retained as the design record.
> **Baseline source:** `SECURITY.md` §11 (lines 267–294) — the planned header set.
> **Audit finding:** none of the planned headers exist today; `next.config.ts` (29 lines) contains no
> `headers()` block (Master Audit 2026-11-15, finding E1/HIGH; `PROJECT_MASTER_CONTEXT.md` §13.1).

---

## 1. Current state (evidence)

- `next.config.ts` defines only `cacheComponents`, `partialPrefetching`,
  `experimental.proxyClientMaxBodySize: "34mb"`, and a Turbopack CSS rule (lines 3–27). **No
  `headers()`, no `images` config, no redirects.**
- `SECURITY.md:157` lists "Security headers added under `headers()` — see §11" as part of the plan;
  §11 (lines 267–294) provides the baseline snippet (HSTS, nosniff, Referrer-Policy, X-Frame-Options,
  CSP) and states Vercel applies "some sane defaults" but PlantAI adds what's missing explicitly.
- Consequence: pages currently rely on platform defaults only; no explicit HSTS, no CSP, no
  frame/clickjacking protection, no nosniff, no referrer policy of our own choosing.

## 2. Proposed header set

| Header | Proposed value | Rationale / notes |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | 2-year HSTS per SECURITY.md §11. **Caution:** only enable `preload` when confident every subdomain is HTTPS-only; on a custom apex domain with unknown future subdomains, `includeSubDomains` alone is safer. Start without `preload`; add it consciously later. |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-sniffing of uploaded/served content. Zero compatibility risk. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Privacy-preserving default (matches SECURITY.md §11). Zero compatibility risk. |
| `X-Frame-Options` | `DENY` | Clickjacking protection. Note: modern equivalent is CSP `frame-ancestors 'none'` (proposed below); XFO is kept for legacy browsers, exactly as the §11 snippet does. |
| `Content-Security-Policy` | see §3 | The only compatibility-sensitive header. Ship it in **Report-Only** mode first. |
| *(Phase 6, not now)* | `Permissions-Policy` | Camera (future PWA) + geolocation off; explicitly deferred by SECURITY.md:292. |

## 3. CSP design and compatibility concerns

Baseline (SECURITY.md:278–287), adapted to the verified Supabase integration:

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https://<PROJECT_REF>.supabase.co;
connect-src 'self' https://<PROJECT_REF>.supabase.co wss://<PROJECT_REF>.supabase.co;
font-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
```

Compatibility analysis (each directive vs the actual app):

- **`script-src 'self' 'unsafe-inline'`** — Next.js App Router injects inline bootstrap scripts and
  (in dev) requires `'unsafe-eval'`; React Server Components stream inline payloads. Dropping
  `unsafe-inline` requires a nonce-based CSP with middleware support (SECURITY.md:291 plans this as a
  Phase 5 evolution). **MVP keeps `unsafe-inline`** — documented, honest trade-off; the header still
  blocks external script injection and `object-src`.
- **`style-src 'self' 'unsafe-inline'`** — Tailwind generates a stylesheet, but React inline
  `style=` attributes and Next's inline styles require `unsafe-inline`. Kept for MVP.
- **`img-src`** — must include the **Supabase storage host** before any `plant_library.image_url`
  (hosted on the `plant-images` public bucket) renders via `next/image`. Also note: adding remote
  image hosts additionally requires an `images.remotePatterns` entry in `next.config.ts` for
  `next/image` — a separate, currently-missing config (Master Audit §G). `data:` is included for
  inline placeholders only if actually used — otherwise drop it.
- **`connect-src`** — Supabase JS talks to `https://<PROJECT_REF>.supabase.co` (REST/auth) and uses
  WebSockets (`wss://`) for Realtime (not currently used, but harmless to allow; remove if unused at
  review). **Never** add `my-api.plantnet.org` here — Pl@ntNet is called server-side only
  (`src/lib/plantnet/live-provider.ts`), so the browser never needs that origin; adding it would
  widen the client attack surface for no benefit.
- **`frame-ancestors 'none'`** — replaces/extends XFO `DENY`; no embedding use-case exists.
- **`form-action 'self'`** — no native credential form remains; Google OAuth starts via a supabase-js
  redirect and returns same-origin to `/auth/callback`, so CSP form targets are not part of the
  provider allowlist.
- **Auth redirects** — the Google/Supabase provider redirect is governed by Google Cloud's authorized
  redirect URIs and Supabase's redirect allowlist (`docs/GOOGLE_OAUTH_SETUP.md`), not by CSP.
  Legacy `/auth/confirm` and `/auth/link` callbacks are same-origin navigations — unaffected by CSP.
  No `*.supabase.co` entries are needed beyond the project host above.
- **Third-party scripts (AdSense, analytics):** NONE exist today. **When AdSense ships (Phase 5/6),
  CSP must be revisited** — AdSense requires script/img/frame allowances for `googleadservices.com`,
  `googlesyndication.com`, `doubleclick.net` etc. This is a planned, conscious Phase 5 change, not an
  MVP concern.

## 4. Proposed implementation shape (for the future stage — NOT executed)

```ts
// next.config.ts — headers() returning async headers() [{ source: '/:path*', headers: [...] }]
// CSP host values injected from env (NEXT_PUBLIC_SUPABASE_URL host) at config-eval time —
// never hardcoded, so dev/staging/prod project refs stay correct.
```

- Apply headers to all routes (`source: '/:path*'`).
- Ship CSP **first as `Content-Security-Policy-Report-Only`** with `report-uri`/`report-to` to the
  browser console (zero-budget reporting per SECURITY.md:293), observe for a fixed soak window,
  then flip to enforcing `Content-Security-Policy`.
- Header values reviewed against `SECURITY.md` §11 at implementation time; SECURITY.md remains the
  control document — this file is the implementation plan, not a competing source.

## 5. Testing and verification procedure (for the future stage)

1. **Build gate:** `npm run build` exit 0; `npm run typecheck` clean.
2. **Header presence:** `curl -sI http://localhost:3000/ | findstr /i "strict-transport content-security x-frame x-content-type referrer-policy"` — all five present with expected values on `/`, `/identify`, `/plant/<slug>`, `/login`, and a 404 response.
3. **CSP soak (Report-Only):** browse all real routes in Chrome/Edge + Firefox; confirm **zero CSP
   violations** in DevTools console; exercise Google sign-in/out and any reachable legacy callbacks,
   plus the identify upload flow; only then switch to enforcing.
4. **Functional regression:** identify upload (mock), save-plant action, auth loop all still work
   (CSP must not break `connect-src` to Supabase or inline bootstrap).
5. **External spot-check (optional):** a public header-inspection service of the owner's choosing
   once deployed; never paste secrets into third-party tools.
6. **Evidence:** record command outputs + soak duration in the stage report; CHANGELOG entry.

## 6. Risks / open items

- `preload` HSTS decision (§2) — owner call.
- `next/image` remotePatterns for Supabase storage remains missing independently of headers — track
  as its own Phase 3 task (it blocks plant images regardless of CSP).
- AdSense-driven CSP relaxation is deferred to Phase 5/6 and must be a deliberate, documented change.

---

**END OF PROPOSAL. Nothing implemented. Implementation requires explicit owner approval as a
separate stage (Stage 2 candidate per PROJECT_MASTER_CONTEXT.md §12).**
