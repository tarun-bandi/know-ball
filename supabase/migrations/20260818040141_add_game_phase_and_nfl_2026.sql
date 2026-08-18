-- Distinguish preseason, regular-season, and postseason games without
-- duplicating the parent season row for each phase.
CREATE TYPE public.game_phase AS ENUM ('preseason', 'regular', 'postseason');

ALTER TABLE public.games
  ADD COLUMN phase public.game_phase NOT NULL DEFAULT 'regular';

UPDATE public.games
SET phase = 'postseason'
WHERE postseason = true;

-- The 2026 NFL season begins with preseason in August. Previous seed logic
-- incorrectly treated January-August as part of the prior season.
INSERT INTO public.seasons (year, type, sport)
VALUES (2026, 'regular', 'nfl')
ON CONFLICT (sport, year) DO NOTHING;

UPDATE public.games
SET
  season_id = (
    SELECT id
    FROM public.seasons
    WHERE sport = 'nfl' AND year = 2026
  ),
  phase = CASE
    WHEN postseason THEN 'postseason'::public.game_phase
    WHEN game_date_utc < TIMESTAMPTZ '2026-09-01 00:00:00+00'
      THEN 'preseason'::public.game_phase
    ELSE 'regular'::public.game_phase
  END
WHERE sport = 'nfl'
  AND game_date_utc >= TIMESTAMPTZ '2026-07-01 00:00:00+00'
  AND game_date_utc < TIMESTAMPTZ '2027-03-01 00:00:00+00';

CREATE INDEX games_recent_sport_status_idx
  ON public.games (sport, status, game_date_utc DESC, id DESC);
