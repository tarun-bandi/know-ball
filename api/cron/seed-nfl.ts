import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { fetchAndCacheNflBoxScore, type NflBoxScoreSyncGame } from '../../lib/server/nflBoxScores';

const ESPN_NFL_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

const NFL_WEEK_TO_ROUND: Record<number, string> = {
  1: 'wild_card',
  2: 'divisional',
  3: 'conf_championship',
  4: 'super_bowl',
  5: 'super_bowl',
};

const BOX_SCORE_CONCURRENCY = 4;

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapStatus(status: any): 'scheduled' | 'live' | 'final' {
  const state = status?.type?.state;
  if (status?.type?.completed || state === 'post') return 'final';
  if (state === 'in') return 'live';
  return 'scheduled';
}

function formatEspnDate(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function getScoreboardDateRange(): string {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  start.setUTCDate(start.getUTCDate() - 14);
  end.setUTCDate(end.getUTCDate() + 7);
  return `${formatEspnDate(start)}-${formatEspnDate(end)}`;
}

function getCurrentNflSeasonYear(): number {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-indexed
  const year = now.getFullYear();
  // The new NFL year begins with preseason. Jan-Jun finishes the prior season;
  // Jul-Dec belongs to the current year's season.
  return month >= 7 ? year : year - 1;
}

function mapSeasonPhase(seasonType: number): 'preseason' | 'regular' | 'postseason' {
  if (seasonType === 1) return 'preseason';
  if (seasonType === 3) return 'postseason';
  return 'regular';
}

function parseScore(score: unknown): number | null {
  if (score == null || score === '') return null;
  const parsed = Number.parseInt(String(score), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// ─── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Load NFL team map: provider_team_id → internal UUID
    const { data: teams, error: teamsErr } = await supabase
      .from('teams')
      .select('id, provider_team_id, abbreviation')
      .eq('sport', 'nfl')
      .returns<{ id: string; provider_team_id: number; abbreviation: string }[]>();

    if (teamsErr) {
      return res.status(500).json({ error: `Failed to load NFL teams: ${teamsErr.message}` });
    }

    const teamIdMap = new Map<number, string>();
    const teamAbbreviationMap = new Map<number, string>();
    for (const row of teams ?? []) {
      teamIdMap.set(row.provider_team_id, row.id);
      teamAbbreviationMap.set(row.provider_team_id, row.abbreviation);
    }

    if (teamIdMap.size === 0) {
      return res.status(500).json({ error: 'No NFL teams in DB. Run NFL seed first.' });
    }

    // 2. Fetch this week's NFL games from ESPN. ESPN's season metadata is the
    // source of truth for both the season year and preseason/regular/postseason.
    const scoreboardUrl = new URL(`${ESPN_NFL_BASE}/scoreboard`);
    scoreboardUrl.searchParams.set('dates', getScoreboardDateRange());
    scoreboardUrl.searchParams.set('limit', '100');
    const espnRes = await fetch(scoreboardUrl, {
      headers: { 'User-Agent': 'know-ball/1.0' },
    });

    if (!espnRes.ok) {
      return res.status(502).json({ error: `ESPN API error ${espnRes.status}` });
    }

    const espnData = await espnRes.json();
    const events = espnData.events ?? [];

    if (events.length === 0) {
      return res.status(200).json({ message: 'No NFL games this week', upserted: 0 });
    }

    // 3. Ensure the season represented by ESPN exists.
    const seasonYear = events.find((event: any) => Number.isInteger(event.season?.year))
      ?.season.year ?? getCurrentNflSeasonYear();
    const { data: seasonData, error: seasonErr } = await supabase
      .from('seasons')
      .upsert({ year: seasonYear, type: 'regular', sport: 'nfl' }, { onConflict: 'sport,year' })
      .select('id')
      .returns<{ id: string }[]>()
      .single();

    if (seasonErr) {
      return res.status(500).json({ error: `Season upsert failed: ${seasonErr.message}` });
    }

    const seasonId = seasonData!.id;

    // 4. Map to DB rows
    const skipped: string[] = [];
    const boxScoreContextByEventId = new Map<number, Omit<NflBoxScoreSyncGame, 'id'>>();
    const rows = events.flatMap((event: any) => {
      const comp = event.competitions?.[0];
      if (!comp) return [];

      const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
      const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
      if (!home || !away) return [];

      const homeTeamId = teamIdMap.get(parseInt(home.team.id, 10));
      const awayTeamId = teamIdMap.get(parseInt(away.team.id, 10));

      if (!homeTeamId || !awayTeamId) {
        skipped.push(event.id);
        return [];
      }

      const phase = mapSeasonPhase(event.season?.type ?? comp.season?.type ?? 2);
      const isPostseason = phase === 'postseason';
      const weekNumber: number = event.week?.number ?? 0;
      const playoffRound = isPostseason ? (NFL_WEEK_TO_ROUND[weekNumber] ?? null) : null;

      // Extract broadcast info
      const broadcast: string | null =
        comp.geoBroadcasts?.[0]?.media?.shortName ??
        comp.broadcasts?.[0]?.names?.[0] ??
        null;

      // Extract team records
      const homeRecord: string | null = home.records?.[0]?.summary ?? null;
      const awayRecord: string | null = away.records?.[0]?.summary ?? null;

      const providerGameId = parseInt(event.id, 10);
      boxScoreContextByEventId.set(providerGameId, {
        providerGameId,
        homeTeamId,
        awayTeamId,
        homeTeamAbbreviation: teamAbbreviationMap.get(parseInt(home.team.id, 10)) ?? home.team.abbreviation,
        awayTeamAbbreviation: teamAbbreviationMap.get(parseInt(away.team.id, 10)) ?? away.team.abbreviation,
      });

      return [{
        provider: 'espn' as const,
        provider_game_id: providerGameId,
        season_id: seasonId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_team_score: parseScore(home.score),
        away_team_score: parseScore(away.score),
        game_date_utc: new Date(event.date).toISOString(),
        status: mapStatus(comp.status),
        period: comp.status?.period ?? null,
        time: comp.status?.displayClock ?? null,
        postseason: isPostseason,
        phase,
        playoff_round: playoffRound,
        sport: 'nfl' as const,
        week: weekNumber || null,
        broadcast,
        home_team_record: homeRecord,
        away_team_record: awayRecord,
      }];
    });

    // 5. Upsert
    let upsertedGames: Array<{
      id: string;
      provider_game_id: number;
      status: 'scheduled' | 'live' | 'final';
    }> = [];
    if (rows.length > 0) {
      const { data: upsertedData, error: upsertErr } = await supabase
        .from('games')
        .upsert(rows, { onConflict: 'provider,provider_game_id' })
        .select('id, provider_game_id, status');

      if (upsertErr) {
        return res.status(500).json({ error: `Games upsert failed: ${upsertErr.message}` });
      }
      upsertedGames = (upsertedData ?? []) as typeof upsertedGames;
    }

    // 6. Cache player box scores for newly completed games. This shares the
    // same daily cron as schedule ingestion so Hobby deployments stay within
    // Vercel's two-cron limit.
    const finalGames = upsertedGames.filter((game) => game.status === 'final');
    const finalGameIds = finalGames.map((game) => game.id);
    const existingGameIds = new Set<string>();

    if (finalGameIds.length > 0) {
      const { data: existingBoxScores, error: existingError } = await supabase
        .from('box_scores')
        .select('game_id')
        .in('game_id', finalGameIds);
      if (existingError) {
        console.warn(`Failed to inspect NFL box score cache: ${existingError.message}`);
      } else {
        for (const row of existingBoxScores ?? []) existingGameIds.add(row.game_id);
      }
    }

    const gamesToCache = finalGames.flatMap((game) => {
      if (existingGameIds.has(game.id)) return [];
      const context = boxScoreContextByEventId.get(game.provider_game_id);
      return context ? [{ ...context, id: game.id }] : [];
    });

    let cachedGames = 0;
    let cachedPlayers = 0;
    let boxScoreFailures = 0;
    for (let index = 0; index < gamesToCache.length; index += BOX_SCORE_CONCURRENCY) {
      const batch = gamesToCache.slice(index, index + BOX_SCORE_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((game) => fetchAndCacheNflBoxScore(supabase, game)),
      );
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.playerCount > 0) {
          cachedGames += 1;
          cachedPlayers += result.value.playerCount;
        } else if (result.status === 'rejected') {
          boxScoreFailures += 1;
          console.warn(`NFL box score sync failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
        }
      }
    }

    return res.status(200).json({
      message: 'OK',
      season: seasonYear,
      upserted: rows.length,
      skipped: skipped.length,
      boxScores: {
        games: cachedGames,
        players: cachedPlayers,
        failed: boxScoreFailures,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? 'Unknown error' });
  }
}
