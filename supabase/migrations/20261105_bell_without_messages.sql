-- The bell no longer shows chat messages, so they must not push other notifications out
-- of the 5 kept per member. Only replaces one function. Safe to run twice.
create or replace function public.cap_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- chat entries (one per conversation) stay out of the count: they never show in the bell
  delete from notifications n
   where n.user_id = new.user_id
     and n.type <> 'message'
     and n.id not in (
       select id from notifications where user_id = new.user_id and type <> 'message' order by created_at desc limit 5
     );
  return null;
end $$;
