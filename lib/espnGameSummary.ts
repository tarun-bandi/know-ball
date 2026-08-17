import type {
  GameStatsLeaderGroup,
  GameStatsPlayerGroup,
  GameStatsResponse,
  GameStatsTeam,
  GameStatsTeamSummary,
  RemoteGameStatus,
} from '@/types/gameStats';

function color(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.replace('#', '') : '';
  return /^[0-9a-f]{6}$/i.test(raw) ? `#${raw}` : fallback;
}

function normalizeStatus(state: unknown): RemoteGameStatus {
  if (state === 'in') return 'live';
  if (state === 'post') return 'final';
  return 'scheduled';
}

function teamFrom(value: any, competitor?: any): GameStatsTeam {
  const team = value?.team ?? value ?? {};
  const record = competitor?.record?.find?.((item: any) => item?.type === 'total');

  return {
    id: String(team.id ?? ''),
    abbreviation: String(team.abbreviation ?? ''),
    displayName: String(team.displayName ?? team.name ?? ''),
    shortName: String(team.shortDisplayName ?? team.name ?? team.abbreviation ?? ''),
    logo: typeof team.logo === 'string' ? team.logo : team.logos?.[0]?.href ?? null,
    color: color(team.color, '#334155'),
    alternateColor: color(team.alternateColor, '#94a3b8'),
    score: String(competitor?.score ?? ''),
    record: record?.displayValue ?? record?.summary ?? null,
    winner: Boolean(competitor?.winner),
  };
}

function periodLabel(index: number): string {
  if (index < 4) return `Q${index + 1}`;
  return index === 4 ? 'OT' : `OT${index - 3}`;
}

export function normalizeEspnGameSummary(raw: any, providerGameId: string): GameStatsResponse {
  const competition = raw?.header?.competitions?.[0] ?? {};
  const competitors = Array.isArray(competition.competitors) ? competition.competitors : [];
  const awayCompetitor = competitors.find((item: any) => item?.homeAway === 'away') ?? {};
  const homeCompetitor = competitors.find((item: any) => item?.homeAway === 'home') ?? {};
  const awayTeam = teamFrom(awayCompetitor.team, awayCompetitor);
  const homeTeam = teamFrom(homeCompetitor.team, homeCompetitor);

  const lineScoreCount = Math.max(
    awayCompetitor.linescores?.length ?? 0,
    homeCompetitor.linescores?.length ?? 0,
  );
  const periods = Array.from({ length: lineScoreCount }, (_, index) => ({
    label: periodLabel(index),
    away: String(awayCompetitor.linescores?.[index]?.displayValue ?? '-'),
    home: String(homeCompetitor.linescores?.[index]?.displayValue ?? '-'),
  }));

  const teamStats: GameStatsTeamSummary[] = (raw?.boxscore?.teams ?? []).map((entry: any) => {
    const competitor = competitors.find((item: any) => String(item?.team?.id) === String(entry?.team?.id));
    return {
      team: teamFrom(entry?.team, competitor),
      stats: (entry?.statistics ?? []).map((stat: any) => ({
        key: String(stat?.name ?? stat?.label ?? ''),
        label: String(stat?.label ?? stat?.name ?? ''),
        abbreviation: stat?.abbreviation ? String(stat.abbreviation) : null,
        value: String(stat?.displayValue ?? '-'),
      })),
    };
  });

  const playerStats: GameStatsPlayerGroup[] = (raw?.boxscore?.players ?? []).map((entry: any) => {
    const competitor = competitors.find((item: any) => String(item?.team?.id) === String(entry?.team?.id));
    const statistics = entry?.statistics?.[0] ?? {};
    const labels = Array.isArray(statistics.labels) ? statistics.labels.map(String) : [];

    return {
      team: teamFrom(entry?.team, competitor),
      labels,
      players: (statistics.athletes ?? []).map((row: any) => ({
        id: String(row?.athlete?.id ?? ''),
        displayName: String(row?.athlete?.displayName ?? 'Unknown player'),
        shortName: String(row?.athlete?.shortName ?? row?.athlete?.displayName ?? 'Unknown'),
        jersey: row?.athlete?.jersey ? String(row.athlete.jersey) : null,
        position: row?.athlete?.position?.abbreviation ?? null,
        headshot: row?.athlete?.headshot?.href ?? null,
        starter: Boolean(row?.starter),
        didNotPlay: Boolean(row?.didNotPlay),
        reason: row?.reason ? String(row.reason) : null,
        stats: Object.fromEntries(labels.map((label: string, index: number) => [label, String(row?.stats?.[index] ?? '-')])),
      })),
    };
  });

  const leaders: GameStatsLeaderGroup[] = (raw?.leaders ?? []).map((entry: any) => {
    const competitor = competitors.find((item: any) => String(item?.team?.id) === String(entry?.team?.id));
    return {
      team: teamFrom(entry?.team, competitor),
      leaders: (entry?.leaders ?? []).flatMap((category: any) => {
        const leader = category?.leaders?.[0];
        if (!leader?.athlete) return [];
        return [{
          category: String(category?.name ?? ''),
          label: String(category?.displayName ?? category?.name ?? ''),
          value: String(leader?.mainStat?.value ?? leader?.displayValue ?? '-'),
          athleteId: String(leader.athlete.id ?? ''),
          athleteName: String(leader.athlete.displayName ?? ''),
          athleteShortName: String(leader.athlete.shortName ?? leader.athlete.displayName ?? ''),
          headshot: leader.athlete.headshot?.href ?? null,
          summary: leader?.summary ? String(leader.summary) : null,
        }];
      }),
    };
  });

  const statusType = competition?.status?.type ?? {};
  const broadcast = competition?.broadcasts?.[0]?.media?.shortName
    ?? raw?.broadcasts?.[0]?.media?.shortName
    ?? null;

  return {
    providerGameId,
    source: 'espn',
    status: normalizeStatus(statusType.state),
    statusDetail: String(statusType.shortDetail ?? statusType.detail ?? statusType.description ?? ''),
    date: competition?.date ?? raw?.header?.competitions?.[0]?.date ?? null,
    awayTeam,
    homeTeam,
    periods,
    teamStats,
    playerStats,
    leaders,
    venue: raw?.gameInfo?.venue?.fullName ?? null,
    attendance: typeof raw?.gameInfo?.attendance === 'number' ? raw.gameInfo.attendance : null,
    officials: (raw?.gameInfo?.officials ?? []).map((official: any) => String(official?.displayName ?? official?.fullName ?? '')).filter(Boolean),
    broadcast,
    seriesSummary: competition?.series?.[0]?.summary ?? competition?.series?.[0]?.description ?? null,
    fetchedAt: new Date().toISOString(),
  };
}
