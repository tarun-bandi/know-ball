-- Migration 029: Persist per-game play-by-play payloads

create table if not exists public.game_play_by_play (
  game_id uuid primary key references public.games(id) on delete cascade,
  provider text not null default 'espn',
  provider_game_id integer not null,
  sport text not null default 'nba',
  actions jsonb not null default '[]'::jsonb,
  action_count integer not null default 0,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_game_id, sport)
);

create index if not exists game_play_by_play_provider_idx
  on public.game_play_by_play (provider, provider_game_id, sport);

alter table public.game_play_by_play enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'game_play_by_play'
      and policyname = 'Play-by-play is viewable by everyone'
  ) then
    create policy "Play-by-play is viewable by everyone"
      on public.game_play_by_play for select using (true);
  end if;
end $$;
