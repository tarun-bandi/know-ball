/** Pure game logic for NBA/NFL Codenames — no React, no side-effects. */

const NBA_TEAMS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
] as const;

const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
  'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA',
  'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB',
  'TEN', 'WAS',
] as const;

export type League = 'nba' | 'nfl';
export type CardRole = 'red' | 'blue' | 'neutral' | 'assassin';
export type Team = 'red' | 'blue';
export type GuessOutcome = 'correct' | 'wrong_team' | 'neutral' | 'assassin';

export interface CodenamesCard {
  team: string;
  role: CardRole;
  revealed: boolean;
}

const TEAM_POOLS: Record<League, readonly string[]> = {
  nba: NBA_TEAMS,
  nfl: NFL_TEAMS,
};

/** Fisher-Yates shuffle (in-place). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a fresh 25-card board.
 * The team that goes first gets 9 cards, the other gets 8.
 */
export function generateBoard(firstTeam: Team, league: League = 'nba'): CodenamesCard[] {
  const pool = TEAM_POOLS[league];
  const teams = shuffle([...pool]).slice(0, 25);

  const roles: CardRole[] = [
    ...Array(9).fill(firstTeam),
    ...Array(8).fill(firstTeam === 'red' ? 'blue' : 'red'),
    ...Array(7).fill('neutral' as CardRole),
    'assassin',
  ];
  shuffle(roles);

  return teams.map((team, i) => ({
    team,
    role: roles[i],
    revealed: false,
  }));
}

/** Process a guess and return the outcome. Does NOT mutate the card array. */
export function processGuess(
  cards: CodenamesCard[],
  index: number,
  currentTeam: Team,
): GuessOutcome {
  const card = cards[index];
  if (card.revealed) return 'correct'; // already revealed, no-op
  if (card.role === 'assassin') return 'assassin';
  if (card.role === currentTeam) return 'correct';
  if (card.role === 'neutral') return 'neutral';
  return 'wrong_team';
}

/** Check if either team has revealed all their cards. Returns the winner or null. */
export function checkWinCondition(cards: CodenamesCard[]): Team | null {
  const redTotal = cards.filter((c) => c.role === 'red').length;
  const blueTotal = cards.filter((c) => c.role === 'blue').length;
  const redRevealed = cards.filter((c) => c.role === 'red' && c.revealed).length;
  const blueRevealed = cards.filter((c) => c.role === 'blue' && c.revealed).length;

  if (redRevealed === redTotal) return 'red';
  if (blueRevealed === blueTotal) return 'blue';
  return null;
}
