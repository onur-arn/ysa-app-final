-- Closes the listing of the public "media" bucket to visitors and non-active accounts.
-- Public URLs keep working. Touches no data. Safe to run twice.
drop policy if exists "media read" on storage.objects;
-- Files stay reachable through their public URL (public bucket), but only active members
-- can list the bucket: without this anyone could enumerate members' photos and voice notes.
create policy "media read"   on storage.objects for select to authenticated using (bucket_id = 'media' and public.is_active());
