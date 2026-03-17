export interface NormalizedPlayByPlayAction {
  actionNumber: number;
  clock: string;
  period: number;
  teamTricode: string;
  playerName: string;
  description: string;
  actionType: string;
  scoreHome: string;
  scoreAway: string;
  isFieldGoal: boolean;
  shotResult?: string;
}

function toClockValue(clock: any): string {
  if (typeof clock?.displayValue === 'string') return clock.displayValue;
  if (typeof clock === 'string') return clock;

  if (typeof clock?.value === 'number' && Number.isFinite(clock.value)) {
    const totalSeconds = Math.max(0, Math.round(clock.value));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  return '';
}

function toPeriodValue(period: any): number {
  if (typeof period?.number === 'number' && Number.isFinite(period.number)) return period.number;
  if (typeof period?.value === 'number' && Number.isFinite(period.value)) return period.value;
  if (typeof period === 'number' && Number.isFinite(period)) return period;
  return 0;
}

function inferShotResult(play: any): string | undefined {
  if (play?.scoringPlay) return 'Made';
  const text = String(play?.text ?? '').toLowerCase();
  if (!text) return undefined;
  if (text.includes('misses') || text.includes('missed')) return 'Missed';
  if (text.includes('makes') || text.includes('made')) return 'Made';
  return undefined;
}

function extractPlayerName(play: any): string {
  const participants = Array.isArray(play?.participants) ? play.participants : [];
  for (const participant of participants) {
    const displayName = participant?.athlete?.displayName;
    if (typeof displayName === 'string' && displayName.length > 0) return displayName;
  }
  return '';
}

/**
 * ESPN summary payloads include an array at `summary.plays`.
 * This normalizes those raw plays into the app's play-by-play shape.
 */
export function parseEspnPlayByPlayActions(summary: any): NormalizedPlayByPlayAction[] {
  const plays = Array.isArray(summary?.plays) ? summary.plays : [];

  const actions: NormalizedPlayByPlayAction[] = plays.map((play: any, index: number) => {
    const actionNumberCandidate = Number(play?.sequenceNumber ?? play?.id ?? index + 1);
    const actionNumber = Number.isFinite(actionNumberCandidate) ? actionNumberCandidate : index + 1;

    const description = String(play?.text ?? play?.shortText ?? '').trim();
    const shotResult = inferShotResult(play);

    return {
      actionNumber,
      clock: toClockValue(play?.clock),
      period: toPeriodValue(play?.period),
      teamTricode: String(play?.team?.abbreviation ?? ''),
      playerName: extractPlayerName(play),
      description,
      actionType: String(play?.type?.text ?? play?.type?.name ?? ''),
      scoreHome: play?.homeScore == null ? '' : String(play.homeScore),
      scoreAway: play?.awayScore == null ? '' : String(play.awayScore),
      isFieldGoal: Boolean(play?.scoringPlay),
      shotResult,
    };
  });

  return actions
    .filter((action) => action.description.length > 0)
    .sort((a, b) => a.actionNumber - b.actionNumber);
}
