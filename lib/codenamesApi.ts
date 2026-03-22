import { supabase } from '@/lib/supabase';
import { generateBoard, processGuess, checkWinCondition } from '@/lib/codenamesEngine';
import type { CodenamesCard, Team } from '@/lib/codenamesEngine';
import type { CodenamesRoom, CodenamesPlayer, CodenamesGameState } from '@/types/database';

export interface GameStateCards {
  team: string;
  role: string;
  revealed: boolean;
}

export interface CluePayload {
  team: string;
  word: string;
  number: number;
}

/** Create a new room. Returns the room row. */
export async function createRoom(userId: string, displayName: string, avatarUrl?: string | null) {
  // Generate unique code
  const { data: code, error: codeError } = await supabase.rpc('generate_room_code');
  if (codeError || !code) throw new Error(codeError?.message ?? 'Failed to generate room code');

  const { data: room, error: roomError } = await supabase
    .from('codenames_rooms')
    .insert({ code, host_id: userId })
    .select()
    .single();
  if (roomError || !room) throw new Error(roomError?.message ?? 'Failed to create room');

  // Auto-join the host as a player
  const { error: joinError } = await supabase
    .from('codenames_players')
    .insert({ room_id: room.id, user_id: userId, display_name: displayName, avatar_url: avatarUrl });
  if (joinError) throw new Error(joinError.message);

  return room as CodenamesRoom;
}

/** Join an existing room by code. Returns the player row. */
export async function joinRoom(code: string, userId: string, displayName: string, avatarUrl?: string | null) {
  const { data: room, error: roomError } = await supabase
    .from('codenames_rooms')
    .select()
    .eq('code', code.toUpperCase())
    .eq('status', 'lobby')
    .single();
  if (roomError || !room) throw new Error('Room not found or game already started');

  const { data: player, error: joinError } = await supabase
    .from('codenames_players')
    .upsert(
      { room_id: room.id, user_id: userId, display_name: displayName, avatar_url: avatarUrl },
      { onConflict: 'room_id,user_id' }
    )
    .select()
    .single();
  if (joinError || !player) throw new Error(joinError?.message ?? 'Failed to join room');

  return { room: room as CodenamesRoom, player: player as CodenamesPlayer };
}

/** Update a player's team/role assignment. */
export async function updatePlayerAssignment(
  playerId: string,
  team: 'red' | 'blue' | null,
  role: 'spymaster' | 'guesser' | null,
) {
  const { error } = await supabase
    .from('codenames_players')
    .update({ team, role })
    .eq('id', playerId);
  if (error) throw new Error(error.message);
}

/** Host starts the game. Validates teams, generates board, creates game state. */
export async function startGame(roomId: string, firstTeam: Team) {
  // Validate: each team needs 1 spymaster + ≥1 guesser
  const { data: players, error: pError } = await supabase
    .from('codenames_players')
    .select()
    .eq('room_id', roomId);
  if (pError) throw new Error(pError.message);

  for (const t of ['red', 'blue'] as const) {
    const teamPlayers = (players ?? []).filter((p) => p.team === t);
    const spymasters = teamPlayers.filter((p) => p.role === 'spymaster');
    const guessers = teamPlayers.filter((p) => p.role === 'guesser');
    if (spymasters.length !== 1) throw new Error(`${t} team needs exactly 1 spymaster`);
    if (guessers.length < 1) throw new Error(`${t} team needs at least 1 guesser`);
  }

  const cards = generateBoard(firstTeam);
  const cardsJson = cards.map((c) => ({ team: c.team, role: c.role, revealed: c.revealed }));

  const { error: gsError } = await supabase
    .from('codenames_game_state')
    .insert({
      room_id: roomId,
      cards: cardsJson as any,
      current_team: firstTeam,
      phase: 'spymaster_clue',
      guesses_remaining: 0,
      clue_history: [] as any,
    });
  if (gsError) throw new Error(gsError.message);

  const { error: roomError } = await supabase
    .from('codenames_rooms')
    .update({ status: 'playing', first_team: firstTeam })
    .eq('id', roomId);
  if (roomError) throw new Error(roomError.message);
}

/** Spymaster submits a clue. */
export async function submitClue(roomId: string, word: string, number: number, team: Team) {
  const { data: gs, error: fetchError } = await supabase
    .from('codenames_game_state')
    .select()
    .eq('room_id', roomId)
    .single();
  if (fetchError || !gs) throw new Error('Game state not found');

  const clue: CluePayload = { team, word: word.toUpperCase(), number };
  const history = Array.isArray(gs.clue_history) ? gs.clue_history : [];

  const { error } = await supabase
    .from('codenames_game_state')
    .update({
      current_clue: clue as any,
      guesses_remaining: number + 1,
      phase: 'guessing',
      clue_history: [...history, clue] as any,
    })
    .eq('room_id', roomId)
    .eq('updated_at', gs.updated_at); // optimistic concurrency

  if (error) throw new Error(error.message);
}

