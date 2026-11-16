# PlantAI — Database Schema

> Status: Phase 0 (Planning) · Last updated: 2026-11-10
> Owner: Technical Architect
> Third-party facts (Free-tier limits: 500 MB DB, 1 GB storage, 50k MAU, ~1-week inactivity pause, no automatic backups) are sourced from [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) unless marked **UNVERIFIED**.
> Related: [`ARCHITECTURE.md`](ARCHITECTURE.md), [`REQUIREMENTS.md`](REQUIREMENTS.md), [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md), [`SECURITY.md`](SECURITY.md), [`TESTING_PLAN.md`](TESTING_PLAN.md), [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md), [`CHANGELOG.md`](CHANGELOG.md), [`TASKS.md`](TASKS.md).

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [ERD — all tables & relationships](#2-erd--all-tables--relationships)
3. [Table specifications](#3-table-specifications)
   - 3.1 [profiles](#31-profiles)
   - 3.2 [plant_library](#32-plant_library)
   - 3.3 [identifications](#33-identifications)
   - 3.4 [user_plants](#34-user_plants)
   - 3.5 [care_reminders](#35-care_reminders)
   - 3.6 [saved_plants](#36-saved_plants)
   - 3.7 [blog_posts](#37-blog_posts)
   - 3.8 [contact_messages](#38-contact_messages)
   - 3.9 [app_settings](#39-app_settings)
   - 3.10 [identification_cache](#310-identification_cache)
4. [Enums](#4-enums)
5. [Triggers](#5-triggers)
6. [Storage buckets & bucket policies](#6-storage-buckets--bucket-policies)
7. [Migration strategy & seed data](#7-migration-strategy--seed-data)
8. [Back-up strategy](#8-back-up-strategy)
9. [Data retention & privacy notes](#9-data-retention--privacy-notes)

---

## 1. Conventions

| Convention | Rule |
|---|---|
| Naming | `snake_case` everywhere; tables plural; FK columns `<entity>_id`; indexes `<table>_<cols>_idx` |
| Primary keys | `uuid` with `gen_random_uuid()` default (all user/content tables); `text` PK only for key-value (`app_settings`) |
| Timestamps | `timestamptz` **everywhere** (never `timestamp`); UTC assumed; `created_at` `default now()`; `updated_at` maintained by trigger |
| User identity | Always `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` (or `ON DELETE SET NULL` where the row must outlive deletion, e.g. anonymous identifications) |
| Booleans | `is_*` / `has_*` prefix, `NOT NULL DEFAULT` always specified |
| Money/counts | No money columns in MVP; counters `integer` |
| Soft delete | **Not in MVP** (hard deletes; caution cascades). Revisit only if accidental-loss risk materializes — record in `CHANGELOG.md` |
| Text types | User content `text` (unbounded); controlled vocab via enums (§4) |
| NULL policy | NULL allowed only where documented per column; prefer defaults |
| RLS | **Enabled on 100% of tables before first deploy.** Deny-by-default; every policy explicitly named (`p_<table>_<scope>_<op>`) |
| Migrations | Plain SQL files in `supabase/migrations/*.sql`, applied ascending with Supabase CLI — §7 |

Generic helpers used by all policies:

```sql
-- Canonical admin check (also in ARCHITECTURE.md §7.3). SECURITY DEFINER so
-- RLS recursion is impossible and service-role maintenance code can call it.
create or replace function public.is_admin() returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;
```

---

## 2. ERD — all tables & relationships

```mermaid
erDiagram
    AUTH_USERS ||--o| profiles : "id = auth.users.id (trigger-created)"
    AUTH_USERS ||--o{ identifications : "user_id (nullable)"
    AUTH_USERS ||--o{ user_plants : "user_id"
    AUTH_USERS ||--o{ saved_plants : "user_id"
    AUTH_USERS ||--o{ blog_posts : "author_id"
    AUTH_USERS ||--o{ plant_library : "created_by"

    PROFILES ||--o{ contact_messages : "handled_by? (admin read only)"

    PLANT_LIBRARY ||--o{ user_plants : "plant_id (nullable, SET NULL)"
    PLANT_LIBRARY ||--o{ saved_plants : "plant_id"
    PLANT_LIBRARY }o--o{ identifications : "matched via best_match_* (no FK)"

    USER_PLANTS ||--o{ care_reminders : "user_plant_id"

    BLOG_POSTS ||..|| PLANT_LIBRARY : "optional topic link (post.PlantLibrarySlug)"

    IDENTIFICATION_CACHE }o..o{ identifications : "hash match (no FK, data-level only)"

    APP_SETTINGS : "key-value (referenced by rate-limit config)"
```

Notes:

- `identifications → plant_library` is deliberately an **application-level link** (via `best_match_scientific_name`), not a FK: a Pl@ntNet result may correspond to a species not (yet) present in `plant_library`, and library entries may be renamed without breaking history.
- `user_plants.plant_library_id` **is** a FK (`ON DELETE SET NULL`) because the user may plant a library entry; if that entry is unpublished/deleted the user's plant keeps its copied-in names.
- `identification_cache` is regenerable; no FK ties it to history (all cascades are via no-op deletion of cache rows only).

---

## 3. Table specifications

### 3.1 `profiles`

**Purpose:** one row per authenticated user; stores display identity and the `role` that powers `is_admin()`. Created automatically on signup by trigger (`handle_new_user()`).

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | PK, `REFERENCES auth.users(id) ON DELETE CASCADE` | — | = `auth.users.id` |
| `username` | `text` | `UNIQUE`, `CHECK (char_length(username) BETWEEN 3 AND 24)` | — | Public handle, required at signup UI (nullable in DB only during schema backfill) |
| `full_name` | `text` | — | `NULL` | Optional display name (profile page only) |
| `avatar_url` | `text` | — | `NULL` | URL to uploaded avatar (plant-images bucket or external) |
| `role` | `text` | `CHECK (role IN ('user','admin'))` | `'user'` | Powers `is_admin()`; only changeable via SQL/migration, never via app |
| `email_confirmed` | `boolean` | — | `false` | Mirror of auth state for UI convenience (not security-bearing) |
| `locale` | `text` | — | `'en'` | UI language hint |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` | Trigger-touched |

**PK / FKs / indexes:** PK = `id`; FK = `id → auth.users(id)` cascade; unique index on `username` (unique explicitly for duplicates safety): `profiles_username_idx`.

**RLS policies:**

```sql
alter table public.profiles enable row level security;

-- Owner reads own profile
create policy p_profiles_select_self on public.profiles
  for select using (auth.uid() = id);

-- Admin reads every profile (needed for admin dashboards)
create policy p_profiles_select_admin on public.profiles
  for select using (public.is_admin());

-- Owner edits own, but cannot change role or id:
create policy p_profiles_update_self on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id AND role = 'admin' = false AND id = auth.uid());

-- Reads may not set/copy role above 'user'
-- (refer to role protection: DB-level trigger guard below):
create or replace function public.guard_profile_role() returns trigger
language plpgsql security definer as $$
begin
  if new.role is distinct from old.role then
    raise exception 'role changes allowed only via SQL migrations';
  end if;
  return new;
end $$;

create trigger trg_guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- No insert/delete policies for authenticated (allow inserts by trigger only,
-- deletes cascade from auth.users). Explicit deny-by-default maintains RLS.
```

Admin write access: **none needed as policies in MVP** (admin edits own profile like everyone else; role changes happen via SQL migration only). This keeps `profiles` the strictest of all tables.

---

### 3.2 `plant_library`

**Purpose:** editorial plant content: species info + care summary + images, powering `/plant/[slug]`, `/library` search, and `careSummary` in `/api/identify` responses. Public read of **published rows only**; admin write.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` | |
| `slug` | `text` | `NOT NULL`, `UNIQUE` | — | URL token: lowercase, dashed — enforced at app level + `CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')` |
| `scientific_name` | `text` | `NOT NULL` | — | e.g. `Monstera deliciosa` |
| `common_names` | `text[]` | `NOT NULL` | `'{}'` | e.g. `{swiss cheese plant, ceriman}` |
| `family` | `text` | — | `NULL` | e.g. `Araceae` |
| `genus` | `text` | — | `NULL` | e.g. `Monstera` |
| `category` | `plant_category` | `NOT NULL` | `'other'` | Controlled vocabulary (§4) |
| `description` | `text` | — | `NULL` | Editorial description (README-ish, markdown-lite) |
| `watering` | `text` | — | `NULL` | Care summary prose (feeds `careSummary.watering`) |
| `sunlight` | `text` | — | `NULL` | Ditto `careSummary.sunlight` |
| `soil` | `text` | — | `NULL` | Ditto `careSummary.soil` |
| `fertilizer` | `text` | — | `NULL` | Ditto `careSummary.fertilizer` |
| `difficulty` | `text` | `CHECK (difficulty IN ('easy','moderate','hard'))` | `NULL` | Care difficulty label |
| `image_url` | `text` | — | `NULL` | Primary image (plant-images bucket public URL) |
| `image_credit` | `text` | — | `NULL` | CC-BY-SA-style attribution string, mandatory when `image_url` present (checked at app level) |
| `source_url` | `text` | — | `NULL` | Optional care-info source link |
| `is_published` | `boolean` | `NOT NULL` | `false` | Gate for public read |
| `created_by` | `uuid` | `REFERENCES auth.users(id) ON DELETE SET NULL` | `NULL` | Admin who created (audit) |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` | Trigger-touched |

**PK / FKs / indexes:**

```sql
create unique index plant_library_slug_idx       on public.plant_library (slug);
create index plant_library_category_idx          on public.plant_library (category) where is_published;
create index plant_library_published_idx         on public.plant_library (is_published, updated_at desc);
-- Text search (pg_trgm on scientific_name; default GIN array containment on common_names):
create extension if not exists pg_trgm;            -- done once per project (migration 000X)
create index plant_library_scientific_name_trgm_idx on public.plant_library
  using gin (scientific_name gin_trgm_ops);
create index plant_library_common_names_idx      on public.plant_library
  using gin (common_names);
```

Search behavior for `/library?q=`: ILIKE on `scientific_name` accelerated by `gin_trgm_ops`; exact/array containment on `common_names` via the array GIN. Fuzzy `similarity() >= 0.2` fallback is ordered last (cheap, small dataset).

**RLS:**

```sql
alter table public.plant_library enable row level security;

-- Anyone (anon or authenticated) may read published entries
create policy p_plant_library_select_published on public.plant_library
  for select using (is_published);

-- Admin may always read (including unpublished previews)
create policy p_plant_library_select_admin on public.plant_library
  for select using (public.is_admin());

-- Admin-only writes (insert/update/update-publish)
create policy p_plant_library_write_admin on public.plant_library
  for all using (public.is_admin())
  with check (public.is_admin());
```

---

### 3.3 `identifications`

**Purpose:** one row per `/api/identify` request (success or notable failure). Powers `/dashboard` history (Phase 4), cache creation, and quota analytics. Stores the normalized result; the **raw** Pl@ntNet payload optionally for debugging.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` | |
| `user_id` | `uuid` | `REFERENCES auth.users(id) ON DELETE SET NULL` | `NULL` | `NULL` = anonymous identification |
| `image_paths` | `text[]` | `NOT NULL DEFAULT '{}'` | `'{}'` | Storage paths inside private `request-images` bucket (≤3 entries; see §6) |
| `organ` | `text` | `CHECK (organ IN ('flower','leaf','lateral','root','auto'))` | `'auto'` | Pl@ntNet organ hint used. **⚠ Existing-schema mismatch (flagged 2026-11-12, NOT yet migrated):** the upstream contract (verified) uses **`organs` (plural, one per image)** with valid values `leaf`/`flower`/`fruit`/`bark`+`auto`; this column's CHECK still contains invalid values (`lateral`/`root`) and lacks `fruit`/`bark`. Migration = **future owner-authorized task** (`TASKS.md` future work) — do not change application behavior until approved |
| `latitude` / `longitude` | `numeric(10,7)` | `CHECK (latitude BETWEEN -90 AND 90)` / `CHECK (longitude BETWEEN -180 AND 180)` | `NULL` | Optional regional-flora location. **Not used in MVP** — PlantAI sends no GPS coordinates upstream (Stage A1, 2026-11-12); regional-flora restriction is a documented future option |
| `project` | `text` | `NOT NULL` | `'allplants'` | Pl@ntNet project/flora used. **⚠ Existing-schema mismatch (flagged 2026-11-12, NOT yet migrated):** the verified upstream default project is **`all`** (`allplants` is not the documented default). Migration/seed decision = **future owner-authorized task** (`TASKS.md` future work). **Stage F1/F2 note (2026-11-14):** the application now writes `project = "all"` EXPLICITLY on every identification write (`PERSISTED_PROJECT`, persistence.ts) — stored values are provenance-correct; only the column DEFAULT itself remains `'allplants'` until the owner-approved F-3 migration |
| `hash` | `text` | — | `NULL` | Perceptual hash of primary image (dedup/analytics; not FK) |
| `best_match_scientific_name` | `text` | — | `NULL` | App-level join to `plant_library` for `careSummary` & stats |
| `best_match_score` | `numeric(5,4)` | `CHECK (best_match_score BETWEEN 0 AND 1)` | `NULL` | Pl@ntNet v2 0–1 score |
| `result` | `jsonb` | — | `NULL` | Normalized species list (the exact shape documented in `API_DOCUMENTATION.md`) |
| `raw_response` | `jsonb` | — | `NULL` | Optional upstream payload for debug; may be null to save space |
| `status` | `identification_status` | `NOT NULL` | `'processing'` | Lifecycle of the row (§4) |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | |

**PK / FKs / indexes:**

```sql
create index identifications_user_idx      on public.identifications (user_id, created_at desc);
create index identifications_status_idx    on public.identifications (status);
create index identifications_hash_idx      on public.identifications (hash);
create index identifications_created_idx   on public.identifications (created_at desc);
```

**RLS (user read own; **no** user update/delete once stored — append-only history; retention/clean-up done by service-role):**

```sql
alter table public.identifications enable row level security;

create policy p_identifications_select_self on public.identifications
  for select using (user_id = auth.uid());

create policy p_identifications_select_admin on public.identifications
  for select using (public.is_admin());

-- Inserts are performed by the server (service-role, bypassing RLS), because
-- anonymous users also create rows. No anon/authenticated INSERT policy.
```

Why service-role insert: `/api/identify` runs server-side already; keeping inserts exclusive to the server module closes a faker-user_id hole and matches `SECURITY.md` (server-only writes pattern). Owner reads remain RLS-guarded.

---

### 3.4 `user_plants`

**Purpose:** "My Plants": a user's individual plant instance (nickname, photo, notes), optionally linked to a `plant_library` entry for auto-filled care data.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` | |
| `user_id` | `uuid` | `NOT NULL`, `REFERENCES auth.users(id) ON DELETE CASCADE` | — | Owner |
| `plant_library_id` | `uuid` | `REFERENCES plant_library(id) ON DELETE SET NULL` | `NULL` | Optional library reference |
| `nickname` | `text` | `CHECK (char_length(nickname) BETWEEN 1 AND 60)` | — | User-given name (e.g. “Monty”) |
| `scientific_name` | `text` | — | `NULL` | Copied-in from library or user-typed |
| `common_name` | `text` | — | `NULL` | Ditto |
| `image_url` | `text` | — | `NULL` | Owner-uploaded photo (plant-images bucket, per-user prefix) |
| `acquired_at` | `date` | — | `NULL` | When user got the plant |
| `location` | `text` | `CHECK (location IN ('indoor','outdoor','balcony','greenhouse'))` | `NULL` | Where it lives (useful context, non-MVP-filterable) |
| `notes` | `text` | — | `NULL` | Freeform owner notes |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` | Trigger-touched |

**PK / FKs / indexes:**

```sql
create index user_plants_user_idx        on public.user_plants (user_id, created_at desc);
create index user_plants_library_idx     on public.user_plants (plant_library_id);
```

**RLS (owner-only CRUD):**

```sql
alter table public.user_plants enable row level security;

create policy p_user_plants_owner_all on public.user_plants
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy p_user_plants_admin_all on public.user_plants
  for all
  using (public.is_admin())
  with check (public.is_admin());
```

---

### 3.5 `care_reminders`

**Purpose:** scheduled plant-care tasks (watering, fertilizing…) attached to a user's plant. `next_due_date` advances via trigger when marked complete.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` | |
| `user_plant_id` | `uuid` | `NOT NULL`, `REFERENCES user_plants(id) ON DELETE CASCADE` | — | Parent plant |
| `user_id` | `uuid` | `NOT NULL`, `REFERENCES auth.users(id) ON DELETE CASCADE` | — | **Denormalized owner** (enables single-table owner RLS + fast `/reminders` queries; kept in sync at write time, validated by trigger) |
| `reminder_type` | `reminder_type` | `NOT NULL` | `'watering'` | Controlled vocab (§4) |
| `notes` | `text` | — | `NULL` | e.g. “quarter ellipse of fertilizer” |
| `interval_days` | `integer` | `NOT NULL`, `CHECK (interval_days BETWEEN 1 AND 3650)` | `7` | Repeat frequency |
| `next_due_date` | `date` | `NOT NULL` | — | & next occurrence (local-date; independent of `timestamptz` convention — explicitly a *date* because reminders are calendar-day semantics) |
| `last_completed_at` | `timestamptz` | — | `NULL` | When last ‘done’ |
| `is_paused` | `boolean` | `NOT NULL` | `false` | Pause without delete |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` | Trigger-touched |

**PK / FKs / indexes:**

```sql
create index care_reminders_user_plant_idx on public.care_reminders (user_plant_id);
create index care_reminders_next_due_idx   on public.care_reminders (next_due_date)
  where is_paused = false;                 -- hot path: "what's due" dashboard/reminders queries
create unique index care_reminders_type_unique_idx
  on public.care_reminders (user_plant_id, reminder_type)
  where is_paused = false;                 -- one active reminder per type per plant (app policy)
```

**RLS (owner-only CRUD; `user_id` denormalized so we need no join):**

```sql
alter table public.care_reminders enable row level security;

create policy p_care_reminders_owner_all on public.care_reminders
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy p_care_reminders_admin_all on public.care_reminders
  for all
  using (public.is_admin())
  with check (public.is_admin());
```

Owner consistency is enforced by trigger (§5): `new.user_id` must equal the owner of `new.user_plant_id`.

---

### 3.6 `saved_plants`

**Purpose:** bookmarks of `plant_library` entries (`/saved-plants`). Pure composite join table.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `user_id` | `uuid` | `NOT NULL`, `REFERENCES auth.users(id) ON DELETE CASCADE` | — | PK part 1 |
| `plant_id` | `uuid` | `NOT NULL`, `REFERENCES plant_library(id) ON DELETE CASCADE` | — | PK part 2 (only published rows can be saved — enforced at app level) |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | |

**PK / uniques / indexes:**

```sql
alter table public.saved_plants
  add constraint saved_plants_user_plant_pk primary key (user_id, plant_id);
create index saved_plants_plant_idx on public.saved_plants (plant_id); -- reverse lookup/stats
```

**RLS:**

```sql
alter table public.saved_plants enable row level security;

create policy p_saved_plants_owner_all on public.saved_plants
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy p_saved_plants_admin_all on public.saved_plants
  for all
  using (public.is_admin())
  with check (public.is_admin());
```

---

### 3.7 `blog_posts`

**Purpose:** editorial blog content / gardening guides (`/blog`, `/blog/[slug]`), part of SEO strategy (`SEO_STRATEGY.md`). Public read of `published` only.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` | |
| `slug` | `text` | `NOT NULL`, `UNIQUE`, `CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')` | — | URL token under `/blog/[slug]` |
| `title` | `text` | `NOT NULL`, `CHECK (char_length(title) BETWEEN 3 AND 200)` | — | |
| `excerpt` | `text` | `CHECK (char_length(excerpt) <= 400)` | `NULL` | Card/list teaser |
| `content_md` | `text` | `NOT NULL` | — | Markdown source (rendered server-side) |
| `cover_image_url` | `text` | — | `NULL` | plant-images public URL |
| `cover_image_credit` | `text` | — | `NULL` | Attribution when third-party image used |
| `author_id` | `uuid` | `REFERENCES auth.users(id) ON DELETE SET NULL` | `NULL` | Displayed author |
| `status` | `blog_status` | `NOT NULL` | `'draft'` | Lifecycle (§4) |
| `published_at` | `timestamptz` | — | `NULL` | Set when transitioning to `published` (app-level) |
| `reading_minutes` | `integer` | `CHECK (reading_minutes > 0)` | `NULL` | Auto-estimated at save time |
| `seo_title` | `text` | `CHECK (char_length(seo_title) <= 60)` | `NULL` | Overrides title in `<title>` (SEO_STRATEGY.md) |
| `seo_description` | `text` | `CHECK (char_length(seo_description) <= 160)` | `NULL` | Meta description |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` | Trigger-touched |

**PK / FKs / indexes:**

```sql
create unique index blog_posts_slug_idx    on public.blog_posts (slug);
create index blog_posts_status_pub_idx     on public.blog_posts (status, published_at desc);
create index blog_posts_scheduled_idx      on public.blog_posts (published_at)
  where status = 'published';
-- Full-text index (SEO ranking via content quality; search comes later than Phase 3):
create index blog_posts_title_trgm_idx     on public.blog_posts using gin (title gin_trgm_ops);
```

**RLS:**

```sql
alter table public.blog_posts enable row level security;

-- Public read of published posts only
create policy p_blog_posts_select_published on public.blog_posts
  for select using (status = 'published');

-- Authenticated users may also preview drafts they authored
create policy p_blog_posts_select_author on public.blog_posts
  for select using (author_id = auth.uid());

create policy p_blog_posts_select_admin on public.blog_posts
  for select using (public.is_admin());

-- Admin-only writes
create policy p_blog_posts_write_admin on public.blog_posts
  for all
  using (public.is_admin())
  with check (public.is_admin());
```

---

### 3.8 `contact_messages`

**Purpose:** `/contact` form submissions. No authentication required (anyone can help/ask) → spam-controlled at **app level** (rate limit + honeypot + server-action token; `SECURITY.md`). Insert is anyone; read is admin-only.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` | |
| `name` | `text` | `NOT NULL`, `CHECK (char_length(name) BETWEEN 2 AND 80)` | — | Sender-supplied |
| `email` | `text` | `NOT NULL`, `CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')` | — | Reply-to |
| `subject` | `text` | `CHECK (char_length(subject) <= 120)` | `NULL` | Optional |
| `message` | `text` | `NOT NULL`, `CHECK (char_length(message) BETWEEN 10 AND 4000)` | — | Body |
| `status` | `message_status` | `NOT NULL` | `'new'` | Lifecycle (§4) |
| `admin_notes` | `text` | — | `NULL` | Admin-facing only |
| `handled_by` | `uuid` | `REFERENCES auth.users(id) ON DELETE SET NULL` | `NULL` | Admin who replied/closed |
| `ip_hash` | `text` | — | `NULL` | Salted hash of submitter IP (abuse metrics; never raw) |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | |

**PK / indexes:** PK = `id`; `contact_messages_status_idx (status, created_at desc)`, `contact_messages_ip_idx (ip_hash)`.

**RLS:**

```sql
alter table public.contact_messages enable row level security;

-- Anyone may submit (app enforces rate limits & validation before insert)
create policy p_contact_messages_insert_anyone on public.contact_messages
  for insert to anon, authenticated
  with check (true);

-- Only admins see messages
create policy p_contact_messages_select_admin on public.contact_messages
  for select using (public.is_admin());

-- Only admins update status/notes (handled_by is set by their OWN update)
create policy p_contact_messages_update_admin on public.contact_messages
  for update using (public.is_admin())
  with check (public.is_admin());

-- No delete policy for user roles (cleanup via service-role + retention)
```

**Rate limiting (app level, before the insert):** 3 messages per IP per 24h + 1/min per session, in `src/lib/rate-limit.ts`; plus a client-side silent honeypot field. See `API_DOCUMENTATION.md` §Rate limiting strategy and `SECURITY.md`.

---

### 3.9 `app_settings`

**Purpose:** operational tunables (rate limits, feature flags, min/max values) editable without redeploy. Read by everyone processes; write by admin. Key-value + metadata.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `key` | `text` | PK, `CHECK (key = lower(key) AND key ~ '^[a-z_]+(\.[a-z_]+)*$')` | — | e.g. `identify.daily_limit.anonymous` |
| `value` | `jsonb` | `NOT NULL` | — | JSON-encoded value (number, string, bool, object) |
| `value_type` | `text` | `CHECK (value_type IN ('number','string','boolean','json'))` | `'number'` | Validates at read time |
| `description` | `text` | `NOT NULL` | — | Why this exists / units |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` | Trigger-touched |
| `updated_by` | `uuid` | `REFERENCES auth.users(id) ON DELETE SET NULL` | `NULL` | Last admin |

**Indexes:** PK = `key` (no extra indexes needed at MVP scale).

**Seed (Phase 1 migration 000_seed.sql, §7):**

| Key | Default | Meaning |
|---|---|---|
| `identify.daily_limit.anonymous` | `5` | Per-IP identify calls/day, anonymous (canonical mitigation #4; Pl@ntNet upstream = 500/day total, [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) |
| `identify.daily_limit.authenticated` | `20` | Per-user identify calls/day |
| `identify.concurrent.upstream` | `4` | Per-instance semaphore (multi-instance total ≤ Pl@ntNet's 20 max, [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) |
| `identify.images.max` | `3` | Max images per request (upstream allows 1–5; we under-rate to save quota) |
| `identify.image.max_bytes` | `10485760` | **10 MB per image, per canonical decision (PlantAI enforces ≤10 MB even though upstream total is 50 MB)** |
| `contact.rate_limit.per_day` | `3` | Per-IP contact messages/day |
| `feature.identification_cache` | `true` | Toggle for hash-dedup cache |
| `feature.reminders` | `false` | Phase 4 flag (default, ui hides until shipped) |

**RLS:**

```sql
alter table public.app_settings enable row level security;

create policy p_app_settings_read_all on public.app_settings
  for select using (true);   -- settings are harmless to read; secret keys must NOT be stored here

create policy p_app_settings_write_admin on public.app_settings
  for all
  using (public.is_admin())
  with check (public.is_admin());
```

**Rule:** `app_settings` must **never** hold secrets (API keys) — those belong in env vars (`ENVIRONMENT_SETUP.md`).

---

### 3.10 `identification_cache`

**Purpose:** perceptual-hash → normalized-result cache. Core quota-protection mechanism (canonical decision #4): repeated uploads of the same image answer from cache, preserving Pl@ntNet credits.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` | |
| `p_hash` | `text` | `NOT NULL` | — | 64-hex perceptual hash of primary image |
| `p_hash_variants` | `text[]` | `NOT NULL DEFAULT '{}'` | `'{}'` | Hashes of other images in the request (dedup on any image) |
| `project` | `text` | `NOT NULL` | `'allplants'` | Pl@ntNet project the result belongs to. **⚠ Existing-schema mismatch (flagged 2026-11-12):** verified upstream default project is **`all`** — migration is a future owner-authorized task (`TASKS.md` future work). **Stage F1/F2 note (2026-11-14):** the application now writes `project = "all"` EXPLICITLY (`PERSISTED_PROJECT`) and upserts with conflict target `(p_hash, project, organ)` — cache keys are written with the verified project regardless of the column default |
| `organ` | `text` | — | `'auto'` | Organ used (cache key part; same photo + different organ can differ). **⚠ Existing-schema mismatch:** upstream valid values are `leaf`/`flower`/`fruit`/`bark`+`auto` (`lateral`/`root` invalid) — this cache column has no CHECK so no data error, but the value set written here must follow the corrected enum once the request builder is implemented |
| `normalized_result` | `jsonb` | `NOT NULL` | — | Same shape as `identifications.result` (API_DOCUMENTATION.md) |
| `top_score` | `numeric(5,4)` | — | `NULL` | Fast prefilter for cache quality stats |
| `hit_count` | `integer` | `NOT NULL` | `0` | Cache hit stat |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | |
| `last_hit_at` | `timestamptz` | — | `NULL` | LRU-style eviction input (service-role only) |

**PK / indexes:**

```sql
create unique index identification_cache_key_idx on public.identification_cache (p_hash, project, organ);
create index identification_cache_last_hit_idx on public.identification_cache (last_hit_at);
create index identification_cache_hash_variants_idx on public.identification_cache
  using gin (p_hash_variants);
```

**RLS:**

```sql
alter table public.identification_cache enable row level security;

create policy p_identification_cache_select_admin on public.identification_cache
  for select using (public.is_admin());
-- All reads/writes (lookup + upsert + hit_count bump) happen via the server
-- module with the service-role client, so no user-facing policies are needed.
```

Regression safety: cache lookups are fast (`unique index`), unavoidable staleness (result quality drift) is bounded by `last_hit_at`-based eviction after ≥ 90 days of no hits (see §9). Cache miss is fine — it only costs 1 Pl@ntNet credit.

---

## 4. Enums

```sql
create type plant_category as enum (
  'tree','shrub','herbaceous','succulent_cactus','fern',
  'vine_climber','aquatic','ornamental_grass','houseplant',
  'fruit_vegetable','other'
);

create type reminder_type as enum (
  'watering','fertilizing','pruning','repotting','misting','custom'
);

create type blog_status as enum ('draft','published','archived');

create type identification_status as enum ('processing','complete','failed');

create type message_status as enum ('new','read','replied','closed');
```

Notes:

- `plant_category` aligns with `UI_UX_DESIGN.md` filter chips; adding values in-place is safe (`ALTER TYPE ... ADD VALUE`).
- `identification_status` may gain `'cached'` in Phase 2 implementation if the app distinguishes cached from fresh — decide at implementation, then record in `CHANGELOG.md`.
- `reminder_type` includes `misting`, `custom` so MVP (Phase 4 shell) matches the UI mockups (`UI_UX_DESIGN.md`).

---

## 5. Triggers

```sql
-- 5.1 updated_at touch (generic, used by every table with updated_at)
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_touch_updated_at        before update on public.profiles            for each row execute function public.touch_updated_at();
create trigger trg_touch_updated_at_pl     before update on public.plant_library       for each row execute function public.touch_updated_at();
create trigger trg_touch_updated_at_up     before update on public.user_plants         for each row execute function public.touch_updated_at();
create trigger trg_touch_updated_at_cr     before update on public.care_reminders      for each row execute function public.touch_updated_at();
create trigger trg_touch_updated_at_bp     before update on public.blog_posts          for each row execute function public.touch_updated_at();
create trigger trg_touch_updated_at_as     before update on public.app_settings        for each row execute function public.touch_updated_at();
```

```sql
-- 5.2 create-profile-on-signup (auth users trigger)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1) || '_' || substr(new.id::text,1,6)),
    'user'
  );
  return new;
end $$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

(Supabase Auth metadata `username` is set at signup time by the client form; `handle_new_user` falls back to a deterministic unique-ish handle. Name collisions in the fallback path are handled by a `username uniqueness` retry at app level — first signup wins; affected user is prompted to change during onboarding. Simple, documented.)

```sql
-- 5.3 care reminder: user_id_consistency guard
create or replace function public.care_reminders_owner_check() returns trigger
language plpgsql as $$
begin
  if not exists (
    select 1 from public.user_plants up where up.id = new.user_plant_id and up.user_id = new.user_id
  ) then
    raise exception 'user_id must own user_plant_id';
  end if;
  return new;
end $$;

create trigger trg_care_reminders_owner_check
  before insert or update on public.care_reminders
  for each row execute function public.care_reminders_owner_check();
```

```sql
-- 5.4 care reminder: next_due_date advance (done in app + trigger to be safe)
create or replace function public.care_reminders_complete_advance() returns trigger
language plpgsql as $$
begin
  if new.last_completed_at is not null
     and (old.last_completed_at is null or old.last_completed_at <> new.last_completed_at) then
    new.next_due_date = new.next_due_date + make_interval(days => new.interval_days);
  end if;
  return new;
end $$;

create trigger trg_care_reminders_complete_advance
  before update on public.care_reminders
  for each row execute function public.care_reminders_complete_advance();
```

(Trigger bumps schedule one interval when `last_completed_at` changes; Server Actions use this as primary path in Phase 4 and remove client-side math duplication.)

---

## 6. Storage buckets & bucket policies

Two buckets only (Free plan storage = **1 GB**, [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) — these buckets share the quota; mind the split).

### 6.1 `request-images` (private)

- **Purpose:** original images submitted to `/api/identify` (audit trail, cache-source availability, debug).
- **Path convention:** `{user_id|'anon'}/{identification_id}/{n}-{original-name-sanitized}.jpg` — user prefix for policy, id subdir so retention purge is file-count granular.
- **Policies (object-level):**

```sql
-- upload allowed for own prefix (files pushed by the server using service-role
-- in practice; this policy exists for direct uploads edge cases only)
create policy p_storage_request_images_own_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'request-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy p_storage_request_images_own_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'request-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy p_storage_request_images_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'request-images' and public.is_admin())
  with check (bucket_id = 'request-images' and public.is_admin());
```

- No public URL is ever issued; if a result image must be shown later, create a short-lived signed URL server-side. Access failure shows graceful fallback (no broken imagery).

### 6.2 `plant-images` (public read)

- **Purpose:** plant_library cover images, user_plants photos, blog covers, avatars. Public host for content referenced by URLs in DB + open-web delivery (via CDN in front of the free tier's storage).
- **Path convention:** `{user_id|'library'|'editorial'}/{yyyy}/{mm}/{uuid}.{ext}` — user prefix for user content; `library/`/`editorial/` for CMS-authored content.
- **Policies:**

```sql
create policy p_storage_plant_images_public_read on storage.objects
  for select using (bucket_id = 'plant-images');

-- user upload into own prefix
create policy p_storage_plant_images_user_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'plant-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy p_storage_plant_images_user_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'plant-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'plant-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- admin manage anywhere in bucket
create policy p_storage_plant_images_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'plant-images' and public.is_admin())
  with check (bucket_id = 'plant-images' and public.is_admin());
```

- Image constraints enforced at upload (client `UploadWidget` + server `/api/identify`): JPEG/PNG/WebP ≤ 10 MB; Pl@ntNet attribution obligation is noted in DB columns (`image_credit`) so no image ships uncited.

---

## 7. Migration strategy & seed data

### 7.1 How migrations run

- Plain SQL files, ascending, in `supabase/migrations/`:

```text
supabase/migrations/
  20260101000000_000_initial_schema.sql   -- extensions, enums, all tables, indexes
  20260101000001_001_rls_policies.sql     -- enables RLS + all policies per table
  20260101000002_002_functions_triggers.sql -- is_admin(), touch_updated_at, handle_new_user, reminder triggers
  20260101000003_003_storage_buckets.sql  -- buckets + storage policies
  20260101000004_004_seed.sql             -- app_settings defaults, admin profile, sample plant_library rows
```

- Applied via **Supabase CLI** (`supabase db push` locally/CI; `supabase migration up` locally for testing) with a check in `TESTING_PLAN.md` that a fresh project applies 000→004 clean.
- Naming: `<timestamp>_<seq>_<short_name>.sql`. Every migration is idempotent-safe where possible (`if not exists` guardrails); destructive changes are **separate** migrations with a comment + SQL dump taken first (§8).
- Rollback Policy: no automated down-migrations; recovery = restore dump (§8) + forward-fix migration.

### 7.2 Seed data (`004_seed.sql`)

```sql
-- Admin profile: create/confirm ONE Supabase auth user manually in the dashboard,
-- then promote — seed cannot mint a real auth.users row with a password hash.
insert into public.profiles (id, username, role)
select id, 'admin', 'admin'
from auth.users
where email = 'admin@plantai.example';   -- replace with real admin email in deploy env
-- If the auth user was created after handle_new_user trigger, the profile row
-- already exists — use ON CONFLICT DO UPDATE only on a migration fix-up pr.

-- Sample plant_library rows (starter content; care text is editorial, not AI-given facts)
insert into public.plant_library
  (slug, scientific_name, common_names, family, genus, category, description,
   watering, sunlight, soil, fertilizer, difficulty, is_published)
values
  ('monstera-deliciosa', 'Monstera deliciosa',
   array['swiss cheese plant', 'ceriman'], 'Araceae', 'Monstera',
   'houseplant',
   'A vigorous tropical climber loved for its fenestrated leaves…',
   'Water when top 2–3 cm of soil are dry; reduce in winter.',
   'Bright indirect light; avoid direct midday sun.',
   'Airy mix: peat/coir + perlite + orchid bark.',
   'Balanced NPK monthly in growing season.',
   'easy', true),
  -- + 5–10 more starter species for /library and /plant/[slug] smoke tests
  ('orchid-phalaenopsis', 'Phalaenopsis amabilis',
   array['moth orchid'], 'Orchidaceae', 'Phalaenopsis',
   'houseplant',
   '…', '…', '…', '…', '…', 'moderate', true),
  ('ficus-lyrata', 'Ficus lyrata',
   array['fiddle-leaf fig'], 'Moraceae', 'Ficus',
   'houseplant',
   '…', '…', '…', '…', '…', 'hard', true)
on conflict (slug) do nothing;
```

Seed rows are demo/starting content — real editorial writing continues in Phase 3 (`TASKS.md`).

---

## 8. Back-up strategy

Supabase Free **does not include automatic backups** ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Supabase) and a paused free project retains data with a **1-year restore window** via dashboard.

| Event | Action |
|---|---|
| Before **every** migration | `supabase db dump -f backups/pre_<migration_name>.sql` (or Date-named) — the required pre-migration dump |
| Weekly (dev cadence, Phase 1–4) | Scheduled dump: same command via a recurring local task or CI job (document detailed steps in `DEPLOYMENT_GUIDE.md`; CI uses service-role env var from `ENVIRONMENT_SETUP.md`, secret not committed) |
| Before deleting a bucket / bulk delete | Object-list export + move before dropping |
| Monetization / production (Phase 5+) | When Supabase Pro is adopted, weekly automatic backups land via plan features; until then manual cadence plus restore drill once per phase |

Warning: Silent pause/data-loss risk beyond 1 year of inactivity — add a calendar reminder (dev-level; no automation required in MVP).

---

## 9. Data retention & privacy notes

- **Decision (MVP):** identification rows are **retained** (no auto-delete). Rationale: cache + analytics value, simplicity, and the MVP sum of data is small (< a few MB). Explicitly committed here to keep implementation honest — clean-up is a Phase 5 decision, not a silent one.
- When Phase 5 raises this: purge rule should be « delete rows **older than 90 days** for (a) anonymous users’ `identifications` rows, (b) `identification_cache` rows not hit for 90 days » — recorded now so a later agent can implement without re-deriving.
- **Retention per data type** (current MVP commitments):

| Data | Where | MVP retention | Notes |
|---|---|---|---|
| Auth account | `auth.users` (Supabase-managed) | Until user deletes account | Profile deletion cascades owned data (see below) |
| `profiles` row | `profiles` | Cascade on account delete | No extra PII stored beyond username/avatar/name |
| Identification rows (users) | `identifications` | Retained (see above) | Stats/history value in `/dashboard` (Phase 4) |
| Identification rows (anonymous) | `identifications` (user_id NULL) | Retained; purge ≥90d deferred to Phase 5 | Content can be nothing but hashes + results (no profile) |
| Upload images (request-images) | Storage | Retained; signed, private access only | Phase 5 purge decision with the same 90-day rule |
| Plant/blog images (plant-images) | Storage | While content lives | Creative commons attributions shipped (see `LEGAL_AND_COMPLIANCE.md`) |
| Contact messages | `contact_messages` | Retained; admin-curated | ip_hash derived, no raw IP ever |
| app_settings / cache | as designed | Regenerable | Cache rows evicted at ≥90d since last hit |

- **Account deletion:** user deletes via `/account`; owned rows cascade from `auth.users` (`user_plants`, `care_reminders`, `saved_plants`, `profiles`; `identifications.user_id` + `blog_posts.author_id` + `plant_library.created_by` are `SET NULL` so platform history stays intact but the link to the person is severed). Anonymous identifications already have no link. This design means no manual anonymization step is needed post-delete.
- **Privacy commitments** (expanded in `LEGAL_AND_COMPLIANCE.md`): no third-party analytics on free-tier MVP without a documented privacy-policy note; IP addresses are stored only as salted hashes; images in `request-images` are never public; Pl@ntNet receives the image + optional lat/lon **as inherent to the identify request** and that data-share is disclosed in `/privacy`.

---

*End of DATABASE_SCHEMA.md.*
