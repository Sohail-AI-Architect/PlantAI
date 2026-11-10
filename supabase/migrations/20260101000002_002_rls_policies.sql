-- PlantAI — Row Level Security: enable + all policies
-- Source of truth: DATABASE_SCHEMA.md §3 (per-table RLS snippets), verbatim.
-- Enable is idempotent; policies are re-created defensively in dev.
-- WARNING: auth.uid()/is_admin() depend on 001_functions_triggers.sql.

-- ── profiles (§3.1) — strictest table ─────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists p_profiles_select_self on public.profiles;
create policy p_profiles_select_self on public.profiles
  for select using (auth.uid() = id);

drop policy if exists p_profiles_select_admin on public.profiles;
create policy p_profiles_select_admin on public.profiles
  for select using (public.is_admin());

drop policy if exists p_profiles_update_self on public.profiles;
create policy p_profiles_update_self on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);
-- NOTE: role immutability is enforced by the trg_guard_profile_role trigger
-- (001), which raises if a caller tries to change role — the update policy
-- alone cannot express it per-column.

-- No insert/delete policies: profiles rows are created by the auth trigger
-- (security definer) and deleted via cascade from auth.users.

-- ── plant_library (§3.2) ──────────────────────────────────────────────────
alter table public.plant_library enable row level security;
alter table public.plant_library force row level security;

drop policy if exists p_plant_library_select_published on public.plant_library;
create policy p_plant_library_select_published on public.plant_library
  for select using (is_published);

drop policy if exists p_plant_library_select_admin on public.plant_library;
create policy p_plant_library_select_admin on public.plant_library
  for select using (public.is_admin());

drop policy if exists p_plant_library_write_admin on public.plant_library;
create policy p_plant_library_write_admin on public.plant_library
  for all using (public.is_admin())
  with check (public.is_admin());

-- ── identifications (§3.3) — read own; service-role inserts only ──────────
alter table public.identifications enable row level security;
alter table public.identifications force row level security;

drop policy if exists p_identifications_select_self on public.identifications;
create policy p_identifications_select_self on public.identifications
  for select using (user_id = auth.uid());

drop policy if exists p_identifications_select_admin on public.identifications;
create policy p_identifications_select_admin on public.identifications
  for select using (public.is_admin());

-- No INSERT policy by design: rows are written by the server module with the
-- service-role client (bypasses RLS) — closes a forged-user_id hole.

-- ── user_plants (§3.4) — owner-only CRUD ──────────────────────────────────
alter table public.user_plants enable row level security;
alter table public.user_plants force row level security;

drop policy if exists p_user_plants_owner_all on public.user_plants;
create policy p_user_plants_owner_all on public.user_plants
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists p_user_plants_admin_all on public.user_plants;
create policy p_user_plants_admin_all on public.user_plants
  for all using (public.is_admin())
  with check (public.is_admin());

-- ── care_reminders (§3.5) — owner-only CRUD ───────────────────────────────
alter table public.care_reminders enable row level security;
alter table public.care_reminders force row level security;

drop policy if exists p_care_reminders_owner_all on public.care_reminders;
create policy p_care_reminders_owner_all on public.care_reminders
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists p_care_reminders_admin_all on public.care_reminders;
create policy p_care_reminders_admin_all on public.care_reminders
  for all using (public.is_admin())
  with check (public.is_admin());

-- ── saved_plants (§3.6) — owner-only CRUD ─────────────────────────────────
alter table public.saved_plants enable row level security;
alter table public.saved_plants force row level security;

drop policy if exists p_saved_plants_owner_all on public.saved_plants;
create policy p_saved_plants_owner_all on public.saved_plants
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists p_saved_plants_admin_all on public.saved_plants;
create policy p_saved_plants_admin_all on public.saved_plants
  for all using (public.is_admin())
  with check (public.is_admin());

-- ── blog_posts (§3.7) — public read of published; admin write ─────────────
alter table public.blog_posts enable row level security;
alter table public.blog_posts force row level security;

drop policy if exists p_blog_posts_select_published on public.blog_posts;
create policy p_blog_posts_select_published on public.blog_posts
  for select using (status = 'published');

drop policy if exists p_blog_posts_select_author on public.blog_posts;
create policy p_blog_posts_select_author on public.blog_posts
  for select using (author_id = auth.uid());

drop policy if exists p_blog_posts_select_admin on public.blog_posts;
create policy p_blog_posts_select_admin on public.blog_posts
  for select using (public.is_admin());

drop policy if exists p_blog_posts_write_admin on public.blog_posts;
create policy p_blog_posts_write_admin on public.blog_posts
  for all using (public.is_admin())
  with check (public.is_admin());

-- ── contact_messages (§3.8) — anyone inserts; admin reads/updates ─────────
alter table public.contact_messages enable row level security;
alter table public.contact_messages force row level security;

drop policy if exists p_contact_messages_insert_anyone on public.contact_messages;
create policy p_contact_messages_insert_anyone on public.contact_messages
  for insert to anon, authenticated
  with check (true);

drop policy if exists p_contact_messages_select_admin on public.contact_messages;
create policy p_contact_messages_select_admin on public.contact_messages
  for select using (public.is_admin());

drop policy if exists p_contact_messages_update_admin on public.contact_messages;
create policy p_contact_messages_update_admin on public.contact_messages
  for update using (public.is_admin())
  with check (public.is_admin());

-- ── app_settings (§3.9) — read all; admin write ───────────────────────────
alter table public.app_settings enable row level security;
alter table public.app_settings force row level security;

drop policy if exists p_app_settings_read_all on public.app_settings;
create policy p_app_settings_read_all on public.app_settings
  for select using (true);

drop policy if exists p_app_settings_write_admin on public.app_settings;
create policy p_app_settings_write_admin on public.app_settings
  for all using (public.is_admin())
  with check (public.is_admin());

-- ── identification_cache (§3.10) — service-role only in practice ──────────
alter table public.identification_cache enable row level security;
alter table public.identification_cache force row level security;

drop policy if exists p_identification_cache_select_admin on public.identification_cache;
create policy p_identification_cache_select_admin on public.identification_cache
  for select using (public.is_admin());
-- Lookups + upserts happen via the server module with the service-role
-- client; no user-facing policies exist by design.
