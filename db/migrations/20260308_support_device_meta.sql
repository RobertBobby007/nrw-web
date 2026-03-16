alter table public.support_messages
add column if not exists device_meta jsonb;

comment on column public.support_messages.device_meta is
'Client and server-detected device context attached to user support messages.';
