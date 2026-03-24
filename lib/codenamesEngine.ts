/** Pure game logic for NBA/NFL Codenames — no React, no side-effects. */

import { getAbbreviationPool } from '@/features/codenames/data/teams';
export { lookupTeam } from '@/features/codenames/data/teams';
export { validateClue } from '@/features/codenames/utils/clue-validation';

export type League = 'nba' | 'nfl' | 'mixed';
export type CardRole = 'red' | 'blue' | 'neutral' | 'assassin';
export type Team = 'red' | 'blue';
export type GuessOutcome = 'correct' | 'wrong_team' | 'neutral' | 'assassin';

export interface CodenamesCard {
  team: string;
  role: CardRole;
  revealed: boolean;
}

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
  const pool = getAbbreviationPool(league);
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
