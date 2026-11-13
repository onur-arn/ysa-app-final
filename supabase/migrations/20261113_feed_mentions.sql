-- Feed "@": a post can ping people, whole stations and position groups (Başkanlar…).
alter table posts add column if not exists mentions uuid[] not null default '{}';
alter table posts add column if not exists mention_stations text[] not null default '{}';
alter table posts add column if not exists mention_groups text[] not null default '{}';

-- Same list as MENTION_GROUPS in lib/constants.ts.
create or replace function public.mention_group_positions(g text) returns text[]
language sql immutable set search_path = public as $$
  select case g
    when 'board' then array['Başkan', 'Sekreter', 'Sayman', 'Proje Direktörü', 'Dış İlişkiler Direktörü', 'İç İlişkiler Direktörü',
                            'Kurumsal İletişim Direktörü', 'Eğitim Koordinatörü', 'Avrupa Birliği Projeler Sorumlusu']
    when 'exec' then array['İnovasyon ve Girişimcilik Proje Direktörü', 'Kültür ve Sanat Proje Direktörü', 'Gençlik ve Çevre Proje Direktörü',
                           'Dezavantajlı Gruplar ve Sosyal Dahil Etme Proje Direktörü', 'Demokratik Katılım Proje Direktörü', 'Gençlik Sağlığı Proje Direktörü']
    else array[g]
  end
$$;

-- Everyone pinged gets one "mention" notification (like chat @mentions, regardless of preferences).
create or replace function public.posts_mention_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; positions text[];
begin
  if cardinality(new.mentions) + cardinality(new.mention_stations) + cardinality(new.mention_groups) = 0 then return null; end if;
  select full_name into who from profiles where id = new.author_id;
  select coalesce(array_agg(x), '{}') into positions from unnest(new.mention_groups) g, unnest(public.mention_group_positions(g)) x;
  insert into notifications (user_id, type, title, body, link, actor_id)
  select p.id, 'mention', coalesce(who, 'YouthStation') || ' seni etiketledi', left(new.content, 140), '/feed?post=' || new.id, new.author_id
    from profiles p
   where p.status = 'active' and p.id is distinct from new.author_id
     and (p.id = any(new.mentions) or p.station_id = any(new.mention_stations) or p.position = any(positions));
  return null;
end $$;
drop trigger if exists posts_mention_notify on posts;
create trigger posts_mention_notify after insert on posts for each row execute function public.posts_mention_notify();
