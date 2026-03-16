alter table public.nlove_profiles
  add column if not exists relationship_goal text
  check (
    relationship_goal is null
    or relationship_goal in (
      'long_term',
      'long_term_open',
      'short_term',
      'new_friends',
      'still_figuring_out'
    )
  );

create index if not exists idx_nlove_profiles_relationship_goal
  on public.nlove_profiles (relationship_goal);
