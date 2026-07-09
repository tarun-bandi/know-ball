import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ESPN_WORLD_CUP_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const PROVIDER = 'espn_world_cup';
const TOURNAMENT_YEAR = 2026;

type GameStatus = 'scheduled' | 'live' | 'final';

interface EspnTeam {
  id: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName?: string;
  name?: string;
  location?: string;
  color?: string;
  logo?: string;
}

interface EspnLeader {
  displayValue?: string;
  value?: number;
  athlete?: {
    id: string;
    displayName: string;
    fullName?: string;
    jersey?: string;
    position?: { abbreviation?: string };
    headshot?: string;
  };
  team?: { id: string };
}

interface EspnCompetitor {
  id: string;
  homeAway: 'home' | 'away';
  score: string;
  winner?: boolean;
  team: EspnTeam;
  leaders?: Array<{
    name: string;
    leaders: EspnLeader[];
  }>;
}

interface EspnEvent {
  id: string;
  date: string;
  season?: { year?: number; slug?: string; type?: number };
  competitions?: Array<{
    attendance?: number;
    venue?: { fullName?: string };
    status?: {
      displayClock?: string;
      period?: number;
      type?: {
        state?: string;
        completed?: boolean;
        shortDetail?: string;
        detail?: string;
      };
    };
    broadcasts?: Array<{ names?: string[] }>;
    geoBroadcasts?: Array<{ media?: { shortName?: string } }>;
    competitors?: EspnCompetitor[];
  }>;
}

function mapStatus(state: string | undefined, completed: boolean | undefined): GameStatus {
  if (state === 'in') return 'live';
  if (state === 'post' || completed) return 'final';
  return 'scheduled';
}

function normalizeStage(event: EspnEvent): string {
  const slug = event.season?.slug?.toLowerCase() ?? '';
  if (slug.includes('group')) return 'group';
  if (slug.includes('round-of-32') || slug.includes('round_of_32')) return 'round_of_32';
  if (slug.includes('round-of-16') || slug.includes('round_of_16')) return 'round_of_16';
  if (slug.includes('quarter')) return 'quarterfinals';
  if (slug.includes('semi')) return 'semifinals';
  if (slug.includes('third') || slug.includes('3rd')) return 'third_place';
  if (slug.includes('final')) return 'final';

  const note = event.competitions?.[0]?.status?.type?.shortDetail?.toLowerCase() ?? '';
  if (note.includes('round of 32')) return 'round_of_32';
  if (note.includes('round of 16')) return 'round_of_16';
  if (note.includes('quarter')) return 'quarterfinals';
  if (note.includes('semi')) return 'semifinals';
  if (note.includes('third') || note.includes('3rd')) return 'third_place';
  if (note.includes('final')) return 'final';

  return 'group';
}

function getGroupCode(event: EspnEvent): string | null {
  const text = [
    event.season?.slug,
    event.competitions?.[0]?.status?.type?.shortDetail,
    event.competitions?.[0]?.status?.type?.detail,
  ]
    .filter(Boolean)
    .join(' ');
  const match = text.match(/group[-\s]?([a-l])/i);
  return match ? match[1].toUpperCase() : null;
}

function getDateRange(req: VercelRequest): string {
  const raw = Array.isArray(req.query.dates) ? req.query.dates[0] : req.query.dates;
  if (raw && /^\d{8}-\d{8}$/.test(raw)) return raw;
  return '20260611-20260719';
}

