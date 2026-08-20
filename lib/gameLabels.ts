import type { GameWithTeams } from '@/types/database';

const PRIMETIME_MAP: Record<string, string> = {
  NBC: 'Sunday Night Football',
  ESPN: 'Monday Night Football',
  ABC: 'Monday Night Football',
  'Prime Video': 'Thursday Night Football',
  NFLN: 'Thursday Night Football',
};

const PLAYOFF_ROUND_LABELS: Record<string, string> = {
  wild_card: 'Wild Card',
  divisional: 'Divisional',
  conf_championship: 'Championship',
  super_bowl: 'Super Bowl',
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getGameLabel(game: GameWithTeams): string | null {
  if (game.event_label) return game.event_label;

  if (game.sport === 'nba') return formatDate(game.game_date_utc);

  if (game.postseason && game.playoff_round) {
    const roundLabel = PLAYOFF_ROUND_LABELS[game.playoff_round] ?? game.playoff_round;
    if (game.playoff_round === 'super_bowl') return 'Super Bowl';
    const conference = game.home_team?.conference ?? '';
    return conference ? `${conference} ${roundLabel}` : roundLabel;
  }

  if (game.broadcast) {
    const primetime = PRIMETIME_MAP[game.broadcast];
    if (primetime) {
      const suffix = game.week ? ` · Week ${game.week}, ${game.season?.year ?? ''}`.trim() : '';
      return `${primetime}${suffix}`;
    }
  }

  if (game.week) return `Week ${game.week}, ${game.season?.year ?? ''}`.trim();
  return null;
}
