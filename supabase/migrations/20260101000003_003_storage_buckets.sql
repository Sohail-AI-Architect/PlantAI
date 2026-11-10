-- PlantAI — storage buckets + bucket policies
-- Source of truth: DATABASE_SCHEMA.md §6 (verbatim policies).
-- Free-tier note: buckets share the 1 GB storage quota (docs/VERIFIED_FACTS.md).

-- ── Buckets ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('request-images', 'request-images', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('plant-images', 'plant-images', true)
on conflict (id) do nothing;

-- ── request-images (private; §6.1) ────────────────────────────────────────
drop policy if exists p_storage_request_images_own_insert on storage.objects;
create policy p_storage_request_images_own_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'request-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists p_storage_request_images_own_select on storage.objects;
create policy p_storage_request_images_own_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'request-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists p_storage_request_images_admin_all on storage.objects;
create policy p_storage_request_images_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'request-images' and public.is_admin())
  with check (bucket_id = 'request-images' and public.is_admin());

-- No public URLs are ever issued for this bucket (short-lived signed URLs
-- only, generated server-side in Phase 2).

-- ── plant-images (public read; §6.2) ──────────────────────────────────────
drop policy if exists p_storage_plant_images_public_read on storage.objects;
create policy p_storage_plant_images_public_read on storage.objects
  for select using (bucket_id = 'plant-images');

drop policy if exists p_storage_plant_images_user_insert on storage.objects;
create policy p_storage_plant_images_user_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'plant-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists p_storage_plant_images_user_update on storage.objects;
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

drop policy if exists p_storage_plant_images_admin_all on storage.objects;
create policy p_storage_plant_images_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'plant-images' and public.is_admin())
  with check (bucket_id = 'plant-images' and public.is_admin());
