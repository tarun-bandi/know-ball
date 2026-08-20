export type RemoteGameStatus = 'scheduled' | 'live' | 'final';

export interface GameStatsTeam {
  id: string;
  abbreviation: string;
  displayName: string;
  shortName: string;
  logo: string | null;
  color: string;
  alternateColor: string;
  score: string;
  record: string | null;
  winner: boolean;
}

export interface GameStatsPeriod {
  label: string;
  away: string;
  home: string;
}

export interface GameStatsTeamStat {
  key: string;
  label: string;
  abbreviation: string | null;
  value: string;
}

export interface GameStatsTeamSummary {
  team: GameStatsTeam;
  stats: GameStatsTeamStat[];
}

export interface GameStatsPlayer {
  id: string;
  displayName: string;
  shortName: string;
  jersey: string | null;
  position: string | null;
  headshot: string | null;
  starter: boolean;
  didNotPlay: boolean;
  reason: string | null;
  stats: Record<string, string>;
}

export interface GameStatsPlayerGroup {
  team: GameStatsTeam;
  labels: string[];
  players: GameStatsPlayer[];
}

export interface GameStatsLeader {
  category: string;
  label: string;
  value: string;
  athleteId: string;
  athleteName: string;
  athleteShortName: string;
  headshot: string | null;
  summary: string | null;
}

export interface GameStatsLeaderGroup {
  team: GameStatsTeam;
  leaders: GameStatsLeader[];
}

export interface GameStatsHighlight {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
  videoUrl: string;
  hlsUrl: string | null;
  thumbnailUrl: string | null;
  externalUrl: string | null;
}

export interface GameStatsResponse {
  providerGameId: string;
  source: 'espn';
  status: RemoteGameStatus;
  statusDetail: string;
  date: string | null;
  awayTeam: GameStatsTeam;
  homeTeam: GameStatsTeam;
  periods: GameStatsPeriod[];
  teamStats: GameStatsTeamSummary[];
  playerStats: GameStatsPlayerGroup[];
  leaders: GameStatsLeaderGroup[];
  venue: string | null;
  attendance: number | null;
  officials: string[];
  broadcast: string | null;
  seriesSummary: string | null;
  eventLabel: string | null;
  highlights: GameStatsHighlight[];
  fetchedAt: string;
}
