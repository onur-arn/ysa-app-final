-- 27/11/2026 — Réactions sur les messages : 5 emojis au choix, une réaction par personne
-- (comme WhatsApp). Les ❤️ existants restent des ❤️. Peut être relancé sans risque.
alter table message_likes add column if not exists emoji text not null default '❤️';
do $$ begin
  alter table message_likes add constraint message_likes_emoji_check check (emoji in ('❤️', '👍', '😂', '😮', '🙏'));
exception when duplicate_object then null; end $$;

-- changing one's reaction = update of one's own row
drop policy if exists "mlikes update" on message_likes;
create policy "mlikes update" on message_likes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
