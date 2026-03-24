-- Allow 'mixed' league mode for codenames rooms (NBA + NFL combined)
ALTER TABLE codenames_rooms
  DROP CONSTRAINT IF EXISTS codenames_rooms_league_check;

ALTER TABLE codenames_rooms
  ADD CONSTRAINT codenames_rooms_league_check CHECK (league IN ('nba', 'nfl', 'mixed'));
