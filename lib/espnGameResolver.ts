const ESPN_NBA_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';

interface EspnCompetitor {
  homeAway?: 'home' | 'away';
  team?: {
    abbreviation?: string;
  };
}

interface EspnEvent {
  id?: string;
  competitions?: Array<{
    competitors?: EspnCompetitor[];
  }>;
}

export type EspnScoreboardCache = Map<string, EspnEvent[]>;

const NBA_ABBR_CANONICAL_MAP: Record<string, string> = {
  GS: 'GSW',
  GSW: 'GSW',
  NY: 'NYK',
  NYK: 'NYK',
  SA: 'SAS',
  SAS: 'SAS',
  NO: 'NOP',
  NOP: 'NOP',
  UTAH: 'UTA',
  UTA: 'UTA',
  WSH: 'WAS',
  WAS: 'WAS',
};

function normalizeNbaAbbreviation(abbr: string | undefined | null): string {
  const key = String(abbr ?? '').trim().toUpperCase();
  if (!key) return '';
  return NBA_ABBR_CANONICAL_MAP[key] ?? key;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function formatDateKeyUTC(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function formatDateKeyET(date: Date): string {
  return date
    .toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    .replace(/-/g, '');
}

function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKeyUTC(date);
}

function getCandidateDateKeys(gameDateUtc: string): string[] {
  const gameDate = new Date(gameDateUtc);
  if (Number.isNaN(gameDate.getTime())) return [];

  const utcKey = formatDateKeyUTC(gameDate);
  const etKey = formatDateKeyET(gameDate);

  return Array.from(
    new Set([
      etKey,
      utcKey,
      shiftDateKey(etKey, -1),
      shiftDateKey(etKey, 1),
      shiftDateKey(utcKey, -1),
      shiftDateKey(utcKey, 1),
    ]),
  );
}

async function fetchScoreboardEvents(
  dateKey: string,
  cache: EspnScoreboardCache,
): Promise<EspnEvent[]> {
  const cached = cache.get(dateKey);
  if (cached) return cached;

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${ESPN_NBA_SCOREBOARD}?dates=${dateKey}`, {
        headers: { 'User-Agent': 'nba-letterbox/1.0' },
      });

      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        if (retryable && attempt < maxAttempts) {
          await sleep(300 * attempt);
          continue;
        }
        throw new Error(`ESPN scoreboard ${dateKey} returned ${res.status}`);
      }

      const json = await res.json();
      const events = Array.isArray(json?.events) ? (json.events as EspnEvent[]) : [];
      cache.set(dateKey, events);
      return events;
    } catch (err) {
      if (attempt < maxAttempts) {
        await sleep(300 * attempt);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`ESPN scoreboard ${dateKey} failed after retries`);
}

export async function resolveEspnNbaEventId(
  gameDateUtc: string,
  homeTeamAbbr: string,
  awayTeamAbbr: string,
  cache: EspnScoreboardCache = new Map(),
): Promise<number | null> {
  const homeTarget = normalizeNbaAbbreviation(homeTeamAbbr);
  const awayTarget = normalizeNbaAbbreviation(awayTeamAbbr);
  const dateKeys = getCandidateDateKeys(gameDateUtc);

  for (const dateKey of dateKeys) {
    let events: EspnEvent[] = [];
    try {
      events = await fetchScoreboardEvents(dateKey, cache);
    } catch {
      continue;
    }

    for (const event of events) {
      const competitors = event.competitions?.[0]?.competitors ?? [];
      const home = competitors.find((c) => c.homeAway === 'home');
      const away = competitors.find((c) => c.homeAway === 'away');

      const homeAbbr = normalizeNbaAbbreviation(home?.team?.abbreviation);
      const awayAbbr = normalizeNbaAbbreviation(away?.team?.abbreviation);
      if (homeAbbr !== homeTarget || awayAbbr !== awayTarget) continue;

      const eventId = parseInt(String(event.id ?? ''), 10);
      if (Number.isFinite(eventId)) return eventId;
    }
  }

  return null;
}
