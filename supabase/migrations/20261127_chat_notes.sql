-- 27/11/2026 — Messagerie façon WhatsApp, notes partagées, notifications du fil.
-- À appliquer AVANT le déploiement. Peut être relancé sans risque.

-- ── 1. Messages et posts modifiables (« düzenlendi ») ─────────────────────────
alter table messages add column if not exists edited_at timestamptz;
alter table posts    add column if not exists edited_at timestamptz;

-- A sender may only change the text of a text message (or delete it): every other
-- column stays as it was, whatever the client sends.
create or replace function public.messages_guard_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  new.conversation_id := old.conversation_id;
  new.sender_id       := old.sender_id;
  new.kind            := old.kind;
  new.created_at      := old.created_at;
  new.reply_to        := old.reply_to;
  new.forwarded       := old.forwarded;
  if old.deleted_at is not null then return old; end if;
  if new.deleted_at is not null then
    -- deletion: the client clears content and attachment
    new.edited_at := old.edited_at;
    return new;
  end if;
  new.attachment_url  := old.attachment_url;
  new.attachment_name := old.attachment_name;
  new.attachment_size := old.attachment_size;
  if new.content is distinct from old.content then
    if old.kind <> 'text' or coalesce(btrim(new.content), '') = '' then
      new.content := old.content;
      new.mentions := old.mentions;
    else
      new.edited_at := now();
    end if;
  else
    new.mentions := old.mentions;
    new.edited_at := old.edited_at;
  end if;
  return new;
end $$;
drop trigger if exists messages_guard_update on messages;
create trigger messages_guard_update before update on messages for each row execute function public.messages_guard_update();

create or replace function public.posts_mark_edited() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.content is distinct from old.content then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  return new;
end $$;
drop trigger if exists posts_mark_edited on posts;
create trigger posts_mark_edited before update on posts for each row execute function public.posts_mark_edited();

-- ── 2. Messages importants (⭐ Yıldızlı mesajlar), propres à chaque membre ─────
create table if not exists message_stars (
  user_id    uuid not null references profiles(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
create index if not exists message_stars_msg_idx on message_stars(message_id);
alter table message_stars enable row level security;
drop policy if exists "stars own" on message_stars;
create policy "stars own" on message_stars for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists(select 1 from messages m where m.id = message_id and public.is_member_of(m.conversation_id)));

-- ── 3. Notes partagées entre stations ─────────────────────────────────────────
-- A note belongs to a station; its members, the stations it is shared with and
-- the Uluslararası Yönetim Kurulu can read and edit it. Misafir accounts cannot.
create table if not exists notes (
  id              uuid primary key default gen_random_uuid(),
  station_id      text not null references stations(id) on delete cascade,
  shared_stations text[] not null default '{}',
  title           text not null default '',
  content         text not null default '',
  color           text,
  pinned          boolean not null default false,
  created_by      uuid references profiles(id) on delete set null,
  updated_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists notes_station_idx on notes(station_id, updated_at desc);
alter table notes enable row level security;

create or replace function public.can_see_note(st text, shared text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active() and not public.is_guest()
     and (public.is_intl() or st = public.my_station() or public.my_station() = any(shared))
$$;
drop policy if exists "notes read" on notes;
drop policy if exists "notes insert" on notes;
drop policy if exists "notes update" on notes;
drop policy if exists "notes delete" on notes;
create policy "notes read"   on notes for select to authenticated using (public.can_see_note(station_id, shared_stations));
create policy "notes insert" on notes for insert to authenticated
  with check (created_by = auth.uid() and public.is_active() and not public.is_guest() and (public.is_intl() or station_id = public.my_station()));
create policy "notes update" on notes for update to authenticated using (public.can_see_note(station_id, shared_stations));
create policy "notes delete" on notes for delete to authenticated using (created_by = auth.uid() or public.is_board());

-- The owner station and the sharing list only change by the owner station (or intl).
create or replace function public.notes_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if auth.uid() is not null and not public.is_intl() and old.station_id is distinct from public.my_station() then
      new.station_id := old.station_id;
      new.shared_stations := old.shared_stations;
    end if;
  end if;
  new.shared_stations := array(select distinct s from unnest(new.shared_stations) s where s is not null and s <> new.station_id);
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
drop trigger if exists notes_before on notes;
create trigger notes_before before insert or update on notes for each row execute function public.notes_before();

-- Stations a note is newly shared with are told about it.
create or replace function public.notes_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; fresh text[];
begin
  fresh := array(select s from unnest(new.shared_stations) s
                  where tg_op = 'INSERT' or not (s = any(old.shared_stations)));
  if cardinality(fresh) = 0 then return null; end if;
  select full_name into who from profiles where id = auth.uid();
  insert into notifications (user_id, type, title, body, link, actor_id)
  select p.id, 'note', coalesce(who, 'YouthStation') || ' bir not paylaştı', left(coalesce(nullif(new.title, ''), new.content), 140),
         '/gorevler?tab=notes&note=' || new.id, auth.uid()
    from profiles p
   where p.status = 'active' and p.station_id = any(fresh) and p.id is distinct from auth.uid()
     and public.wants(p.id, 'tasks');
  return null;
end $$;
drop trigger if exists notes_notify on notes;
create trigger notes_notify after insert or update of shared_stations on notes for each row execute function public.notes_notify();

-- ── 4. Notifications : tout activé pour tous, et alerte à chaque nouveau post ──
alter table profiles alter column notif_prefs set default '{"messages": true, "tasks": true, "events": true, "members": true, "posts": true}';
update profiles set notif_prefs = '{"messages": true, "tasks": true, "events": true, "members": true, "posts": true}';
-- Group conversations muted in the past start ringing again too.
update conversation_members set muted = false where muted;

create or replace function public.posts_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if new.kind not in ('post', 'igem') or new.author_id is null then return null; end if;
  select full_name into who from profiles where id = new.author_id;
  insert into notifications (user_id, type, title, body, link, actor_id)
  select p.id, 'post', coalesce(who, 'YouthStation') || ' yeni bir gönderi paylaştı', left(new.content, 140), '/feed?post=' || new.id, new.author_id
    from profiles p
   where p.status = 'active' and p.id <> new.author_id
     and not (p.id = any(new.mentions))            -- the mentioned get their own "mention" alert
     and public.wants(p.id, 'posts');
  return null;
end $$;
drop trigger if exists posts_notify on posts;
create trigger posts_notify after insert on posts for each row execute function public.posts_notify();

-- ── 5. Temps réel ──────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['notes', 'message_stars'] loop
    begin execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
