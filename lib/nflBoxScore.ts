export interface NflBoxScoreGameContext {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamAbbreviation: string;
  awayTeamAbbreviation: string;
}

export interface NflBoxScoreRow {
  game_id: string;
  team_id: string;
  player_name: string;
  sport: 'nfl';
  stats: Record<string, string | number | null>;
}

interface ParsedPlayerStatGroup {
  playerName: string;
  teamAbbreviation: string;
  category: string;
  stats: Record<string, string | number | null>;
}

function integer(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decimal(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function splitStat(value: unknown): [number, number] {
  const [first, second] = String(value ?? '0/0').split(/[\/-]/);
  return [integer(first), integer(second)];
}

function parsePlayerGroups(summary: any): ParsedPlayerStatGroup[] {
  const groups: ParsedPlayerStatGroup[] = [];

  for (const teamData of summary?.boxscore?.players ?? []) {
    const teamAbbreviation = String(teamData?.team?.abbreviation ?? '').toUpperCase();
    if (!teamAbbreviation) continue;

    for (const statGroup of teamData?.statistics ?? []) {
      const category = String(statGroup?.name ?? '');
      const labels = (statGroup?.labels ?? []) as string[];

      for (const athlete of statGroup?.athletes ?? []) {
        const playerName = String(athlete?.athlete?.displayName ?? '');
        if (!playerName) continue;

        const values = (athlete?.stats ?? []) as Array<string | number | null>;
        const stats: Record<string, string | number | null> = {};
        for (let index = 0; index < labels.length && index < values.length; index++) {
          stats[labels[index]] = values[index];
        }

        groups.push({ playerName, teamAbbreviation, category, stats });
      }
    }
  }

  return groups;
}

function buildPlayerStats(groups: ParsedPlayerStatGroup[]): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};

  for (const group of groups) {
    const stats = group.stats;
    switch (group.category) {
      case 'passing': {
        const [completions, attempts] = splitStat(stats['C/ATT']);
        const [sacksTaken] = splitStat(stats.SACKS);
        result.passing_completions = completions;
        result.passing_attempts = attempts;
        result.passing_yards = integer(stats.YDS);
        result.passing_tds = integer(stats.TD);
        result.passing_ints = integer(stats.INT);
        result.passer_rating = decimal(stats.RTG);
        result.qbr = decimal(stats.QBR);
        result.sacks_taken = sacksTaken;
        break;
      }
      case 'rushing':
        result.rushing_carries = integer(stats.CAR);
        result.rushing_yards = integer(stats.YDS);
        result.rushing_tds = integer(stats.TD);
        result.rushing_long = integer(stats.LONG);
        break;
      case 'receiving':
        result.receptions = integer(stats.REC);
        result.receiving_yards = integer(stats.YDS);
        result.receiving_tds = integer(stats.TD);
        result.targets = integer(stats.TGTS);
        result.receiving_long = integer(stats.LONG);
        break;
      case 'defensive':
        result.total_tackles = integer(stats.TOT);
        result.solo_tackles = integer(stats.SOLO);
        result.def_sacks = decimal(stats.SACKS) ?? 0;
        result.tackles_for_loss = integer(stats.TFL);
        result.passes_defended = integer(stats.PD);
        result.qb_hits = integer(stats['QB HTS']);
        result.def_tds = integer(stats.TD);
        break;
      case 'interceptions':
        result.def_ints = integer(stats.INT);
        result.int_yards = integer(stats.YDS);
        result.int_tds = integer(stats.TD);
        break;
      case 'fumbles':
        result.fumbles = integer(stats.FUM);
        result.fumbles_lost = integer(stats.LOST);
        break;
      case 'kicking': {
        const [fieldGoalsMade, fieldGoalsAttempted] = splitStat(stats.FG);
        const [extraPointsMade, extraPointsAttempted] = splitStat(stats.XP);
        result.fg_made = fieldGoalsMade;
        result.fg_attempted = fieldGoalsAttempted;
        result.xp_made = extraPointsMade;
        result.xp_attempted = extraPointsAttempted;
        result.kicking_points = integer(stats.PTS);
        break;
      }
      case 'punting':
        result.punts = integer(stats.NO);
        result.punt_yards = integer(stats.YDS);
        result.punt_long = integer(stats.LONG);
        break;
      case 'kickReturns':
        result.kick_returns = integer(stats.NO);
        result.kick_return_yards = integer(stats.YDS);
        result.kick_return_tds = integer(stats.TD);
        break;
      case 'puntReturns':
        result.punt_returns = integer(stats.NO);
        result.punt_return_yards = integer(stats.YDS);
        result.punt_return_tds = integer(stats.TD);
        break;
    }
  }

  const categories = new Set(groups.map((group) => group.category));
  result.primary_category = categories.has('passing')
    ? 'passing'
    : categories.has('rushing')
      ? 'rushing'
      : categories.has('receiving')
        ? 'receiving'
        : categories.has('kicking')
          ? 'kicking'
          : categories.has('punting')
            ? 'punting'
            : 'defensive';

  return result;
}

export function normalizeEspnNflBoxScore(summary: any, game: NflBoxScoreGameContext): NflBoxScoreRow[] {
  const teamIds = new Map([
    [game.homeTeamAbbreviation.toUpperCase(), game.homeTeamId],
    [game.awayTeamAbbreviation.toUpperCase(), game.awayTeamId],
  ]);
  const playerGroups = new Map<string, ParsedPlayerStatGroup[]>();

  for (const group of parsePlayerGroups(summary)) {
    const key = `${group.teamAbbreviation}::${group.playerName}`;
    const existing = playerGroups.get(key) ?? [];
    existing.push(group);
    playerGroups.set(key, existing);
  }

  return Array.from(playerGroups.entries()).flatMap(([key, groups]) => {
    const separator = key.indexOf('::');
    const teamAbbreviation = key.slice(0, separator);
    const playerName = key.slice(separator + 2);
    const teamId = teamIds.get(teamAbbreviation);
    if (!teamId) return [];

    return [{
      game_id: game.id,
      team_id: teamId,
      player_name: playerName,
      sport: 'nfl' as const,
      stats: buildPlayerStats(groups),
    }];
  });
}
