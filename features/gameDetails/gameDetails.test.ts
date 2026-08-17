import { buildGameSlug, gamePath, parseGameSlug } from '@/lib/gameRoutes';
import { normalizeEspnGameSummary } from '@/lib/espnGameSummary';

describe('game detail routes', () => {
  const game = {
    sport: 'nba' as const,
    game_date_utc: '2026-04-25T00:00:00Z',
    away_team: { abbreviation: 'LAL' },
    home_team: { abbreviation: 'HOU' },
  };

  it('builds a readable matchup slug in the league calendar date', () => {
    expect(buildGameSlug(game)).toBe('nba-2026-04-24-lal-at-hou');
    expect(gamePath(game)).toBe('/game/nba-2026-04-24-lal-at-hou');
  });

  it('parses readable matchup slugs', () => {
    expect(parseGameSlug('nba-2026-04-24-lal-at-hou')).toEqual({
      sport: 'nba',
      date: '2026-04-24',
      awayAbbreviation: 'LAL',
      homeAbbreviation: 'HOU',
    });
    expect(parseGameSlug('not-a-game')).toBeNull();
  });
});

describe('ESPN game summary normalization', () => {
  it('normalizes scores, periods, players, leaders, and game details', () => {
    const result = normalizeEspnGameSummary({
      header: {
        competitions: [{
          date: '2026-04-25T00:00Z',
          status: { type: { state: 'post', shortDetail: 'Final/OT' } },
          series: [{ summary: 'LAL win series 2-1' }],
          broadcasts: [{ media: { shortName: 'Prime Video' } }],
          competitors: [
            {
              homeAway: 'away',
              winner: true,
              score: '112',
              linescores: [{ displayValue: '39' }, { displayValue: '11' }],
              record: [{ type: 'total', displayValue: '53-29' }],
              team: { id: '13', abbreviation: 'LAL', displayName: 'Los Angeles Lakers', name: 'Lakers', color: '552583' },
            },
            {
              homeAway: 'home',
              winner: false,
              score: '108',
              linescores: [{ displayValue: '32' }, { displayValue: '7' }],
              team: { id: '10', abbreviation: 'HOU', displayName: 'Houston Rockets', name: 'Rockets', color: 'ce1141' },
            },
          ],
        }],
      },
      boxscore: {
        teams: [{
          team: { id: '13', abbreviation: 'LAL', displayName: 'Los Angeles Lakers', name: 'Lakers' },
          statistics: [{ name: 'fieldGoalPct', label: 'Field Goal %', displayValue: '48' }],
        }],
        players: [{
          team: { id: '13', abbreviation: 'LAL', displayName: 'Los Angeles Lakers', name: 'Lakers' },
          statistics: [{
            labels: ['MIN', 'PTS'],
            athletes: [{
              starter: true,
              athlete: { id: '1966', displayName: 'LeBron James', shortName: 'L. James', jersey: '23', position: { abbreviation: 'F' } },
              stats: ['45', '29'],
            }],
          }],
        }],
      },
      leaders: [{
        team: { id: '13', abbreviation: 'LAL', displayName: 'Los Angeles Lakers', name: 'Lakers' },
        leaders: [{
          name: 'points',
          displayName: 'Points',
          leaders: [{ athlete: { id: '1966', displayName: 'LeBron James', shortName: 'L. James' }, displayValue: '29' }],
        }],
      }],
      gameInfo: {
        venue: { fullName: 'Toyota Center (Houston)' },
        attendance: 18055,
        officials: [{ displayName: 'Zach Zarba' }],
      },
    }, '401869400');

    expect(result.status).toBe('final');
    expect(result.statusDetail).toBe('Final/OT');
    expect(result.awayTeam.score).toBe('112');
    expect(result.awayTeam.record).toBe('53-29');
    expect(result.periods).toEqual([
      { label: 'Q1', away: '39', home: '32' },
      { label: 'Q2', away: '11', home: '7' },
    ]);
    expect(result.playerStats[0].players[0].stats).toEqual({ MIN: '45', PTS: '29' });
    expect(result.leaders[0].leaders[0].athleteName).toBe('LeBron James');
    expect(result.venue).toBe('Toyota Center (Houston)');
    expect(result.attendance).toBe(18055);
  });
});
