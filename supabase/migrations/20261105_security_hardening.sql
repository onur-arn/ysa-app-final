-- Security review: closes internal functions to clients, locks station and e-mail on
-- profiles, and group admin rights. Touches no data. Safe to run twice.
begin;

create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- trusted database triggers (points for messages) set this flag for one statement
  -- the admin role is reserved to VIP e-mails, whoever edits the row
  if new.app_role = 'admin' and not public.is_vip_email(new.email) then new.app_role := 'member'; end if;
  if auth.uid() is null or public.is_admin() or current_setting('ysa.trusted', true) = 'on' then return new; end if;
  new.points := old.points;
  new.app_role := old.app_role;
  new.email := old.email;   -- the address password resets go to: never editable from the app
  if not public.is_intl() or new.id = auth.uid() then
    new.status := old.status;
    new.approved_at := old.approved_at;
  end if;
  -- pending accounts too: picking 'intl' before approval would grant its powers once approved
  if not public.is_intl() then
    new.station_id := old.station_id;
    new.position := old.position;
  end if;
  return new;
end $$;

create or replace function public.guard_conv_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.is_admin is distinct from old.is_admin
     and not public.is_conv_admin(old.conversation_id) and not public.is_admin() then
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;
drop trigger if exists guard_conv_admin on conversation_members;
create trigger guard_conv_admin before update on conversation_members for each row execute function public.guard_conv_admin();

-- Internal helpers: PostgREST exposes every public function, so close these to clients.
-- Triggers still reach them: they run as the owner (security definer).
revoke execute on function public.add_points(uuid, int) from public, anon, authenticated;
revoke execute on function public.recompute_points() from public, anon, authenticated;
revoke execute on function public.wants(uuid, text) from public, anon, authenticated;
revoke execute on function public.is_vip_email(text) from public, anon, authenticated;
-- The app runs the 30-day clean-up for signed-in members; visitors have no reason to.
revoke execute on function public.purge_old_posts() from public, anon;
grant execute on function public.purge_old_posts() to authenticated;

commit;
