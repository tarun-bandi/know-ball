import {
  getFanPassportBadges,
  getFanPassportLevel,
  getFanPassportScore,
  getFanPassportShareText,
  type FanPassportInputs,
} from '@/lib/fanPassport';

const emptyPassport: FanPassportInputs = {
  logsCount: 0,
  rankedCount: 0,
  listCount: 0,
  favoriteTeamCount: 0,
  favoritePlayerCount: 0,
  followerCount: 0,
  followingCount: 0,
  watchlistCount: 0,
  worldCupLogCount: 0,
  predictionAccuracy: null,
};

describe('fan passport helpers', () => {
  it('keeps brand-new users in founding fan state', () => {
    expect(getFanPassportLevel(emptyPassport)).toMatchObject({
      label: 'Founding Fan',
      score: 0,
    });
    expect(getFanPassportBadges(emptyPassport)).toEqual([
      expect.objectContaining({ key: 'founding-fan' }),
    ]);
  });

  it('scores logged, ranked, social, and world cup activity', () => {
    const input: FanPassportInputs = {
      ...emptyPassport,
      logsCount: 12,
      rankedCount: 5,
      listCount: 2,
      favoriteTeamCount: 3,
      favoritePlayerCount: 4,
      followerCount: 8,
      followingCount: 6,
      watchlistCount: 9,
      worldCupLogCount: 2,
      predictionAccuracy: { correct: 7, total: 10 },
    };

    expect(getFanPassportScore(input)).toBe(156);
    expect(getFanPassportLevel(input).label).toBe('Group Chat Starter');
  });

  it('surfaces the most venture-relevant passport badges', () => {
    const badges = getFanPassportBadges({
      ...emptyPassport,
      logsCount: 4,
      rankedCount: 4,
      favoriteTeamCount: 1,
      favoritePlayerCount: 2,
      worldCupLogCount: 1,
      predictionAccuracy: { correct: 3, total: 5 },
    });

    expect(badges.map((badge) => badge.key)).toEqual([
      'receipts',
      'ranked-taste',
      'predictor',
      'world-cup',
      'taste-graph',
    ]);
  });

  it('generates share copy for a public fan passport', () => {
    const text = getFanPassportShareText(
      { display_name: 'Tarun', handle: 'tarun' },
      { ...emptyPassport, logsCount: 10, rankedCount: 3, listCount: 1 },
      'https://know-ball.app/u/tarun',
    );

    expect(text).toContain("Tarun's Know Ball Fan Passport");
    expect(text).toContain('10 games logged, 3 ranked, 1 lists');
    expect(text).toContain('Follow @tarun: https://know-ball.app/u/tarun');
  });
});
