import {
  createGame,
  generateBoard,
  assignRoles,
  submitClue,
  guessCard,
  endTurn,
  checkWinCondition,
} from '../utils/game-logic';
import type { GameState, BoardCard } from '../types';

describe('assignRoles', () => {
  it('returns 25 roles', () => {
    const roles = assignRoles('red');
    expect(roles).toHaveLength(25);
  });

  it('has correct role counts for red starting', () => {
    const roles = assignRoles('red');
    expect(roles.filter((r) => r === 'red')).toHaveLength(9);
    expect(roles.filter((r) => r === 'blue')).toHaveLength(8);
    expect(roles.filter((r) => r === 'neutral')).toHaveLength(7);
    expect(roles.filter((r) => r === 'assassin')).toHaveLength(1);
  });

  it('has correct role counts for blue starting', () => {
    const roles = assignRoles('blue');
    expect(roles.filter((r) => r === 'blue')).toHaveLength(9);
    expect(roles.filter((r) => r === 'red')).toHaveLength(8);
    expect(roles.filter((r) => r === 'neutral')).toHaveLength(7);
    expect(roles.filter((r) => r === 'assassin')).toHaveLength(1);
  });
});

describe('generateBoard', () => {
  it('produces 25 unique cards for nba mode', () => {
    const board = generateBoard('nba', 'red');
    expect(board).toHaveLength(25);
    const abbrs = board.map((c) => c.team);
    expect(new Set(abbrs).size).toBe(25);
  });

  it('produces 25 unique cards for nfl mode', () => {
    const board = generateBoard('nfl', 'blue');
    expect(board).toHaveLength(25);
    const abbrs = board.map((c) => c.team);
    expect(new Set(abbrs).size).toBe(25);
  });

  it('produces 25 unique cards for mixed mode', () => {
    const board = generateBoard('mixed', 'red');
    expect(board).toHaveLength(25);
    const abbrs = board.map((c) => c.team);
    expect(new Set(abbrs).size).toBe(25);
  });

  it('all cards start unrevealed', () => {
    const board = generateBoard('nba', 'red');
    expect(board.every((c) => !c.revealed)).toBe(true);
  });
});

describe('createGame', () => {
  it('creates a valid initial game state', () => {
    const state = createGame('nba', 'red');
    expect(state.cards).toHaveLength(25);
    expect(state.currentTeam).toBe('red');
    expect(state.phase).toBe('spymaster_clue');
    expect(state.currentClue).toBeNull();
    expect(state.guessesRemaining).toBe(0);
    expect(state.winner).toBeNull();
    expect(state.phase).not.toBe('game_over');
    expect(state.clueHistory).toEqual([]);
  });

  it('assigns random starting team when not specified', () => {
    // Run 20 times and check we get at least one of each
    const teams = new Set<string>();
    for (let i = 0; i < 50; i++) {
      teams.add(createGame('nba').currentTeam);
    }
    expect(teams.has('red')).toBe(true);
    expect(teams.has('blue')).toBe(true);
  });
});

describe('submitClue', () => {
  let state: GameState;
  beforeEach(() => {
    state = createGame('nba', 'red');
  });

  it('transitions to guessing phase', () => {
    const next = submitClue(state, 'red', 'ANIMAL', 3);
    expect(next.phase).toBe('guessing');
    expect(next.currentClue).toEqual({ team: 'red', word: 'ANIMAL', number: 3 });
    expect(next.guessesRemaining).toBe(4); // number + 1
    expect(next.clueHistory).toHaveLength(1);
  });

  it('rejects clue from wrong team', () => {
    expect(() => submitClue(state, 'blue', 'ANIMAL', 2)).toThrow('Not your turn');
  });

  it('rejects clue when not in clue phase', () => {
    const guessing = submitClue(state, 'red', 'ANIMAL', 2);
    expect(() => submitClue(guessing, 'red', 'ANOTHER', 1)).toThrow('Not in clue phase');
  });

  it('rejects clue number < 1', () => {
    expect(() => submitClue(state, 'red', 'ANIMAL', 0)).toThrow('at least 1');
  });
});

