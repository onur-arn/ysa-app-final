-- Messages transférés : affichés avec la mention « İletildi ».
alter table messages add column if not exists forwarded boolean not null default false;
