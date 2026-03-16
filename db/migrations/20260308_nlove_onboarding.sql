create table if not exists public.nlove_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  onboarding_completed boolean not null default false,
  gender_identity text,
  looking_for text[] not null default '{}',
  age_min integer not null default 18 check (age_min >= 18),
  age_max integer not null default 99 check (age_max >= age_min),
  max_distance_km integer not null default 30 check (max_distance_km >= 1 and max_distance_km <= 500),
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nlove_profiles_enabled_completed
  on public.nlove_profiles (enabled, onboarding_completed);

create index if not exists idx_nlove_profiles_gender
  on public.nlove_profiles (gender_identity);

create index if not exists idx_nlove_profiles_looking_for_gin
  on public.nlove_profiles using gin (looking_for);

create index if not exists idx_nlove_profiles_photos_gin
  on public.nlove_profiles using gin (photos);

drop trigger if exists trg_nlove_profiles_updated_at on public.nlove_profiles;
create trigger trg_nlove_profiles_updated_at
before update on public.nlove_profiles
for each row
execute function public.nlove_set_updated_at();
