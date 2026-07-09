import { Platform } from 'react-native';
import type { ProviderGame, SportProvider, TeamComparisonStatDef } from './types';

const ESPN_WORLD_CUP_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

const PLAYOFF_ROUND_LABELS: Record<string, string> = {
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarterfinals: 'Quarterfinals',
  semifinals: 'Semifinals',
  third_place: 'Third Place',
  final: 'Final',
};

const TEAM_COMPARISON_STATS: TeamComparisonStatDef[] = [
  { key: 'shots', label: 'Shots' },
  { key: 'shots_on_target', label: 'Shots on Target' },
  { key: 'possession_pct', label: 'Possession' },
  { key: 'corners', label: 'Corners' },
  { key: 'fouls', label: 'Fouls', lowerIsBetter: true },
];

interface EspnWorldCupCompetitor {
  id: string;
  homeAway: 'home' | 'away';
  score: string;
  team: {
    id: string;
    abbreviation: string;
    logo?: string;
  };
}

interface EspnWorldCupEvent {
  id: string;
  date: string;
  season: {
    year: number;
    type: number;
    slug?: string;
  };
  competitions: Array<{
    competitors: EspnWorldCupCompetitor[];
    status: {
      displayClock?: string;
      period?: number;
      type: {
        state: 'pre' | 'in' | 'post';
        completed: boolean;
        shortDetail?: string;
      };
    };
  }>;
}

interface EspnWorldCupScoreboard {
  events?: EspnWorldCupEvent[];
}

function getLocalDateKey(): string {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    .replace(/-/g, '');
}

async function fetchWorldCupScoreboard(date?: string): Promise<EspnWorldCupEvent[]> {
  if (Platform.OS === 'web') {
    const dateParam = date ?? getLocalDateKey();
    const res = await fetch(`/api/scores/world-cup?date=${encodeURIComponent(dateParam)}`);
    if (!res.ok) return [];
    const json: EspnWorldCupScoreboard = await res.json();
    return json.events ?? [];
  }

  const url = date ? `${ESPN_WORLD_CUP_SCOREBOARD}?dates=${date}` : ESPN_WORLD_CUP_SCOREBOARD;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json: EspnWorldCupScoreboard = await res.json();
  return json.events ?? [];
}

function getCompetitor(event: EspnWorldCupEvent, side: 'home' | 'away') {
  return event.competitions[0]?.competitors.find((c) => c.homeAway === side);
}

export const worldCupProvider: SportProvider = {
  sport: 'world_cup',

  async fetchTodaysGames(): Promise<ProviderGame[]> {
    const events = await fetchWorldCupScoreboard();
    return events.map((event) => {
      const comp = event.competitions[0];
      const home = getCompetitor(event, 'home');
      const away = getCompetitor(event, 'away');
      const status = comp?.status;

      return {
        id: parseInt(event.id, 10),
        date: event.date,
        homeTeamProviderId: home?.team.id ?? '',
        awayTeamProviderId: away?.team.id ?? '',
        homeScore: parseInt(home?.score ?? '0', 10),
        awayScore: parseInt(away?.score ?? '0', 10),
        status: status?.type.state ?? 'pre',
        period: status?.period ?? 0,
        clock: status?.displayClock ?? '',
        postseason: event.season.slug !== 'group-stage',
        datetime: event.date,
        season: event.season.year,
      };
    });
  },

  mapStatus(status: string): 'scheduled' | 'live' | 'final' {
    if (status === 'in') return 'live';
    if (status === 'post' || status === 'final') return 'final';
    return 'scheduled';
  },

  formatLiveStatus(status: string, period: number, clock: string): string | null {
    if (status === 'pre' || status === 'scheduled' || status === 'post' || status === 'final') {
      return null;
    }
    if (clock) return clock;
    if (period === 1) return '1H';
    if (period === 2) return '2H';
    if (period > 2) return 'ET';
    return 'Live';
  },

  getTeamLogoUrl(abbreviation: string): string {
    return `https://a.espncdn.com/i/teamlogos/countries/500/${abbreviation.toLowerCase()}.png`;
  },

  getPeriodLabels(): string[] {
    return ['1H', '2H', 'ET'];
  },

  getPlayoffRoundLabel(round: string): string {
    return PLAYOFF_ROUND_LABELS[round] ?? round.replace(/_/g, ' ');
  },

  getBoxScoreColumns() {
    return [];
  },

  getTeamComparisonStats(): TeamComparisonStatDef[] {
    return TEAM_COMPARISON_STATS;
  },

  getConferences(): string[] {
    return ['World Cup'];
  },
};
