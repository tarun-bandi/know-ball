-- Allow anonymous (logged-out) users to play codenames.
-- Drop FK constraints to auth.users so anonymous UUIDs can be used.
-- Open RLS policies to anon role.

-- Drop FKs to auth.users
ALTER TABLE codenames_rooms DROP CONSTRAINT IF EXISTS codenames_rooms_host_id_fkey;
ALTER TABLE codenames_players DROP CONSTRAINT IF EXISTS codenames_players_user_id_fkey;

-- Open RLS policies to include anon role
-- Rooms: anon can read, create, update
DROP POLICY IF EXISTS "Anyone can read rooms" ON codenames_rooms;
CREATE POLICY "Anyone can read rooms" ON codenames_rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create rooms" ON codenames_rooms;
CREATE POLICY "Anyone can create rooms" ON codenames_rooms FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Host can update room" ON codenames_rooms;
CREATE POLICY "Anyone can update own room" ON codenames_rooms FOR UPDATE USING (true);

-- Players: anon can read, insert, update, delete
DROP POLICY IF EXISTS "Anyone can read players" ON codenames_players;
CREATE POLICY "Anyone can read players" ON codenames_players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join rooms" ON codenames_players;
CREATE POLICY "Anyone can join rooms" ON codenames_players FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own player" ON codenames_players;
CREATE POLICY "Anyone can update players" ON codenames_players FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can leave rooms" ON codenames_players;
CREATE POLICY "Anyone can leave rooms" ON codenames_players FOR DELETE USING (true);

-- Game state: anon can read, insert, update
DROP POLICY IF EXISTS "Anyone can read game state" ON codenames_game_state;
CREATE POLICY "Anyone can read game state" ON codenames_game_state FOR SELECT USING (true);

DROP POLICY IF EXISTS "Host can create game state" ON codenames_game_state;
CREATE POLICY "Anyone can create game state" ON codenames_game_state FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Room members can update game state" ON codenames_game_state;
CREATE POLICY "Anyone can update game state" ON codenames_game_state FOR UPDATE USING (true);

-- Grant anon role execute on the RPC
GRANT EXECUTE ON FUNCTION public.generate_room_code() TO anon;
