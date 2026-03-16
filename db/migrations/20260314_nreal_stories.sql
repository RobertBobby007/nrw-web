create table if not exists public.nreal_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  caption text,
  views_count integer not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '24 hours'
);

create index if not exists nreal_stories_active_idx
  on public.nreal_stories (expires_at desc, created_at desc)
  where is_deleted = false;

create index if not exists nreal_stories_user_idx
  on public.nreal_stories (user_id, created_at desc);
