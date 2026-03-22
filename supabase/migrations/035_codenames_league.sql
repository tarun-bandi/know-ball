-- Add league setting to codenames rooms
ALTER TABLE codenames_rooms
  ADD COLUMN league text NOT NULL DEFAULT 'nba'
  CHECK (league IN ('nba', 'nfl'));
