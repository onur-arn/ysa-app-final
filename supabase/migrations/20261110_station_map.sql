-- Stations carry their own map position, so the Yönetici panel can add a new one
-- (Milano, Londra…) that shows up on the sign-up map. Safe to run twice.
begin;

alter table stations add column if not exists lat double precision;
alter table stations add column if not exists lng double precision;

update stations set lat = v.lat, lng = v.lng
from (values
  ('paris', 48.85, 2.35), ('caen', 49.18, -0.37), ('nancy', 48.69, 6.18), ('strasbourg', 48.57, 7.75),
  ('lyon', 45.75, 4.83), ('hamburg', 53.55, 10.0), ('bucarest', 44.43, 26.1)
) as v(id, lat, lng)
where stations.id = v.id and stations.lat is null;

commit;