async function fetchEvents(dateRange: string): Promise<EspnEvent[]> {
  const res = await fetch(`${ESPN_WORLD_CUP_SCOREBOARD}?dates=${dateRange}`, {
    headers: { 'User-Agent': 'know-ball/1.0' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ESPN World Cup API error ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json.events ?? [];
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { first_name: fullName, last_name: '' };
  return {
    first_name: parts.slice(0, -1).join(' '),
    last_name: parts[parts.length - 1],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const events = await fetchEvents(getDateRange(req));
    const teamsByProviderId = new Map<number, string>();
    const gamesByProviderId = new Map<number, string>();
    const playerRows = new Map<number, any>();
    const statRows = new Map<number, any>();

    const { data: season, error: seasonErr } = await supabase
      .from('seasons')
      .upsert({ year: TOURNAMENT_YEAR, type: 'playoffs', sport: 'world_cup' }, { onConflict: 'sport,year' })
      .select('id')
      .single();

    if (seasonErr) throw seasonErr;

    const teamRows = new Map<number, any>();
    for (const event of events) {
      const competitors = event.competitions?.[0]?.competitors ?? [];
      for (const competitor of competitors) {
        const providerTeamId = parseInt(competitor.team.id, 10);
        if (!Number.isFinite(providerTeamId)) continue;
        teamRows.set(providerTeamId, {
          provider: PROVIDER,
          provider_team_id: providerTeamId,
          abbreviation: competitor.team.abbreviation.toUpperCase(),
          city: competitor.team.location ?? competitor.team.displayName,
          full_name: competitor.team.displayName,
          name: competitor.team.shortDisplayName ?? competitor.team.name ?? competitor.team.displayName,
          conference: getGroupCode(event),
          division: null,
          sport: 'world_cup',
        });
      }
    }

    if (teamRows.size > 0) {
      const { data: upsertedTeams, error: teamsErr } = await supabase
        .from('teams')
        .upsert(Array.from(teamRows.values()), { onConflict: 'provider,provider_team_id' })
        .select('id, provider_team_id');
      if (teamsErr) throw teamsErr;
      for (const row of upsertedTeams ?? []) {
        teamsByProviderId.set(row.provider_team_id, row.id);
      }
    }

    const gameRows: any[] = [];
    const skipped: string[] = [];
    for (const event of events) {
      const comp = event.competitions?.[0];
      const home = comp?.competitors?.find((c) => c.homeAway === 'home');
      const away = comp?.competitors?.find((c) => c.homeAway === 'away');
      const homeTeamId = home ? teamsByProviderId.get(parseInt(home.team.id, 10)) : null;
      const awayTeamId = away ? teamsByProviderId.get(parseInt(away.team.id, 10)) : null;

      if (!comp || !home || !away || !homeTeamId || !awayTeamId) {
        skipped.push(event.id);
        continue;
      }

      const status = mapStatus(comp.status?.type?.state, comp.status?.type?.completed);
      const stage = normalizeStage(event);
      gameRows.push({
        provider: PROVIDER,
        provider_game_id: parseInt(event.id, 10),
        season_id: season.id,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_team_score: parseInt(home.score, 10) || 0,
        away_team_score: parseInt(away.score, 10) || 0,
        game_date_utc: new Date(event.date).toISOString(),
        status,
        period: comp.status?.period ?? null,
        time: comp.status?.displayClock ?? null,
        postseason: stage !== 'group',
        playoff_round: stage === 'group' ? null : stage,
        sport: 'world_cup',
        arena: comp.venue?.fullName ?? null,
        attendance: comp.attendance ?? null,
        broadcast:
          comp.geoBroadcasts?.[0]?.media?.shortName ??
          comp.broadcasts?.[0]?.names?.join(', ') ??
          null,
      });

      for (const competitor of [home, away]) {
        for (const leaderGroup of competitor.leaders ?? []) {
          if (!leaderGroup.name.toLowerCase().includes('goal')) continue;
          for (const leader of leaderGroup.leaders ?? []) {
            const athlete = leader.athlete;
            if (!athlete?.id || !athlete.displayName) continue;
            const providerPlayerId = parseInt(athlete.id, 10);
            const teamId = teamsByProviderId.get(parseInt(competitor.team.id, 10));
            if (!Number.isFinite(providerPlayerId) || !teamId) continue;
            const name = splitName(athlete.fullName ?? athlete.displayName);
            playerRows.set(providerPlayerId, {
              provider: PROVIDER,
              provider_player_id: providerPlayerId,
              first_name: name.first_name,
              last_name: name.last_name,
              position: athlete.position?.abbreviation ?? null,
              jersey_number: athlete.jersey ?? null,
              team_id: teamId,
              headshot_url: athlete.headshot ?? null,
              sport: 'world_cup',
            });
            statRows.set(providerPlayerId, {
              tournament_year: TOURNAMENT_YEAR,
              goals: Math.round(leader.value ?? parseInt(leader.displayValue ?? '0', 10) ?? 0),
              assists: 0,
              minutes: 0,
              matches_played: 0,
              penalties: 0,
              clean_sheets: 0,
              team_id: teamId,
            });
          }
        }
      }
    }

    if (gameRows.length > 0) {
      const { data: upsertedGames, error: gamesErr } = await supabase
        .from('games')
        .upsert(gameRows, { onConflict: 'provider,provider_game_id' })
        .select('id, provider_game_id');
      if (gamesErr) throw gamesErr;
      for (const row of upsertedGames ?? []) {
        gamesByProviderId.set(row.provider_game_id, row.id);
      }
    }

    const metadataRows = events.flatMap((event) => {
      const gameId = gamesByProviderId.get(parseInt(event.id, 10));
      if (!gameId) return [];
      const stage = normalizeStage(event);
      return [{
        game_id: gameId,
        tournament_year: TOURNAMENT_YEAR,
        stage,
        group_code: stage === 'group' ? getGroupCode(event) : null,
        matchday: null,
        bracket_slot: stage === 'group' ? null : `${stage}-${event.id}`,
        home_seed_label: null,
        away_seed_label: null,
        status_note: event.competitions?.[0]?.status?.type?.shortDetail ?? null,
      }];
    });

    if (metadataRows.length > 0) {
      const { error: metadataErr } = await supabase
        .from('world_cup_match_metadata')
        .upsert(metadataRows, { onConflict: 'game_id' });
      if (metadataErr) throw metadataErr;
    }

    if (playerRows.size > 0) {
      const { data: upsertedPlayers, error: playersErr } = await supabase
        .from('players')
        .upsert(Array.from(playerRows.values()), { onConflict: 'provider,provider_player_id' })
        .select('id, provider_player_id');
      if (playersErr) throw playersErr;

      const playerIdMap = new Map<number, string>();
      for (const player of upsertedPlayers ?? []) {
        playerIdMap.set(player.provider_player_id, player.id);
      }

      const stats = Array.from(statRows.entries()).flatMap(([providerPlayerId, row]) => {
        const playerId = playerIdMap.get(providerPlayerId);
        if (!playerId) return [];
        return [{ ...row, player_id: playerId }];
      });

      if (stats.length > 0) {
        const { error: statsErr } = await supabase
          .from('world_cup_player_stats')
          .upsert(stats, { onConflict: 'tournament_year,player_id' });
        if (statsErr) throw statsErr;
      }
    }

    return res.status(200).json({
      message: 'OK',
      events: events.length,
      upsertedGames: gameRows.length,
      upsertedTeams: teamRows.size,
      upsertedPlayers: playerRows.size,
      skipped,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? 'Failed to sync World Cup data' });
  }
}
