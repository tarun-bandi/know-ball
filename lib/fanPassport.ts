export type FanPassportTone = 'accent' | 'success' | 'warning' | 'muted';

export interface FanPassportInputs {
  logsCount: number;
  rankedCount: number;
  listCount: number;
  favoriteTeamCount: number;
  favoritePlayerCount: number;
  followerCount: number;
  followingCount: number;
  watchlistCount: number;
  worldCupLogCount: number;
  predictionAccuracy: { correct: number; total: number } | null;
}

export interface FanPassportBadge {
  key: string;
  label: string;
  detail: string;
  tone: FanPassportTone;
}

export interface FanPassportLevel {
  label: string;
  detail: string;
  score: number;
}

export interface FanPassportProfile {
  display_name: string;
  handle: string;
}

export function getFanPassportScore(input: FanPassportInputs): number {
  const predictionBonus = input.predictionAccuracy
    ? Math.round((input.predictionAccuracy.correct / Math.max(input.predictionAccuracy.total, 1)) * 10)
    : 0;

  return (
    input.logsCount * 4 +
    input.rankedCount * 5 +
    input.listCount * 8 +
    input.favoriteTeamCount * 3 +
    input.favoritePlayerCount * 2 +
    input.followerCount * 2 +
    input.followingCount +
    input.watchlistCount +
    input.worldCupLogCount * 6 +
    predictionBonus
  );
}

export function getFanPassportLevel(input: FanPassportInputs): FanPassportLevel {
  const score = getFanPassportScore(input);

  if (score >= 450) {
    return {
      label: 'Franchise Voice',
      detail: 'A visible taste profile with enough history to carry a fan graph.',
      score,
    };
  }

  if (score >= 180) {
    return {
      label: 'Film Room Regular',
      detail: 'Logs, rankings, and receipts are turning into a real sports identity.',
      score,
    };
  }

  if (score >= 60) {
    return {
      label: 'Group Chat Starter',
      detail: 'Enough activity to make recommendations and arguments feel personal.',
      score,
    };
  }

  return {
    label: 'Founding Fan',
    detail: 'The passport starts with your first logs, lists, follows, and predictions.',
    score,
  };
}

export function getFanPassportBadges(input: FanPassportInputs): FanPassportBadge[] {
  const badges: FanPassportBadge[] = [];

  if (input.logsCount > 0) {
    badges.push({
      key: 'receipts',
      label: 'Receipts',
      detail: `${input.logsCount} game${input.logsCount === 1 ? '' : 's'} logged`,
      tone: 'accent',
    });
  }

  if (input.rankedCount >= 3) {
    badges.push({
      key: 'ranked-taste',
      label: 'Ranked Taste',
      detail: `${input.rankedCount} ranked game${input.rankedCount === 1 ? '' : 's'}`,
      tone: 'success',
    });
  }

  if (input.predictionAccuracy && input.predictionAccuracy.total > 0) {
    badges.push({
      key: 'predictor',
      label: 'Prediction Record',
      detail: `${input.predictionAccuracy.correct}-${input.predictionAccuracy.total - input.predictionAccuracy.correct}`,
      tone: 'warning',
    });
  }

  if (input.worldCupLogCount > 0) {
    badges.push({
      key: 'world-cup',
      label: 'World Cup Mode',
      detail: `${input.worldCupLogCount} tournament log${input.worldCupLogCount === 1 ? '' : 's'}`,
      tone: 'accent',
    });
  }

  if (input.favoriteTeamCount + input.favoritePlayerCount > 0) {
    badges.push({
      key: 'taste-graph',
      label: 'Taste Graph',
      detail: `${input.favoriteTeamCount} teams, ${input.favoritePlayerCount} players`,
      tone: 'muted',
    });
  }

  if (input.listCount > 0 || input.watchlistCount > 0) {
    badges.push({
      key: 'curator',
      label: 'Curator',
      detail: `${input.listCount} list${input.listCount === 1 ? '' : 's'}, ${input.watchlistCount} watchlisted`,
      tone: 'success',
    });
  }

  return badges.length
    ? badges.slice(0, 6)
    : [{
      key: 'founding-fan',
      label: 'Founding Fan',
      detail: 'Start logging to build your sports identity',
      tone: 'accent',
    }];
}

export function getFanPassportShareText(
  profile: FanPassportProfile,
  input: FanPassportInputs,
  url: string,
): string {
  const level = getFanPassportLevel(input);
  const predictionLine = input.predictionAccuracy
    ? `\nPrediction record: ${input.predictionAccuracy.correct}/${input.predictionAccuracy.total}`
    : '';

  return [
    `${profile.display_name}'s Know Ball Fan Passport`,
    `Level: ${level.label}`,
    `${input.logsCount} games logged, ${input.rankedCount} ranked, ${input.listCount} lists${predictionLine}`,
    `Follow @${profile.handle}: ${url}`,
  ].join('\n');
}
