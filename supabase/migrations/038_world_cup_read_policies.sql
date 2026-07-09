alter table public.world_cup_match_metadata enable row level security;
alter table public.world_cup_player_stats enable row level security;

drop policy if exists "World Cup match metadata is viewable by everyone"
  on public.world_cup_match_metadata;
create policy "World Cup match metadata is viewable by everyone"
  on public.world_cup_match_metadata for select using (true);

drop policy if exists "World Cup player stats are viewable by everyone"
  on public.world_cup_player_stats;
create policy "World Cup player stats are viewable by everyone"
  on public.world_cup_player_stats for select using (true);
