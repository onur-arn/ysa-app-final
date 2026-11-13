-- Feed "@": no picker any more. The post text is read at publish time and every
-- "@Ad Soyad", "@İstasyon" or "@Başkanlar" (any case, with or without Turkish
-- letters) is resolved against today's members, stations and groups.
-- Same rules as lib/mentions.ts.
create or replace function public.mention_norm(t text) returns text
language sql immutable set search_path = public as $$
  select lower(translate(coalesce(t, ''), 'İIıŞşĞğÇçÖöÜüÂâÎîÛû', 'iiissggccoouuaaiiuu'))
$$;

-- Same list as MENTION_GROUPS in lib/constants.ts.
create or replace function public.mention_group_labels() returns table(id text, label text)
language sql immutable set search_path = public as $$
  values ('board', 'Yönetim Kurulu'), ('exec', 'Yürütme Kurulu'), ('Başkan', 'Başkanlar'), ('Sekreter', 'Sekreterler'),
         ('Sayman', 'Saymanlar'), ('Proje Direktörü', 'Proje Direktörleri'), ('Dış İlişkiler Direktörü', 'Dış İlişkiler Direktörleri'),
         ('İç İlişkiler Direktörü', 'İç İlişkiler Direktörleri'), ('Kurumsal İletişim Direktörü', 'Kurumsal İletişim Direktörleri')
$$;

-- true when the text holds "@label" as a whole tag
create or replace function public.has_mention(normed text, label text) returns boolean
language sql immutable set search_path = public as $$
  select normed ~ ('(^|[^[:alnum:]])@' || regexp_replace(public.mention_norm(label), '([.*+?^${}()|\[\]\\-])', '\\\1', 'g') || '($|[^[:alnum:]])')
$$;

create or replace function public.posts_resolve_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
declare n text := public.mention_norm(new.content);
begin
  if position('@' in n) = 0 then
    new.mentions := '{}'; new.mention_stations := '{}'; new.mention_groups := '{}';
    return new;
  end if;
  new.mentions := array(select p.id from profiles p where p.status = 'active' and p.full_name <> '' and public.has_mention(n, p.full_name));
  new.mention_stations := array(select s.id from stations s where public.has_mention(n, s.name));
  new.mention_groups := array(select g.id from public.mention_group_labels() g where public.has_mention(n, g.label));
  return new;
end $$;
drop trigger if exists posts_resolve_mentions on posts;
create trigger posts_resolve_mentions before insert or update of content on posts for each row execute function public.posts_resolve_mentions();
