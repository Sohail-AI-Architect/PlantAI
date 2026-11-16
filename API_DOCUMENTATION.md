# PlantAI — API Documentation

> Status: Phase 2 implemented (mock-first) · Last updated: 2026-11-12
> Owner: Technical Architect
> Third-party facts (Pl@ntNet free plan = 500 identifications/day, 20 concurrent max, errors consume 1 credit, ≤50 MB POST, 429 at quota exhaustion until midnight UTC) are sourced from [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) unless marked **UNVERIFIED**.
> Related: [`ARCHITECTURE.md`](ARCHITECTURE.md), [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md), [`AI_INTEGRATION_PLAN.md`](AI_INTEGRATION_PLAN.md), [`UI_UX_DESIGN.md`](UI_UX_DESIGN.md), [`SECURITY.md`](SECURITY.md), [`REQUIREMENTS.md`](REQUIREMENTS.md), [`TESTING_PLAN.md`](TESTING_PLAN.md), [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md), [`CHANGELOG.md`](CHANGELOG.md).

---

## Table of Contents

1. [Overview — the internal API surface](#1-overview--the-internal-api-surface)
2. [`POST /api/identify` — full specification](#2-post-apiidentify--full-specification)
   - 2.1 [Endpoint facts](#21-endpoint-facts)
   - 2.2 [Auth expectations](#22-auth-expectations)
   - 2.3 [Request contract](#23-request-contract)
   - 2.4 [Server-side processing pipeline](#24-server-side-processing-pipeline)
   - 2.5 [Rate limiting & response headers](#25-rate-limiting--response-headers)
   - 2.6 [Response contract (success)](#26-response-contract-success)
   - 2.7 [Error responses](#27-error-responses)
   - 2.8 [Pl@ntNet upstream mapping](#28-plantnet-upstream-mapping)
   - 2.9 [Validation rules (client & server)](#29-validation-rules-client--server)
3. [Server Actions catalog](#3-server-actions-catalog)
4. [Future endpoints (non-MVP)](#4-future-endpoints-non-mvp)
5. [Rate limiting strategy](#5-rate-limiting-strategy)
6. [Testing guidance](#6-testing-guidance)
7. [Changelog — API changes](#7-changelog--api-changes)

---

## 1. Overview — the internal API surface

PlantAI deliberately keeps the **public HTTP API surface minimal**:

| Surface | Role |
|---|---|
| **RSC pages** (App Router) | All *reads* — the page *is* the API for data rendering: `/plant/[slug]`, `/library?q=`, `/my-plants`, blog, static pages |
| **Server Actions** (`src/actions/*`) | All *mutations* except identify: saved plants, contact form, Phase-4 reminders/my-plants, admin content writes |
| **`POST /api/identify`** | **The only Route Handler in the MVP** — binary upload → validation → rate limit → cache → server-side Pl@ntNet proxy → persist → JSON |
| **Supabase client SDK** (from browser) | Auth session flows only (signup/confirm/login/reset/logout) + RLS-authorized Storage uploads; database reads through the SDK are not used by pages (pages go server-side) |

**Rationale for exactly one Route Handler:**

1. The identify flow needs *binary multipart input*, *explicit HTTP status codes* (400/413/429/503 semantics), *custom response headers* (`X-RateLimit-*`), and a *proxy* role over an upstream HTTP API — semantics Server Actions don't model naturally.
2. Everything else (typed input → validate → DB write → revalidate) is a better fit for Server Actions: no client fetch layer, no URL-versioning burden, zero extra files. An HTTP endpoint nobody calls is pure maintenance cost (`ARCHITECTURE.md` ADR-3/ADR-4).
3. This keeps the whole *data* API internal/openable later: if an external consumer ever appears (public API in Phase 7+), the zod schemas in `src/lib/validation/` are already the canonical contract objects.

Cross-reference: the runtime pipeline diagram is in [`ARCHITECTURE.md`](ARCHITECTURE.md) §8.2; DB tables are in [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md).

---

## 2. `POST /api/identify` — full specification

### 2.1 Endpoint facts

| Property | Value |
|---|---|
| Method | `POST` |
| Path | `/api/identify` |
| Body encoding | `multipart/form-data` |
| Max body (server limit) | ~32 MB total (3 images × 10 MB + fields) — oversized bodies rejected as `413` before heavy work |
| Response format | `application/json` (UTF-8) |
| CORS | Same-origin only — no whitelisting; the browser must call this via the same origin (this is the *reason* the key stays server-side, [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Pl@ntNet account rules) |
| Runtime | Vercel serverless function (Node runtime; memory sized for 3×10 MB buffers) |
| Idempotency | Uploads are hash-deduped (§2.4) — repeated calls with identical images return cached results and skip the upstream credit |
| Upstream | Pl@ntNet API v2 at **`https://my-api.plantnet.org`** (`/v2/identify/{project}`; default project **`all`**) — 500 identifications/day free ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md), verified 2026-11-12); API key supplied **only** server-side via `PLANTNET_API_KEY` as the **`api-key` query parameter** (`ENVIRONMENT_SETUP.md`). **The full request URL contains the key and must NEVER be logged** — errors and diagnostics must be redacted before any log output |

### 2.2 Auth expectations

| Scenario | Identity | Rate limit basis |
|---|---|---|
| Not logged in | Anonymous — allowed | Per-IP: **5/day** (default; tunable in `app_settings.identify.daily_limit.anonymous`, [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) §3.9) |
| Logged in (session cookie present) | Authenticated user | Per-user: **20/day** (default; tunable via `app_settings.identify.daily_limit.authenticated`) |
| Admin | Has `profile.role='admin'` | Same as authenticated (component: admins still respect upstream 500/day pool — [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) |

- No `Authorization` header is ever needed — identity comes from the `@supabase/ssr` session cookie via `middleware.ts`.
- Anonymous use is a **product decision** (try-it-before-signup, `REQUIREMENTS.md`), paid for with stricter limits + optional captcha in Phase 5 if abuse appears (`SECURITY.md`).
- Limits are *discoverable via response headers* (§2.5) and *enforceable gracefully* — the UI waits for `429` to render the “quota reached” state rather than error text (`UI_UX_DESIGN.md`).

### 2.3 Request contract

| Part | Type | Required | Constraint | Description |
|---|---|---|---|---|
| `images[]` | `File` (binary) | **Yes (1–3 files)** | `image/jpeg` or `image/png` only (magic-byte sniffed, not just extension); ≤ **10 MB each** (client pre-resizing: **planned, not yet implemented** — see note below) | 1–5 allowed upstream but PlantAI allows only 1–3 (upstream cap is 5, [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md); 3 keeps POST small + protects quota; recommended shot set: whole plant, leaf top-side, flower/fruit if present). **All images must be the same individual plant** (upstream rule) |
| `latitude` | `number` | No | `-90..90`, decimal degrees | Regional flora hint — semantically part of “region” |
| `longitude` | `number` | No | `-180..180` | Ditto |
| `organ` | `string` | No | one of `leaf`, `flower`, `fruit`, `bark`, `auto` (default `auto`) | PlantAI's organ hint. **Upstream contract (verified 2026-11-12):** the upstream parameter is **`organs` (plural)** — one repeated form value **per image, matched in image order**; omitting it enables automatic detection. `lateral`/`root` are **not valid upstream values** (previously listed here in error). The route's request builder maps the single caller field to the repeated upstream `organs` values (Stage B implementation; **code mismatch flagged in TASKS.md future work — current zod/UI enum still contains `lateral`/`root` and lacks `fruit`/`bark`**) |
| `sendMarkdown` / non-standard fields | — | — | — | **Rejected** — unknown form fields are ignored silently to keep upload forward-compatible in MVP |

Notes:

- **MVP decision: no server-side resize.** Pl@ntNet auto-resizes input to 1280 px on the smaller side ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)), so PlantAI passes ≤10 MB originals straight through. Client `UploadWidget` downsampling/encoding (canvas) is **planned but not yet implemented** (deferred per `TASKS.md` P2-01, 2026-11-12 — no client resize/compress or EXIF-strip code exists today; the server's magic-byte + size validation is authoritative). If Supabase upload sizes ever need server resize (future feature: server-side storage tiering), it'd be a separate decision recorded in `CHANGELOG.md`.
- `latitude`/`longitude` precision: keep `!==`-exact — clients send 5–6 decimal places max; nothing leaks more precision.
- `images[]` name must match exactly; multiple files under the same form key.

### 2.4 Server-side processing pipeline

```text
 [1] parse multipart            ── fail ► 413 (total size) / 400 (malformed)
 [2] field validation (zod)     ── fail ► 400
 [3] magic-byte type + size per image ── fail ► 400 (type) / 413 (per-image size)
 [4] rate limit (per-user/per-IP daily counter + concurrency semaphore)
                                ── fail ► 429 (daily)  / 503 (upstream concurrency starved)
 [5] perceptual hash of each image (JS library, no native deps)
 [6] hash lookup in identification_cache ── hit ► normalize cached / update hit_count ► 200 (cached:true)
 [7] persist identifications row (status=processing, image_paths)
 [8] upstream POST https://my-api.plantnet.org/v2/identify/{project}
      │        (project `all`; api-key query param; repeated `organs` per
      │         image in order — the URL contains the key and is NEVER logged)
     ├─ 2xx → [9]
     ├─ 429 (upstream quota exhausted until midnight UTC) → status=failed ► 503 response
     │       + remainingQuota:0 + "quota reached" UI state
     ├─ 4xx upstream (bad request — shouldn't happen) → status=failed ► 502 → mapped per §2.7
     └─ network/5xx → status=failed ► 502 response
 [9] normalize result to PlantAI shape (§2.6), attach confidence band labels
     + CC-BY-SA citation strings for images
 [10] resolve careSummary: best botanical match → query plant_library
      by scientific name; found → embed careSummary else null
 [11] update identifications row: result, best_match_*, status=complete
 [12] put identification_cache (p_hash, project, organ → normalized_result)
 [13] respond 200 with JSON + rate-limit headers
```

Decision notes:

- Identifications insert **before** the upstream call, so failures still create a `failed` row for analytics (but note: nothing consumes Pl@ntNet quota unless we actually call upstream — validation-failed early requests never even reach step 7).
- Cache stampede guard: two identical uploads in flight do not double-call upstream — the second hits the just-noted cache row (upsert on hash key, [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) §3.10).
- No markdown re-processing: response = the one stored `result` JSON.

### 2.5 Rate limiting & response headers

Every response (success, error, and 429) includes:

| Header | Meaning |
|---|---|
| `X-RateLimit-Limit` | Daily cap for the caller's class (5 anon / 20 auth — current settings) |
| `X-RateLimit-Remaining` | Calls left today for this caller (integer ≥ 0) |
| `X-RateLimit-Reset` | Epoch-seconds until reset (next **00:00 UTC** — aligns to Pl@ntNet's midnight-UTC quota reset ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md))) |
| `X-RateLimit-Remaining-Upstream` | Server's *last known* global remaining Pl@ntNet pool/500 — best-effort; unknown before first upstream call of the day |

Client reading → UI “N of M identifications left today” chip (`UI_UX_DESIGN.md`).

**Upstream quota headers (Pl@ntNet → PlantAI server, documented upstream contract):** identification responses also carry `RateLimit-Policy` (`"dailyQuota";q=…;w=86400;pk=…` — policy definition), `RateLimit` (`"dailyQuota";r=<remaining>;t=<seconds to reset>;pk=…` — remaining quota + reset timing), and `Retry-After` (RFC 7231 date, returned **with upstream HTTP 429**). PlantAI captures these server-side (never forwarded verbatim) to power `X-RateLimit-Remaining-Upstream` and the exact reset hint. The response **body** also carries `remainingIdentificationRequests` (quota remaining today).

### 2.6 Response contract (success)

HTTP `200`, `Cache-Control: no-store`.

```json
{
  "success": true,
  "cached": false,
  "identificationId": "5f1c2f41-6f70-49a1-11d0-7f4ecbb13da0",
  "remainingQuota": 18,
  "topResult": {
    "species": [
      {
        "rank": 1,
        "scientificName": "Monstera deliciosa",
        "commonNames": ["swiss cheese plant", "ceriman"],
        "family": "Araceae",
        "genus": "Monstera",
        "gbifId": 2875115,
        "score": 0.83,
        "confidenceBand": "exact",
        "sources": ["pl@ntnet-v2"],
        "images": [
          {
            "url": "https://my.plantnet.org/.../illustration.jpg",
            "alt": "Monstera deliciosa illustration",
            "citation": "Pomme Pépin / Pl@ntNet, cc-by-sa",
            "cc_by_sa": true
          }
        ]
      },
      {
        "rank": 2,
        "scientificName": "Monstera adansonii",
        "commonNames": ["five holes plant"],
        "family": "Araceae",
        "genus": "Monstera",
        "gbifId": 2875201,
        "score": 0.11,
        "confidenceBand": "possible",
        "sources": ["pl@ntnet-v2"],
        "images": []
      }
    ]
  },
  "careSummary": {
    "watering": "Water when top 2–3 cm of soil are dry; reduce in winter.",
    "sunlight": "Bright indirect light; avoid direct midday sun.",
    "soil": "Airy mix: peat/coir + perlite + orchid bark.",
    "fertilizer": "Balanced NPK monthly in growing season.",
    "plantLibrarySlug": "monstera-deliciosa"
  }
}
```

Field rules:

| Field | Rule |
|---|---|
| `species[]` | Max 10 entries, top-score-first (zero-cardinality rule: no requirement of exact count from upstream) |
| `confidenceBand` | Derived from `score`: `score >= 0.7` → `"exact"`; `0.35 ≤ score < 0.7` → `"likely"`; `score < 0.35` → `"possible"` (thresholds are a PlantAI product choice, not upstream semantics — tune in Phase 2 after real-score inspection, note in `AI_INTEGRATION_PLAN.md`) |
| `images[]` | Carries **CC-BY-SA-style citation** on every image (mandatory render obligation — [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Pl@ntNet images). In mock mode always `[]` — mock never fabricates botanical imagery or citations |
| `careSummary` | Object with 4 strings + `plantLibrarySlug`, **or `null`** if no `plant_library` row matches the top species |
| `cached` | `true` if served from `identification_cache` (no fresh upstream call); in that case `remainingQuota` reflects last-known upstream value |
| `remainingQuota` | Caller's daily remainder (mirrors `X-RateLimit-Remaining`) |

**Phase 2 additive fields (mock mode — see §7 v0.2.0):**

| Field | Rule |
|---|---|
| `mode` | `"mock"` \| `"live"` — always present. `"mock"` results are example data and must NEVER be presented as real AI output (UI renders the demo banner; `sources: ["mock"]` on every candidate) |
| `mockNotice` | Present in mock mode only: human-readable label, e.g. `"Demo result — PlantAI testing mode. This is not a real AI identification."` |
| `careSummary.plantLibraryId` | Additive: the library row `id`, so the results UI can call the `savePlant` action directly |
| `species[].plantLibrarySlug` | Additive (mock mode): seeded library slug per fixture candidate, for the "open full detail" affordance. Live mode may keep it post-normalization or drop it — resolve via `careSummary` there |

**Mock-mode success example (Phase 2 live behavior, verified 2026-11-12):** top-level `mode:"mock"`, `mockNotice:"Demo result — PlantAI testing mode. This is not a real AI identification."`, `sources:["mock"]` on all candidates, `images:[]`, deterministic per image-set (seeded from the combined SHA-256).

### 2.7 Error responses

Envelope is consistent: `success:false`, a stable machine `error.code`, human-safe `message`, optional `details[]` (picked from zod). **No stack traces, no upstream internals** (`SECURITY.md`).

| HTTP | `error.code` | Typical cause | `message` (user-facing) | Recovery hint |
|---|---|---|---|---|
| 400 | `invalid_request` | missing/empty images[]; wrong field type; bad `organ`; malformed lat/lon | “We couldn't read your photos — check the upload and try again.” | Show zod `details` in form UI |
| 400 | `unsupported_image` | not JPEG/PNG (magic bytes) | “Only JPEG or PNG photos are supported.” | Re-encode client-side |
| 401 | `auth_required` | (identify's optional-auth flow doesn't emit this today; kept for consistency with other endpoints/actions) | “Please sign in to continue.” | Nudge login |
| 404 | `no_match_found` | upstream returned no usable species result | “No confident match — try better light, a closer leaf photo, or another angle.” | Retry suggestions |
| 413 | `image_too_large` | any image >10 MB after arrival (client resize failed/JS off) | “That photo is too large (over 10 MB). Try enabling the auto-resize helper.” | Client re-resize |
| 429 | `daily_limit_reached` | caller's own per-user/per-IP daily cap | “You've used your free identifications for today — come back after midnight UTC, or sign in for more.” | Render quota UI state |
| 502 | `upstream_error` | Pl@ntNet 5xx / network | “The plant identification service is having trouble — please try again in a moment.” | Retry |
| 503 | `quota_exhausted` | upstream `429` (Pl@ntNet pool exhausted until midnight UTC, [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) | “PlantAI's daily identification quota is exhausted — back tomorrow morning. Why not browse the library in the meantime?” | Library CTA |
| 503 | `concurrency_limited` | per-instance semaphore saturated (20 upstream max, [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) | “We're busy identifying other plants — try again in a few seconds.” | Brief retry |
| 500 | `internal_error` | unexpected | “Something went wrong on our side — the error has been logged.” | Retry later |

Example error body (`429`):

```json
{
  "success": false,
  "error": { "code": "daily_limit_reached", "message": "You've used your free identifications for today — come back after midnight UTC, or sign in for more." },
  "remainingQuota": 0,
  "nextResetUTC": "2026-11-11T00:00:00Z"
}
```

**Failure-consumes-credit warning:** an upstream request that *errors* still costs 1 Pl@ntNet credit ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md), verified since 2026-02-13) — this is exactly why steps 1–5 of the pipeline fail *before* upstream. Any request that gets past validation is assumed to be a plausible identify attempt.

**Upstream 404 semantics (verified 2026-11-12):** Pl@ntNet rejects images identified as non-plants with **HTTP 404 "Species not found"** — this specific condition maps to PlantAI's `404 no_match_found` (same friendly UX as an empty result list). Other unexpected upstream 4xx responses are **not** no-matches: they are contract-drift/client-server mismatches and remain a distinct error path (planned code `upstream_rejected`, HTTP 502 — future-work item in `TASKS.md`; not yet implemented).

### 2.8 Pl@ntNet upstream mapping

| Concern | Value / rule |
|---|---|
| Upstream endpoint | **`POST https://my-api.plantnet.org/v2/identify/{project}`** (official API host — verified 2026-11-12; `my.plantnet.org` is the docs/portal site). Auth via the **`api-key` query parameter**. **The URL embeds the secret — never log full URLs; redact the key from every log/diagnostic/error path** (`ENVIRONMENT_SETUP.md`) |
| Default project | **`all`** (official default; "set `project` to `all`" when no specific flora fits). Legacy projects are deprecated upstream — never sent |
| Regional project | **Deferred, not in MVP:** `/v2/projects` accepts `lat`/`lon` (WGS84) and returns nearby projects — **that transmits the user's location to Pl@ntNet**. PlantAI's MVP sends **no GPS coordinates upstream**; if regional selection is ever adopted it requires explicit user consent + a documented privacy disclosure (LEGAL_AND_COMPLIANCE.md §2.6) |
| Upstream image count | We upload all the caller's images (1–3 of the upstream max 5) under repeated `images` form fields; all must be the **same individual plant** (UI copy enforces; upstream rejects otherwise) |
| Upstream organs | Upstream parameter is **`organs` (plural)**: one repeated value **per image, in image order**; identical values repeated for same-organ sets; **omitting the parameter = automatic detection for every image**. Valid values `leaf`/`flower`/`fruit`/`bark` (+`auto`). PlantAI's single `organ` caller field is mapped by the request builder (Stage B) — current zod/UI enum mismatch is a flagged future-work item (`TASKS.md`) |
| Upstream body size | Pl@ntNet limit: ≤50 MB total, 1–5 images, JPEG/PNG ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) — PlantAI's stricter 3×10 MB always fits |
| Upstream response normalization | v2 shape: `results[]` with `score` 0–1, `species.scientificNameWithoutAuthor`, `commonNames`, `family.scientificNameWithoutAuthor`, `genus.scientificNameWithoutAuthor`, optional `gbif.id`/`powo.id`, per-image `images[]` with **actual** `author`/`license`/`citation` fields (returned per image — never assumed), plus `predictedOrgans`, `bestMatch`, `version`, `remainingIdentificationRequests`. Mapping to §2.6 happens in `src/lib/plantnet/normalize.ts`; normalized shape is the **only** thing stored in `identifications.result` / `identification_cache.normalized_result`, so upstream drift is fixed at one file. **Optional/absent image fields are handled conservatively** (see licensing row) |
| Image licensing / display rule | Images are **usually** CC BY-SA but this is **not guaranteed per image** — use the actual returned `author`/`license`/`citation`. The Using-images doc establishes **CC BY-SA as the only documented reusable case** (attribution + ShareAlike; pattern `Photo(s): [Contributor] / Pl@ntNet, CC BY-SA`). PlantAI renders an upstream image **only** when its returned `license` is a documented-reusable value (currently `cc-by-sa`), always with contributor + Pl@ntNet credit + license; unknown/missing/unsupported license → **image not displayed**, candidate still shown. Free-plan "Powered by Pl@ntNet" mention is appreciated, not required — kept separate from per-image photo attribution |
| Upstream quota signals | Response **body** field `remainingIdentificationRequests` (remaining today) + headers `RateLimit-Policy` / `RateLimit` (remaining + seconds-to-reset) / `Retry-After` (on upstream 429). Captured server-side → `X-RateLimit-Remaining-Upstream` + exact reset hints; never forwarded verbatim |
| Upstream 404 semantics | Images identified as non-plants → upstream **404 "Species not found"** → PlantAI `404 no_match_found`. Other unexpected upstream 4xx ≠ no-match (distinct error path; planned `upstream_rejected`) |
| Error-cost reality | Any non-2xx upstream response may consume 1 credit ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) — therefore **retry-on-failure is avoided in MVP** (a transient network failure is surfaced as 502; the user manually retries). **No automatic retries** |
| Key secrecy | `PLANTNET_API_KEY` read exclusively inside `src/lib/plantnet/` (server-only module, build-time error if imported client-side). **No CORS whitelisting is ever registered** for the API; no browser-visible config exposes the key; **the key must never appear in application logs** (query-parameter authentication makes URL redaction mandatory) |

### 2.9 Validation rules (client & server)

Duplicated intentionally at both boundaries (client gives pre-click UX; server gives security truth — a skipped client resize can't sneak a 40 MB file in):

| # | Rule | Client (`UploadWidget`) | Server (`/api/identify`) |
|---|---|---|---|
| V1 | 1–3 images | File input `max` + accept filter; count from DOM files | Count form entries named `images[]`; reject 0 or >3 |
| V2 | MIME `image/jpeg` \| `image/png` | `accept` + extension/UI check | Magic-byte sniff (first bytes: `FFD8FF` / `89504E47`) |
| V3 | ≤**10 MB** per image | File.size check (canvas pre-resize on exceed: **planned, not yet implemented** — `TASKS.md` P2-01) | Content-Length + buffer length re-check |
| V4 | total body ≤~32 MB |      (implicit) | Body content-length guard |
| V5 | All photos = same plant | Copy in UI (“photos of the same individual”) | **Not verifiable automatically** — accepted on trust + upstream validation |
| V6 | `organ` ∈ five-value enum | Select dropdown | zod enum, default `auto` |
| V7 | lat/lon numeric ranges; only both-or-neither | Warn on one-without-other | zod refine (`both` XOR `neither`) |
| V8 | Session cookie validity | (used transparently) | `middleware.ts` + `@supabase/ssr` parse; invalid cookie = anonymous treat (not an error) |
| V9 | Filename/path safety | (planned — **no storage path assembly exists yet**; when Storage uploads ship, strip path separators and replace the original name entirely with a UUID storage name) | Strip path separators; UUID storage name replaces original name entirely |

Any validation failure never touches Pl@ntNet (quota rule, [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)).

---

## 3. Server Actions catalog

All actions live in `src/actions/*.ts`, each prefixed `"use server"`, take **zod-validated** input objects, use the **caller's server session client** (RLS applies — `DATABASE_SCHEMA.md` §RLS) unless noted as `admin (service-role path)`, and return a typed `{ ok: true, data } | { ok: false, error }` discriminant. Auth actions are **absent** intentionally (see §3.3).

### 3.1 MVP actions (Phases 1–3)

```ts
// src/actions/saved-plants.ts
savePlant(input: { plantId: string }): Promise<Action<{ saved: true } | { saved: false; reason: "already_saved" }>>
```
`savePlant` — zod-validated `plantId` (uuid, must be a published `plant_library` row per RLS + explicit existence check). Idempotent via `(user_id,plant_id)` primary key save in `saved_plants` (signature allows same-plant re-save treated as `already_saved`). Signature guard: requires session — anonymous callers get `401`-equivalent `UNAUTHORIZED` result.

```ts
unsavePlant(input: { plantId: string }): Promise<Action<{ deleted: boolean /* false if absent idempotent */ }>>
```
`unsavePlant` — delete own `saved_plants` row by `(user_id, plant_id)`; idempotent (missing row = success `false`).

```ts
// src/actions/contact.ts
submitContact(input: { name; email; subject?; message; honeypot?: string }): Promise<Action<{ received: true }>>
```
`submitContact` — generic-user action. **App-level rate limit first** (§5 + `DATABASE_SCHEMA.md` §3.8 note) and a silently-swallowed honeypot submit (spam deterrence) — then insert into `contact_messages` via the RLS `p_contact_messages_insert_anyone` policy. `ip_hash` is computed server-side (salted), never exposed to the client.

### 3.2 Phase 4 actions (My Plants & Reminders)

```ts
// src/actions/user-plants.ts
createUserPlant(input: { userPlant: { nickname; plantLibraryId?; scientificName?; commonName?; imageUrl?; acquiredAt?; location?; notes? } }): Promise<Action<UserPlant>>;
updateUserPlant(input: { userPlantId: string; patch: Partial<UserPlant> }): Promise<Action<UserPlant>>;
deleteUserPlant(input: { userPlantId: string }): Promise<Action<{ deleted: true }>>;  // cascades care_reminders
```

```ts
// src/actions/reminders.ts
createReminder(input: { userPlantId: string; reminderType: ReminderType; intervalDays: number; nextDueDate: string /* ISO date */; notes?: string }): Promise<Action<CareReminder>>;
updateReminder(input: { reminderId: string; patch: Partial<{ reminderType; intervalDays; nextDueDate; notes; isPaused }> }): Promise<Action<CareReminder>>;
completeReminder(input: { reminderId: string }): Promise<Action<CareReminder>>;   // sets last_completed_at; trigger owns next_due_date advance (DATABASE_SCHEMA.md §5.4)
deleteReminder(input: { reminderId: string }): Promise<Action<{ deleted: true }>>;
```

Notes:

- `user_id` on `care_reminders` is derived server-side from the session (and cross-checked by trigger §5.3), never passed by the client.
- Every Phase-4 action re-checks the owner under RLS (`p_care_reminders_owner_all`) before write; two parallel writes are serialized by row lock on Postgres — no extra transaction layer needed.

### 3.3 Phase 3–4 admin actions (role-gated)

```ts
// src/actions/admin/plant-library.ts (admin only, is_admin()-checked → RLS `p_plant_library_write_admin`)
adminUpsertPlantLibraryEntry(input: {
  id?: string;                       // upsert by id if given; else insert
  slug?: string;                     // optional change; uniqueness enforced
  scientificName: string; commonNames: string[]; family?; genus?; category;
  description?; watering?; sunlight?; soil?; fertilizer?; imageUrl?; imageCredit?; isPublished: boolean
}): Promise<Action<PlantLibraryEntry>>

adminUpsertBlogPost(input: {
  id?: string; slug: string; title: string; excerpt?; contentMd: string;
  coverImageUrl?; coverImageCredit?; status: 'draft'|'published'|'archived';
  seoTitle?; seoDescription?
}): Promise<Action<BlogPost>>   // sets published_at automatically on first publish
```

These run through the **admin client** path (session of an admin user invoking an action — RLS gives write access by `is_admin()`); for bulk/seed-like maintenance that service-role is legitimate, migrations/seed SQL is used (`DATABASE_SCHEMA.md` §7) — never an HTTP surface.

### 3.4 Where auth actions *don't* live

Authentication (signup, confirm, login, reset, logout) **is not** implemented as Server Actions, deliberately:

- Supabase's JS client handles verification/flows (PKCE, email confirm links, session cookie shaping) natively in the browser.
- A Server Action would need cookie-wrapping glue (`@supabase/ssr` supports it, but browser-native flows differ minimally) — so MVP uses small **client components** + `@supabase/ssr` middleware as designed in `ARCHITECTURE.md` §7.
- Result: fewer custom flows to test; middleware refreshes the session regardless of how auth was initiated.

### 3.5 Uniform action contract

```ts
type Action<TData> =
  | { ok: true;  data: TData }
  | { ok: false; error: { code: "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION" |
                          "NOT_FOUND" | "RATE_LIMITED" | "CONFLICT" | "INTERNAL",
                          message: string;           // human-safe
                          details?: { path: string; msg: string }[] } };
```

Mapping: zod failure → `VALIDATION` (with `details`), RLS denial/missing session → `UNAUTHORIZED`/`FORBIDDEN`, missing row → `NOT_FOUND`, idempotent conflicts → explicit field, unexpected error → `INTERNAL` (logged, no stack to caller). UI maps these to toast/inline copy (`UI_UX_DESIGN.md`). Testing of every action: `TESTING_PLAN.md`.

---

## 4. Future endpoints (non-MVP)

**Explicitly non-MVP** (canonical decision #8) — listed to freeze naming and avoid accidental near-term invention:

| Endpoint | Phase | Status | Notes |
|---|---|---|---|
| `POST /api/diseases/identify` | **7 — BETA** | Planned, placeholder only | Wraps Pl@ntNet `/v2/diseases/identify` launched 2025-12-02 — **BETA, limited to a small list of species & diseases (EPPO codes)** and consumes the same identify quota ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)). MVP delivers *educational* disease guides only; UI copy must never imply AI diagnosis until Phase 7 review with real coverage data. Reuses the `/api/identify` pipeline (validation, cache, rate limits) with a different upstream project + normalized `diseases[]` shape. |
| `GET /api/plants/suggest?q=` | (optional, Phase 3+) | **Rejected for now** | Autocomplete reads stay in RSC/actions — no separate endpoint unless an external consumer appears |
| `POST /api/reminders/cron-tick` | Phase 5+ | Considered, unverified | Push/email reminder delivery will need a scheduled job (Vercel Cron or a simpler client-visible “due today” page). No email-sending endpoint exists in MVP; all reminders are in-app UI (`REQUIREMENTS.md`) |
| `GET /api/health` | Phase 1 | Planned (ops only) | Anonymous liveness; also suggested as the tiny daily traffic source to prevent free Supabase pause ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Supabase) |

Decisions to revisit are recorded in `CHANGELOG.md`; Endpoint paths above are aspirational, not binding until implemented.

---

## 5. Rate limiting strategy

### 5.1 MVP mechanism

- `src/lib/rate-limit.ts`: **in-memory** per-instance counters: `Map<key, {count, resetAt}>`; key = `user:{id}` or `ip:{salted-hash}`; reset at next **midnight UTC** (aligned to upstream, [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)).
- Limits come from `app_settings` (`identify.daily_limit.anonymous|authenticated`), read once per instance + on settings `updated_at` change (cheap polling).
- Concurrency gate: semaphore, `identify.concurrent.upstream` **4** per instance default — instances are assumed ≤5, keeping the aggregate under Pl@ntNet's **20-simultaneous** ceiling ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)).
- Contact form limiter shares this module with `contact.rate_limit.per_day` (`DATABASE_SCHEMA.md` §3.8).

### 5.2 Honest limitation

Serverless platforms give no guarantee that two requests share one warm instance; state *should* be treated as approximate — two cold instances might serve 2× the daily anonymous budget before a shared counter catches up. Product impact for MVP: modest over-permission for anonymous users; the **upstream** pool remains protected by the hash-cache and by the fact that the abusive-population scale needed to matter is far beyond early traffic.

### 5.3 Durable options at Phase 5 (all **UNVERIFIED** as to exact behavior — research before choosing)

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| `rate_limit_counters` table in Supabase (row per key/day, `update … returning count`) | Zero new vendor; RLS-own; fits current stack | Adds a DB hit per *every* identify call; pool contended under burst | **Current favored fallback** — increase delegated concurrency only if measured burst load justifies |
| Free-tier Redis (Upstash free / Redis Cloud 30 MB) | Atomic INCR, natural TTL | New vendor + new failure mode; free tier expiry conditions must be verified | Keep on the list; choose only if DB-hit latency becomes a measured issue |
| Vercel Edge Config / KV | Truly edge-fast reads | Exact write semantics + free-tier limits **UNVERIFIED** — confirm at Phase 5 | Verify before committing |
| Cloudflare-agnostic (host-migration dependency) | none | Kills the ADR chosen elsewhere | Do not adopt — couples host portability (`ARCHITECTURE.md` ADR-2) |

Decision date: Phase 5 (monetization-prep) — with a measurement first, not by default.

---

## 6. Testing guidance

Comprehensive plans, environments, and case matrices live in [`TESTING_PLAN.md`](TESTING_PLAN.md). Directly API-relevant coverage:

1. **Contract tests** against `/api/identify` happy-path + every error row of §2.7 (including `429` after limit exhaustion and `503` on mocked upstream `429`).
2. **Zod schema tests** for all Server Actions (`§3`) — positive/negative cases, RLS-denial paths (`UNAUTHORIZED`/`FORBIDDEN`).
3. **Cache tests** — same image twice → second is `cached:true`; 3-image permutation hashing behaves predictably.
4. **Upstream mock harness** — record/replay of real Pl@ntNet v2 samples (kept out of production data; never call the live API with real keys from CI).
5. Load & concurrency smoke: simulated 20-in-flight and a single-instance burst guard (does the semaphore hold when the limiter is hit simultaneously?).

---

## 7. Changelog — API changes

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-11-13 | 0.3.2 | **Stage D — mock/live response parity + fixture hardening (tests only; contract unchanged).** New offline suites: mock/live parity via a shared normalized-contract checker (both providers satisfy the same `SpeciesCandidate` shape after `normalizeSpecies`; mock output regression-pinned float-exact for a fixed hash; response envelope + candidate key sets frozen at the route level) and a real-route regression suite for `POST /api/identify` (validation/413/429/organ-400 paths, dedup, Stage B/C provider-error taxonomy end-to-end, persistence-OFF write-guard + fallback UUID, mockNotice parity, no URL/key/partition-key leaks in bodies or logs). Shared fixture module `tests/fixtures/plantnet/upstream-fixtures.ts` — SYNTHETIC, documentation-derived, explicitly labelled as not-real recordings; URLs use RFC 2606 `.invalid`. One-line additive change: mock candidates now carry `powoId: null` (identical optional-identifier contract as live). **No request/response contract change; 113/113 tests, lint 0 errors, typecheck clean, build exit 0**. Mock mode, persistence-OFF state, and the 0.2.x wire contract remain **unchanged** | Lead engineer (Stage D session) |
| 2026-11-13 | 0.3.1 | **Stage C — upstream normalization, image licensing, organ validation, quota visibility.** (1) **Normalizer implemented** (`normalizeUpstreamResponse` in `src/lib/plantnet/normalize.ts`): maps verified upstream 200 responses into the PlantAI candidate structure using ONLY the documented Stage A1 field shapes (official identify output example: `species.{scientificNameWithoutAuthor, scientificNameAuthorship, scientificName, genus, family, commonNames}` + top-level `gbif:{id}`/`powo:{id}` siblings, string id forms); scientific name read verbatim or composed from documented fields only; scores preserved exactly (0–1 validated); GBIF ids digit-string→number value-preserving, POWO ids verbatim strings; malformed entries/images skipped defensively (one bad optional image never invalidates a candidate); empty results → HTTP 404 `no_match_found`; `normalizeSpecies` re-ranks + caps at 10 as before; `UpstreamNormalizerNotReadyError` superseded/removed. (2) **Image licensing:** `SpeciesImage.cc_by_sa: boolean` replaced by `license?: string` + `attribution: string` — images render ONLY for the documented reusable CC BY-SA license (conservative, case-insensitive, separator-normalized) AND a present contributor author; citation preserved verbatim when returned, attribution composed only from actual returned metadata (never fabricated); missing/unknown/unsupported license or missing author ⇒ image hidden, candidate stays visible. (3) **Organ validation (V6 correction):** canonical shared enum `src/lib/plantnet/organs.ts` (`leaf`/`flower`/`fruit`/`bark`/`auto`) used by the Zod schema AND the upload UI's new optional organ selector; invalid `lateral`/`root` rejected with HTTP 400 before any upstream call (dependency-free module so the client widget never bundles zod). (4) **Quota visibility:** `X-RateLimit-Remaining-Upstream` response header on identify success AND error paths, from verified sources only — `remainingIdentificationRequests` body field first, then the `r=` value of the `RateLimit` header parsed defensively (`parseRateLimitRemaining`); partition keys/API keys/URLs/reset times never exposed; no values invented; error taxonomy and no-retry policy unchanged. Offline tests added (`tests/upstream-normalize.test.ts`) + Stage B boundary tests updated; **80/80 tests, lint 0 errors, typecheck clean, build exit 0**. Mock behavior, persistence-OFF state, and the 0.2.x wire contract remain **unchanged**; `PLANTNET_MODE=mock` remains the enforced state | Lead engineer (Stage C session) |
| 2026-11-13 | 0.3.0 | **Stage B — live provider implemented (NOT activated).** `src/lib/plantnet/live-provider.ts` added behind the existing `identify()` seam: verified Stage A1 upstream contract (`POST https://my-api.plantnet.org/v2/identify/{project}`, default project `all`, `api-key` query parameter, repeated `organs` per image in order, MIME from magic bytes, 20 s `AbortController` timeout, **no automatic retries**, no lat/lon/email/IP/user-ID, no deprecated params, URL/key/body/headers never logged — `redactUrlForLogs` strips the query string). Verified error taxonomy implemented: upstream 404 → `no_match_found`, 429 → `quota_exhausted`, other 4xx → `upstream_rejected` (route: HTTP 502), 5xx/network/timeout → `upstream_error`; quota capture: `RateLimit-Policy`/`RateLimit`/`Retry-After` + `remainingIdentificationRequests` (new additive `upstreamQuota` field). Wiring: `PLANTNET_MODE` not exactly `live`, or a missing/blank server-only key, fails safe to mock with a safe diagnostic; live module is lazy-imported and unreachable in mock mode. **Stage C dependency:** the upstream 200 → candidate mapping is a typed boundary (`UpstreamNormalizer`); until Stage C implements it, live 200s throw the typed `UpstreamNormalizerNotReadyError` — no mapping invented. Offline test suite added (28 cases, mocked fetch, dummy key only). Mock behavior, persistence-OFF state, and the 0.2.x wire contract are **unchanged**; `PLANTNET_MODE=mock` remains the enforced state | Lead engineer (Stage B session) |
| 2026-11-12 | 0.2.1 | **Documentation alignment (Stage A2 — no code/contract change).** Corrected upstream facts throughout §2 from the Stage A1 official-doc verification ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md), verified 2026-11-12): API host **`https://my-api.plantnet.org`** (was `my.plantnet.org`), default project **`all`** (was `allplants`), upstream parameter **`organs` (plural, repeated per image in order)** with valid values `leaf`/`flower`/`fruit`/`bark`+`auto` (was singular `organ` with invalid `lateral`/`root`), `api-key` **query-parameter** auth + **never log the full URL**, documented upstream headers `RateLimit-Policy`/`RateLimit`/`Retry-After`, upstream 404 "Species not found" (non-plant image) maps to `no_match_found` while other unexpected 4xx ≠ no-match, conservative image `author`/`license`/`citation` handling (CC BY-SA = only documented reusable case), regional-lookup deferred (MVP sends **no GPS upstream**). Mock behavior, persistence-OFF state, and the 0.2.0 wire contract are **unchanged** | Lead engineer (Stage A2 session) |
| 2026-11-12 | 0.2.0 | **Phase 2 implementation.** `/api/identify` live in MOCK mode (`PLANTNET_MODE=mock` default; live provider not implemented — requires owner approval + valid server-only key). Additive success fields: `mode` (`"mock"`|`"live"`), `mockNotice` (mock only), `careSummary.plantLibraryId`, `species[].plantLibrarySlug` (mock only). Validation unchanged from §2.9 (verified: magic-byte sniff, 10 MB/image, 1–3 images). Persistence + durable `identification_cache` degrade to logged skip while the service_role credential is invalid; per-instance dedup cache keys `hash::organ` (drop-in swap ready). Rate limiting implemented per §5 with `X-RateLimit-*` headers verified live | Lead engineer (Phase 2 session) |
| 2026-11-10 | 0.1.0 | Initial API contract: documented `/api/identify` request/response/error envelope, server-action catalog, rate-limiting strategy (in-memory MVP), future endpoints | Technical architect |

*All future changes to any endpoint or action signature (breaking or additive) must add a row here, plus a note in [`CHANGELOG.md`](CHANGELOG.md).*

---

*End of API_DOCUMENTATION.md.*
