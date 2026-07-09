import type { Sport, SportProvider } from './types';
import { nbaProvider } from './nba';
import { nflProvider } from './nfl';
import { worldCupProvider } from './worldCup';

export type { Sport, SportProvider, BoxScoreColumnDef, BoxScoreCategory, TeamComparisonStatDef, ProviderGame } from './types';

const providers: Record<Sport, SportProvider> = {
  nba: nbaProvider,
  nfl: nflProvider,
  world_cup: worldCupProvider,
};

export function getProvider(sport: Sport): SportProvider {
  return providers[sport];
}

export function getAllProviders(): SportProvider[] {
  return Object.values(providers);
}
