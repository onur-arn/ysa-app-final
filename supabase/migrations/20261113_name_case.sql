-- "NOM", "nom" → "Nom" for first and last names, whatever is typed.
-- Same rules as formatName() in lib/names.ts (I/İ inside a word → i;
-- first letter: i/İ → İ, I/ı → I).
create or replace function public.format_name(raw text) returns text
language plpgsql immutable set search_path = public as $$
declare
  s text := regexp_replace(trim(coalesce(raw, '')), '\s+', ' ', 'g');
  out text := '';
  c text;
  cap boolean := true;
begin
  for i in 1..char_length(s) loop
    c := substr(s, i, 1);
    if cap and c ~ '[[:alpha:]]' then
      out := out || case c when 'i' then 'İ' when 'İ' then 'İ' when 'I' then 'I' when 'ı' then 'I' else upper(c) end;
      cap := false;
    else
      out := out || case c when 'I' then 'i' when 'İ' then 'i' else lower(c) end;
      if c in (' ', '-', '''', '’', '.') then cap := true; end if;
    end if;
  end loop;
  return out;
end $$;

create or replace function public.format_profile_names() returns trigger
language plpgsql set search_path = public as $$
begin
  new.first_name := public.format_name(new.first_name);
  new.last_name := public.format_name(new.last_name);
  return new;
end $$;

drop trigger if exists format_profile_names on profiles;
create trigger format_profile_names before insert or update of first_name, last_name on profiles
  for each row execute function public.format_profile_names();

-- members already signed up
update profiles set first_name = public.format_name(first_name), last_name = public.format_name(last_name)
where first_name is distinct from public.format_name(first_name) or last_name is distinct from public.format_name(last_name);
