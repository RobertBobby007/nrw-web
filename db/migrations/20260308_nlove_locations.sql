alter table public.nlove_profiles
  add column if not exists location_sharing_enabled boolean not null default true,
  add column if not exists location_required_ack boolean not null default false;

create table if not exists public.nlove_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  geohash text not null,
  lat_approx numeric(9,6) not null,
  lng_approx numeric(9,6) not null,
  accuracy_m numeric(8,2),
  captured_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_nlove_locations_updated_at on public.nlove_locations (updated_at desc);
create index if not exists idx_nlove_locations_geohash on public.nlove_locations (geohash);
create index if not exists idx_nlove_locations_user_id on public.nlove_locations (user_id);

create index if not exists idx_nlove_profiles_location_sharing
  on public.nlove_profiles (location_sharing_enabled, onboarding_completed, enabled);

drop trigger if exists trg_nlove_locations_updated_at on public.nlove_locations;
create trigger trg_nlove_locations_updated_at
before update on public.nlove_locations
for each row
execute function public.nlove_set_updated_at();

alter table public.nlove_locations enable row level security;

-- Optional safety if table policy set is recreated repeatedly
DROP POLICY IF EXISTS nlove_locations_select_own ON public.nlove_locations;
DROP POLICY IF EXISTS nlove_locations_insert_own ON public.nlove_locations;
DROP POLICY IF EXISTS nlove_locations_update_own ON public.nlove_locations;
DROP POLICY IF EXISTS nlove_locations_delete_own ON public.nlove_locations;

create policy nlove_locations_select_own
on public.nlove_locations
for select
to authenticated
using (user_id = auth.uid());

create policy nlove_locations_insert_own
on public.nlove_locations
for insert
to authenticated
with check (user_id = auth.uid());

create policy nlove_locations_update_own
on public.nlove_locations
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy nlove_locations_delete_own
on public.nlove_locations
for delete
to authenticated
using (user_id = auth.uid());
