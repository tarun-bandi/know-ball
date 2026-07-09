-- Tournament-specific data for the 2026 World Cup hub.
-- Core teams, players, and games still live in the existing generic tables.

create table if not exists public.world_cup_match_metadata (
  game_id uuid primary key references public.games(id) on delete cascade,
  tournament_year integer not null default 2026,
  stage text not null,
  group_code text,
  matchday smallint,
  bracket_slot text,
  home_seed_label text,
  away_seed_label text,
  home_penalties smallint,
  away_penalties smallint,
  status_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_world_cup_match_metadata_year_stage
  on public.world_cup_match_metadata (tournament_year, stage);

create index if not exists idx_world_cup_match_metadata_group
  on public.world_cup_match_metadata (tournament_year, group_code);

create table if not exists public.world_cup_player_stats (
  id uuid primary key default gen_random_uuid(),
  tournament_year integer not null default 2026,
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  goals smallint not null default 0,
  assists smallint not null default 0,
  minutes smallint not null default 0,
  matches_played smallint not null default 0,
  penalties smallint not null default 0,
  clean_sheets smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_year, player_id)
);

create index if not exists idx_world_cup_player_stats_goals
  on public.world_cup_player_stats (tournament_year, goals desc, assists desc, minutes asc);
