alter table public.nlove_profiles
  add column if not exists superlike_credits integer not null default 0 check (superlike_credits >= 0);

create table if not exists public.nlove_superlike_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pack_id text not null,
  credits integer not null check (credits > 0),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'czk',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'canceled')),
  payment_provider text not null default 'stripe',
  payment_reference text,
  checkout_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nlove_superlike_orders_user_created
  on public.nlove_superlike_orders (user_id, created_at desc);

create index if not exists idx_nlove_superlike_orders_status
  on public.nlove_superlike_orders (status, created_at desc);

drop trigger if exists trg_nlove_superlike_orders_updated_at on public.nlove_superlike_orders;
create trigger trg_nlove_superlike_orders_updated_at
before update on public.nlove_superlike_orders
for each row
execute function public.nlove_set_updated_at();

create or replace function public.consume_superlike_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  update public.nlove_profiles
  set superlike_credits = superlike_credits - 1,
      updated_at = now()
  where user_id = p_user_id
    and superlike_credits > 0
  returning superlike_credits into v_remaining;

  if v_remaining is null then
    raise exception 'INSUFFICIENT_SUPERLIKE_CREDITS';
  end if;

  return v_remaining;
end;
$$;

alter table public.nlove_superlike_orders enable row level security;

drop policy if exists nlove_superlike_orders_select_own on public.nlove_superlike_orders;
drop policy if exists nlove_superlike_orders_insert_own on public.nlove_superlike_orders;

create policy nlove_superlike_orders_select_own
on public.nlove_superlike_orders
for select
to authenticated
using (user_id = auth.uid());

create policy nlove_superlike_orders_insert_own
on public.nlove_superlike_orders
for insert
to authenticated
with check (user_id = auth.uid());
