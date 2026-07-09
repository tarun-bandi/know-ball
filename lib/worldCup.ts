import type { Team, WorldCupGame } from '@/types/database';

export type WorldCupStage =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarterfinals'
  | 'semifinals'
  | 'third_place'
  | 'final';

export interface WorldCupStanding {
  team: Team;
  groupCode: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  rank: number;
  qualificationStatus: 'qualified' | 'best_third_race' | 'eliminated' | 'undecided';
}

export interface WorldCupBracketMatch {
  id: string;
  stage: WorldCupStage;
  slot: string;
  date: string;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeSeedLabel: string | null;
  awaySeedLabel: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  winnerTeamId: string | null;
  status: 'scheduled' | 'live' | 'final';
}

export type WorldCupKnockoutStage = Exclude<WorldCupStage, 'group'>;

export interface GoldenBootEntry {
  playerId: string;
  playerName: string;
  team: Team;
  goals: number;
  assists: number;
  minutes: number;
  matchesPlayed: number;
  penalties: number;
  headshotUrl: string | null;
}

const KNOCKOUT_ORDER: WorldCupKnockoutStage[] = [
  'round_of_32',
  'round_of_16',
  'quarterfinals',
  'semifinals',
  'third_place',
  'final',
];

export const WORLD_CUP_STAGE_LABELS: Record<WorldCupStage, string> = {
  group: 'Group Stage',
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarterfinals: 'Quarterfinals',
  semifinals: 'Semifinals',
  third_place: 'Third Place',
  final: 'Final',
};

function getMetadata(game: WorldCupGame) {
  return game.world_cup_match_metadata ?? null;
}

function isGroupGame(game: WorldCupGame): boolean {
  return getMetadata(game)?.stage === 'group';
}

function addTeamIfMissing(group: Map<string, WorldCupStanding>, team: Team, groupCode: string) {
  if (group.has(team.id)) return;
  group.set(team.id, {
    team,
    groupCode,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    rank: 0,
    qualificationStatus: 'undecided',
  });
}

function applyResult(row: WorldCupStanding, goalsFor: number, goalsAgainst: number) {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;

  if (goalsFor > goalsAgainst) {
    row.won += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.drawn += 1;
    row.points += 1;
  } else {
    row.lost += 1;
  }
}

function rankGroup(rows: WorldCupStanding[]): WorldCupStanding[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.full_name.localeCompare(b.team.full_name);
  });
  const groupComplete = sorted.length > 0 && sorted.every((row) => row.played >= 3);

  return sorted.map((row, index) => {
    let qualificationStatus: WorldCupStanding['qualificationStatus'] = 'undecided';
    if (groupComplete) {
      if (index < 2) qualificationStatus = 'qualified';
      else if (index === 2) qualificationStatus = 'best_third_race';
      else qualificationStatus = 'eliminated';
    }

    return {
      ...row,
      rank: index + 1,
      qualificationStatus,
    };
  });
}

export function computeWorldCupStandings(games: WorldCupGame[]): Record<string, WorldCupStanding[]> {
  const groups = new Map<string, Map<string, WorldCupStanding>>();

  for (const game of games.filter(isGroupGame)) {
    const metadata = getMetadata(game);
    const groupCode = metadata?.group_code ?? 'Group';
    if (!groups.has(groupCode)) groups.set(groupCode, new Map());
    const group = groups.get(groupCode)!;

    addTeamIfMissing(group, game.home_team, groupCode);
    addTeamIfMissing(group, game.away_team, groupCode);

    const homeScore = game.home_team_score;
    const awayScore = game.away_team_score;
    if (game.status === 'scheduled' || homeScore == null || awayScore == null) continue;

    applyResult(group.get(game.home_team.id)!, homeScore, awayScore);
    applyResult(group.get(game.away_team.id)!, awayScore, homeScore);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<Record<string, WorldCupStanding[]>>((acc, [groupCode, group]) => {
      acc[groupCode] = rankGroup(Array.from(group.values()));
      return acc;
    }, {});
}

function getPenaltyWinner(game: WorldCupGame): string | null {
  const metadata = getMetadata(game);
  const homePens = metadata?.home_penalties;
  const awayPens = metadata?.away_penalties;
  if (homePens == null || awayPens == null || homePens === awayPens) return null;
  return homePens > awayPens ? game.home_team.id : game.away_team.id;
}

function getWinnerTeamId(game: WorldCupGame): string | null {
  if (game.status !== 'final') return null;
  if (game.home_team_score == null || game.away_team_score == null) return null;
  if (game.home_team_score > game.away_team_score) return game.home_team.id;
  if (game.away_team_score > game.home_team_score) return game.away_team.id;
  return getPenaltyWinner(game);
}

export function buildWorldCupBracket(games: WorldCupGame[]): Record<WorldCupKnockoutStage, WorldCupBracketMatch[]> {
  const bracket = KNOCKOUT_ORDER.reduce(
    (acc, stage) => ({ ...acc, [stage]: [] }),
    {} as Record<WorldCupKnockoutStage, WorldCupBracketMatch[]>,
  );

  for (const game of games) {
    const metadata = getMetadata(game);
    const stage = metadata?.stage as WorldCupStage | undefined;
    if (!stage || stage === 'group' || !KNOCKOUT_ORDER.includes(stage)) continue;

    bracket[stage].push({
      id: game.id,
      stage,
      slot: metadata?.bracket_slot ?? game.provider_game_id.toString(),
      date: game.game_date_utc,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      homeSeedLabel: metadata?.home_seed_label ?? null,
      awaySeedLabel: metadata?.away_seed_label ?? null,
      homeScore: game.home_team_score,
      awayScore: game.away_team_score,
      homePenalties: metadata?.home_penalties ?? null,
      awayPenalties: metadata?.away_penalties ?? null,
      winnerTeamId: getWinnerTeamId(game),
      status: game.status,
    });
  }

  for (const stage of KNOCKOUT_ORDER) {
    bracket[stage].sort((a, b) => a.slot.localeCompare(b.slot));
  }

  return bracket;
}

export function sortGoldenBootRace(entries: GoldenBootEntry[]): GoldenBootEntry[] {
  return [...entries].sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.assists !== a.assists) return b.assists - a.assists;
    if (a.minutes !== b.minutes) return a.minutes - b.minutes;
    return a.playerName.localeCompare(b.playerName);
  });
}

export function formatWorldCupStage(stage: string | null | undefined): string {
  if (!stage) return 'World Cup';
  return WORLD_CUP_STAGE_LABELS[stage as WorldCupStage] ?? stage.replace(/_/g, ' ');
}
