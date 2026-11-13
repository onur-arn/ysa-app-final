-- Görev: several assignees. assignee_ids is the list; assignee_id stays as its
-- first entry (kept in sync by tasks_before) for older code paths.
alter table tasks add column if not exists assignee_ids uuid[] not null default '{}';
update tasks set assignee_ids = array[assignee_id] where assignee_id is not null and cardinality(assignee_ids) = 0;

create or replace function public.tasks_before() returns trigger language plpgsql as $$
begin
  new.completed_at := case when new.status = 'done' then coalesce(new.completed_at, now()) else null end;
  if new.assign_all then
    new.assignee_ids := '{}';
  elsif tg_op = 'INSERT' then
    if cardinality(new.assignee_ids) = 0 and new.assignee_id is not null then new.assignee_ids := array[new.assignee_id]; end if;
  elsif new.assignee_ids is not distinct from old.assignee_ids and new.assignee_id is distinct from old.assignee_id then
    -- an older client writing assignee_id only, or a deleted profile (on delete set null)
    new.assignee_ids := case when new.assignee_id is null then array_remove(old.assignee_ids, old.assignee_id) else array[new.assignee_id] end;
  end if;
  new.assignee_ids := array(select u from unnest(new.assignee_ids) with ordinality as x(u, n) where u is not null group by u order by min(n));
  new.assignee_id := new.assignee_ids[1];
  return new;
end $$;

-- a deleted account leaves the assignee lists
create or replace function public.tasks_drop_assignee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update tasks set assignee_ids = array_remove(assignee_ids, old.id) where old.id = any(assignee_ids);
  return null;
end $$;
drop trigger if exists tasks_drop_assignee on profiles;
create trigger tasks_drop_assignee after delete on profiles for each row execute function public.tasks_drop_assignee();

-- Görev: every newly added assignee, or the whole station for "Tüm ekip".
create or replace function public.tasks_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor text;
begin
  if not (tg_op = 'INSERT' or new.assignee_ids is distinct from old.assignee_ids or new.assign_all is distinct from old.assign_all) then
    return null;
  end if;
  select full_name into actor from profiles where id = new.created_by;
  insert into notifications (user_id, type, title, body, link, actor_id)
  select p.id, 'task', 'Yeni görev', new.title || coalesce(' · ' || actor, ''), '/gorevler?open=' || new.id, new.created_by
    from profiles p
   where p.status = 'active' and p.id is distinct from auth.uid() and public.wants(p.id, 'tasks')
     and ((new.assign_all and p.station_id = new.station_id and (tg_op = 'INSERT' or not old.assign_all))
       or (p.id = any(new.assignee_ids) and (tg_op = 'INSERT' or not p.id = any(old.assignee_ids))));
  return null;
end $$;

-- A finished görev rewards each assignee ("Tüm ekip" tasks: shared, no individual points).
create or replace function public.points_task_done() returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if new.status = 'done' and old.status <> 'done' then
    foreach u in array new.assignee_ids loop perform public.add_points(u, 10); end loop;
  elsif old.status = 'done' and new.status <> 'done' then
    foreach u in array old.assignee_ids loop perform public.add_points(u, -10); end loop;
  end if;
  return null;
end $$;

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
    + (select count(*) * 10 from tasks x where x.status = 'done' and p.id = any(x.assignee_ids))
  where true;   -- Supabase's safeupdate refuses an UPDATE without WHERE
  perform set_config('ysa.trusted', 'off', true);
end $$;
