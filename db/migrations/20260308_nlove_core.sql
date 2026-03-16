create extension if not exists pgcrypto;

create table if not exists public.nlove_swipes (
  id uuid primary key default gen_random_uuid(),
  swiper_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('pass', 'like', 'superlike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nlove_swipes_no_self_check check (swiper_id <> target_id),
  constraint nlove_swipes_unique_pair unique (swiper_id, target_id)
);

create table if not exists public.nlove_matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  chat_id uuid references public.chats(id) on delete set null,
  constraint nlove_matches_no_self_check check (user_a <> user_b)
);

create unique index if not exists nlove_matches_unique_pair
  on public.nlove_matches (least(user_a::text, user_b::text), greatest(user_a::text, user_b::text));

create index if not exists idx_nlove_swipes_swiper_created
  on public.nlove_swipes (swiper_id, created_at desc);

create index if not exists idx_nlove_swipes_target_action
  on public.nlove_swipes (target_id, action, created_at desc);

create index if not exists idx_nlove_matches_user_a_created
  on public.nlove_matches (user_a, created_at desc);

create index if not exists idx_nlove_matches_user_b_created
  on public.nlove_matches (user_b, created_at desc);

create or replace function public.nlove_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_nlove_swipes_updated_at on public.nlove_swipes;
create trigger trg_nlove_swipes_updated_at
before update on public.nlove_swipes
for each row
execute function public.nlove_set_updated_at();
