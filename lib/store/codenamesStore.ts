import { create } from 'zustand';
import {
  generateBoard,
  processGuess,
  checkWinCondition,
  type CodenamesCard,
  type Team,
  type GuessOutcome,
} from '@/lib/codenamesEngine';

export type GamePhase =
  | 'setup'
  | 'handoff_spymaster'
  | 'spymaster_clue'
  | 'handoff_guessers'
  | 'guessing'
  | 'game_over';

export interface ClueEntry {
  team: Team;
  word: string;
  number: number;
}

interface CodenamesState {
  cards: CodenamesCard[];
  currentTeam: Team;
  phase: GamePhase;
  currentClue: ClueEntry | null;
  guessesRemaining: number;
  winner: Team | null;
  winReason: 'cards' | 'assassin' | null;
  clueHistory: ClueEntry[];
  firstTeam: Team;

  // Actions
  startNewGame: (firstTeam: Team) => void;
  confirmHandoff: () => void;
  submitClue: (word: string, number: number) => void;
  revealCard: (index: number) => GuessOutcome | null;
  endTurn: () => void;
  resetGame: () => void;
}

export const useCodenamesStore = create<CodenamesState>((set, get) => ({
  cards: [],
  currentTeam: 'red',
  phase: 'setup',
  currentClue: null,
  guessesRemaining: 0,
  winner: null,
  winReason: null,
  clueHistory: [],
  firstTeam: 'red',

  startNewGame: (firstTeam) => {
    set({
      cards: generateBoard(firstTeam),
      currentTeam: firstTeam,
      phase: 'handoff_spymaster',
      currentClue: null,
      guessesRemaining: 0,
      winner: null,
      winReason: null,
      clueHistory: [],
      firstTeam,
    });
  },

  confirmHandoff: () => {
    const { phase } = get();
    if (phase === 'handoff_spymaster') {
      set({ phase: 'spymaster_clue' });
    } else if (phase === 'handoff_guessers') {
      set({ phase: 'guessing' });
    }
  },

  submitClue: (word, number) => {
    const { currentTeam, clueHistory } = get();
    const clue: ClueEntry = { team: currentTeam, word, number };
    set({
      currentClue: clue,
      guessesRemaining: number + 1, // +1 bonus guess per Codenames rules
      phase: 'handoff_guessers',
      clueHistory: [...clueHistory, clue],
    });
  },

  revealCard: (index) => {
    const { cards, currentTeam, guessesRemaining, phase } = get();
    if (phase !== 'guessing' || guessesRemaining <= 0) return null;
    if (cards[index].revealed) return null;

    const outcome = processGuess(cards, index, currentTeam);
    const newCards = cards.map((c, i) =>
      i === index ? { ...c, revealed: true } : c,
    );

    if (outcome === 'assassin') {
      const losingTeam = currentTeam;
      set({
        cards: newCards,
        winner: losingTeam === 'red' ? 'blue' : 'red',
        winReason: 'assassin',
        phase: 'game_over',
      });
      return outcome;
    }

    // Check win by revealing all cards
    const winner = checkWinCondition(newCards);
    if (winner) {
      set({
        cards: newCards,
        winner,
        winReason: 'cards',
        phase: 'game_over',
      });
      return outcome;
    }

    if (outcome === 'correct') {
      const remaining = guessesRemaining - 1;
      if (remaining <= 0) {
        // Out of guesses — switch turns
        const nextTeam: Team = currentTeam === 'red' ? 'blue' : 'red';
        set({
          cards: newCards,
          currentTeam: nextTeam,
          guessesRemaining: 0,
          currentClue: null,
          phase: 'handoff_spymaster',
        });
      } else {
        set({ cards: newCards, guessesRemaining: remaining });
      }
      return outcome;
    }

    // Wrong team or neutral — turn ends
    const nextTeam: Team = currentTeam === 'red' ? 'blue' : 'red';
    set({
      cards: newCards,
      currentTeam: nextTeam,
      guessesRemaining: 0,
      currentClue: null,
      phase: 'handoff_spymaster',
    });
    return outcome;
  },

  endTurn: () => {
    const { currentTeam } = get();
    const nextTeam: Team = currentTeam === 'red' ? 'blue' : 'red';
    set({
      currentTeam: nextTeam,
      guessesRemaining: 0,
      currentClue: null,
      phase: 'handoff_spymaster',
    });
  },

  resetGame: () => {
    set({
      cards: [],
      currentTeam: 'red',
      phase: 'setup',
      currentClue: null,
      guessesRemaining: 0,
      winner: null,
      winReason: null,
      clueHistory: [],
      firstTeam: 'red',
    });
  },
}));
