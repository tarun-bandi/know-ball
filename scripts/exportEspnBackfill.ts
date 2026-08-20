/**
 * Export historical ESPN NBA scoreboards as compact JSON for an authenticated
 * database import. This does not require a Supabase key.
 *
 * Usage:
 *   ts-node scripts/exportEspnBackfill.ts --seasons 2016,2017 --output /tmp/nba.json
 */
import { writeFileSync } from 'node:fs';
import {
  getEspnEventHeadline,
  mapNbaPlayoffRound,
  mapNbaSeasonPhase,
  normalizeEspnEventLabel,
} from '../lib/espnGameMetadata';

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
const ABBREVIATIONS: Record<string, string> = {
  GS: 'GSW',
  NO: 'NOP',
  SA: 'SAS',
  UTAH: 'UTA',
  NY: 'NYK',
  WSH: 'WAS',
};

interface ExportRow {
  i: number;
  y: number;
  h: string;
  a: string;
  hs: number | null;
  as: number | null;
  d: string;
  st: 'scheduled' | 'live' | 'final';
  p: number | null;
  t: string | null;
  po: boolean;
  ph: 'preseason' | 'regular' | 'postseason';
  r: string | null;
  l: string | null;
  b: string | null;
  v: string | null;
}

function arg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function normalizeAbbreviation(value: string): string {
  const upper = value.toUpperCase();
  return ABBREVIATIONS[upper] ?? upper;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function status(state: unknown, completed: unknown): ExportRow['st'] {
  if (state === 'in') return 'live';
  if (state === 'post' || completed === true) return 'final';
  return 'scheduled';
}

async function fetchDate(date: Date, attempt = 1): Promise<any[]> {
  const key = dateKey(date);
  try {
    const response = await fetch(`${SCOREBOARD_URL}?dates=${key}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body: any = await response.json();
    return Array.isArray(body?.events) ? body.events : [];
  } catch (error) {
    if (attempt >= 5) throw new Error(`ESPN ${key} failed: ${String(error)}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    return fetchDate(date, attempt + 1);
  }
}

async function exportSeason(seasonYear: number): Promise<ExportRow[]> {
  const dates: Date[] = [];
  const cursor = new Date(Date.UTC(seasonYear, seasonYear === 2020 ? 11 : 9, 1));
  const end = seasonYear === 2019
    ? new Date(Date.UTC(2020, 9, 31))
    : seasonYear === 2020
      ? new Date(Date.UTC(2021, 6, 31))
      : new Date(Date.UTC(seasonYear + 1, 5, 30));
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const events: any[] = [];
  for (let index = 0; index < dates.length; index += 12) {
    const batch = await Promise.all(dates.slice(index, index + 12).map((date) => fetchDate(date)));
    events.push(...batch.flat());
    process.stderr.write(`\r${seasonYear}: ${Math.min(index + 12, dates.length)}/${dates.length} days`);
  }
  process.stderr.write('\n');

  return events.flatMap((event): ExportRow[] => {
    const competition = event?.competitions?.[0];
    const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
    const home = competitors.find((entry: any) => entry?.homeAway === 'home');
    const away = competitors.find((entry: any) => entry?.homeAway === 'away');
    const homeAbbreviation = home?.team?.abbreviation;
    const awayAbbreviation = away?.team?.abbreviation;
    const providerId = Number(event?.id);
    if (!competition || !homeAbbreviation || !awayAbbreviation || !Number.isFinite(providerId)) return [];

    const eventStatus = event?.status ?? competition?.status ?? {};
    const eventHeadline = getEspnEventHeadline(competition);
    const numberOrNull = (value: unknown) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    return [{
      i: providerId,
      y: seasonYear,
      h: normalizeAbbreviation(homeAbbreviation),
      a: normalizeAbbreviation(awayAbbreviation),
      hs: numberOrNull(home?.score),
      as: numberOrNull(away?.score),
      d: new Date(event.date).toISOString(),
      st: status(eventStatus?.type?.state, eventStatus?.type?.completed),
      p: numberOrNull(eventStatus?.period),
      t: eventStatus?.displayClock || null,
      po: event?.season?.type === 3,
      ph: mapNbaSeasonPhase(event?.season?.type),
      r: mapNbaPlayoffRound(eventHeadline),
      l: normalizeEspnEventLabel(eventHeadline, event.date),
      b: competition?.broadcasts?.[0]?.names?.join(', ') ?? null,
      v: competition?.venue?.fullName ?? null,
    }];
  });
}

async function main() {
  const seasons = (arg('--seasons') ?? '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite);
  const output = arg('--output');
  if (seasons.length === 0 || !output) {
    throw new Error('Provide --seasons 2016,2017 and --output /tmp/nba.json');
  }

  const rows: ExportRow[] = [];
  for (const season of seasons) rows.push(...await exportSeason(season));
  const uniqueRows = [...new Map(rows.map((row) => [row.i, row])).values()];
  writeFileSync(output, JSON.stringify(uniqueRows));
  console.log(`Exported ${uniqueRows.length} games to ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
