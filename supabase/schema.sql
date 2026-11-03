-- ═══════════════════════════════════════════════════════════════════════════
-- YSA App Final – Supabase schema (idempotent: safe to run several times)
-- Supabase Dashboard > SQL Editor > paste > Run
--
--   • Users are referenced by uuid everywhere (never by name).
--   • Sign-up goes through Supabase Auth; profiles start "pending" and an admin
--     approves them. No password is ever stored by the app.
--   • "Uluslararası Büro" (station 'intl') is the central office: it sees every
--     station's tasks and private events, pins messages, assigns positions.
--   • Notifications are only written by triggers (never by clients), so nobody
--     can forge one; push delivery reads the same table.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── STATIONS ────────────────────────────────────────────────────────────────
create table if not exists stations (
  id         text primary key,
  name       text not null,
  short      text not null,
  city       text not null,
  color      text not null default '188 57% 48%',
  position   int  not null default 0
);
insert into stations (id, name, short, city, color, position) values
  ('intl',       'Uluslararası Büro',    'INT', 'Uluslararası', '188 57% 48%', 0),
  ('paris',      'Paris İstasyonu',      'PAR', 'Paris',        '221 70% 55%', 1),
  ('caen',       'Caen İstasyonu',       'CAE', 'Caen',         '350 70% 55%', 2),
  ('nancy',      'Nancy İstasyonu',      'NAN', 'Nancy',        '28 85% 55%',  3),
  ('strasbourg', 'Strasbourg İstasyonu', 'STR', 'Strasbourg',   '280 50% 55%', 4),
  ('lyon',       'Lyon İstasyonu',       'LYO', 'Lyon',         '150 55% 45%', 5),
  ('hamburg',    'Hamburg İstasyonu',    'HAM', 'Hamburg',      '200 70% 50%', 6),
  ('bucarest',   'Bükreş İstasyonu',     'BUC', 'Bükreş',       '45 90% 50%',  7)
on conflict (id) do nothing;

-- ── PROFILES ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  first_name   text not null default '',
  last_name    text not null default '',
  full_name    text generated always as (trim(first_name || ' ' || last_name)) stored,
  email        text not null default '',
  phone        text,
  birthday     date,
  linkedin     text,
  hometown     text,
  station_id   text references stations(id) on delete set null default 'paris',
  position     text,
  app_role     text not null default 'member' check (app_role in ('member', 'admin')),
  status       text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'rejected')),
  photo_url    text,
  igem_trained boolean not null default false,
  igem_date    date,
  points       int not null default 0,          -- grows with every message sent
  notif_prefs  jsonb not null default '{"messages": true, "tasks": true, "events": true, "members": true}',
  last_seen_at timestamptz,
  approved_at  timestamptz,
  created_at   timestamptz not null default now()
);
-- set once the secretariat has been e-mailed about this sign-up (Kabul et / Reddet)
alter table profiles add column if not exists signup_notified_at timestamptz;

create unique index if not exists profiles_unique_position on profiles(station_id, position)
  where position is not null and status in ('active', 'pending');

-- ── HELPERS (security definer → no RLS recursion) ──────────────────────────
create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and status = 'active')
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and status = 'active' and app_role = 'admin')
$$;
-- Misafir: signed up without a station and not an admin → read-only on the feed
create or replace function public.is_guest() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select station_id is null and app_role <> 'admin' from profiles where id = auth.uid()), true)
$$;

create or replace function public.my_station() returns text
language sql stable security definer set search_path = public as $$
  select station_id from profiles where id = auth.uid()
$$;
-- Uluslararası Büro member (or platform admin): the central office powers
create or replace function public.is_intl() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and status = 'active' and (station_id = 'intl' or app_role = 'admin'))
$$;

-- 🔐 VIP accounts: the only ones allowed into the Yönetici panel (gold lock in Ayarlar).
create table if not exists vip_emails (email text primary key);
insert into vip_emails values ('secretaire@youthstation.org'), ('president@youthstation.org') on conflict do nothing;
alter table vip_emails enable row level security;   -- no policy: invisible to clients

create or replace function public.is_vip_email(mail text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from vip_emails where email = lower(coalesce(mail, '')))
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  boss boolean := public.is_vip_email(new.email);
  photo text := nullif(meta->>'photo_url', '');
  -- "Misafir giriş": a guest has no station and the position "Misafir"
  guest boolean := coalesce((meta->>'guest')::boolean, false);
