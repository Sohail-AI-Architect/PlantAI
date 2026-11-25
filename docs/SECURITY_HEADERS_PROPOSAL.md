# PlantAI — Security Headers Implementation Proposal (Stage 2 candidate)

> **Document:** `docs/SECURITY_HEADERS_PROPOSAL.md` · **Date:** 2026-11-15
> **Document role:** historical design record. It preserves the pre-implementation
> audit and proposed rollout; it is not the current implementation source.
> **Current implementation status:** implemented in `next.config.ts` (Stage D,
> 2026-11-15). Verified from source: headers are applied to `/:path*` with
> `Strict-Transport-Security: max-age=63072000; includeSubDomains` (no `preload`),
> `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
> `X-Frame-Options: DENY`, and an enforcing `Content-Security-Policy`. Supabase
> origins are derived from `NEXT_PUBLIC_SUPABASE_URL`; AdSense origins are
> explicitly allow-listed. Source implementation does not independently prove the
> deployed Netlify response headers; owner verification of live headers remains
> required.
> **Original audit finding (historical):** at the time of the 2026-11-15 master
> audit, none of the planned headers existed and `next.config.ts` was 29 lines
> with no `headers()` block (Master Audit 2026-11-15, finding E1/HIGH).

---

## 1. Historical pre-implementation state (evidence, 2026-11-15)

- At audit time, `next.config.ts` defined only `cacheComponents`,
  `partialPrefetching`, `experimental.proxyClientMaxBodySize: "34mb"`, and a
  Turbopack CSS rule (lines 3–27). **No `headers()`, no `images` config, no
  redirects.** The current file now includes `headers()` and `images.remotePatterns`;
  see the current-status banner above.
- Earlier `SECURITY.md` §5 listed "Security headers added under `headers()` —
  see §11" as part of the plan; §11 provided the baseline snippet (HSTS,
  nosniff, Referrer-Policy, X-Frame-Options, CSP) and the historical note that
  Vercel applies "some sane defaults".
- Historical consequence: pages then relied on platform defaults only; no
  explicit HSTS, no CSP, no frame/clickjacking protection, no nosniff, no
  referrer policy of our own choosing.

## 2. Proposed header set

| Header | Historical proposal / current source | Rationale / notes |
|---|---|---|
| `Strict-Transport-Security` | Historical proposal: `max-age=63072000; includeSubDomains; preload`. Implemented source: `max-age=63072000; includeSubDomains` (`preload` is not currently implemented). | 2-year HSTS per `SECURITY.md` §11. **Caution:** `preload` should only be enabled when every subdomain is confidently HTTPS-only; the implemented baseline deliberately omits it. Adding it remains a separate owner decision. |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-sniffing of uploaded/served content. Zero compatibility risk. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Privacy-preserving default (matches `SECURITY.md` §11). Zero compatibility risk. |
| `X-Frame-Options` | `DENY` | Clickjacking protection. Modern equivalent is CSP `frame-ancestors 'none'` (below); XFO is kept for legacy browsers. |
| `Content-Security-Policy` | see §3 | Original proposal: ship in **Report-Only** mode first. Current source ships an enforcing `Content-Security-Policy`; see the implementation note below. |
| *(deferred; not implemented)* | `Permissions-Policy` | Camera (future PWA) + geolocation off; absent from `next.config.ts`. `SECURITY.md` §11 states it is not part of the implemented baseline. No Phase 6 implementation commitment is claimed. |

> **Implementation note:** the table above preserves the original proposal and
> records the current source value where they differ. The implemented
> `next.config.ts` uses HSTS **without** `preload`, ships CSP in enforcing mode
> (not Report-Only), and includes the `object-src 'none'` and `frame-src`
> directives shown in §3. `Permissions-Policy` remains deferred. No
> `report-uri` or `report-to` directive or endpoint is configured.

## 3. CSP design and compatibility concerns

### 3.1 Historical proposal baseline

Historical baseline from the pre-implementation proposal, adapted at the time to
the verified Supabase integration. This is **not** the current source value:

```text
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

That historical example had no AdSense origins and no `frame-src` directive.

### 3.2 Current source implementation (`next.config.ts`)

Actual CSP assembled at config evaluation. Placeholders stand for the
environment-derived Supabase values; all AdSense origins below are the exact
explicit origins in `next.config.ts`. These are source values only and do not
prove the headers returned by the deployed Netlify site:

```text
default-src 'self';
script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://securepubads.g.doubleclick.net https://www.google.com https://www.gstatic.com https://adservice.google.com https://partner.googleadservices.com https://www.googletagservices.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google;
style-src 'self' 'unsafe-inline';
img-src 'self' data: <validated HTTPS Supabase origin> https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://www.google.com https://www.gstatic.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google;
connect-src 'self' <validated HTTPS Supabase origin> wss://<validated Supabase host> https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://www.google.com https://www.gstatic.com https://adservice.google.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google;
frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://www.gstatic.com https://ep2.adtrafficquality.google;
font-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
```

`NEXT_PUBLIC_SUPABASE_URL` is parsed at config evaluation. Only HTTPS hosts
ending in `.supabase.co` or `.supabase.com` are accepted; invalid, placeholder,
or unparseable values are omitted rather than guessed. The validated HTTPS
origin is added to `img-src` and `connect-src`, and
`wss://<validated Supabase host>` is added to `connect-src` for realtime. In
development only, `'unsafe-eval'` is added to `script-src` for HMR/Turbopack;
production does not add it. No broader wildcard origins are added beyond the
exact AdSense list above and the validated Supabase origin.

Compatibility analysis (each directive vs the actual app):

