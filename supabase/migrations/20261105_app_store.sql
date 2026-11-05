-- App Store release: member blocking (guideline 1.2) and APNs device tokens.
-- Only adds to the production database. Safe to run twice. Paste in Supabase → SQL Editor.
begin;

create table if not exists user_blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on user_blocks(blocked_id);
alter table user_blocks enable row level security;
drop policy if exists "blocks read" on user_blocks;
drop policy if exists "blocks insert" on user_blocks;
drop policy if exists "blocks delete" on user_blocks;
create policy "blocks read"   on user_blocks for select to authenticated using (blocker_id = auth.uid());
create policy "blocks insert" on user_blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "blocks delete" on user_blocks for delete to authenticated using (blocker_id = auth.uid());

create or replace function public.has_blocked(author uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from user_blocks where blocker_id = auth.uid() and blocked_id = author)
$$;


create table if not exists device_tokens (
  token      text primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists device_tokens_user_idx on device_tokens(user_id);
alter table device_tokens enable row level security;


create or replace function public.dm_blocked(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from conversations c
      join conversation_members o on o.conversation_id = c.id and o.user_id <> auth.uid()
      join user_blocks u on (u.blocker_id = auth.uid() and u.blocked_id = o.user_id)
                         or (u.blocker_id = o.user_id and u.blocked_id = auth.uid())
     where c.id = cid and c.type = 'dm')
$$;


drop policy if exists "posts read" on posts;
create policy "posts read"   on posts for select to authenticated using (public.is_active() and not public.has_blocked(author_id));
drop policy if exists "pcomments read" on post_comments;
create policy "pcomments read"   on post_comments for select to authenticated using (public.is_active() and not public.has_blocked(author_id));
drop policy if exists "stories read" on stories;
create policy "stories read"   on stories for select to authenticated using (public.is_active() and expires_at > now() and not public.has_blocked(author_id));
drop policy if exists "tcomments read" on task_comments;
create policy "tcomments read" on task_comments for select to authenticated
  using (not public.has_blocked(author_id) and exists(select 1 from tasks t where t.id = task_id and public.can_see_task(t.station_id, t.assignee_id, t.created_by)));
drop policy if exists "msg read" on messages;
create policy "msg read"   on messages for select to authenticated using ((public.is_member_of(conversation_id) and not public.has_blocked(sender_id)) or public.can_review_conversation(conversation_id));
drop policy if exists "msg insert" on messages;
create policy "msg insert" on messages for insert to authenticated with check (sender_id = auth.uid() and public.is_member_of(conversation_id) and not public.dm_blocked(conversation_id));

create or replace function public.open_dm(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if not public.is_active() then raise exception 'inactive'; end if;
  if exists(select 1 from user_blocks where (blocker_id = auth.uid() and blocked_id = other) or (blocker_id = other and blocked_id = auth.uid())) then
    raise exception 'blocked';
  end if;
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
            and x.sender_id is distinct from auth.uid() and x.kind <> 'system' and x.deleted_at is null
            and not public.has_blocked(x.sender_id)),
         exists(select 1 from messages x where x.conversation_id = c.id and x.created_at > me.last_read_at and auth.uid() = any(x.mentions)),
         me.muted, lm.content, lm.kind, lm.sender_id,
         o.user_id, o.last_read_at
    from conversations c
    join conversation_members me on me.conversation_id = c.id and me.user_id = auth.uid()
    left join lateral (select user_id, last_read_at from conversation_members m2
                        where m2.conversation_id = c.id and m2.user_id <> auth.uid() order by joined_at limit 1) o on c.type = 'dm'
    left join lateral (select content, kind, sender_id from messages m where m.conversation_id = c.id and m.deleted_at is null
                          and not public.has_blocked(m.sender_id)
                        order by created_at desc limit 1) lm on true
   order by c.last_message_at desc
$$;

create or replace function public.skip_blocked_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.actor_id is not null and exists(select 1 from user_blocks where blocker_id = new.user_id and blocked_id = new.actor_id) then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists skip_blocked_notification on notifications;
drop trigger if exists skip_blocked_notification on notifications;
create trigger skip_blocked_notification before insert on notifications for each row execute function public.skip_blocked_notification();

commit;