begin
  -- only accept sign-up photos uploaded through /api/signup-photo
  if photo is not null and photo not like '%/storage/v1/object/public/media/signup/%' then photo := null; end if;
  insert into profiles (id, email, first_name, last_name, phone, birthday, linkedin, hometown, station_id, position,
                        igem_trained, igem_date, app_role, status, approved_at, photo_url)
  values (
    new.id, new.email,
    coalesce(meta->>'first_name', ''), coalesce(meta->>'last_name', ''),
    nullif(meta->>'phone', ''), nullif(meta->>'birthday', '')::date, nullif(meta->>'linkedin', ''),
    nullif(meta->>'hometown', ''),
    case when guest then null else coalesce(nullif(meta->>'station_id', ''), 'paris') end,
    case when guest then 'Misafir' else nullif(meta->>'position', '') end,
    coalesce((meta->>'igem_trained')::boolean, false), nullif(meta->>'igem_date', '')::date,
    case when boss then 'admin' else 'member' end,
    case when boss then 'active' else 'pending' end,
    case when boss then now() end,
    photo
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Members cannot change their own role/status/points; station/position are
-- frozen once active (intl may reassign positions, admins anything).
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- trusted database triggers (points for messages) set this flag for one statement
  -- the admin role is reserved to VIP e-mails, whoever edits the row
  if new.app_role = 'admin' and not public.is_vip_email(new.email) then new.app_role := 'member'; end if;
  if auth.uid() is null or public.is_admin() or current_setting('ysa.trusted', true) = 'on' then return new; end if;
  new.points := old.points;
  new.app_role := old.app_role;
  if not public.is_intl() or new.id = auth.uid() then
    new.status := old.status;
    new.approved_at := old.approved_at;
  end if;
  if old.status = 'active' and not public.is_intl() then
    new.station_id := old.station_id;
    new.position := old.position;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on profiles;
create trigger protect_profile before update on profiles for each row execute function public.protect_profile();

alter table stations enable row level security;
alter table profiles enable row level security;
drop policy if exists "stations read" on stations;
drop policy if exists "stations admin" on stations;
create policy "stations read" on stations for select using (true);
create policy "stations admin" on stations for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles read" on profiles;
drop policy if exists "profiles self" on profiles;
drop policy if exists "profiles intl" on profiles;
drop policy if exists "profiles admin delete" on profiles;
create policy "profiles read" on profiles for select to authenticated
  using (id = auth.uid() or public.is_intl() or (public.is_active() and status = 'active'));
create policy "profiles self" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles intl" on profiles for update to authenticated using (public.is_intl()) with check (public.is_intl());
create policy "profiles admin delete" on profiles for delete to authenticated using (public.is_admin());

create or replace function public.taken_positions() returns table(station_id text, "position" text)
language sql stable security definer set search_path = public as $$
  select station_id, position from profiles where position is not null and status in ('active', 'pending')
$$;
grant execute on function public.taken_positions() to anon, authenticated;

create or replace function public.add_points(uid uuid, n int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if uid is null or n = 0 then return; end if;
  perform set_config('ysa.trusted', 'on', true);
  update profiles set points = greatest(0, points + n) where id = uid;
  perform set_config('ysa.trusted', 'off', true);
end $$;

-- ── PASSWORD RESET CODES (sent by the app through Brevo) ───────────────────
-- Server only (RLS on, no policy). The 6-digit code is stored hashed, expires
-- after 15 minutes and allows 5 attempts.
create table if not exists password_resets (
  email      text primary key,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   int not null default 0,
  created_at timestamptz not null default now()
);
alter table password_resets enable row level security;

-- ── NOTIFICATIONS (bell + push) ─────────────────────────────────────────────
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  type       text not null,                 -- message | mention | task | event | member | comment
  title      text not null,
  body       text,
  link       text,
  actor_id   uuid references profiles(id) on delete set null,
  group_key  text,                          -- one live row per conversation for chat messages
  count      int not null default 1,
  read_at    timestamptz,
  pushed_at  timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);
create unique index if not exists notifications_group_idx on notifications(user_id, group_key) where group_key is not null;
alter table notifications enable row level security;
drop policy if exists "notif read own" on notifications;
drop policy if exists "notif update own" on notifications;
drop policy if exists "notif delete own" on notifications;
create policy "notif read own"   on notifications for select to authenticated using (user_id = auth.uid());
create policy "notif update own" on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notif delete own" on notifications for delete to authenticated using (user_id = auth.uid());

-- Respect each member's notification preferences (settings screen).
create or replace function public.wants(uid uuid, pref text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (notif_prefs->>pref)::boolean from profiles where id = uid and status = 'active'), false)
$$;