- **`script-src`** — the implemented directive is `'self' 'unsafe-inline'`
  plus explicit AdSense script origins, with `'unsafe-eval'` added only in
  development. Next.js App Router injects inline bootstrap scripts and React
  Server Components stream inline payloads; dropping `unsafe-inline` requires a
  nonce-based CSP with middleware plumbing, which `SECURITY.md` §11 treats as a
  future evolution. External scripts are restricted to the explicit allow-list,
  including AdSense; they are not generally blocked. `object-src 'none'`
  separately restricts object/plugin content rather than serving as a script
  control.
- **`style-src 'self' 'unsafe-inline'`** — Tailwind generates a stylesheet, but React inline
  `style=` attributes and Next's inline styles require `unsafe-inline`. Kept for MVP.
- **`img-src`** — the implemented CSP directive includes `'self'`, `data:`, the
  validated HTTPS Supabase origin, and the explicit AdSense image origins.
  This is distinct from `images.remotePatterns` in `next.config.ts`: the CSP
  directive governs browser image loads, while `images.remotePatterns` only
  governs which remote hosts `next/image` may optimize. The implemented remote
  patterns are `https://*.supabase.co` and `https://*.supabase.com`.
- **`connect-src`** — the implemented directive includes `'self'`, the
  validated HTTPS Supabase origin, `wss://<validated Supabase host>` for
  realtime, and the explicit AdSense connect origins. Pl@ntNet is called
  server-side only (`src/lib/plantnet/live-provider.ts`), so
  `my-api.plantnet.org` is not added to browser `connect-src`; adding it would
  widen the client attack surface without benefit.
- **`frame-src`** — the implemented directive is limited to the explicit
  AdSense frame origins. This governs frames the page loads; it is separate
  from `frame-ancestors`, which governs who may embed PlantAI.
- **`frame-ancestors 'none'`** — replaces/extends XFO `DENY`; no embedding use-case exists.
- **`form-action 'self'`** — no native credential form remains; Google OAuth starts via a supabase-js
  redirect and returns same-origin to `/auth/callback`, so CSP form targets are not part of the
  provider allowlist.
- **Auth redirects** — the Google/Supabase provider redirect is governed by Google Cloud's authorized
  redirect URIs and Supabase's redirect allowlist (`docs/GOOGLE_OAUTH_SETUP.md`), not by CSP.
  Legacy `/auth/confirm` and `/auth/link` callbacks are same-origin navigations — unaffected by CSP.
  No `*.supabase.co` entries are needed beyond the project host above.
- **Third-party scripts (AdSense, analytics):** at audit time, none were expected. The implemented
  CSP explicitly allow-lists the AdSense origins shown in §3.2, and `src/app/layout.tsx`
  contains an AdSense loader. AdSense approval, active ad serving, and consent behavior remain
  owner verification items; no approval or revenue claim is made here.

## 4. Historical proposed implementation shape (now implemented in `next.config.ts`)

```ts
// next.config.ts — async headers() returning [{ source: '/:path*', headers: [...] }]
// Supabase host values are parsed from NEXT_PUBLIC_SUPABASE_URL at config evaluation;
// only https hosts ending in .supabase.co or .supabase.com are accepted;
// invalid, placeholder or unparseable values are omitted rather than guessed.
```

- Apply headers to all routes (`source: '/:path*'`) — implemented.
- The historical proposal considered a `Content-Security-Policy-Report-Only`
  soak with manual DevTools console observation. Current source sets an
  enforcing `Content-Security-Policy`; no `report-uri` or `report-to` directive
  or endpoint is configured. DevTools console inspection is manual observation,
  not a configured browser-console reporting endpoint. No completed CSP soak is
  claimed.
- Header values were reviewed against `SECURITY.md` §11; `SECURITY.md` remains the control document,
  while this file is retained as the historical implementation plan.

## 5. Historical testing and verification procedure (owner verification of deployed headers still required)

1. **Build gate:** `npm run build` exit 0; `npm run typecheck` clean.
2. **Header presence:** `curl -sI http://localhost:3000/ | findstr /i "strict-transport content-security x-frame x-content-type referrer-policy"` — all five present with expected values on `/`, `/identify`, `/plant/<slug>`, `/login`, and a 404 response.
3. **CSP soak (historical Report-Only proposal):** browse all real routes in Chrome/Edge + Firefox;
   confirm **zero CSP violations** by manual DevTools console observation; exercise Google sign-in/out
   and any reachable legacy callbacks, plus the identify upload flow. The implemented baseline is
   already enforcing, so this step is retained as the original rollout plan and as an owner
   verification model, not as evidence of a completed soak or of configured CSP reporting.
4. **Functional regression:** identify upload (mock), save-plant action, auth loop all still work
   (CSP must not break `connect-src` to Supabase or inline bootstrap).
5. **External spot-check (optional):** a public header-inspection service of the owner's choosing
   once deployed; never paste secrets into third-party tools.
6. **Evidence:** record command outputs + soak duration in the stage report; CHANGELOG entry.

## 6. Risks / open items

- `preload` HSTS decision (§2) — resolved in the implemented baseline as **no preload**; adding it
  remains a deliberate owner decision.
- `next/image` remotePatterns for Supabase storage was missing at audit time; it is now present in
  `next.config.ts` for `*.supabase.co` and `*.supabase.com`.
- AdSense origins are explicitly allow-listed in the implemented CSP. Any future relaxation must be a
  deliberate, documented change, and AdSense approval/ad serving remain owner verification items.
- Report-Only rollout and configured CSP reporting were historical proposals only; current source
  has enforcing CSP with no `report-uri` or `report-to` directive or endpoint.
- Live Netlify response headers are not proven by source code; owner verification is still required.

---

**END OF HISTORICAL PROPOSAL. The baseline is implemented in `next.config.ts`; deployed Netlify
response headers require owner verification. No new implementation or deployment is performed by
this document.**
