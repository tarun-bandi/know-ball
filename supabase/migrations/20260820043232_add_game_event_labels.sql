alter table public.games
  add column if not exists event_label text;

comment on column public.games.event_label is
  'Human-readable event context supplied by the data provider, such as 2017 NBA Finals · Game 5.';
