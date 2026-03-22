import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchGameState } from '@/lib/codenamesApi';
import type { CodenamesGameState } from '@/types/database';

interface UseCodenamesGameResult {
  gameState: CodenamesGameState | null;
  isLoading: boolean;
}

export function useCodenamesGame(roomId: string | null): UseCodenamesGameResult {
  const [gameState, setGameState] = useState<CodenamesGameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    if (!roomId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const gs = await fetchGameState(roomId!);
      if (cancelled) return;
      setGameState(gs);
      setIsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [roomId]);

  // Realtime subscription
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`codenames-game-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'codenames_game_state', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'room_id' in payload.new) {
            setGameState(payload.new as CodenamesGameState);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return { gameState, isLoading };
}
