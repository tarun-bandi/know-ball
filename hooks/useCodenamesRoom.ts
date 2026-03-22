import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchPlayers } from '@/lib/codenamesApi';
import type { CodenamesRoom, CodenamesPlayer } from '@/types/database';

interface UseCodenamesRoomResult {
  room: CodenamesRoom | null;
  players: CodenamesPlayer[];
  isLoading: boolean;
  refetchPlayers: () => Promise<void>;
}

export function useCodenamesRoom(roomId: string | null): UseCodenamesRoomResult {
  const [room, setRoom] = useState<CodenamesRoom | null>(null);
  const [players, setPlayers] = useState<CodenamesPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlayers = useCallback(async () => {
    if (!roomId) return;
    try {
      const p = await fetchPlayers(roomId);
      setPlayers(p);
    } catch {}
  }, [roomId]);

  // Initial fetch
  useEffect(() => {
    if (!roomId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const [{ data: roomData }, playersData] = await Promise.all([
        supabase.from('codenames_rooms').select().eq('id', roomId!).single(),
        fetchPlayers(roomId!),
      ]);
      if (cancelled) return;
      if (roomData) setRoom(roomData as CodenamesRoom);
      setPlayers(playersData);
      setIsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [roomId]);

  // Realtime subscription
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`codenames-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'codenames_rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          setRoom(payload.new as CodenamesRoom);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'codenames_players', filter: `room_id=eq.${roomId}` },
        () => {
          // Refetch all players on any change (simplest approach for INSERT/UPDATE/DELETE)
          loadPlayers();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, loadPlayers]);

  return { room, players, isLoading, refetchPlayers: loadPlayers };
}
