import { buildGameSlug, gamePath, parseGameSlug } from '@/lib/gameRoutes';
import { normalizeEspnGameSummary } from '@/lib/espnGameSummary';
import { mapNbaPlayoffRound, normalizeEspnEventLabel } from '@/lib/espnGameMetadata';
import { getTeamAccentColor } from '@/lib/teamColors';

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

describe('game detail team colorways', () => {
  it('uses each NFL team palette instead of NBA fallback colors', () => {
    expect(getTeamAccentColor('GB', 'nfl')).toBe('#203731');
    expect(getTeamAccentColor('PIT', 'nfl')).toBe('#FFB612');
  });
});

describe('ESPN game summary normalization', () => {
  it('normalizes scores, periods, players, leaders, and game details', () => {
    const result = normalizeEspnGameSummary({
      header: {
        competitions: [{
          date: '2026-04-25T00:00Z',
          status: { type: { state: 'post', shortDetail: 'Final/OT' } },
          notes: [{ headline: 'NBA FINALS - GAME 5' }],
          series: [
            { type: 'regular', summary: 'Season series tied 1-1' },
            { type: 'playoff', summary: 'LAL win series 4-1' },
          ],
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
      videos: [{
        id: 987,
        headline: 'Game 5 highlights',
        description: 'The best moments from Game 5.',
        duration: 142,
        thumbnail: 'http://cdn.espn.com/thumb.jpg',
        links: {
          source: {
            HD: { href: 'http://cdn.espn.com/game-5.mp4' },
            HLS: { href: 'https://cdn.espn.com/game-5.m3u8' },
          },
          web: { href: 'http://www.espn.com/video/clip?id=987' },
        },
      }],
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
    expect(result.seriesSummary).toBe('LAL win series 4-1');
    expect(result.eventLabel).toBe('2026 NBA Finals · Game 5');
    expect(result.highlights).toEqual([expect.objectContaining({
      id: '987',
      title: 'Game 5 highlights',
      videoUrl: 'https://cdn.espn.com/game-5.mp4',
      thumbnailUrl: 'https://cdn.espn.com/thumb.jpg',
    })]);
  });
});

describe('NBA event metadata', () => {
  it('creates readable playoff labels and round keys from ESPN notes', () => {
    expect(normalizeEspnEventLabel('NBA FINALS - GAME 5', '2017-06-13T01:00:00Z'))
      .toBe('2017 NBA Finals · Game 5');
    expect(normalizeEspnEventLabel('EASTERN CONFERENCE FINALS - GAME 7', '2018-05-28T00:30:00Z'))
      .toBe('2018 Eastern Conference Finals · Game 7');
    expect(mapNbaPlayoffRound('WESTERN CONFERENCE SEMIFINALS - GAME 2')).toBe('conf_semis');
  });
});
