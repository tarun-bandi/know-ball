/**
 * NBA play-by-play backfill (ESPN summary API)
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/backfill-nba-playbyplay.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/backfill-nba-playbyplay.ts --season 2024
 *   npx ts-node --project tsconfig.scripts.json scripts/backfill-nba-playbyplay.ts --limit 50
 *   npx ts-node --project tsconfig.scripts.json scripts/backfill-nba-playbyplay.ts --game-id <game_uuid> --force
 *
 * Requires: .env with EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { parseEspnPlayByPlayActions } from '../lib/espnPlayByPlay';
import { resolveEspnNbaEventId, type EspnScoreboardCache } from '../lib/espnGameResolver';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const ESPN_NBA_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary';

interface CliArgs {
  season: number;
  limit: number;
  gameId: string | null;
  force: boolean;
  delayMs: number;
}

interface GameRow {
  id: string;
  provider: string;
  provider_game_id: number;
  game_date_utc: string;
  status: string;
  home_team: { abbreviation: string } | { abbreviation: string }[] | null;
  away_team: { abbreviation: string } | { abbreviation: string }[] | null;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as any).cause;
    if (cause instanceof Error) return `${err.message} (cause: ${cause.message})`;
    return err.message;
  }
  if (err && typeof err === 'object') {
    const maybeMessage = (err as any).message;
    if (typeof maybeMessage === 'string' && maybeMessage.length > 0) return maybeMessage;
    try {
      return JSON.stringify(err);
    } catch {}
  }
  return String(err);
}

function isRetryableNetworkError(err: unknown): boolean {
  const msg = errorMessage(err).toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('enotfound') ||
    msg.includes('network')
  );
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = isRetryableNetworkError(err);
      if (!retryable || attempt === maxAttempts) break;
      console.warn(`${label} attempt ${attempt}/${maxAttempts} failed: ${errorMessage(err)}`);
      await sleep(400 * attempt);
    }
  }

  throw new Error(`${label} failed: ${errorMessage(lastError)}`);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function extractTeamAbbreviation(
  teamRef: { abbreviation: string } | { abbreviation: string }[] | null,
): string | null {
  if (!teamRef) return null;
  if (Array.isArray(teamRef)) return teamRef[0]?.abbreviation ?? null;
  return teamRef.abbreviation ?? null;
}

function getCurrentSeasonYear(): number {
  const now = new Date();
  const etMonth = parseInt(
    now.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'numeric' }),
    10,
  );
  const etYear = parseInt(
    now.toLocaleDateString('en-US', { timeZone: 'America/New_York', year: 'numeric' }),
    10,
  );
  return etMonth >= 10 ? etYear : etYear - 1;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let season = getCurrentSeasonYear() - 1;
  let limit = 0;
  let gameId: string | null = null;
  let force = false;
  let delayMs = 350;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--season' && args[i + 1]) {
      season = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--game-id' && args[i + 1]) {
      gameId = args[i + 1];
      i++;
    } else if (args[i] === '--force') {
      force = true;
    } else if (args[i] === '--delay-ms' && args[i + 1]) {
      delayMs = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { season, limit, gameId, force, delayMs };
}

async function fetchSummaryActions(providerGameId: number): Promise<any[] | null> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${ESPN_NBA_SUMMARY}?event=${providerGameId}`, {
        headers: { 'User-Agent': 'nba-letterbox/1.0' },
      });

      if (res.ok) {
        const summary = await res.json();
        return parseEspnPlayByPlayActions(summary);
      }

      if (res.status === 404) return [];

      const shouldRetry = res.status === 429 || res.status >= 500;
      if (shouldRetry && attempt < maxAttempts) {
        await sleep(400 * attempt);
        continue;
      }

      const body = await res.text().catch(() => '');
      console.warn(`  ESPN summary error for ${providerGameId}: ${res.status} ${body.slice(0, 120)}`);
      return null;
    } catch (err) {
      if (attempt < maxAttempts && isRetryableNetworkError(err)) {
        await sleep(400 * attempt);
        continue;
      }
      console.warn(`  ESPN summary fetch failed for ${providerGameId}: ${errorMessage(err)}`);
      return null;
    }
  }

  return null;
}

async function loadGames(args: CliArgs): Promise<GameRow[]> {
  if (args.gameId) {
    const { data, error } = await supabase
      .from('games')
      .select(`
        id,
        provider,
        provider_game_id,
        game_date_utc,
        status,
        home_team:teams!games_home_team_id_fkey (abbreviation),
        away_team:teams!games_away_team_id_fkey (abbreviation)
      `)
      .eq('id', args.gameId)
      .eq('sport', 'nba')
      .maybeSingle();

    if (error) throw error;
    return data ? [data as unknown as GameRow] : [];
  }

  const startIso = new Date(Date.UTC(args.season, 9, 1, 0, 0, 0)).toISOString();
  const endIso = new Date(Date.UTC(args.season + 1, 6, 1, 0, 0, 0)).toISOString();

  let query = supabase
    .from('games')
    .select(`
      id,
      provider,
      provider_game_id,
      game_date_utc,
      status,
      home_team:teams!games_home_team_id_fkey (abbreviation),
      away_team:teams!games_away_team_id_fkey (abbreviation)
    `)
    .eq('sport', 'nba')
    .gte('game_date_utc', startIso)
    .lt('game_date_utc', endIso)
    .eq('status', 'final')
    .order('game_date_utc', { ascending: true });

  if (args.limit > 0) query = query.limit(args.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as GameRow[];
}

async function loadExistingGameIds(gameIds: string[]): Promise<Set<string>> {
  const existing = new Set<string>();
  if (gameIds.length === 0) return existing;

  for (const chunk of chunkArray(gameIds, 100)) {
    const { data, error } = await supabase
      .from('game_play_by_play')
      .select('game_id')
      .in('game_id', chunk);

    if (error) throw error;
    for (const row of data ?? []) existing.add(row.game_id);
  }

  return existing;
}

async function main() {
  const args = parseArgs();
  console.log('NBA play-by-play backfill starting...\n');
  console.log(`Season: ${args.season}${args.gameId ? ' (ignored due to --game-id)' : ''}`);
  console.log(`Force refresh: ${args.force ? 'yes' : 'no'}`);
  console.log(`Delay: ${args.delayMs}ms\n`);

  const games = await withRetry('Loading games from Supabase', () => loadGames(args));

  if (games.length === 0) {
    console.log('No target NBA games found.');
    return;
  }

  const existing = args.force
    ? new Set<string>()
    : await withRetry(
      'Loading existing play-by-play rows',
      () => loadExistingGameIds(games.map((g) => g.id)),
    );
  const gamesToProcess = args.force ? games : games.filter((g) => !existing.has(g.id));

  console.log(`Found ${games.length} game(s); ${gamesToProcess.length} need backfill.\n`);
  if (gamesToProcess.length === 0) return;

  let processed = 0;
  let saved = 0;
  let failed = 0;
  let totalActions = 0;
  const scoreboardCache: EspnScoreboardCache = new Map();

  for (const game of gamesToProcess) {
    processed++;
    let espnEventId: number | null = null;

    if (game.provider === 'espn') {
      espnEventId = game.provider_game_id;
    } else {
      const homeAbbr = extractTeamAbbreviation(game.home_team);
      const awayAbbr = extractTeamAbbreviation(game.away_team);
      if (homeAbbr && awayAbbr) {
        try {
          espnEventId = await withRetry(
            `Resolving ESPN event id for ${awayAbbr}@${homeAbbr} (${game.game_date_utc.slice(0, 10)})`,
            () =>
              resolveEspnNbaEventId(
                game.game_date_utc,
                homeAbbr,
                awayAbbr,
                scoreboardCache,
              ),
          );
        } catch (err) {
          failed++;
          console.log(
            `[${processed}/${gamesToProcess.length}] ${game.id} resolve failed: ${errorMessage(err)}`,
          );
          await sleep(args.delayMs);
          continue;
        }
      }
    }

    if (!espnEventId) {
      failed++;
      console.log(`[${processed}/${gamesToProcess.length}] ${game.id} could not resolve ESPN event id`);
      await sleep(args.delayMs);
      continue;
    }

    const actions = await fetchSummaryActions(espnEventId);

    if (actions === null) {
      failed++;
      console.log(`[${processed}/${gamesToProcess.length}] ${espnEventId} failed`);
      await sleep(args.delayMs);
      continue;
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('game_play_by_play')
      .upsert(
        {
          game_id: game.id,
          provider: 'espn',
          provider_game_id: espnEventId,
          sport: 'nba',
          actions,
          action_count: actions.length,
          fetched_at: now,
          updated_at: now,
        },
        { onConflict: 'game_id' },
      );

    if (error) {
      failed++;
      console.log(`[${processed}/${gamesToProcess.length}] ${espnEventId} upsert failed: ${error.message}`);
      await sleep(args.delayMs);
      continue;
    }

    saved++;
    totalActions += actions.length;
    console.log(
      `[${processed}/${gamesToProcess.length}] ${espnEventId} saved ${actions.length} action(s)`,
    );
    await sleep(args.delayMs);
  }

  console.log('\nBackfill complete.');
  console.log(`Saved games: ${saved}`);
  console.log(`Failed games: ${failed}`);
  console.log(`Total actions stored: ${totalActions}`);
}

main().catch((err) => {
  console.error('Unhandled error:', errorMessage(err));
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
