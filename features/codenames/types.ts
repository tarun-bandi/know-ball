export type GameMode = 'nba' | 'nfl' | 'mixed';
export type TeamSide = 'red' | 'blue';
export type PlayerRole = 'spymaster' | 'guesser';
export type TurnPhase = 'spymaster_clue' | 'guessing' | 'game_over';

export type CardRole = 'red' | 'blue' | 'neutral' | 'assassin';

export interface TeamRecord {
  id: string;
  league: 'nba' | 'nfl';
  city: string;
  name: string;
  displayName: string;
  abbreviation: string;
  conference: string;
  division: string;
  aliases: string[];
}

export interface BoardCard {
  /** Team abbreviation shown on the card */
  team: string;
  role: CardRole;
  revealed: boolean;
}

export interface Clue {
  team: TeamSide;
  word: string;
  number: number;
}

export type GuessResult = 'correct' | 'wrong_team' | 'neutral' | 'assassin';

export interface GameState {
  cards: BoardCard[];
  currentTeam: TeamSide;
  phase: TurnPhase;
  currentClue: Clue | null;
  guessesRemaining: number;
  winner: TeamSide | null;
  winReason: 'cards' | 'assassin' | null;
  clueHistory: Clue[];
}
