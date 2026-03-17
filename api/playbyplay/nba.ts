import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { parseEspnPlayByPlayActions } from '../../lib/espnPlayByPlay';
import { resolveEspnNbaEventId } from '../../lib/espnGameResolver';

const ESPN_NBA_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary';

interface GameMeta {
  provider: string;
  provider_game_id: number;
  game_date_utc: string;
  home_team: { abbreviation: string } | null;
  away_team: { abbreviation: string } | null;
}

function parseIntParam(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const internalGameId = typeof req.query.gameId === 'string' ? req.query.gameId : null;
  const providerGameIdFromQuery = parseIntParam(
    typeof req.query.providerGameId === 'string' ? req.query.providerGameId : null,
  );
  const gameStatus = typeof req.query.status === 'string' ? req.query.status : null;
  const isLive = gameStatus === 'live';

  if (!internalGameId && !providerGameIdFromQuery) {
    return res.status(400).json({ error: 'Missing required query param: gameId or providerGameId' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase =
    supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

  let resolvedGameId: string | null = internalGameId;
  let resolvedProviderGameId: number | null = internalGameId ? null : providerGameIdFromQuery;
  let gameMeta: GameMeta | null = null;

  try {
    if (supabase) {
      if (resolvedGameId) {
        const { data } = await supabase
          .from('games')
          .select(`
            provider,
            provider_game_id,
            game_date_utc,
            home_team:teams!games_home_team_id_fkey (abbreviation),
            away_team:teams!games_away_team_id_fkey (abbreviation)
          `)
          .eq('id', resolvedGameId)
          .eq('sport', 'nba')
          .maybeSingle();

        gameMeta = (data as unknown as GameMeta | null) ?? null;
      } else if (providerGameIdFromQuery) {
        const { data } = await supabase
          .from('games')
          .select('id')
          .eq('provider', 'espn')
          .eq('provider_game_id', providerGameIdFromQuery)
          .eq('sport', 'nba')
          .maybeSingle();

        resolvedGameId = data?.id ?? null;
        resolvedProviderGameId = providerGameIdFromQuery;
      }

      if (!isLive) {
        let cacheQuery = supabase
          .from('game_play_by_play')
          .select('actions, provider_game_id')
          .eq('sport', 'nba')
          .limit(1);

        if (resolvedGameId) {
          cacheQuery = cacheQuery.eq('game_id', resolvedGameId);
        } else if (resolvedProviderGameId) {
          cacheQuery = cacheQuery.eq('provider_game_id', resolvedProviderGameId);
        }

        const { data: cachedRow } = await cacheQuery.maybeSingle();
        if (cachedRow) {
          const cachedActions = Array.isArray(cachedRow.actions) ? cachedRow.actions : [];
          res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
          return res.status(200).json({
            gameId: String(cachedRow?.provider_game_id ?? resolvedProviderGameId ?? ''),
            actions: cachedActions,
            source: 'cache',
          });
        }
      }

      if (!resolvedProviderGameId && gameMeta) {
        if (gameMeta.provider === 'espn') {
          resolvedProviderGameId = gameMeta.provider_game_id;
        } else {
          const homeAbbr = gameMeta.home_team?.abbreviation;
          const awayAbbr = gameMeta.away_team?.abbreviation;
          if (homeAbbr && awayAbbr) {
            resolvedProviderGameId = await resolveEspnNbaEventId(
              gameMeta.game_date_utc,
              homeAbbr,
              awayAbbr,
            );
          }
        }
      }
    } else if (!resolvedProviderGameId) {
      resolvedProviderGameId = providerGameIdFromQuery;
    }

    if (!resolvedProviderGameId) {
      return res.status(404).json({ error: 'Could not resolve ESPN event id for this game' });
    }

    const summaryRes = await fetch(`${ESPN_NBA_SUMMARY}?event=${resolvedProviderGameId}`, {
      headers: { 'User-Agent': 'know-ball/1.0' },
    });

    if (!summaryRes.ok) {
      return res.status(502).json({ error: `ESPN summary returned ${summaryRes.status}` });
    }

    const summaryJson = await summaryRes.json();
    const actions = parseEspnPlayByPlayActions(summaryJson);

    if (supabase && resolvedGameId) {
      await supabase
        .from('game_play_by_play')
        .upsert(
          {
            game_id: resolvedGameId,
            provider: 'espn',
            provider_game_id: resolvedProviderGameId,
            sport: 'nba',
            actions,
            action_count: actions.length,
            fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'game_id' },
        );
    }

    res.setHeader(
      'Cache-Control',
      isLive ? 's-maxage=20, stale-while-revalidate=30' : 's-maxage=300, stale-while-revalidate=3600',
    );
    return res.status(200).json({
      gameId: String(resolvedProviderGameId),
      actions,
      source: 'espn',
    });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch play-by-play data' });
  }
}
