-- Codenames multiplayer tables
-- Room statuses: lobby, playing, finished

-- Helper function to generate unique room codes
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no I/O/0/1
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM codenames_rooms WHERE codenames_rooms.code = code AND status != 'finished') THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- Rooms table
CREATE TABLE codenames_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'finished')),
  first_team text CHECK (first_team IN ('red', 'blue')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Players table
CREATE TABLE codenames_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES codenames_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  display_name text,
  avatar_url text,
  team text CHECK (team IN ('red', 'blue')),
  role text CHECK (role IN ('spymaster', 'guesser')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

-- Game state (one row per game, JSONB for cards)
CREATE TABLE codenames_game_state (
  room_id uuid PRIMARY KEY REFERENCES codenames_rooms(id) ON DELETE CASCADE,
  cards jsonb NOT NULL,
  current_team text NOT NULL CHECK (current_team IN ('red', 'blue')),
  phase text NOT NULL DEFAULT 'spymaster_clue' CHECK (phase IN ('spymaster_clue', 'guessing', 'game_over')),
  current_clue jsonb,
  guesses_remaining int NOT NULL DEFAULT 0,
  winner text CHECK (winner IN ('red', 'blue')),
  win_reason text CHECK (win_reason IN ('cards', 'assassin')),
  clue_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE codenames_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE codenames_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE codenames_game_state ENABLE ROW LEVEL SECURITY;

-- RLS policies for rooms
CREATE POLICY "Anyone can read rooms"
  ON codenames_rooms FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create rooms"
  ON codenames_rooms FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update room"
  ON codenames_rooms FOR UPDATE
  USING (auth.uid() = host_id);

-- RLS policies for players
CREATE POLICY "Anyone can read players"
  ON codenames_players FOR SELECT
  USING (true);

CREATE POLICY "Users can join rooms"
  ON codenames_players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own player"
  ON codenames_players FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
  ON codenames_players FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for game state
CREATE POLICY "Anyone can read game state"
  ON codenames_game_state FOR SELECT
  USING (true);

CREATE POLICY "Host can create game state"
  ON codenames_game_state FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM codenames_rooms
      WHERE id = room_id AND host_id = auth.uid()
    )
  );

CREATE POLICY "Room members can update game state"
  ON codenames_game_state FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM codenames_players
      WHERE codenames_players.room_id = codenames_game_state.room_id
        AND codenames_players.user_id = auth.uid()
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE codenames_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE codenames_players;
ALTER PUBLICATION supabase_realtime ADD TABLE codenames_game_state;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_codenames_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER codenames_rooms_updated_at
  BEFORE UPDATE ON codenames_rooms
  FOR EACH ROW EXECUTE FUNCTION update_codenames_updated_at();

CREATE TRIGGER codenames_game_state_updated_at
  BEFORE UPDATE ON codenames_game_state
  FOR EACH ROW EXECUTE FUNCTION update_codenames_updated_at();
