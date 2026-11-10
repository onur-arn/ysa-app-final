-- All Uluslararası Büro powers (moderation, every station's tasks and private events,
-- pins, positions) are reserved to its Yönetim Kurulu (and platform admins). Its Yürütme
-- Kurulu has the rights of an ordinary station member. Validating, suspending and deleting
-- accounts is reserved to the VIP admins. Touches no data. Safe to run twice.
begin;

create or replace function public.is_board_position(p text) returns boolean
language sql immutable set search_path = public as $$
  select p in ('Başkan', 'Sekreter', 'Sayman', 'Proje Direktörü', 'Dış İlişkiler Direktörü', 'İç İlişkiler Direktörü',
               'Kurumsal İletişim Direktörü', 'Eğitim Koordinatörü', 'Avrupa Birliği Projeler Sorumlusu')
$$;

-- Yönetim Kurulu of Uluslararası Büro (or platform admin): the moderation powers
create or replace function public.is_board() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and status = 'active'
    and (app_role = 'admin' or (station_id = 'intl' and public.is_board_position(position))))
$$;

-- every policy and function that checks is_intl() now means the Yönetim Kurulu
create or replace function public.is_intl() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_board()
$$;

-- Nobody but an admin changes their own station or position, and only the board
-- hands out (or takes back) a Yönetim Kurulu seat in Uluslararası Büro.
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
  new.first_name := old.first_name;   -- names are set at sign-up; only admins can correct them
  new.last_name := old.last_name;
  -- validating, suspending and deleting accounts: VIP admins only (Yönetici panel)
  new.status := old.status;
  new.approved_at := old.approved_at;
  -- pending accounts too: picking 'intl' before approval would grant its powers once approved
  if not public.is_intl() or new.id = auth.uid() then
    new.station_id := old.station_id;
    new.position := old.position;
  end if;
  if not public.is_board()
     and ((new.station_id = 'intl' and public.is_board_position(new.position))
          or (old.station_id = 'intl' and public.is_board_position(old.position)))
     and (new.station_id, new.position) is distinct from (old.station_id, old.position) then
    new.station_id := old.station_id;
    new.position := old.position;
  end if;
  return new;
end $$;

-- Posts: Uluslararası Büro may still (un)pin any post, but only the author or the board
-- may change anything else in it.
create or replace function public.posts_guard_pin() returns trigger
language plpgsql security definer set search_path = public as $$
declare keep_pin boolean;
begin
  if auth.uid() is null then return new; end if;
  if new.pinned is distinct from old.pinned and not public.is_intl() then
    new.pinned := old.pinned;
  end if;
  if old.author_id is distinct from auth.uid() and not public.is_board() then
    keep_pin := new.pinned;
    new := old;
    new.pinned := keep_pin;
  end if;
  return new;
end $$;

drop policy if exists "posts delete" on posts;
create policy "posts delete" on posts for delete to authenticated using (author_id = auth.uid() or public.is_board());

drop policy if exists "pcomments delete" on post_comments;
create policy "pcomments delete" on post_comments for delete to authenticated using (author_id = auth.uid() or public.is_board());

drop policy if exists "events update" on events;
drop policy if exists "events delete" on events;
create policy "events update" on events for update to authenticated
  using (created_by = auth.uid() or public.is_board())
  with check (public.is_intl() or station_id = public.my_station());
create policy "events delete" on events for delete to authenticated using (created_by = auth.uid() or public.is_board());

drop policy if exists "tasks delete" on tasks;
create policy "tasks delete" on tasks for delete to authenticated using (created_by = auth.uid() or public.is_board());

-- The Yürütme Kurulu only exists in Uluslararası Büro: other stations have the Yönetim Kurulu only.
-- Checked only when the station or the position changes, so existing rows stay editable.
create or replace function public.guard_executive_position() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.position in ('İnovasyon ve Girişimcilik Proje Direktörü', 'Kültür ve Sanat Proje Direktörü', 'Gençlik ve Çevre Proje Direktörü',
                      'Dezavantajlı Gruplar ve Sosyal Dahil Etme Proje Direktörü', 'Demokratik Katılım Proje Direktörü', 'Gençlik Sağlığı Proje Direktörü')
     and new.station_id is distinct from 'intl'
     and (tg_op = 'INSERT' or (new.station_id, new.position) is distinct from (old.station_id, old.position)) then
    raise exception 'executive_intl_only: the Yürütme Kurulu only exists in Uluslararası Büro';
  end if;
  return new;
end $$;
drop trigger if exists guard_executive_position on profiles;
create trigger guard_executive_position before insert or update of station_id, position on profiles
  for each row execute function public.guard_executive_position();

commit;
