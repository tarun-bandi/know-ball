import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { fetchAndCacheNflBoxScore } from '../../lib/server/nflBoxScores';
import type { BoxScore } from '../../types/database';

const ESPN_EVENT_ID = /^\d{6,20}$/;

interface NflGameRow {
  id: string;
  provider_game_id: number;
  status: 'scheduled' | 'live' | 'final';
  home_team_id: string;
  away_team_id: string;
  home_team: { abbreviation: string };
  away_team: { abbreviation: string };
}

function setCacheHeaders(res: VercelResponse, status: NflGameRow['status'], eventId: string) {
  const cacheControl = status === 'final'
    ? 'public, s-maxage=31536000, stale-while-revalidate=86400'
    : 'public, s-maxage=10, stale-while-revalidate=30';
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Vercel-CDN-Cache-Control', cacheControl);
  res.setHeader('Vercel-Cache-Tag', `nfl-game-${eventId}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : '';
  if (!ESPN_EVENT_ID.test(eventId)) {
    return res.status(400).json({ error: 'A valid ESPN eventId is required' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Missing Supabase server configuration' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const providerGameId = Number.parseInt(eventId, 10);

  const { data, error } = await supabase
    .from('games')
    .select(`
      id,
      provider_game_id,
      status,
      home_team_id,
      away_team_id,
      home_team:teams!games_home_team_id_fkey (abbreviation),
      away_team:teams!games_away_team_id_fkey (abbreviation)
    `)
    .eq('sport', 'nfl')
    .eq('provider', 'espn')
    .eq('provider_game_id', providerGameId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'NFL game not found' });

  const game = data as unknown as NflGameRow;
  const { data: cached, error: cacheError } = await supabase
    .from('box_scores')
    .select('*')
    .eq('game_id', game.id);

  if (cacheError) return res.status(500).json({ error: cacheError.message });

  const cachedBoxScores = (cached ?? []) as BoxScore[];
  if (game.status === 'final' && cachedBoxScores.length > 0) {
    setCacheHeaders(res, game.status, eventId);
    return res.status(200).json({ boxScores: cachedBoxScores, source: 'cache' });
  }

  if (game.status === 'scheduled') {
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(409).json({ error: 'Box score is not available before kickoff' });
  }

  try {
    const result = await fetchAndCacheNflBoxScore(supabase, {
      id: game.id,
      providerGameId,
      homeTeamId: game.home_team_id,
      awayTeamId: game.away_team_id,
      homeTeamAbbreviation: game.home_team.abbreviation,
      awayTeamAbbreviation: game.away_team.abbreviation,
    });

    if (result.boxScores.length === 0) {
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      return res.status(404).json({ error: 'ESPN has not published player stats for this game yet' });
    }

    setCacheHeaders(res, game.status, eventId);
    return res.status(200).json({ boxScores: result.boxScores, source: 'espn' });
  } catch (syncError) {
    if (cachedBoxScores.length > 0) {
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json({ boxScores: cachedBoxScores, source: 'stale-cache' });
    }
    console.error(JSON.stringify({
      event: 'espn_nfl_box_score_error',
      eventId,
      message: syncError instanceof Error ? syncError.message : String(syncError),
    }));
    return res.status(502).json({ error: 'Failed to load the NFL box score' });
  }
}
