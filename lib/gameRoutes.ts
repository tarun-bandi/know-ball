import type { Sport } from '@/types/database';

export interface SluggableGame {
  sport?: Sport | null;
  game_date_utc: string;
  away_team: { abbreviation: string };
  home_team: { abbreviation: string };
}

export interface ParsedGameSlug {
  sport: Sport;
  date: string;
  awayAbbreviation: string;
  homeAbbreviation: string;
}

const GAME_SLUG_PATTERN = /^(nba|nfl|world-cup)-(\d{4}-\d{2}-\d{2})-([a-z0-9]+)-at-([a-z0-9]+)$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isGameUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function formatGameDateForSlug(date: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(date));

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function buildGameSlug(game: SluggableGame): string {
  const sport = game.sport ?? 'nba';
  return [
    sport === 'world_cup' ? 'world-cup' : sport,
    formatGameDateForSlug(game.game_date_utc),
    game.away_team.abbreviation.toLowerCase(),
    'at',
    game.home_team.abbreviation.toLowerCase(),
  ].join('-');
}

export function gamePath(game: SluggableGame | string): string {
  return `/game/${typeof game === 'string' ? game : buildGameSlug(game)}`;
}

export function parseGameSlug(value: string): ParsedGameSlug | null {
  const match = value.match(GAME_SLUG_PATTERN);
  if (!match) return null;

  return {
    sport: (match[1].toLowerCase() === 'world-cup' ? 'world_cup' : match[1].toLowerCase()) as Sport,
    date: match[2],
    awayAbbreviation: match[3].toUpperCase(),
    homeAbbreviation: match[4].toUpperCase(),
  };
}
