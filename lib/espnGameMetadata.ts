export type NbaGamePhase = 'preseason' | 'regular' | 'postseason';

function cleanHeadline(headline: unknown): string | null {
  if (typeof headline !== 'string') return null;
  const cleaned = headline.replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

export function getEspnEventHeadline(competition: any): string | null {
  const notes = Array.isArray(competition?.notes) ? competition.notes : [];
  const headline = notes.find((note: any) => cleanHeadline(note?.headline))?.headline;
  return cleanHeadline(headline);
}

export function mapNbaPlayoffRound(headline: unknown): string | null {
  const normalized = cleanHeadline(headline)?.toUpperCase();
  if (!normalized) return null;
  if (/\bNBA FINALS\b/.test(normalized)) return 'finals';
  if (/\bCONFERENCE FINALS\b/.test(normalized)) return 'conf_finals';
  if (/\b(CONFERENCE SEMIFINALS|SECOND ROUND)\b/.test(normalized)) return 'conf_semis';
  if (/\bFIRST ROUND\b/.test(normalized)) return 'first_round';
  return null;
}

export function mapNbaSeasonPhase(seasonType: unknown): NbaGamePhase {
  if (seasonType === 1) return 'preseason';
  if (seasonType === 3) return 'postseason';
  return 'regular';
}

export function normalizeEspnEventLabel(headline: unknown, gameDate: unknown): string | null {
  const cleaned = cleanHeadline(headline);
  if (!cleaned) return null;

  const date = typeof gameDate === 'string' || gameDate instanceof Date
    ? new Date(gameDate)
    : null;
  const year = date && Number.isFinite(date.getTime()) ? date.getUTCFullYear() : null;
  const upper = cleaned.toUpperCase();
  const gameNumber = upper.match(/\bGAME\s+(\d+)\b/)?.[1] ?? null;

  let eventName: string | null = null;
  if (/\bNBA FINALS\b/.test(upper)) {
    eventName = 'NBA Finals';
  } else {
    const conference = /\bEASTERN\b/.test(upper)
      ? 'Eastern'
      : /\bWESTERN\b/.test(upper)
        ? 'Western'
        : null;
    if (/\bCONFERENCE FINALS\b/.test(upper)) {
      eventName = conference ? `${conference} Conference Finals` : 'Conference Finals';
    } else if (/\b(CONFERENCE SEMIFINALS|SECOND ROUND)\b/.test(upper)) {
      eventName = conference ? `${conference} Conference Semifinals` : 'Conference Semifinals';
    } else if (/\bFIRST ROUND\b/.test(upper)) {
      eventName = conference ? `${conference} Conference First Round` : 'First Round';
    }
  }

  if (!eventName) return null;
  return [year ? `${year} ${eventName}` : eventName, gameNumber ? `Game ${gameNumber}` : null]
    .filter(Boolean)
    .join(' · ');
}
