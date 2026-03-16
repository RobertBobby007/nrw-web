alter table public.nlove_profiles
  add column if not exists age integer check (age is null or (age >= 18 and age <= 99));

create index if not exists idx_nlove_profiles_age on public.nlove_profiles (age);
