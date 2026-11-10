-- PlantAI — functions & triggers
-- Source of truth: DATABASE_SCHEMA.md §1 helpers, §5 triggers.
-- NOTE (ordering): created BEFORE the RLS file because every policy in
-- 001 depends on is_admin(); the planning doc lists files as 000/001/002 —
-- sequence in this directory is 000 schema / 001 functions / 002 RLS.

-- ── Canonical admin check (§1; ARCHITECTURE.md §7.3) ──────────────────────
-- SECURITY DEFINER so RLS recursion is impossible; service-role code may
-- call it for maintenance/seed tasks.
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

-- ── 5.1 updated_at touch ──────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_touch_updated_at    before update on public.profiles       for each row execute function public.touch_updated_at();
create trigger trg_touch_updated_at_pl before update on public.plant_library  for each row execute function public.touch_updated_at();
create trigger trg_touch_updated_at_up before update on public.user_plants    for each row execute function public.touch_updated_at();
create trigger trg_touch_updated_at_cr before update on public.care_reminders for each row execute function public.touch_updated_at();
create trigger trg_touch_updated_at_bp before update on public.blog_posts     for each row execute function public.touch_updated_at();
create trigger trg_touch_updated_at_as before update on public.app_settings   for each row execute function public.touch_updated_at();

-- ── profiles: role immutability guard (§3.1 RLS note) ─────────────────────
-- Role changes are allowed ONLY via SQL migrations; no app path may alter
-- profiles.role (SECURITY.md §8).
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

-- ── 5.2 create-profile-on-signup ──────────────────────────────────────────
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

-- ── 5.3 care_reminders owner consistency ──────────────────────────────────
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

-- ── 5.4 care_reminders due-date advance ───────────────────────────────────
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
