import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeEspnNflBoxScore, type NflBoxScoreGameContext } from '../nflBoxScore';
import type { BoxScore } from '../../types/database';

const ESPN_NFL_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary';

export interface NflBoxScoreSyncGame extends NflBoxScoreGameContext {
  providerGameId: number;
}

export interface NflBoxScoreSyncResult {
  boxScores: BoxScore[];
  playerCount: number;
}

export async function fetchAndCacheNflBoxScore(
  supabase: SupabaseClient<any>,
  game: NflBoxScoreSyncGame,
): Promise<NflBoxScoreSyncResult> {
  const upstream = await fetch(`${ESPN_NFL_SUMMARY}?event=${game.providerGameId}`);

  if (!upstream.ok) {
    throw new Error(`ESPN NFL summary returned ${upstream.status}`);
  }

  const rows = normalizeEspnNflBoxScore(await upstream.json(), game);
  if (rows.length === 0) {
    return { boxScores: [], playerCount: 0 };
  }

  const { data, error } = await supabase
    .from('box_scores')
    .upsert(rows, { onConflict: 'game_id,team_id,player_name' })
    .select('*');

  if (error) {
    throw new Error(`NFL box score cache failed: ${error.message}`);
  }

  return {
    boxScores: (data ?? []) as BoxScore[],
    playerCount: rows.length,
  };
}
