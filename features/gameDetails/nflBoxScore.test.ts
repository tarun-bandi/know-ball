import { normalizeEspnNflBoxScore } from '@/lib/nflBoxScore';

describe('ESPN NFL box score normalization', () => {
  it('merges a player across stat groups and maps teams to internal IDs', () => {
    const rows = normalizeEspnNflBoxScore({
      boxscore: {
        players: [{
          team: { abbreviation: 'GB' },
          statistics: [
            {
              name: 'passing',
              labels: ['C/ATT', 'YDS', 'TD', 'INT', 'SACKS', 'RTG'],
              athletes: [{
                athlete: { displayName: 'Jordan Love' },
                stats: ['12/18', '155', '2', '1', '2-14', '102.3'],
              }],
            },
            {
              name: 'rushing',
              labels: ['CAR', 'YDS', 'TD', 'LONG'],
              athletes: [{
                athlete: { displayName: 'Jordan Love' },
                stats: ['3', '21', '0', '12'],
              }],
            },
          ],
        }],
      },
    }, {
      id: 'game-1',
      awayTeamId: 'team-gb',
      homeTeamId: 'team-pit',
      awayTeamAbbreviation: 'GB',
      homeTeamAbbreviation: 'PIT',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      game_id: 'game-1',
      team_id: 'team-gb',
      player_name: 'Jordan Love',
      sport: 'nfl',
      stats: {
        passing_completions: 12,
        passing_attempts: 18,
        passing_yards: 155,
        passing_tds: 2,
        passing_ints: 1,
        sacks_taken: 2,
        passer_rating: 102.3,
        rushing_carries: 3,
        rushing_yards: 21,
        primary_category: 'passing',
      },
    });
  });

  it('drops teams that do not belong to the requested game', () => {
    const rows = normalizeEspnNflBoxScore({
      boxscore: {
        players: [{
          team: { abbreviation: 'CHI' },
          statistics: [{
            name: 'rushing',
            labels: ['CAR', 'YDS'],
            athletes: [{ athlete: { displayName: 'Unknown Player' }, stats: ['2', '8'] }],
          }],
        }],
      },
    }, {
      id: 'game-1',
      awayTeamId: 'team-gb',
      homeTeamId: 'team-pit',
      awayTeamAbbreviation: 'GB',
      homeTeamAbbreviation: 'PIT',
    });

    expect(rows).toEqual([]);
  });
});
