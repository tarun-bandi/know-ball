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
  label: string;
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
  statusNote: string | null;
  synthetic?: boolean;
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

const STAGE_PREFIX: Record<WorldCupKnockoutStage, string> = {
  round_of_32: 'R32',
  round_of_16: 'R16',
  quarterfinals: 'QF',
  semifinals: 'SF',
  third_place: '3P',
  final: 'F',
};

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

function getBracketLabel(stage: WorldCupKnockoutStage, index: number): string {
  return `${STAGE_PREFIX[stage]} ${index + 1}`;
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

  const knockoutGames = games
    .filter((game) => {
      const metadata = getMetadata(game);
      const stage = metadata?.stage as WorldCupStage | undefined;
      return Boolean(stage && stage !== 'group' && KNOCKOUT_ORDER.includes(stage));
    })
    .sort((a, b) => new Date(a.game_date_utc).getTime() - new Date(b.game_date_utc).getTime());

  const stageCounts: Partial<Record<WorldCupKnockoutStage, number>> = {};

  for (const game of knockoutGames) {
    const metadata = getMetadata(game);
    const stage = metadata?.stage as WorldCupStage | undefined;
    if (!stage || stage === 'group' || !KNOCKOUT_ORDER.includes(stage)) continue;
    const bracketStage = stage as WorldCupKnockoutStage;
    const index = stageCounts[bracketStage] ?? 0;
    stageCounts[bracketStage] = index + 1;

    bracket[bracketStage].push({
      id: game.id,
      stage,
      slot: metadata?.bracket_slot ?? game.provider_game_id.toString(),
      label: getBracketLabel(bracketStage, index),
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
      statusNote: metadata?.status_note ?? null,
    });
  }

  for (const stage of KNOCKOUT_ORDER) {
    bracket[stage].sort((a, b) => {
      if (a.date !== b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
      return a.slot.localeCompare(b.slot);
    });
  }

  synthesizeMissingFutureRounds(bracket);

  return bracket;
}

function getWinner(match: WorldCupBracketMatch): Team | null {
  if (!match.winnerTeamId) return null;
  if (match.homeTeam?.id === match.winnerTeamId) return match.homeTeam;
  if (match.awayTeam?.id === match.winnerTeamId) return match.awayTeam;
  return null;
}

function getLoser(match: WorldCupBracketMatch): Team | null {
  if (!match.winnerTeamId) return null;
  if (match.homeTeam?.id === match.winnerTeamId) return match.awayTeam;
  if (match.awayTeam?.id === match.winnerTeamId) return match.homeTeam;
  return null;
}

function makeSyntheticMatch(
  stage: WorldCupKnockoutStage,
  index: number,
  homeTeam: Team | null,
  awayTeam: Team | null,
  homeSeedLabel: string,
  awaySeedLabel: string,
): WorldCupBracketMatch {
  return {
    id: `synthetic-${stage}-${index + 1}`,
    stage,
    slot: `${stage}-${index + 1}`,
    label: getBracketLabel(stage, index),
    date: '',
    homeTeam,
    awayTeam,
    homeSeedLabel,
    awaySeedLabel,
    homeScore: null,
    awayScore: null,
    homePenalties: null,
    awayPenalties: null,
    winnerTeamId: null,
    status: 'scheduled',
    statusNote: null,
    synthetic: true,
  };
}

function synthesizeStageFromPreviousWinners(
  bracket: Record<WorldCupKnockoutStage, WorldCupBracketMatch[]>,
  previousStage: WorldCupKnockoutStage,
  nextStage: WorldCupKnockoutStage,
) {
  if (bracket[nextStage].length > 0) return;
  const previous = bracket[previousStage];
  if (previous.length < 2) return;

  const synthesized: WorldCupBracketMatch[] = [];
  for (let i = 0; i < previous.length; i += 2) {
    const first = previous[i];
    const second = previous[i + 1];
    if (!first || !second) continue;
    synthesized.push(
      makeSyntheticMatch(
        nextStage,
        synthesized.length,
        getWinner(first),
        getWinner(second),
        `Winner ${first.label}`,
        `Winner ${second.label}`,
      ),
    );
  }
  bracket[nextStage] = synthesized;
}

function synthesizeMissingFutureRounds(bracket: Record<WorldCupKnockoutStage, WorldCupBracketMatch[]>) {
  synthesizeStageFromPreviousWinners(bracket, 'quarterfinals', 'semifinals');

  if (bracket.final.length === 0 && bracket.semifinals.length >= 2) {
    bracket.final = [
      makeSyntheticMatch(
        'final',
        0,
        getWinner(bracket.semifinals[0]),
        getWinner(bracket.semifinals[1]),
        `Winner ${bracket.semifinals[0].label}`,
        `Winner ${bracket.semifinals[1].label}`,
      ),
    ];
  }

  if (bracket.third_place.length === 0 && bracket.semifinals.length >= 2) {
    bracket.third_place = [
      makeSyntheticMatch(
        'third_place',
        0,
        getLoser(bracket.semifinals[0]),
        getLoser(bracket.semifinals[1]),
        `Loser ${bracket.semifinals[0].label}`,
        `Loser ${bracket.semifinals[1].label}`,
      ),
    ];
  }
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
