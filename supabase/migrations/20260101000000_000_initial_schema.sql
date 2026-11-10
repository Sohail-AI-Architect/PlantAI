-- PlantAI — initial schema (tables, enums, indexes)
-- Source of truth: DATABASE_SCHEMA.md (ver. approved 2026-11-10).
-- Conventions: snake_case, uuid PKs with gen_random_uuid(), timestamptz everywhere.
-- Idempotency: guarded where cheap; Supabase CLI applies each file once.

create extension if not exists pg_trgm;

-- ── Enums (DATABASE_SCHEMA.md §4) ──────────────────────────────────────────
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

-- ── profiles (§3.1) ────────────────────────────────────────────────────────
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text not null unique check (char_length(username) between 3 and 24),
  full_name       text,
  avatar_url      text,
  role            text not null default 'user' check (role in ('user','admin')),
  email_confirmed boolean not null default false,
  locale          text not null default 'en',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── plant_library (§3.2) ───────────────────────────────────────────────────
create table public.plant_library (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') unique,
  scientific_name text not null,
  common_names    text[] not null default '{}',
  family          text,
  genus           text,
  category        plant_category not null default 'other',
  description     text,
  watering        text,
  sunlight        text,
  soil            text,
  fertilizer      text,
  difficulty      text check (difficulty in ('easy','moderate','hard')),
  image_url       text,
  image_credit    text,
  source_url      text,
  is_published    boolean not null default false,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index plant_library_slug_idx       on public.plant_library (slug);
create index        plant_library_category_idx   on public.plant_library (category) where is_published;
create index        plant_library_published_idx  on public.plant_library (is_published, updated_at desc);
create index        plant_library_scientific_name_trgm_idx on public.plant_library using gin (scientific_name gin_trgm_ops);
create index        plant_library_common_names_idx on public.plant_library using gin (common_names);

-- ── identifications (§3.3) ─────────────────────────────────────────────────
create table public.identifications (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references auth.users (id) on delete set null,
  image_paths               text[] not null default '{}',
  organ                     text not null default 'auto'
                            check (organ in ('flower','leaf','lateral','root','auto')),
  latitude                  numeric(10,7) check (latitude between -90 and 90),
  longitude                 numeric(10,7) check (longitude between -180 and 180),
  project                   text not null default 'allplants',
  hash                      text,
  best_match_scientific_name text,
  best_match_score          numeric(5,4) check (best_match_score between 0 and 1),
  result                    jsonb,
  raw_response              jsonb,
  status                    identification_status not null default 'processing',
  created_at                timestamptz not null default now()
);

create index identifications_user_idx    on public.identifications (user_id, created_at desc);
create index identifications_status_idx  on public.identifications (status);
create index identifications_hash_idx    on public.identifications (hash);
create index identifications_created_idx on public.identifications (created_at desc);

-- ── user_plants (§3.4) ─────────────────────────────────────────────────────
create table public.user_plants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  plant_library_id uuid references public.plant_library (id) on delete set null,
  nickname        text not null check (char_length(nickname) between 1 and 60),
  scientific_name text,
  common_name     text,
  image_url       text,
  acquired_at     date,
  location        text check (location in ('indoor','outdoor','balcony','greenhouse')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index user_plants_user_idx    on public.user_plants (user_id, created_at desc);
create index user_plants_library_idx on public.user_plants (plant_library_id);

-- ── care_reminders (§3.5) ──────────────────────────────────────────────────
create table public.care_reminders (
  id                uuid primary key default gen_random_uuid(),
  user_plant_id     uuid not null references public.user_plants (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  reminder_type     reminder_type not null default 'watering',
  notes             text,
  interval_days     integer not null default 7 check (interval_days between 1 and 3650),
  next_due_date     date not null,
  last_completed_at timestamptz,
  is_paused         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index care_reminders_user_plant_idx on public.care_reminders (user_plant_id);
create index care_reminders_next_due_idx   on public.care_reminders (next_due_date) where is_paused = false;
create unique index care_reminders_type_unique_idx
  on public.care_reminders (user_plant_id, reminder_type) where is_paused = false;

-- ── saved_plants (§3.6) ────────────────────────────────────────────────────
create table public.saved_plants (
  user_id    uuid not null references auth.users (id) on delete cascade,
  plant_id   uuid not null references public.plant_library (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, plant_id)
);

create index saved_plants_plant_idx on public.saved_plants (plant_id);

-- ── blog_posts (§3.7) ──────────────────────────────────────────────────────
create table public.blog_posts (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') unique,
  title              text not null check (char_length(title) between 3 and 200),
  excerpt            text check (char_length(excerpt) <= 400),
  content_md         text not null,
  cover_image_url    text,
  cover_image_credit text,
  author_id          uuid references auth.users (id) on delete set null,
  status             blog_status not null default 'draft',
  published_at       timestamptz,
  reading_minutes    integer check (reading_minutes > 0),
  seo_title          text check (char_length(seo_title) <= 60),
  seo_description    text check (char_length(seo_description) <= 160),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index blog_posts_slug_idx       on public.blog_posts (slug);
create index        blog_posts_status_pub_idx on public.blog_posts (status, published_at desc);
create index        blog_posts_scheduled_idx  on public.blog_posts (published_at) where status = 'published';
create index        blog_posts_title_trgm_idx on public.blog_posts using gin (title gin_trgm_ops);

-- ── contact_messages (§3.8) ────────────────────────────────────────────────
create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  email       text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject     text check (char_length(subject) <= 120),
  message     text not null check (char_length(message) between 10 and 4000),
  status      message_status not null default 'new',
  admin_notes text,
  handled_by  uuid references auth.users (id) on delete set null,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index contact_messages_status_idx on public.contact_messages (status, created_at desc);
create index contact_messages_ip_idx     on public.contact_messages (ip_hash);

-- ── app_settings (§3.9) ────────────────────────────────────────────────────
create table public.app_settings (
  key         text primary key
              check (key = lower(key) and key ~ '^[a-z_]+(\.[a-z_]+)*$'),
  value       jsonb not null,
  value_type  text not null default 'number' check (value_type in ('number','string','boolean','json')),
  description text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

-- ── identification_cache (§3.10) ───────────────────────────────────────────
create table public.identification_cache (
  id                uuid primary key default gen_random_uuid(),
  p_hash            text not null,
  p_hash_variants   text[] not null default '{}',
  project           text not null default 'allplants',
  organ             text not null default 'auto',
  normalized_result jsonb not null,
  top_score         numeric(5,4),
  hit_count         integer not null default 0,
  created_at        timestamptz not null default now(),
  last_hit_at       timestamptz
);

create unique index identification_cache_key_idx on public.identification_cache (p_hash, project, organ);
create index identification_cache_last_hit_idx   on public.identification_cache (last_hit_at);
create index identification_cache_hash_variants_idx on public.identification_cache using gin (p_hash_variants);
