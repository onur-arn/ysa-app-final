-- Eğitim Koordinatörü and AB Projeler Sorumlusu join the Yürütme Kurulu as positions that only
-- exist in Uluslararası Büro. Checked only when a station or position changes. Safe to run twice.
begin;

create or replace function public.guard_executive_position() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.position in ('Eğitim Koordinatörü', 'Avrupa Birliği Projeler Sorumlusu',
                      'İnovasyon ve Girişimcilik Proje Direktörü', 'Kültür ve Sanat Proje Direktörü', 'Gençlik ve Çevre Proje Direktörü',
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
