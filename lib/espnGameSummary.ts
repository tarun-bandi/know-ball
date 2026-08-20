import type {
  GameStatsLeaderGroup,
  GameStatsHighlight,
  GameStatsPlayerGroup,
  GameStatsResponse,
  GameStatsTeam,
  GameStatsTeamSummary,
  RemoteGameStatus,
} from '@/types/gameStats';
import { getEspnEventHeadline, normalizeEspnEventLabel } from '@/lib/espnGameMetadata';

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

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().replace(/^http:\/\//i, 'https://');
  return normalized.startsWith('https://') ? normalized : null;
}

function normalizeHighlights(videos: unknown): GameStatsHighlight[] {
  if (!Array.isArray(videos)) return [];

  const seen = new Set<string>();
  return videos.flatMap((video: any, index: number) => {
    const videoUrl = httpsUrl(video?.links?.source?.HD?.href)
      ?? httpsUrl(video?.links?.source?.href)
      ?? httpsUrl(video?.links?.mobile?.source?.href)
      ?? httpsUrl(video?.links?.mobile?.progressiveDownload?.href);
    if (!videoUrl || seen.has(videoUrl)) return [];
    seen.add(videoUrl);

    return [{
      id: String(video?.id ?? `video-${index}`),
      title: String(video?.headline ?? video?.title ?? 'Game video'),
      description: typeof video?.description === 'string' ? video.description : null,
      duration: typeof video?.duration === 'number' ? video.duration : null,
      videoUrl,
      hlsUrl: httpsUrl(video?.links?.source?.HLS?.HD?.href)
        ?? httpsUrl(video?.links?.source?.HLS?.href),
      thumbnailUrl: httpsUrl(video?.thumbnail)
        ?? httpsUrl(video?.images?.[0]?.url)
        ?? httpsUrl(video?.posterImages?.default?.href),
      externalUrl: httpsUrl(video?.links?.web?.href),
    }];
  }).slice(0, 8);
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
  const series = Array.isArray(competition?.series) ? competition.series : [];
  const playoffSeries = series.find((entry: any) => entry?.type === 'playoff') ?? series[0];
  const eventHeadline = getEspnEventHeadline(competition);
  const gameDate = competition?.date ?? raw?.header?.competitions?.[0]?.date ?? null;

  return {
    providerGameId,
    source: 'espn',
    status: normalizeStatus(statusType.state),
    statusDetail: String(statusType.shortDetail ?? statusType.detail ?? statusType.description ?? ''),
    date: gameDate,
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
    seriesSummary: playoffSeries?.summary ?? playoffSeries?.description ?? null,
    eventLabel: normalizeEspnEventLabel(eventHeadline, gameDate),
    highlights: normalizeHighlights(raw?.videos),
    fetchedAt: new Date().toISOString(),
  };
}
