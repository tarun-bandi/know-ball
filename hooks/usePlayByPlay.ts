import { useQuery } from '@tanstack/react-query';
import type { Sport } from '@/types/database';

export interface PlayByPlayAction {
  actionNumber: number;
  clock: string;
  period: number;
  teamTricode: string;
  playerName: string;
  description: string;
  actionType: string;
  scoreHome: string;
  scoreAway: string;
  isFieldGoal: boolean;
  shotResult?: string;
}

interface PlayByPlayResponse {
  gameId: string;
  actions: PlayByPlayAction[];
  source?: 'cache' | 'espn';
}

async function fetchPlayByPlay(
  sport: Sport,
  gameId: string,
  providerGameId: number,
  status: string,
): Promise<PlayByPlayResponse> {
  const params = new URLSearchParams({
    gameId,
    providerGameId: String(providerGameId),
    status,
  });
  const res = await fetch(`/api/playbyplay/${sport}?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Play-by-play fetch failed (${res.status})`);
  }
  return res.json();
}

export function usePlayByPlay(
  gameId: string | undefined,
  providerGameId: number | undefined,
  gameStatus: string | undefined,
  sport: Sport = 'nba',
) {
  const isActiveGame = gameStatus === 'live' || gameStatus === 'final';

  return useQuery({
    queryKey: ['play-by-play', sport, gameId, providerGameId, gameStatus],
    queryFn: () => fetchPlayByPlay(sport, gameId!, providerGameId!, gameStatus!),
    enabled: !!gameId && !!providerGameId && isActiveGame,
    refetchInterval: gameStatus === 'live' ? 60_000 : false,
    staleTime: gameStatus === 'live' ? 0 : 5 * 60 * 1000,
  });
}