create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table push_subscriptions enable row level security;
drop policy if exists "push own" on push_subscriptions;
create policy "push own" on push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── FEED ────────────────────────────────────────────────────────────────────
create table if not exists posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references profiles(id) on delete cascade,     -- null for app-generated welcome posts
  station_id  text references stations(id) on delete set null,
  kind        text not null default 'post' check (kind in ('post', 'welcome', 'igem')),
  content     text not null,
  image_url   text,
  file_path   text,                -- PDF / document in the private "files" bucket
  file_name   text,
  file_size   bigint,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists posts_created_idx on posts(created_at desc);

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (post_id, user_id)
);
create table if not exists post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

alter table posts enable row level security;
alter table post_likes enable row level security;
alter table post_comments enable row level security;
drop policy if exists "posts read" on posts;
drop policy if exists "posts insert" on posts;
drop policy if exists "posts update" on posts;
drop policy if exists "posts delete" on posts;
create policy "posts read"   on posts for select to authenticated using (public.is_active());
create policy "posts insert" on posts for insert to authenticated
  with check (author_id = auth.uid() and public.is_active() and not public.is_guest() and kind in ('post', 'igem') and (not pinned or public.is_intl()));
create policy "posts update" on posts for update to authenticated using (author_id = auth.uid() or public.is_intl());
create policy "posts delete" on posts for delete to authenticated using (author_id = auth.uid() or public.is_intl());

-- Feed posts are kept 30 days, then deleted for good (pinned ones stay).
-- Called opportunistically by the app on every feed load, and nightly if pg_cron exists.
create or replace function public.purge_old_posts() returns void
language sql security definer set search_path = public as $$
  delete from posts where not pinned and kind <> 'welcome' and created_at < now() - interval '30 days';
$$;
do $$
begin
  perform 1 from pg_extension where extname = 'pg_cron';
  if found then
    perform cron.schedule('purge-old-posts', '0 3 * * *', 'select public.purge_old_posts()');
  end if;
exception when others then null;
end $$;

-- Only Uluslararası Büro may (un)pin, whoever edits the post.
create or replace function public.posts_guard_pin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.pinned is distinct from old.pinned and not public.is_intl() then
    new.pinned := old.pinned;
  end if;
  return new;
end $$;
drop trigger if exists posts_guard_pin on posts;
create trigger posts_guard_pin before update on posts for each row execute function public.posts_guard_pin();

drop policy if exists "likes read" on post_likes;
drop policy if exists "likes own" on post_likes;
create policy "likes read" on post_likes for select to authenticated using (public.is_active());
create policy "likes own"  on post_likes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active());

drop policy if exists "pcomments read" on post_comments;
drop policy if exists "pcomments insert" on post_comments;
drop policy if exists "pcomments delete" on post_comments;
create policy "pcomments read"   on post_comments for select to authenticated using (public.is_active());
create policy "pcomments insert" on post_comments for insert to authenticated with check (author_id = auth.uid() and public.is_active());
create policy "pcomments delete" on post_comments for delete to authenticated using (author_id = auth.uid() or public.is_intl());

