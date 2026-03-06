-- Keep profiles.last_seen in sync without client heartbeat.
-- Run in Supabase SQL Editor.

create or replace function public.touch_profile_last_seen_from_chat_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set last_seen = now()
  where id = coalesce(new.sender_id, new.user_id);

  return new;
end;
$$;

drop trigger if exists trg_touch_profile_last_seen_chat_messages on public.chat_messages;
create trigger trg_touch_profile_last_seen_chat_messages
after insert on public.chat_messages
for each row
execute function public.touch_profile_last_seen_from_chat_messages();

create or replace function public.touch_profile_last_seen_from_chat_reads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set last_seen = now()
  where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_touch_profile_last_seen_chat_reads on public.chat_message_reads;
create trigger trg_touch_profile_last_seen_chat_reads
after insert or update on public.chat_message_reads
for each row
execute function public.touch_profile_last_seen_from_chat_reads();

create index if not exists idx_profiles_last_seen on public.profiles (last_seen desc);