describe('guessCard', () => {
  let state: GameState;
  beforeEach(() => {
    state = createGame('nba', 'red');
    state = submitClue(state, 'red', 'ANIMAL', 3);
  });

  it('correct guess stays on same team turn', () => {
    const redIdx = state.cards.findIndex((c) => c.role === 'red');
    const [next, result] = guessCard(state, 'red', redIdx);
    expect(result).toBe('correct');
    expect(next.cards[redIdx].revealed).toBe(true);
    expect(next.currentTeam).toBe('red'); // still red's turn
    expect(next.guessesRemaining).toBe(3); // was 4, now 3
  });

  it('opponent card ends turn', () => {
    const blueIdx = state.cards.findIndex((c) => c.role === 'blue');
    const [next, result] = guessCard(state, 'red', blueIdx);
    expect(result).toBe('wrong_team');
    expect(next.currentTeam).toBe('blue');
    expect(next.phase).toBe('spymaster_clue');
  });

  it('neutral card ends turn', () => {
    const neutralIdx = state.cards.findIndex((c) => c.role === 'neutral');
    const [next, result] = guessCard(state, 'red', neutralIdx);
    expect(result).toBe('neutral');
    expect(next.currentTeam).toBe('blue');
    expect(next.phase).toBe('spymaster_clue');
  });

  it('assassin card causes immediate loss', () => {
    const assassinIdx = state.cards.findIndex((c) => c.role === 'assassin');
    const [next, result] = guessCard(state, 'red', assassinIdx);
    expect(result).toBe('assassin');
    expect(next.phase).toBe('game_over');
    expect(next.winner).toBe('blue');
    expect(next.winReason).toBe('assassin');
  });

  it('rejects guess from wrong team', () => {
    expect(() => guessCard(state, 'blue', 0)).toThrow('Not your turn');
  });

  it('rejects guessing already revealed card', () => {
    const redIdx = state.cards.findIndex((c) => c.role === 'red');
    const [next] = guessCard(state, 'red', redIdx);
    expect(() => guessCard(next, 'red', redIdx)).toThrow('already revealed');
  });

  it('rejects guess before clue', () => {
    const fresh = createGame('nba', 'red');
    expect(() => guessCard(fresh, 'red', 0)).toThrow('No clue');
  });

  it('using all guesses ends turn', () => {
    // Submit clue for 1 → gives 2 guesses
    let s = createGame('nba', 'red');
    s = submitClue(s, 'red', 'ANIMAL', 1);

    // Make 2 correct guesses → should end turn
    const redIndices = s.cards
      .map((c, i) => (c.role === 'red' ? i : -1))
      .filter((i) => i >= 0);

    const [s2] = guessCard(s, 'red', redIndices[0]);
    expect(s2.currentTeam).toBe('red'); // 1 guess left

    const [s3] = guessCard(s2, 'red', redIndices[1]);
    expect(s3.currentTeam).toBe('blue'); // used all guesses
    expect(s3.phase).toBe('spymaster_clue');
  });
});

describe('endTurn', () => {
  it('switches team and resets to clue phase', () => {
    let state = createGame('nba', 'red');
    state = submitClue(state, 'red', 'ANIMAL', 2);
    const next = endTurn(state, 'red');
    expect(next.currentTeam).toBe('blue');
    expect(next.phase).toBe('spymaster_clue');
    expect(next.currentClue).toBeNull();
    expect(next.guessesRemaining).toBe(0);
  });

  it('rejects end turn from wrong team', () => {
    let state = createGame('nba', 'red');
    state = submitClue(state, 'red', 'ANIMAL', 2);
    expect(() => endTurn(state, 'blue')).toThrow('Not your turn');
  });

  it('rejects end turn during clue phase', () => {
    const state = createGame('nba', 'red');
    expect(() => endTurn(state, 'red')).toThrow('Cannot end turn during clue phase');
  });
});

describe('checkWinCondition', () => {
  it('returns null when no team has won', () => {
    const board = generateBoard('nba', 'red');
    expect(checkWinCondition(board)).toBeNull();
  });

  it('detects red win when all red cards revealed', () => {
    const board = generateBoard('nba', 'red');
    // Reveal all red cards
    const revealed = board.map((c) =>
      c.role === 'red' ? { ...c, revealed: true } : c,
    );
    expect(checkWinCondition(revealed)).toBe('red');
  });

  it('detects blue win when all blue cards revealed', () => {
    const board = generateBoard('nba', 'blue');
    const revealed = board.map((c) =>
      c.role === 'blue' ? { ...c, revealed: true } : c,
    );
    expect(checkWinCondition(revealed)).toBe('blue');
  });
});

describe('win condition through gameplay', () => {
  it('reveals all cards of one team triggers win', () => {
    let state = createGame('nba', 'red');

    // Get all red card indices
    const redIndices = state.cards
      .map((c, i) => (c.role === 'red' ? i : -1))
      .filter((i) => i >= 0);

    // Play through revealing all red cards
    for (let i = 0; i < redIndices.length; i++) {
      // Submit clue
      if (state.phase === 'spymaster_clue' && state.currentTeam === 'red') {
        state = submitClue(state, 'red', `CLUE${i}`, 9);
      }
      // If it's blue's turn (from a prior wrong guess), submit clue and end turn
      while (state.currentTeam === 'blue' && state.phase !== 'game_over') {
        if (state.phase === 'spymaster_clue') {
          state = submitClue(state, 'blue', `BLUECLUE${i}`, 1);
        }
        state = endTurn(state, 'blue');
        if (state.phase === 'spymaster_clue' && state.currentTeam === 'red') {
          state = submitClue(state, 'red', `CLUE${i}B`, 9);
        }
      }

      if (state.phase === 'game_over') break;

      const [next, result] = guessCard(state, 'red', redIndices[i]);
      state = next;
      if (state.phase === 'game_over') break;
    }

    expect(state.phase).toBe('game_over');
    expect(state.winner).toBe('red');
    expect(state.winReason).toBe('cards');
  });
});
