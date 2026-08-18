import { useQuery } from '@tanstack/react-query';
import type { BoxScore, Sport } from '@/types/database';

interface NflBoxScoreResponse {
  boxScores: BoxScore[];
  source: 'cache' | 'espn' | 'stale-cache';
}

async function fetchNflBoxScores(providerGameId: number): Promise<NflBoxScoreResponse> {
  const params = new URLSearchParams({ eventId: String(providerGameId) });
  const response = await fetch(`/api/game-stats/nfl?${params.toString()}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `NFL box score fetch failed (${response.status})`);
  return body as NflBoxScoreResponse;
}

export function useNflBoxScores(
  providerGameId: number | undefined,
  status: string | undefined,
  sport: Sport,
  cachedPlayerCount: number,
) {
  const needsRefresh = status === 'live' || cachedPlayerCount === 0;

  return useQuery({
    queryKey: ['nfl-box-score', providerGameId],
    queryFn: () => fetchNflBoxScores(providerGameId!),
    enabled: sport === 'nfl' && Boolean(providerGameId) && status !== 'scheduled' && needsRefresh,
    staleTime: status === 'live' ? 10_000 : Infinity,
    refetchInterval: status === 'live' ? 20_000 : false,
    retry: 1,
  });
}
