import type { BoardCard } from '../types';
import { lookupTeam } from '../data/teams';

/**
 * Normalize text for comparison: lowercase, trim, collapse spaces.
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Naive singular/plural check. Returns true if a and b differ only by a
 * trailing "s" or "es".
 */
function isSingularPluralMatch(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long === short + 's') return true;
  if (long === short + 'es') return true;
  return false;
}

export interface ClueValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Collect all visible terms (name, city, displayName, aliases) from
 * unrevealed cards on the board. Uses the full team dataset for lookups.
 */
function getVisibleTerms(cards: BoardCard[], league?: 'nba' | 'nfl'): string[] {
  const terms: string[] = [];
  for (const card of cards) {
    if (card.revealed) continue;
    const record = lookupTeam(card.team, league);
    if (record) {
      terms.push(normalizeText(record.name));
      terms.push(normalizeText(record.city));
      terms.push(normalizeText(record.displayName));
      terms.push(normalizeText(record.abbreviation));
      for (const alias of record.aliases) {
        terms.push(normalizeText(alias));
      }
    } else {
      // Fallback: at minimum, the abbreviation itself is a visible term
      terms.push(normalizeText(card.team));
    }
  }
  return terms;
}

/**
 * Validate a clue word against the current board.
 * Returns { valid: true } or { valid: false, reason }.
 */
export function validateClue(
  clueWord: string,
  cards: BoardCard[],
  league?: 'nba' | 'nfl',
): ClueValidationResult {
  const normalized = normalizeText(clueWord);

  if (normalized.length === 0) {
    return { valid: false, reason: 'Clue cannot be empty.' };
  }

  if (normalized.includes(' ')) {
    return { valid: false, reason: 'Clue must be a single word.' };
  }

  if (/^\d+$/.test(normalized)) {
    return { valid: false, reason: 'Clue cannot be a number.' };
  }

  const visibleTerms = getVisibleTerms(cards, league);

  // Check exact match
  for (const term of visibleTerms) {
    if (normalized === term) {
      return { valid: false, reason: 'Clue matches a visible team name, city, or alias.' };
    }
  }

  // Check singular/plural variants
  for (const term of visibleTerms) {
    if (isSingularPluralMatch(normalized, term)) {
      return { valid: false, reason: 'Clue is too similar to a visible name (singular/plural variant).' };
    }
  }

  return { valid: true };
}
