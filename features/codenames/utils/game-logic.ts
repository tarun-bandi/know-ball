/**
 * Pure game logic functions for Codenames.
 * Wraps and extends the existing engine in lib/codenamesEngine.ts.
 * These are deterministic, side-effect-free, and testable.
 */

import type {
  GameMode,
  TeamSide,
  CardRole,
  BoardCard,
  Clue,
  GuessResult,
  GameState,
} from '../types';
import { getAbbreviationPool } from '../data/teams';

// Fisher-Yates shuffle (non-mutating)
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Assign 25 card roles: 9 for starting team, 8 for other, 7 neutral, 1 assassin.
 */
export function assignRoles(startingTeam: TeamSide): CardRole[] {
  const other: TeamSide = startingTeam === 'red' ? 'blue' : 'red';
  const roles: CardRole[] = [
    ...Array<CardRole>(9).fill(startingTeam),
    ...Array<CardRole>(8).fill(other),
    ...Array<CardRole>(7).fill('neutral'),
    'assassin',
  ];
  return shuffle(roles);
}

/**
 * Pick 25 random team abbreviations from the pool and assign roles.
 */
export function generateBoard(mode: GameMode, startingTeam: TeamSide): BoardCard[] {
  const pool = getAbbreviationPool(mode);
  if (pool.length < 25) {
    throw new Error(`Not enough teams for mode "${mode}". Need 25, have ${pool.length}.`);
  }
  const selected = shuffle(pool).slice(0, 25);
  const roles = assignRoles(startingTeam);
  return selected.map((abbr, i) => ({
    team: abbr,
    role: roles[i],
    revealed: false,
  }));
}

function countRemaining(cards: BoardCard[], role: CardRole): number {
  return cards.filter((c) => c.role === role && !c.revealed).length;
}

/**
 * Create a fresh game state.
 */
export function createGame(mode: GameMode, startingTeam?: TeamSide): GameState {
  const start = startingTeam ?? (Math.random() < 0.5 ? 'red' : 'blue');
  const cards = generateBoard(mode, start);
  return {
    cards,
    currentTeam: start,
    phase: 'spymaster_clue',
    currentClue: null,
    guessesRemaining: 0,
    winner: null,
    winReason: null,
    clueHistory: [],
  };
}

/**
 * Check if either team has revealed all their cards.
 */
export function checkWinCondition(cards: BoardCard[]): TeamSide | null {
  const redTotal = cards.filter((c) => c.role === 'red').length;
  const blueTotal = cards.filter((c) => c.role === 'blue').length;
  const redRevealed = cards.filter((c) => c.role === 'red' && c.revealed).length;
  const blueRevealed = cards.filter((c) => c.role === 'blue' && c.revealed).length;

  if (redRevealed === redTotal) return 'red';
  if (blueRevealed === blueTotal) return 'blue';
  return null;
}

/**
 * Submit a clue. Returns new game state. Throws on invalid action.
 */
export function submitClue(
  state: GameState,
  team: TeamSide,
  clueWord: string,
  clueNumber: number,
): GameState {
  if (state.phase === 'game_over') throw new Error('Game is over.');
  if (state.phase !== 'spymaster_clue') throw new Error('Not in clue phase.');
  if (state.currentTeam !== team) throw new Error('Not your turn.');
  if (clueNumber < 1) throw new Error('Clue number must be at least 1.');

  const clue: Clue = { word: clueWord.trim().toUpperCase(), number: clueNumber, team };
  return {
    ...state,
    currentClue: clue,
    phase: 'guessing',
    guessesRemaining: clueNumber + 1,
    clueHistory: [...state.clueHistory, clue],
  };
}

/**
 * Guess a card. Returns [newState, result]. Throws on invalid action.
 */
export function guessCard(
  state: GameState,
  team: TeamSide,
  cardIndex: number,
): [GameState, GuessResult] {
  if (state.phase === 'game_over') throw new Error('Game is over.');
  if (state.phase !== 'guessing') throw new Error('No clue has been submitted yet.');
  if (state.currentTeam !== team) throw new Error('Not your turn.');
  if (cardIndex < 0 || cardIndex >= state.cards.length) throw new Error('Invalid card index.');

  const card = state.cards[cardIndex];
  if (card.revealed) throw new Error('Card already revealed.');

  // Reveal the card
  const newCards = state.cards.map((c, i) =>
    i === cardIndex ? { ...c, revealed: true } : c,
  );

  // Assassin → immediate loss
  if (card.role === 'assassin') {
    const winner: TeamSide = team === 'red' ? 'blue' : 'red';
    return [{
      ...state,
      cards: newCards,
      winner,
      winReason: 'assassin',
      phase: 'game_over',
      guessesRemaining: 0,
    }, 'assassin'];
  }

  // Check win condition
  const winner = checkWinCondition(newCards);
  if (winner) {
    return [{
      ...state,
      cards: newCards,
      winner,
      winReason: 'cards',
      phase: 'game_over',
      guessesRemaining: 0,
    }, card.role === team ? 'correct' : card.role === 'neutral' ? 'neutral' : 'wrong_team'];
  }

  // Correct guess
  if (card.role === team) {
    const remaining = state.guessesRemaining - 1;
    if (remaining <= 0) {
      // Used all guesses, end turn
      return [switchTurn({ ...state, cards: newCards, guessesRemaining: 0 }), 'correct'];
    }
    return [{ ...state, cards: newCards, guessesRemaining: remaining }, 'correct'];
  }

  // Wrong guess — opponent card or neutral. Turn ends.
  const result: GuessResult = card.role === 'neutral' ? 'neutral' : 'wrong_team';
  return [switchTurn({ ...state, cards: newCards }), result];
}

/**
 * Voluntarily end the current team's turn.
 */
export function endTurn(state: GameState, team: TeamSide): GameState {
  if (state.phase === 'game_over') throw new Error('Game is over.');
  if (state.currentTeam !== team) throw new Error('Not your turn.');
  if (state.phase !== 'guessing') throw new Error('Cannot end turn during clue phase.');
  return switchTurn(state);
}

function switchTurn(state: GameState): GameState {
  const nextTeam: TeamSide = state.currentTeam === 'red' ? 'blue' : 'red';
  return {
    ...state,
    currentTeam: nextTeam,
    phase: 'spymaster_clue',
    currentClue: null,
    guessesRemaining: 0,
  };
}