-- ── STORIES (24 h, with editor + music) ─────────────────────────────────────
create table if not exists stories (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references profiles(id) on delete cascade,
  station_id        text references stations(id) on delete set null,
  image_url         text not null,
  fit_mode          text not null default 'cover' check (fit_mode in ('cover', 'contain')),
  music_preview_url text,
  music_label       text,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '24 hours'
);
create table if not exists story_views (
  story_id  uuid not null references stories(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  liked     boolean not null default false,
  viewed_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table stories enable row level security;
alter table story_views enable row level security;
drop policy if exists "stories read" on stories;
drop policy if exists "stories insert" on stories;
drop policy if exists "stories delete" on stories;
create policy "stories read"   on stories for select to authenticated using (public.is_active() and expires_at > now());
create policy "stories insert" on stories for insert to authenticated with check (author_id = auth.uid() and public.is_active() and not public.is_guest());
create policy "stories delete" on stories for delete to authenticated using (author_id = auth.uid() or public.is_admin());
drop policy if exists "sviews read" on story_views;
drop policy if exists "sviews own" on story_views;
create policy "sviews read" on story_views for select to authenticated
  using (user_id = auth.uid() or exists(select 1 from stories s where s.id = story_id and s.author_id = auth.uid()));
create policy "sviews own" on story_views for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── EVENTS (takvim) ─────────────────────────────────────────────────────────
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,                 -- set for multi-day ("Bir dönem") events
  all_day     boolean not null default false,
  location    text,
  link        text,
  station_id  text references stations(id) on delete set null,     -- null = every station
  is_private  boolean not null default false,                      -- 🔒 station only (+ Uluslararası Büro)
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists events_starts_idx on events(starts_at);
alter table events enable row level security;

create or replace function public.can_see_event(st text, priv boolean, owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active() and (not priv or public.is_intl() or owner = auth.uid() or st is null or st = public.my_station())
$$;

drop policy if exists "events read" on events;
drop policy if exists "events insert" on events;
drop policy if exists "events update" on events;
drop policy if exists "events delete" on events;
create policy "events read"   on events for select to authenticated using (public.can_see_event(station_id, is_private, created_by));
-- members create events for their own station; Uluslararası Büro for any station
create policy "events insert" on events for insert to authenticated
  with check (created_by = auth.uid() and public.is_active() and (public.is_intl() or station_id = public.my_station()));
create policy "events update" on events for update to authenticated
  using (created_by = auth.uid() or public.is_intl())
  with check (public.is_intl() or station_id = public.my_station());
create policy "events delete" on events for delete to authenticated using (created_by = auth.uid() or public.is_intl());

-- Private events of other stations: only the time slot is shared, shown as 🔒 without any content.
create or replace function public.locked_events()
returns table(id uuid, starts_at timestamptz, ends_at timestamptz, all_day boolean, station_id text)
language sql stable security definer set search_path = public as $$
  select e.id, e.starts_at, e.ends_at, e.all_day, e.station_id from events e
   where public.is_active() and e.is_private and not public.can_see_event(e.station_id, e.is_private, e.created_by)
     and e.starts_at > now() - interval '6 months'
$$;

-- ── TASKS (görevler) ────────────────────────────────────────────────────────
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  status       text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority     text not null default 'normal' check (priority in ('low', 'normal', 'urgent')),
  station_id   text not null references stations(id) on delete cascade,
  assignee_id  uuid references profiles(id) on delete set null,
  assign_all   boolean not null default false,    -- "Tüm ekip": the whole station
  created_by   uuid references profiles(id) on delete set null,
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create table if not exists task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
alter table tasks enable row level security;
alter table task_comments enable row level security;

-- Stations only see their own tasks; Uluslararası Büro sees all (as in v1).
create or replace function public.can_see_task(st text, assignee uuid, creator uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active() and (public.is_intl() or st = public.my_station())
$$;
drop policy if exists "tasks read" on tasks;
drop policy if exists "tasks insert" on tasks;
drop policy if exists "tasks update" on tasks;
drop policy if exists "tasks delete" on tasks;
create policy "tasks read"   on tasks for select to authenticated using (public.can_see_task(station_id, assignee_id, created_by));
create policy "tasks insert" on tasks for insert to authenticated
  with check (created_by = auth.uid() and public.is_active() and (public.is_intl() or station_id = public.my_station()));
create policy "tasks update" on tasks for update to authenticated using (public.can_see_task(station_id, assignee_id, created_by));
create policy "tasks delete" on tasks for delete to authenticated using (created_by = auth.uid() or public.is_intl());

drop policy if exists "tcomments read" on task_comments;
drop policy if exists "tcomments insert" on task_comments;
drop policy if exists "tcomments delete" on task_comments;
create policy "tcomments read" on task_comments for select to authenticated
  using (exists(select 1 from tasks t where t.id = task_id and public.can_see_task(t.station_id, t.assignee_id, t.created_by)));
create policy "tcomments insert" on task_comments for insert to authenticated
  with check (author_id = auth.uid() and exists(select 1 from tasks t where t.id = task_id and public.can_see_task(t.station_id, t.assignee_id, t.created_by)));
create policy "tcomments delete" on task_comments for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create or replace function public.tasks_before() returns trigger language plpgsql as $$
begin
  new.completed_at := case when new.status = 'done' then coalesce(new.completed_at, now()) else null end;
  if new.assign_all then new.assignee_id := null; end if;
  return new;
end $$;
drop trigger if exists tasks_before on tasks;
create trigger tasks_before before insert or update on tasks for each row execute function public.tasks_before();

-- ── MESSAGING ───────────────────────────────────────────────────────────────
create table if not exists conversations (
  id                uuid primary key default gen_random_uuid(),
  type              text not null check (type in ('group', 'dm')),
  name              text,
  avatar_url        text,
  created_by        uuid references profiles(id) on delete set null,
  pinned_message_id uuid,           -- 📌 set by Uluslararası Büro only (see pin_message)
  pinned_by         uuid references profiles(id) on delete set null,
  last_message_at   timestamptz not null default now(),
  created_at        timestamptz not null default now()
);
create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  is_admin        boolean not null default false,
  muted           boolean not null default false,
  last_read_at    timestamptz not null default now(),
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists conv_members_user_idx on conversation_members(user_id);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid references profiles(id) on delete set null,
  kind            text not null default 'text' check (kind in ('text', 'image', 'file', 'audio', 'gif', 'poll', 'system')),
  content         text,
  attachment_url  text,             -- public URL (image, gif, audio) or storage path (file)
  attachment_name text,
  attachment_size bigint,
  mentions        uuid[] not null default '{}',
  reply_to        uuid references messages(id) on delete set null,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_idx on messages(conversation_id, created_at desc);
do $$ begin
  alter table conversations add constraint conversations_pinned_fk foreign key (pinned_message_id) references messages(id) on delete set null;
exception when duplicate_object then null; end $$;

alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;

create or replace function public.is_member_of(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from conversation_members where conversation_id = cid and user_id = auth.uid())
$$;
create or replace function public.is_conv_admin(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from conversation_members where conversation_id = cid and user_id = auth.uid() and is_admin)
$$;

drop policy if exists "conv read" on conversations;
drop policy if exists "conv insert" on conversations;
drop policy if exists "conv update" on conversations;
drop policy if exists "conv delete" on conversations;
create policy "conv read"   on conversations for select to authenticated using (public.is_member_of(id) or created_by = auth.uid());
create policy "conv insert" on conversations for insert to authenticated with check (created_by = auth.uid() and public.is_active());
create policy "conv update" on conversations for update to authenticated using (public.is_conv_admin(id) or public.is_admin());
create policy "conv delete" on conversations for delete to authenticated using (public.is_conv_admin(id) or public.is_admin());

-- Pinning keeps the rest of the row read-only for group admins too.
create or replace function public.conv_guard_pin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and (new.pinned_message_id is distinct from old.pinned_message_id) and not public.is_intl() then
    new.pinned_message_id := old.pinned_message_id;
    new.pinned_by := old.pinned_by;
  end if;
  return new;
end $$;
drop trigger if exists conv_guard_pin on conversations;
create trigger conv_guard_pin before update on conversations for each row execute function public.conv_guard_pin();

drop policy if exists "cm read" on conversation_members;
drop policy if exists "cm insert" on conversation_members;
drop policy if exists "cm update self" on conversation_members;
drop policy if exists "cm update admin" on conversation_members;
drop policy if exists "cm delete" on conversation_members;
create policy "cm read"   on conversation_members for select to authenticated using (public.is_member_of(conversation_id));
create policy "cm insert" on conversation_members for insert to authenticated with check (
  public.is_conv_admin(conversation_id) or exists(select 1 from conversations c where c.id = conversation_id and c.created_by = auth.uid())
);
create policy "cm update self"  on conversation_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cm update admin" on conversation_members for update to authenticated using (public.is_conv_admin(conversation_id));
create policy "cm delete" on conversation_members for delete to authenticated using (user_id = auth.uid() or public.is_conv_admin(conversation_id));

drop policy if exists "msg read" on messages;
drop policy if exists "msg insert" on messages;
drop policy if exists "msg update" on messages;
create policy "msg read"   on messages for select to authenticated using (public.is_member_of(conversation_id));
create policy "msg insert" on messages for insert to authenticated with check (sender_id = auth.uid() and public.is_member_of(conversation_id));
create policy "msg update" on messages for update to authenticated using (sender_id = auth.uid());

create or replace function public.pin_message(cid uuid, mid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_intl() or not public.is_member_of(cid) then raise exception 'only Uluslararası Büro can pin'; end if;
  if mid is not null and not exists(select 1 from messages where id = mid and conversation_id = cid) then raise exception 'bad message'; end if;
  update conversations set pinned_message_id = mid, pinned_by = case when mid is null then null else auth.uid() end where id = cid;
end $$;

create or replace function public.open_dm(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if not public.is_active() then raise exception 'inactive'; end if;
  select c.id into cid from conversations c
   where c.type = 'dm'
     and exists(select 1 from conversation_members m where m.conversation_id = c.id and m.user_id = auth.uid())
     and exists(select 1 from conversation_members m where m.conversation_id = c.id and m.user_id = other)
   limit 1;
  if cid is null then
    insert into conversations (type, created_by) values ('dm', auth.uid()) returning id into cid;
    insert into conversation_members (conversation_id, user_id) values (cid, auth.uid()), (cid, other);
  end if;
  return cid;
end $$;

create or replace function public.my_conversations()
returns table(id uuid, type text, name text, avatar_url text, last_message_at timestamptz, unread bigint, mentioned boolean,
              muted boolean, last_content text, last_kind text, last_sender uuid, other_id uuid, other_last_read timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.type, c.name, c.avatar_url, c.last_message_at,
         (select count(*) from messages x where x.conversation_id = c.id and x.created_at > me.last_read_at
            and x.sender_id is distinct from auth.uid() and x.kind <> 'system' and x.deleted_at is null),
         exists(select 1 from messages x where x.conversation_id = c.id and x.created_at > me.last_read_at and auth.uid() = any(x.mentions)),
         me.muted, lm.content, lm.kind, lm.sender_id,
         o.user_id, o.last_read_at
    from conversations c
    join conversation_members me on me.conversation_id = c.id and me.user_id = auth.uid()
    left join lateral (select user_id, last_read_at from conversation_members m2
                        where m2.conversation_id = c.id and m2.user_id <> auth.uid() order by joined_at limit 1) o on c.type = 'dm'
    left join lateral (select content, kind, sender_id from messages m where m.conversation_id = c.id and m.deleted_at is null
                        order by created_at desc limit 1) lm on true
   order by c.last_message_at desc
$$;

-- Mark a conversation read and clear its bell entry in one call.
create or replace function public.mark_read(cid uuid) returns void
language sql security definer set search_path = public as $$
  update conversation_members set last_read_at = now() where conversation_id = cid and user_id = auth.uid();
  update notifications set read_at = now() where user_id = auth.uid() and group_key = 'conv:' || cid and read_at is null;
$$;

-- On every message: bump the conversation, give the sender a point, notify members.
create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  conv conversations;
  sender_name text;
  preview text;
begin
  select * into conv from conversations where id = new.conversation_id;
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  update conversation_members set last_read_at = new.created_at where conversation_id = new.conversation_id and user_id = new.sender_id;
  if new.kind = 'system' or new.sender_id is null then return null; end if;

  perform public.add_points(new.sender_id, 1);

  select full_name into sender_name from profiles where id = new.sender_id;
  preview := case new.kind
    when 'image' then '📷 Fotoğraf' when 'file' then '📎 ' || coalesce(new.attachment_name, 'Dosya')
    when 'audio' then '🎤 Sesli mesaj' when 'gif' then 'GIF' when 'poll' then '📊 ' || coalesce(new.content, 'Anket')
    else left(coalesce(new.content, ''), 140) end;

  -- one grouped bell entry per conversation and member (count = unread messages)
  insert into notifications (user_id, type, title, body, link, actor_id, group_key)
  select m.user_id, 'message',
         case when conv.type = 'group' then coalesce(conv.name, 'Grup') else sender_name end,
         case when conv.type = 'group' then sender_name || ': ' || preview else preview end,
         '/messages/' || conv.id, new.sender_id, 'conv:' || conv.id
    from conversation_members m
   where m.conversation_id = conv.id and m.user_id <> new.sender_id and not m.muted
     and public.wants(m.user_id, 'messages')
  on conflict (user_id, group_key) where group_key is not null do update
     set title = excluded.title, body = excluded.body, actor_id = excluded.actor_id, created_at = now(), pushed_at = null,
         count = case when notifications.read_at is null then notifications.count + 1 else 1 end, read_at = null;

  -- @mentions get their own entry (even in muted groups)
  insert into notifications (user_id, type, title, body, link, actor_id)
  select m.user_id, 'mention', sender_name || ' seni etiketledi', left(coalesce(new.content, ''), 140), '/messages/' || conv.id, new.sender_id
    from conversation_members m
   where m.conversation_id = conv.id and m.user_id = any(new.mentions) and m.user_id <> new.sender_id;
  return null;
end $$;
drop trigger if exists messages_after_insert on messages;
create trigger messages_after_insert after insert on messages for each row execute function public.messages_after_insert();

-- ── POLLS (feed posts and chat messages share the same tables) ─────────────
create table if not exists polls (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid unique references posts(id) on delete cascade,
  message_id uuid unique references messages(id) on delete cascade,
  question   text not null,
  multiple   boolean not null default false,
  check ((post_id is null) <> (message_id is null))
);
create table if not exists poll_options (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references polls(id) on delete cascade,
  label    text not null,
  position int not null default 0
);
create table if not exists poll_votes (
  poll_id   uuid not null references polls(id) on delete cascade,
  option_id uuid not null references poll_options(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  primary key (option_id, user_id)
);
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;

create or replace function public.can_see_poll(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from polls p where p.id = pid and (
    (p.post_id is not null and public.is_active())
    or (p.message_id is not null and exists(select 1 from messages m where m.id = p.message_id and public.is_member_of(m.conversation_id)))))
$$;
-- Uses the row's own columns: during INSERT … RETURNING the new poll is not yet visible to a sub-query.
create or replace function public.can_see_poll_parent(post uuid, msg uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (post is not null and public.is_active())
      or exists(select 1 from messages m where m.id = msg and public.is_member_of(m.conversation_id))
$$;
create or replace function public.owns_poll_parent(post uuid, msg uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from posts where id = post and author_id = auth.uid())
      or exists(select 1 from messages where id = msg and sender_id = auth.uid())
$$;
drop policy if exists "polls read" on polls;
drop policy if exists "polls insert" on polls;
drop policy if exists "options read" on poll_options;
drop policy if exists "options insert" on poll_options;
drop policy if exists "votes read" on poll_votes;
drop policy if exists "votes own" on poll_votes;
create policy "polls read"     on polls for select to authenticated using (public.can_see_poll_parent(post_id, message_id));
create policy "polls insert"   on polls for insert to authenticated with check (public.owns_poll_parent(post_id, message_id));
create policy "options read"   on poll_options for select to authenticated using (public.can_see_poll(poll_id));
create policy "options insert" on poll_options for insert to authenticated
  with check (exists(select 1 from polls p where p.id = poll_id and public.owns_poll_parent(p.post_id, p.message_id)));
create policy "votes read" on poll_votes for select to authenticated using (public.can_see_poll(poll_id));
create policy "votes own"  on poll_votes for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_see_poll(poll_id));

-- ── NOTIFICATION TRIGGERS ───────────────────────────────────────────────────
-- Görev: the assignee, or the whole station for "Tüm ekip".
create or replace function public.tasks_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor text;
begin
  if not (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id or new.assign_all is distinct from old.assign_all) then
    return null;
  end if;
  select full_name into actor from profiles where id = new.created_by;
  insert into notifications (user_id, type, title, body, link, actor_id)
  select p.id, 'task', 'Yeni görev', new.title || coalesce(' · ' || actor, ''), '/gorevler?open=' || new.id, new.created_by
    from profiles p
   where p.status = 'active' and p.id is distinct from auth.uid() and public.wants(p.id, 'tasks')
     and ((new.assign_all and p.station_id = new.station_id) or p.id = new.assignee_id);
  return null;
end $$;
drop trigger if exists tasks_notify on tasks;
create trigger tasks_notify after insert or update on tasks for each row execute function public.tasks_notify();

-- Etkinlik: members of the event's station (everyone when station is null).
create or replace function public.events_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, type, title, body, link, actor_id)
  select p.id, 'event', case when new.is_private then '🔒 Yeni etkinlik' else 'Yeni etkinlik' end,
         new.title || ' · ' || to_char(new.starts_at at time zone 'Europe/Paris', 'DD.MM HH24:MI'),
         '/agenda?event=' || new.id, new.created_by
    from profiles p
   where p.status = 'active' and p.id is distinct from new.created_by and public.wants(p.id, 'events')
     and (new.station_id is null or p.station_id = new.station_id);
  return null;
end $$;
drop trigger if exists events_notify on events;
create trigger events_notify after insert on events for each row execute function public.events_notify();

-- Yeni üye: everybody hears when a member is approved.
create or replace function public.members_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'active' and new.status = 'active' then
    insert into notifications (user_id, type, title, body, link, actor_id)
    select p.id, 'member', 'Yeni üye', new.full_name || ' aramıza katıldı 👋', '/annuaire?member=' || new.id, new.id
      from profiles p where p.status = 'active' and p.id <> new.id and public.wants(p.id, 'members');
  end if;
  return null;
end $$;
drop trigger if exists members_notify on profiles;
create trigger members_notify after update of status on profiles for each row execute function public.members_notify();

create or replace function public.comments_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; who text;
begin
  select author_id into owner from posts where id = new.post_id;
  select full_name into who from profiles where id = new.author_id;
  if owner is not null and owner <> new.author_id then
    insert into notifications (user_id, type, title, body, link, actor_id)
    values (owner, 'comment', who || ' yorum yaptı', left(new.content, 140), '/feed?post=' || new.post_id, new.author_id);
  end if;
  return null;
end $$;
drop trigger if exists comments_notify on post_comments;
create trigger comments_notify after insert on post_comments for each row execute function public.comments_notify();

-- ── POINTS & GRADES ─────────────────────────────────────────────────────────
-- The more active a member is, the higher they climb:
--   görev completed +10 · event created +5 · post +3 · story +2 · comment +2
--   like +1 · poll vote +1 · task comment +1 · message +1
-- Every rule works both ways (unlike, deleted post, reopened task…) so points cannot be farmed.
create or replace function public.points_for_post() returns trigger language plpgsql security definer set search_path = public as $$
declare r posts := case when tg_op = 'DELETE' then old else new end;
begin
  perform public.add_points(r.author_id, (case when r.kind = 'welcome' then 0 else 3 end) * (case when tg_op = 'DELETE' then -1 else 1 end));
  return null;
end $$;
drop trigger if exists points_post on posts;
create trigger points_post after insert or delete on posts for each row execute function public.points_for_post();

create or replace function public.points_simple() returns trigger language plpgsql security definer set search_path = public as $$
declare row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
begin
  perform public.add_points(
    coalesce(row->>'author_id', row->>'created_by', row->>'user_id')::uuid,
    (case tg_table_name when 'post_comments' then 2 when 'stories' then 2 when 'events' then 5 else 1 end)
      * (case when tg_op = 'DELETE' then -1 else 1 end));
  return null;
end $$;
drop trigger if exists points_comment on post_comments;
drop trigger if exists points_like on post_likes;
drop trigger if exists points_story on stories;
drop trigger if exists points_event on events;
drop trigger if exists points_vote on poll_votes;
drop trigger if exists points_tcomment on task_comments;
create trigger points_comment after insert or delete on post_comments for each row execute function public.points_simple();
create trigger points_like after insert or delete on post_likes    for each row execute function public.points_simple();
create trigger points_story after insert or delete on stories       for each row execute function public.points_simple();
create trigger points_event after insert or delete on events        for each row execute function public.points_simple();
create trigger points_vote after insert or delete on poll_votes    for each row execute function public.points_simple();
create trigger points_tcomment after insert or delete on task_comments for each row execute function public.points_simple();

-- A finished görev rewards its assignee ("Tüm ekip" tasks: shared, no individual points).
create or replace function public.points_task_done() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'done' and old.status <> 'done' then
    perform public.add_points(new.assignee_id, 10);
  elsif old.status = 'done' and new.status <> 'done' then
    perform public.add_points(old.assignee_id, -10);
  end if;
  return null;
end $$;
drop trigger if exists points_task on tasks;
create trigger points_task after update of status on tasks for each row execute function public.points_task_done();

-- Recomputes everyone's score from the data (run at the end of this script).
create or replace function public.recompute_points() returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('ysa.trusted', 'on', true);
  update profiles p set points =
      (select count(*) from messages m where m.sender_id = p.id and m.kind <> 'system')
    + (select count(*) * 3 from posts x where x.author_id = p.id and x.kind <> 'welcome')
    + (select count(*) * 2 from post_comments x where x.author_id = p.id)
    + (select count(*) from post_likes x where x.user_id = p.id)
    + (select count(*) * 2 from stories x where x.author_id = p.id)
    + (select count(*) * 5 from events x where x.created_by = p.id)
    + (select count(*) from poll_votes x where x.user_id = p.id)
    + (select count(*) from task_comments x where x.author_id = p.id)
    + (select count(*) * 10 from tasks x where x.status = 'done' and x.assignee_id = p.id)
  where true;   -- Supabase's safeupdate refuses an UPDATE without WHERE
  perform set_config('ysa.trusted', 'off', true);
end $$;
create or replace function public.member_rank(uid uuid) returns table(points int, rank bigint, total bigint)
language sql stable security definer set search_path = public as $$
  select p.points,
         (select count(*) + 1 from profiles q where q.status = 'active' and q.points > p.points),
         (select count(*) from profiles q where q.status = 'active')
    from profiles p where p.id = uid and public.is_active()
$$;

-- ── STORAGE ─────────────────────────────────────────────────────────────────
-- media: public (avatars, images, stories, voice notes, group pictures)
-- files: private PDFs & documents — "<conversation id>/…" for chats, "feed/…" for posts.
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit) values ('files', 'files', false, 26214400) on conflict (id) do nothing;

drop policy if exists "media read" on storage.objects;
drop policy if exists "media write" on storage.objects;
drop policy if exists "media delete" on storage.objects;
drop policy if exists "files read" on storage.objects;
drop policy if exists "files write" on storage.objects;
drop policy if exists "files delete" on storage.objects;
create policy "media read"   on storage.objects for select using (bucket_id = 'media');
create policy "media write"  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create or replace function public.can_access_file(path text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare top text := split_part(path, '/', 1);
begin
  if not public.is_active() then return false; end if;
  if top = 'feed' then return true; end if;
  return top ~ '^[0-9a-f-]{36}$' and public.is_member_of(top::uuid);
end $$;
create policy "files read"   on storage.objects for select to authenticated using (bucket_id = 'files' and public.can_access_file(name));
create policy "files write"  on storage.objects for insert to authenticated with check (bucket_id = 'files' and public.can_access_file(name));
create policy "files delete" on storage.objects for delete to authenticated using (bucket_id = 'files' and (owner = auth.uid() or public.is_admin()));

-- ── REALTIME ────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['profiles', 'notifications', 'posts', 'post_likes', 'post_comments', 'poll_votes', 'stories',
                           'events', 'tasks', 'task_comments', 'conversations', 'conversation_members', 'messages']
  loop
    begin execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- Keep scores consistent with the data every time this script runs.
select public.recompute_points();
