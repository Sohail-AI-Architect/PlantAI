# PlantAI — Supabase migrations

Authoritative migration set for `plantai-dev` (South Asia / `ap-south-1`, Free plan), per `DATABASE_SCHEMA.md`.

## Apply order (strict)

| # | File | Contents |
|---|------|----------|
| 1 | `20260101000000_000_initial_schema.sql` | extensions, 5 enums, 10 tables, all indexes |
| 2 | `20260101000001_001_functions_triggers.sql` | `is_admin()`, `touch_updated_at`, `handle_new_user`, role guard, reminder guards |
| 3 | `20260101000002_002_rls_policies.sql` | enable RLS on all 10 tables (+FORCE) + every documented policy |
| 4 | `20260101000003_003_storage_buckets.sql` | `request-images` (private) + `plant-images` (public) buckets + object policies |
| 5 | `20260101000004_004_seed.sql` | `app_settings` defaults (rate limits 5/20 etc.) + 10 starter species |

_NOTE (recorded in CHANGELOG.md): the planning doc listed RLS as file 001 — the
directory order swaps 001/002 because every RLS policy references
`is_admin()`, which must exist first. Content is otherwise verbatim from
DATABASE_SCHEMA.md._

## Option A — Supabase CLI (preferred)

```powershell
# from C:\Users\welsohail\PlantAI
npx supabase init            # only once; creates supabase/config.toml if missing
npx supabase login           # opens browser; use the account that owns plantai-dev
npx supabase link --project-ref <PROJECT_REF>   # ref from the dashboard URL
npx supabase db push         # applies all migrations, tracked in supabase_migrations
```

Verify: Dashboard → Database → Migrations (5 applied entries), Table editor shows the 10 `public` tables, Storage shows both buckets.

**Pre-migration backup (DATABASE_SCHEMA.md §8, required):**
`supabase db dump -f backups/pre_phase1.sql` before the FIRST `db push`.

## Option B — Dashboard SQL editor (no CLI login)

Dashboard → SQL editor → run each file's contents in order 1→5 (paste whole file per run). Verify with the same checks as above. (No migration tracking — keep a manual log in CHANGELOG.md if this path is used.)

## Data API access model (grant-based — verified 2026-11-11)

With *automatically expose new tables* **disabled** (verified setting in the
dashboard), reachability through the Data API is governed by **explicit
Postgres grants** to the `anon` / `authenticated` / `service_role` roles, not by
manually exposing tables one by one. Two layers must hold:

1. **Grants** — which Data API role may reach a table. Missing grants produce
   PostgreSQL `42501` errors (see `DATA_API_ACCESS_PLAN.md` /
   `DATA_API_PRIVILEGE_EXECUTION_REPORT.md`).
2. **RLS** — which rows each role can see. Enabled + forced on all 10 tables
   (migration `002_rls_policies.sql`).

Verified end state on `plantai-dev`: `plant_library` anon REST GET →
**HTTP 200, 10 rows**; `identification_cache` anon REST GET → **HTTP 401 /
PostgreSQL 42501** (server-only table, service_role grants only). A dashboard
counter showing "0 of 10" tables reflects only the automatic-expose toggle —
it does **not** mean queries will 404 while the grants exist.

**Do not change these Supabase settings;** re-applying migrations on a fresh
project reproduces the schema, but the grant script referenced in
`DATA_API_PRIVILEGE_EXECUTION_REPORT.md` is a separate, owner-run step.

## Key terminology (Phase 2.5, 2026-11-12)

| Variable | Key in dashboard | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Publishable key** | Browser-safe (client). Safe only because RLS is on everywhere (`SECURITY.md`) |
| `SUPABASE_SECRET_KEY` | **Secret key** (`sb_secret_...`) | **Server-only.** Bypasses RLS (resolves to the `service_role` role). Canonical modern name per current Supabase docs; the legacy `SUPABASE_SERVICE_ROLE_KEY` JWT is deprecated by end of 2026 and is still accepted as a fallback by `getServerSupabaseSecretKey()` in `src/lib/env.ts` |

Never `NEXT_PUBLIC_`-prefix a secret; anything with that prefix is written into
the client bundle. See `ENVIRONMENT_SETUP.md` §5.1 and `SECURITY.md` §2.

## Persistence prerequisites (currently OFF)

Writes to `identifications` / durable `identification_cache` are **inactive**
until ALL of the following hold (write-guard in
`src/lib/plantnet/persistence.ts`):

- `PLANTAI_PERSISTENCE_ENABLED` is set to the exact string `"true"`
  (any other value ⇒ persistence stays off);
- `SUPABASE_SECRET_KEY` (or legacy fallback) is configured **and accepted by
  Supabase** — the previously stored legacy JWT was rejected ("Invalid API key");
- migrations 1–5 above are applied (these tables do not exist otherwise).

Until then, responses are unaffected and zero rows are written. Do not activate
these variables without explicit owner approval.

## Owner verification checklist (cannot be done from here)

- [ ] Migrations applied to `plantai-dev` (or `plantai-prod` as target)
- [ ] Data API reachability verified per the grant-based model above (`plant_library` anon REST → 200; `identification_cache` anon REST → 401)
- [ ] Authentication: email/password + magic link visible in Auth providers (email confirm on)
- [ ] Storage: both buckets exist with correct public/private flags
- [ ] Admin account: create the real owner account, then run the promotion UPDATE from `004_seed.sql` comments
- [ ] First smoke query returns rows: `select count(*) as species from public.plant_library;` (expect 10)
