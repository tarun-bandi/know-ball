import {
  buildWorldCupBracket,
  computeWorldCupStandings,
  sortGoldenBootRace,
} from '@/lib/worldCup';
import type { Team, WorldCupGame } from '@/types/database';

function team(id: string, abbreviation: string, fullName: string): Team {
  return {
    id,
    provider: 'espn_world_cup',
    provider_team_id: Number(id),
    abbreviation,
    city: fullName,
    conference: null,
    division: null,
    full_name: fullName,
    name: fullName,
    sport: 'world_cup',
    created_at: '2026-01-01T00:00:00Z',
  };
}

function game(
  id: string,
  home: Team,
  away: Team,
  homeScore: number | null,
  awayScore: number | null,
  status: 'scheduled' | 'live' | 'final',
  metadata: Partial<NonNullable<WorldCupGame['world_cup_match_metadata']>>,
): WorldCupGame {
  return {
    id,
    provider: 'espn_world_cup',
    provider_game_id: Number(id),
    season_id: 'season-2026',
    home_team_id: home.id,
    away_team_id: away.id,
    home_team_score: homeScore,
    away_team_score: awayScore,
    game_date_utc: '2026-06-12T00:00:00Z',
    status,
    period: null,
    time: null,
    postseason: false,
    playoff_round: null,
    sport: 'world_cup',
    period_scores: null,
    home_q1: null,
    home_q2: null,
    home_q3: null,
    home_q4: null,
    home_ot: null,
    away_q1: null,
    away_q2: null,
    away_q3: null,
    away_q4: null,
    away_ot: null,
    arena: null,
    attendance: null,
    highlights_url: null,
    week: null,
    broadcast: null,
    home_team_record: null,
    away_team_record: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    season: {
      id: 'season-2026',
      year: 2026,
      type: 'playoffs',
      sport: 'world_cup',
      created_at: '2026-01-01T00:00:00Z',
    },
    home_team: home,
    away_team: away,
    world_cup_match_metadata: {
      game_id: id,
      tournament_year: 2026,
      stage: 'group',
      group_code: 'A',
      matchday: 1,
      bracket_slot: null,
      home_seed_label: null,
      away_seed_label: null,
      home_penalties: null,
      away_penalties: null,
      status_note: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      ...metadata,
    },
  };
}

describe('world cup tournament helpers', () => {
  const argentina = team('1', 'ARG', 'Argentina');
  const france = team('2', 'FRA', 'France');
  const japan = team('3', 'JPN', 'Japan');
  const canada = team('4', 'CAN', 'Canada');

  it('computes group standings by points, goal difference, then goals for', () => {
    const standings = computeWorldCupStandings([
      game('101', argentina, france, 2, 1, 'final', { group_code: 'A' }),
      game('102', japan, canada, 1, 1, 'final', { group_code: 'A' }),
      game('103', argentina, japan, 0, 0, 'final', { group_code: 'A' }),
      game('104', france, canada, 3, 0, 'final', { group_code: 'A' }),
    ]);

    expect(standings.A.map((row) => row.team.abbreviation)).toEqual(['ARG', 'FRA', 'JPN', 'CAN']);
    expect(standings.A[0]).toMatchObject({ points: 4, goalDifference: 1, rank: 1 });
    expect(standings.A[1]).toMatchObject({ points: 3, goalDifference: 2, rank: 2 });
  });

  it('keeps scheduled matches out of the table math', () => {
    const standings = computeWorldCupStandings([
      game('201', argentina, france, null, null, 'scheduled', { group_code: 'B' }),
    ]);

    expect(standings.B[0]).toMatchObject({ played: 0, points: 0 });
    expect(standings.B[1]).toMatchObject({ played: 0, points: 0 });
  });

  it('builds knockout bracket winners with penalty shootouts', () => {
    const bracket = buildWorldCupBracket([
      game('301', argentina, france, 1, 1, 'final', {
        stage: 'round_of_16',
        group_code: null,
        bracket_slot: 'R16-01',
        home_penalties: 4,
        away_penalties: 3,
      }),
    ]);

    expect(bracket.round_of_16[0]).toMatchObject({
      slot: 'R16-01',
      winnerTeamId: argentina.id,
      homePenalties: 4,
      awayPenalties: 3,
    });
  });

  it('sorts golden boot race by goals, assists, then fewer minutes', () => {
    const race = sortGoldenBootRace([
      {
        playerId: 'p1',
        playerName: 'Player One',
        team: argentina,
        goals: 5,
        assists: 1,
        minutes: 500,
        matchesPlayed: 5,
        penalties: 1,
        headshotUrl: null,
      },
      {
        playerId: 'p2',
        playerName: 'Player Two',
        team: france,
        goals: 5,
        assists: 2,
        minutes: 620,
        matchesPlayed: 6,
        penalties: 0,
        headshotUrl: null,
      },
      {
        playerId: 'p3',
        playerName: 'Player Three',
        team: japan,
        goals: 5,
        assists: 2,
        minutes: 410,
        matchesPlayed: 4,
        penalties: 0,
        headshotUrl: null,
      },
    ]);

    expect(race.map((entry) => entry.playerId)).toEqual(['p3', 'p2', 'p1']);
  });
});
