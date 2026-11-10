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

## Owner verification checklist (cannot be done from here)

- [ ] Migrations applied to `plantai-dev` (or `plantai-prod` as target)
- [ ] Database settings: "Expose via Data API" — with *automatically expose new tables disabled*, **manually expose** the 10 `public` tables to the `public` REST API, or supabase-js queries will 404 (owner decision item)
- [ ] Authentication: email/password + magic link visible in Auth providers (email confirm on)
- [ ] Storage: both buckets exist with correct public/private flags
- [ ] Admin account: create the real owner account, then run the promotion UPDATE from `004_seed.sql` comments
- [ ] First smoke query returns rows: `select count(*) as species from public.plant_library;` (expect 10)
