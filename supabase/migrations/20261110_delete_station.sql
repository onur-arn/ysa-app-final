-- Deleting a station from the Yönetici panel, and putting Marsilya on the sign-up map
-- (it was created before the panel placed new stations on the map by itself).
-- Safe to run twice.
begin;

update stations set lat = 43.29695, lng = 5.38107 where id = 'marsilya' and lat is null;

-- Deletes a station in one go: its members become Misafir (they keep their account),
-- its tasks and its agenda events are deleted (an event without a station would show
-- in every station), posts and stories stay in the feed without a station.
-- Uluslararası Büro cannot be deleted.
create or replace function public.delete_station(p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_id = 'intl' then raise exception 'Uluslararası Büro cannot be deleted'; end if;
  perform set_config('ysa.trusted', 'on', true);
  update profiles set station_id = null, position = 'Misafir' where station_id = p_id;
  perform set_config('ysa.trusted', 'off', true);
  delete from events where station_id = p_id;
  delete from tasks where station_id = p_id;
  delete from stations where id = p_id;
end $$;

revoke all on function public.delete_station(text) from public, anon;
grant execute on function public.delete_station(text) to authenticated;

commit;
