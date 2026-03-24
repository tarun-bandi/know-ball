import { validateClue, normalizeText } from '../utils/clue-validation';
import type { BoardCard } from '../types';

// Helper: create a minimal board with known teams
function makeBoard(abbreviations: string[]): BoardCard[] {
  const roles = ['red', 'blue', 'neutral', 'assassin'] as const;
  return abbreviations.map((abbr, i) => ({
    team: abbr,
    role: roles[i % 4],
    revealed: false,
  }));
}

describe('normalizeText', () => {
  it('lowercases and trims', () => {
    expect(normalizeText('  HELLO  ')).toBe('hello');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeText('a  b   c')).toBe('a b c');
  });
});

describe('validateClue', () => {
  const board = makeBoard(['BOS', 'LAL', 'CHI', 'MIA', 'GSW', 'NYK']);

  it('accepts valid clue', () => {
    const result = validateClue('animal', board, 'nba');
    expect(result.valid).toBe(true);
  });

  it('rejects empty clue', () => {
    expect(validateClue('', board, 'nba').valid).toBe(false);
  });

  it('rejects multi-word clue', () => {
    expect(validateClue('two words', board, 'nba').valid).toBe(false);
  });

  it('rejects numeric clue', () => {
    expect(validateClue('123', board, 'nba').valid).toBe(false);
  });

  it('rejects clue matching team name (case-insensitive)', () => {
    // "Celtics" is the name for BOS
    expect(validateClue('celtics', board, 'nba').valid).toBe(false);
    expect(validateClue('CELTICS', board, 'nba').valid).toBe(false);
  });

  it('rejects clue matching city', () => {
    // "Boston" is the city for BOS
    expect(validateClue('boston', board, 'nba').valid).toBe(false);
  });

  it('rejects clue matching displayName', () => {
    // "LA Lakers" display name for LAL — "la lakers" should fail
    // But since it has a space it will fail multi-word check first
    // The abbreviation "LAL" itself should also fail
    expect(validateClue('lal', board, 'nba').valid).toBe(false);
  });

  it('rejects clue matching abbreviation', () => {
    expect(validateClue('bos', board, 'nba').valid).toBe(false);
    expect(validateClue('BOS', board, 'nba').valid).toBe(false);
  });

  it('rejects clue matching alias', () => {
    // "Cs" is an alias for BOS Celtics
    expect(validateClue('cs', board, 'nba').valid).toBe(false);
  });

  it('rejects singular/plural variant of team name', () => {
    // "Celtic" (singular of "Celtics") should be rejected
    expect(validateClue('celtic', board, 'nba').valid).toBe(false);
  });

  it('allows clue when matching team is already revealed', () => {
    const revealedBoard = board.map((c) =>
      c.team === 'BOS' ? { ...c, revealed: true } : c,
    );
    // "Celtics" should now be OK since BOS is revealed
    expect(validateClue('celtics', revealedBoard, 'nba').valid).toBe(true);
  });

  it('rejects clue matching NFL team when using NFL board', () => {
    const nflBoard = makeBoard(['BUF', 'DAL', 'GB', 'KC']);
    expect(validateClue('bills', nflBoard, 'nfl').valid).toBe(false);
    expect(validateClue('cowboys', nflBoard, 'nfl').valid).toBe(false);
    expect(validateClue('packers', nflBoard, 'nfl').valid).toBe(false);
  });

  it('works with mixed mode board', () => {
    // BOS exists in both NBA and NFL abbreviation space but the lookup
    // should still find the right team record
    const mixedBoard = makeBoard(['BOS', 'DAL', 'MIA', 'SF']);
    expect(validateClue('celtics', mixedBoard).valid).toBe(false);
    expect(validateClue('niners', mixedBoard).valid).toBe(false); // alias for SF
  });
});
