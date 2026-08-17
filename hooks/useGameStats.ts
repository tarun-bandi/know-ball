import { useQuery } from '@tanstack/react-query';
import type { Sport } from '@/types/database';
import type { GameStatsResponse } from '@/types/gameStats';

async function fetchGameStats(providerGameId: number): Promise<GameStatsResponse> {
  const params = new URLSearchParams({ eventId: String(providerGameId) });
  const response = await fetch(`/api/game-stats/nba?${params.toString()}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Game stats fetch failed (${response.status})`);
  return body as GameStatsResponse;
}

export function useGameStats(
  providerGameId: number | undefined,
  status: string | undefined,
  sport: Sport,
) {
  return useQuery({
    queryKey: ['game-stats', sport, providerGameId],
    queryFn: () => fetchGameStats(providerGameId!),
    enabled: sport === 'nba' && Boolean(providerGameId) && status !== 'scheduled',
    staleTime: status === 'live' ? 0 : 6 * 60 * 60 * 1000,
    refetchInterval: status === 'live' ? 20_000 : false,
    retry: 2,
  });
}
