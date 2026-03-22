import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchPlayers, reassignHost, removePlayer } from '@/lib/codenamesApi';
import { useCodenamesMultiplayerStore } from '@/lib/store/codenamesMultiplayerStore';
import type { CodenamesRoom, CodenamesPlayer } from '@/types/database';

const STALE_TIMEOUT_MS = 60_000;

interface UseCodenamesRoomResult {
  room: CodenamesRoom | null;
  players: CodenamesPlayer[];
  isLoading: boolean;
  refetchPlayers: () => Promise<void>;
  onlineUserIds: Set<string>;
}

export function useCodenamesRoom(roomId: string | null): UseCodenamesRoomResult {
  const [room, setRoom] = useState<CodenamesRoom | null>(null);
  const [players, setPlayers] = useState<CodenamesPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const cleanupTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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

  // Realtime subscription + presence
  useEffect(() => {
    if (!roomId) return;

    const myUserId = useCodenamesMultiplayerStore.getState().myUserId;
    const myPlayerId = useCodenamesMultiplayerStore.getState().myPlayerId;

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
          loadPlayers();
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const userIds = new Set<string>();
        for (const key of Object.keys(state)) {
          for (const presence of state[key] as any[]) {
            if (presence.user_id) userIds.add(presence.user_id);
          }
        }
        setOnlineUserIds(userIds);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        for (const presence of leftPresences as any[]) {
          const leftUserId = presence.user_id as string | undefined;
          if (!leftUserId) continue;

          // Host rotation: if the leaving user is the host, pick a new one
          const currentRoom = useCodenamesMultiplayerStore.getState();
          const storeIsHost = currentRoom.isHost;

          // Check current presence state after the leave
          setTimeout(() => {
            const state = channel.presenceState();
            const stillOnlineIds = new Set<string>();
            for (const key of Object.keys(state)) {
              for (const p of state[key] as any[]) {
                if (p.user_id) stillOnlineIds.add(p.user_id);
              }
            }

            // If the left user is still in presence (reconnected quickly), skip
            if (stillOnlineIds.has(leftUserId)) return;

            // Host rotation check — get latest room state
            setRoom((currentRoomState) => {
              if (currentRoomState && leftUserId === currentRoomState.host_id) {
                const onlineOthers = Array.from(stillOnlineIds).filter((id) => id !== leftUserId);
                if (onlineOthers.length > 0) {
                  const newHost = onlineOthers[Math.floor(Math.random() * onlineOthers.length)];
                  reassignHost(roomId, newHost).catch(() => {});
                }
              }
              return currentRoomState;
            });

            // Stale player cleanup — only host runs this to avoid races
            if (storeIsHost) {
              // Clear any existing timer for this user
              const existing = cleanupTimers.current.get(leftUserId);
              if (existing) clearTimeout(existing);

              const timer = setTimeout(() => {
                // Check if they're still offline
                const finalState = channel.presenceState();
                const finalOnline = new Set<string>();
                for (const key of Object.keys(finalState)) {
                  for (const p of finalState[key] as any[]) {
                    if (p.user_id) finalOnline.add(p.user_id);
                  }
                }
                if (!finalOnline.has(leftUserId)) {
                  removePlayer(roomId, leftUserId).catch(() => {});
                }
                cleanupTimers.current.delete(leftUserId);
              }, STALE_TIMEOUT_MS);

              cleanupTimers.current.set(leftUserId, timer);
            }
          }, 500); // Small delay to let presence state settle
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // Cancel any pending cleanup timer for rejoining users
        for (const presence of newPresences as any[]) {
          const joinedUserId = presence.user_id as string | undefined;
          if (!joinedUserId) continue;
          const existing = cleanupTimers.current.get(joinedUserId);
          if (existing) {
            clearTimeout(existing);
            cleanupTimers.current.delete(joinedUserId);
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && myUserId) {
          await channel.track({ user_id: myUserId, player_id: myPlayerId });
        }
      });

    return () => {
      // Clear all cleanup timers
      for (const timer of cleanupTimers.current.values()) {
        clearTimeout(timer);
      }
      cleanupTimers.current.clear();
      supabase.removeChannel(channel);
    };
  }, [roomId, loadPlayers]);

  return { room, players, isLoading, refetchPlayers: loadPlayers, onlineUserIds };
}