/** Guesser reveals a card. Returns the outcome. */
export async function revealCard(roomId: string, cardIndex: number) {
  const { data: gs, error: fetchError } = await supabase
    .from('codenames_game_state')
    .select()
    .eq('room_id', roomId)
    .single();
  if (fetchError || !gs) throw new Error('Game state not found');

  const cards = gs.cards as unknown as GameStateCards[];
  if (cards[cardIndex].revealed) return null;

  const currentTeam = gs.current_team as Team;

  // Map to engine format for processing
  const engineCards: CodenamesCard[] = cards.map((c) => ({
    team: c.team as any,
    role: c.role as any,
    revealed: c.revealed,
  }));

  const outcome = processGuess(engineCards, cardIndex, currentTeam);

  // Mark card as revealed
  const newCards = cards.map((c, i) =>
    i === cardIndex ? { ...c, revealed: true } : c,
  );

  const updatedEngineCards = engineCards.map((c, i) =>
    i === cardIndex ? { ...c, revealed: true } : c,
  );

  let update: Record<string, any> = { cards: newCards as any };

  if (outcome === 'assassin') {
    const winner = currentTeam === 'red' ? 'blue' : 'red';
    update = { ...update, winner, win_reason: 'assassin', phase: 'game_over', guesses_remaining: 0 };
  } else {
    const winner = checkWinCondition(updatedEngineCards);
    if (winner) {
      update = { ...update, winner, win_reason: 'cards', phase: 'game_over', guesses_remaining: 0 };
    } else if (outcome === 'correct') {
      const remaining = gs.guesses_remaining - 1;
      if (remaining <= 0) {
        const nextTeam = currentTeam === 'red' ? 'blue' : 'red';
        update = { ...update, current_team: nextTeam, guesses_remaining: 0, current_clue: null, phase: 'spymaster_clue' };
      } else {
        update = { ...update, guesses_remaining: remaining };
      }
    } else {
      // wrong_team or neutral — turn ends
      const nextTeam = currentTeam === 'red' ? 'blue' : 'red';
      update = { ...update, current_team: nextTeam, guesses_remaining: 0, current_clue: null, phase: 'spymaster_clue' };
    }
  }

  const { error } = await supabase
    .from('codenames_game_state')
    .update(update)
    .eq('room_id', roomId)
    .eq('updated_at', gs.updated_at); // optimistic concurrency

  if (error) throw new Error(error.message);

  return outcome;
}

/** Guesser ends their team's turn early. */
export async function endTurn(roomId: string) {
  const { data: gs, error: fetchError } = await supabase
    .from('codenames_game_state')
    .select()
    .eq('room_id', roomId)
    .single();
  if (fetchError || !gs) throw new Error('Game state not found');

  const nextTeam = gs.current_team === 'red' ? 'blue' : 'red';

  const { error } = await supabase
    .from('codenames_game_state')
    .update({
      current_team: nextTeam,
      guesses_remaining: 0,
      current_clue: null,
      phase: 'spymaster_clue',
    })
    .eq('room_id', roomId)
    .eq('updated_at', gs.updated_at);

  if (error) throw new Error(error.message);
}

/** Reassign host to a different user. */
export async function reassignHost(roomId: string, newHostUserId: string) {
  const { error } = await supabase
    .from('codenames_rooms')
    .update({ host_id: newHostUserId })
    .eq('id', roomId);
  if (error) throw new Error(error.message);
}

/** Remove a player from a room by their user_id (used for stale cleanup). */
export async function removePlayer(roomId: string, userId: string) {
  const { error } = await supabase
    .from('codenames_players')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** Player leaves the room. */
export async function leaveRoom(roomId: string, userId: string) {
  const { error } = await supabase
    .from('codenames_players')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** Fetch room by code. */
export async function fetchRoomByCode(code: string) {
  const { data, error } = await supabase
    .from('codenames_rooms')
    .select()
    .eq('code', code.toUpperCase())
    .single();
  if (error) return null;
  return data as CodenamesRoom;
}

/** Fetch players for a room. */
export async function fetchPlayers(roomId: string) {
  const { data, error } = await supabase
    .from('codenames_players')
    .select()
    .eq('room_id', roomId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as CodenamesPlayer[];
}

/** Fetch game state for a room. */
export async function fetchGameState(roomId: string) {
  const { data, error } = await supabase
    .from('codenames_game_state')
    .select()
    .eq('room_id', roomId)
    .single();
  if (error) return null;
  return data as CodenamesGameState;
}
