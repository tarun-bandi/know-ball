import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Keyboard,
  Linking,
  Share as RNShare,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { enrichLogs } from '@/lib/enrichLogs';
import { useAuthStore } from '@/lib/store/authStore';
import { getProvider } from '@/lib/providers';
import type { BoxScoreColumnDef, BoxScoreCategory, TeamComparisonStatDef } from '@/lib/providers';
import { ChevronLeft, List, Play, Bookmark, Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import GameCard from '@/components/GameCard';
import ErrorState from '@/components/ErrorState';
import LogModal from '@/components/LogModal';
import type { LogModalResult } from '@/components/LogModal';
import RankingFlowModal from '@/components/RankingFlowModal';
import RankBadge from '@/components/RankBadge';
import { fetchGameRanking } from '@/lib/rankingService';
import AddToListModal from '@/components/AddToListModal';
import TeamLogo from '@/components/TeamLogo';
import { GameDetailSkeleton } from '@/components/Skeleton';
import { gameUrl } from '@/lib/urls';
import type { GameWithTeams, GameLogWithGame, BoxScore, Sport, PeriodScores } from '@/types/database';
import { PageContainer } from '@/components/PageContainer';
import { usePlayByPlay, type PlayByPlayAction } from '@/hooks/usePlayByPlay';
import { useGameStats } from '@/hooks/useGameStats';
import { gamePath, isGameUuid, parseGameSlug, formatGameDateForSlug } from '@/lib/gameRoutes';
import { stadiumSlate } from '@/lib/theme';
import { GameScoreHero, GameStatsOverview, RemoteBoxScore } from '@/components/game/GameStatsPanels';

interface PredictionTally {
  [teamId: string]: number;
}

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

function getGameDetailLabel(game: GameWithTeams): string | null {
  if (game.sport === 'nba') return null; // NBA already shows date in the center

  // NFL playoff
  if (game.postseason && game.playoff_round) {
    const roundLabel = PLAYOFF_ROUND_LABELS[game.playoff_round] ?? game.playoff_round;
    if (game.playoff_round === 'super_bowl') return 'Super Bowl';
    const conference = game.home_team?.conference ?? '';
    return conference ? `${conference} ${roundLabel}` : roundLabel;
  }

  // NFL primetime — include week & year for context
  if (game.broadcast) {
    const primetime = PRIMETIME_MAP[game.broadcast];
    if (primetime) {
      const suffix = game.week ? ` · Week ${game.week}, ${game.season?.year ?? ''}`.trim() : '';
      return `${primetime}${suffix}`;
    }
  }

  // NFL regular season
  if (game.week) {
    return `Week ${game.week}, ${game.season?.year ?? ''}`.trim();
  }

  return null;
}

interface GameDetail {
  game: GameWithTeams;
  logs: GameLogWithGame[];
  myLog: GameLogWithGame | null;
  boxScores: BoxScore[];
  isBookmarked: boolean;
  playerNameMap: Record<string, string>; // player_name -> player_id
  myPrediction: string | null; // predicted_winner_team_id
  predictionTally: PredictionTally;
  myRanking: { position: number; total: number; sentiment: import('@/types/database').Sentiment | null; fanOf: import('@/types/database').FanOf | null } | null;
}

async function resolveGameId(gameRef: string): Promise<string> {
  if (isGameUuid(gameRef)) return gameRef;

  const slug = parseGameSlug(gameRef);
  if (!slug) throw new Error('Invalid game URL');

  const { data: teams, error: teamError } = await supabase
    .from('teams')
    .select('id, abbreviation')
    .eq('sport', slug.sport)
    .in('abbreviation', [slug.awayAbbreviation, slug.homeAbbreviation]);

  if (teamError) throw teamError;
  const teamRows = (teams ?? []) as unknown as { id: string; abbreviation: string }[];
  const awayTeamId = teamRows.find((team) => team.abbreviation === slug.awayAbbreviation)?.id;
  const homeTeamId = teamRows.find((team) => team.abbreviation === slug.homeAbbreviation)?.id;
  if (!awayTeamId || !homeTeamId) throw new Error('Game teams not found');

  const dateCenter = Date.parse(`${slug.date}T12:00:00Z`);
  const { data: games, error: gameError } = await supabase
    .from('games')
    .select('id, game_date_utc')
    .eq('sport', slug.sport)
    .eq('away_team_id', awayTeamId)
    .eq('home_team_id', homeTeamId)
    .gte('game_date_utc', new Date(dateCenter - 36 * 60 * 60 * 1000).toISOString())
    .lte('game_date_utc', new Date(dateCenter + 36 * 60 * 60 * 1000).toISOString());

  if (gameError) throw gameError;
  const gameRows = (games ?? []) as unknown as { id: string; game_date_utc: string }[];
  const game = gameRows.find((candidate) => formatGameDateForSlug(candidate.game_date_utc) === slug.date) ?? gameRows[0];
  if (!game) throw new Error('Game not found');
  return game.id;
}

async function fetchGameDetail(gameRef: string, userId: string): Promise<GameDetail> {
  const gameId = await resolveGameId(gameRef);
  const [gameRes, logsRes, boxRes, watchlistRes, myPredRes, allPredsRes] = await Promise.all([
    supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey (*),
        away_team:teams!games_away_team_id_fkey (*),
        season:seasons (*)
      `)
      .eq('id', gameId)
      .single(),
    supabase
      .from('game_logs')
      .select(`
        *,
        game:games (
          *,
          home_team:teams!games_home_team_id_fkey (*),
          away_team:teams!games_away_team_id_fkey (*),
          season:seasons (*)
        )
      `)
      .eq('game_id', gameId)
      .order('logged_at', { ascending: false })
      .limit(20),
    supabase
      .from('box_scores')
      .select('*')
      .eq('game_id', gameId),
    supabase
      .from('watchlist')
      .select('game_id')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .maybeSingle(),
    supabase
      .from('game_predictions')
      .select('predicted_winner_team_id')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .maybeSingle(),
    supabase
      .from('game_predictions')
      .select('predicted_winner_team_id')
      .eq('game_id', gameId),
  ]);

  if (gameRes.error) throw gameRes.error;
  if (logsRes.error) throw logsRes.error;

  const rawLogs = (logsRes.data ?? []) as unknown as GameLogWithGame[];

  const userIds = [...new Set(rawLogs.map((l) => l.user_id))];
  let profileMap: Record<string, any> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('*')
      .in('user_id', userIds);
    for (const p of profiles ?? []) {
      profileMap[p.user_id] = p;
    }
  }

  const logsWithProfiles = rawLogs.map((l) => ({
    ...l,
    user_profile: profileMap[l.user_id] ?? undefined,
  }));
  const logs = await enrichLogs(logsWithProfiles, userId);
  const myLog = logs.find((l) => l.user_id === userId) ?? null;

  const allBoxScores = (boxRes.data ?? []) as BoxScore[];

  const playerNames = [...new Set(allBoxScores.map((b) => b.player_name))];
  const playerNameMap: Record<string, string> = {};
  if (playerNames.length > 0) {
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name');
    if (players) {
      const nameIndex: Record<string, string> = {};
      for (const p of players) {
        nameIndex[`${p.first_name} ${p.last_name}`] = p.id;
      }
      for (const name of playerNames) {
        if (nameIndex[name]) playerNameMap[name] = nameIndex[name];
      }
    }
  }

  // Build prediction tally
  const predictionTally: PredictionTally = {};
  for (const p of allPredsRes.data ?? []) {
    const tid = p.predicted_winner_team_id;
    predictionTally[tid] = (predictionTally[tid] ?? 0) + 1;
  }

  // Fetch ranking for this game
  let myRanking: Awaited<ReturnType<typeof fetchGameRanking>> = null;
  try {
    myRanking = await fetchGameRanking(userId, gameId);
  } catch {}

  return {
    game: gameRes.data as unknown as GameWithTeams,
    logs,
    myLog,
    boxScores: allBoxScores,
    isBookmarked: !!watchlistRes.data,
    playerNameMap,
    myPrediction: myPredRes.data?.predicted_winner_team_id ?? null,
    predictionTally,
    myRanking,
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Generic stat value helpers ─────────────────────────────────────────────

function getBoxStatValue(player: BoxScore, col: BoxScoreColumnDef): string {
  const stats = player.stats ?? {};
  // For NBA, fall back to typed columns for backwards compatibility
  const get = (key: string): any => stats[key] ?? (player as any)[key];

  if (col.format === 'fraction' && col.fractionKeys) {
    const made = get(col.fractionKeys.made);
    const attempted = get(col.fractionKeys.attempted);
    if (made == null || attempted == null) return '-';
    return `${made}-${attempted}`;
  }
  if (col.format === 'plusMinus') {
    const v = get(col.key);
    if (v == null) return '-';
    return v > 0 ? `+${v}` : `${v}`;
  }
  if (col.format === 'string') {
    return get(col.key) ?? '-';
  }
  const val = get(col.key);
  return val != null ? String(val) : '-';
}

function getBoxSortNumber(player: BoxScore, col: BoxScoreColumnDef): number {
  const stats = player.stats ?? {};
  const get = (key: string): any => stats[key] ?? (player as any)[key];

  if (col.format === 'string' && col.key === 'minutes') {
    const m = get('minutes');
    if (!m) return -1;
    const parts = String(m).split(':');
    return parseInt(parts[0]) * 60 + (parseInt(parts[1]) || 0);
  }
  const val = get(col.key);
  return typeof val === 'number' ? val : -1;
}

// ─── BoxScoreSection ────────────────────────────────────────────────────────

function TeamToggle({ activeTeamId, game, onSelect }: { activeTeamId: string; game: GameWithTeams; onSelect: (id: string) => void }) {
  const isAwayActive = activeTeamId === game.away_team_id;
  return (
    <View className="flex-row bg-surface rounded-xl mb-3 p-1 self-start">
      <TouchableOpacity
        className={`py-2.5 px-6 rounded-lg items-center ${isAwayActive ? 'bg-accent' : ''}`}
        style={isAwayActive ? { backgroundColor: stadiumSlate.accent } : undefined}
        onPress={() => onSelect(game.away_team_id)}
        activeOpacity={0.7}
      >
        <Text className={`font-bold text-sm ${isAwayActive ? 'text-background' : 'text-muted'}`}>
          {game.away_team.abbreviation}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        className={`py-2.5 px-6 rounded-lg items-center ${!isAwayActive ? 'bg-accent' : ''}`}
        style={!isAwayActive ? { backgroundColor: stadiumSlate.accent } : undefined}
        onPress={() => onSelect(game.home_team_id)}
        activeOpacity={0.7}
      >
        <Text className={`font-bold text-sm ${!isAwayActive ? 'text-background' : 'text-muted'}`}>
          {game.home_team.abbreviation}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/** Category-based box score (NFL) — each category rendered as its own table */
function CategoryBoxScoreSection({ boxScores, game, playerNameMap }: { boxScores: BoxScore[]; game: GameWithTeams; playerNameMap: Record<string, string> }) {
  const router = useRouter();
  const sport: Sport = game.sport ?? 'nba';
  const provider = getProvider(sport);
  const categories = provider.getBoxScoreCategories?.() ?? [];
  const [activeTeamId, setActiveTeamId] = useState(game.away_team_id);

  const teamPlayers = useMemo(
    () => boxScores.filter((b) => b.team_id === activeTeamId),
    [boxScores, activeTeamId],
  );

  if (boxScores.length === 0) {
    return (
      <View className="items-center py-8">
        <Text className="text-muted text-sm">Box score not available</Text>
      </View>
    );
  }

  return (
    <View className="mx-4 mt-4">
      <TeamToggle activeTeamId={activeTeamId} game={game} onSelect={setActiveTeamId} />

      {categories.map((cat) => {
        const players = teamPlayers
          .filter((p) => {
            const val = (p.stats ?? {})[cat.filterKey];
            return val != null && val > 0;
          })
          .sort((a, b) => {
            const aVal = (a.stats ?? {})[cat.sortKey] ?? 0;
            const bVal = (b.stats ?? {})[cat.sortKey] ?? 0;
            return (typeof bVal === 'number' ? bVal : 0) - (typeof aVal === 'number' ? aVal : 0);
          });

        if (players.length === 0) return null;

        return (
          <View key={cat.key} className="mb-4">
            <Text className="text-white font-bold text-sm mb-2 uppercase tracking-wider">
              {cat.label}
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View className="flex-row items-center pb-2 border-b border-border">
                  <View className="w-28 pr-2">
                    <Text className="text-muted text-xs font-semibold">Player</Text>
                  </View>
                  {cat.columns.map((col) => (
                    <View key={col.key} style={{ width: col.width }} className="items-center">
                      <Text className="text-xs font-semibold text-muted">{col.label}</Text>
                    </View>
                  ))}
                </View>

                {players.map((player) => {
                  const playerId = playerNameMap[player.player_name];
                  const NameWrapper = playerId ? TouchableOpacity : View;
                  return (
                    <View key={player.id} className="flex-row items-center py-2 border-b border-border">
                      <NameWrapper
                        className="w-28 pr-2"
                        {...(playerId ? { onPress: () => router.push(`/player/${playerId}`), activeOpacity: 0.6 } : {})}
                      >
                        <Text className={`text-xs ${playerId ? 'text-accent' : 'text-white'}`} numberOfLines={1}>
                          {player.player_name}
                        </Text>
                      </NameWrapper>
                      {cat.columns.map((col) => (
                        <View key={col.key} style={{ width: col.width }} className="items-center">
                          <Text className="text-xs text-muted">
                            {getBoxStatValue(player, col)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

function BoxScoreSection({ boxScores, game, playerNameMap }: { boxScores: BoxScore[]; game: GameWithTeams; playerNameMap: Record<string, string> }) {
  const sport: Sport = game.sport ?? 'nba';
  const provider = getProvider(sport);
  if (provider.getBoxScoreCategories) {
    return <CategoryBoxScoreSection boxScores={boxScores} game={game} playerNameMap={playerNameMap} />;
  }
  return <FlatBoxScoreSection boxScores={boxScores} game={game} playerNameMap={playerNameMap} />;
}

/** Flat box score (NBA) — single table with all columns */
function FlatBoxScoreSection({ boxScores, game, playerNameMap }: { boxScores: BoxScore[]; game: GameWithTeams; playerNameMap: Record<string, string> }) {
  const router = useRouter();
  const sport: Sport = game.sport ?? 'nba';
  const columns = getProvider(sport).getBoxScoreColumns();
  const [activeTeamId, setActiveTeamId] = useState(game.away_team_id);
  const [sortColIdx, setSortColIdx] = useState(() => {
    // Default sort: 'points' for NBA, 'passing_yds' for NFL, fallback to first
    const defaultKey = sport === 'nba' ? 'points' : 'passing_yds';
    const idx = columns.findIndex((c) => c.key === defaultKey);
    return idx >= 0 ? idx : 0;
  });
  const [sortAsc, setSortAsc] = useState(false);

  const sortCol = columns[sortColIdx];

  const teamPlayers = useMemo(() => {
    const filtered = boxScores.filter((b) => b.team_id === activeTeamId);
    const starters = filtered.filter((b) => b.starter);
    const bench = filtered.filter((b) => !b.starter);

    const sortFn = (a: BoxScore, b: BoxScore) => {
      const aVal = getBoxSortNumber(a, sortCol);
      const bVal = getBoxSortNumber(b, sortCol);
      return sortAsc ? aVal - bVal : bVal - aVal;
    };

    return {
      starters: starters.sort(sortFn),
      bench: bench.sort(sortFn),
    };
  }, [boxScores, activeTeamId, sortCol, sortAsc]);

  if (boxScores.length === 0) {
    return (
      <View className="items-center py-8">
        <Text className="text-muted text-sm">Box score not available</Text>
      </View>
    );
  }

  const handleSort = (idx: number) => {
    if (sortColIdx === idx) {
      setSortAsc(!sortAsc);
    } else {
      setSortColIdx(idx);
      setSortAsc(false);
    }
  };

  const renderPlayerRow = (player: BoxScore) => {
    const playerId = playerNameMap[player.player_name];
    const NameWrapper = playerId ? TouchableOpacity : View;
    return (
    <View key={player.id} className="flex-row items-center py-2 border-b border-border">
      <NameWrapper
        className="w-28 pr-2"
        {...(playerId ? { onPress: () => router.push(`/player/${playerId}`), activeOpacity: 0.6 } : {})}
      >
        <Text className={`text-xs ${playerId ? 'text-accent' : 'text-white'}`} numberOfLines={1}>
          {player.player_name}
        </Text>
      </NameWrapper>
      {columns.map((col, idx) => (
        <View key={col.key} style={{ width: col.width }} className="items-center">
          <Text className={`text-xs ${idx === sortColIdx ? 'text-accent font-semibold' : 'text-muted'}`}>
            {getBoxStatValue(player, col)}
          </Text>
        </View>
      ))}
    </View>
  );
  };

  return (
    <View className="mx-4 mt-4">
      <TeamToggle activeTeamId={activeTeamId} game={game} onSelect={setActiveTeamId} />

      {/* Scrollable table */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Column headers */}
          <View className="flex-row items-center pb-2 border-b border-border">
            <View className="w-28 pr-2">
              <Text className="text-muted text-xs font-semibold">Player</Text>
            </View>
            {columns.map((col, idx) => (
              <TouchableOpacity
                key={col.key}
                style={{ width: col.width }}
                className="items-center"
                onPress={() => handleSort(idx)}
                activeOpacity={0.6}
              >
                <Text
                  className={`text-xs font-semibold ${
                    sortColIdx === idx ? 'text-accent' : 'text-muted'
                  }`}
                >
                  {col.label}
                  {sortColIdx === idx ? (sortAsc ? ' \u2191' : ' \u2193') : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Starters */}
          {teamPlayers.starters.map(renderPlayerRow)}

          {/* Bench divider */}
          {teamPlayers.bench.length > 0 && (
            <View className="py-1.5 border-b border-border">
              <Text className="text-muted text-xs font-semibold uppercase tracking-wider">
                Bench
              </Text>
            </View>
          )}

          {/* Bench players */}
          {teamPlayers.bench.map(renderPlayerRow)}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── PeriodScoreTable ───────────────────────────────────────────────────────

function PeriodScoreTable({ game }: { game: GameWithTeams }) {
  const sport: Sport = game.sport ?? 'nba';
  const provider = getProvider(sport);
  const periodLabels = provider.getPeriodLabels();

  // Use period_scores JSONB if available, otherwise fall back to individual columns
  const ps: PeriodScores | null = game.period_scores ?? buildPeriodScoresFromColumns(game);
  if (!ps) return null;

  const hasOT = ps.ot && ps.ot.length > 0;

  return (
    <View className="bg-surface border border-border mx-4 mt-4 rounded-2xl p-4">
      {/* Header */}
      <View className="flex-row mb-2">
        <View className="w-14" />
        {periodLabels.map((q) => (
          <Text key={q} className="text-muted text-xs font-semibold w-10 text-center">
            {q}
          </Text>
        ))}
        {hasOT && ps.ot.map((_, i) => (
          <Text key={`ot-${i}`} className="text-muted text-xs font-semibold w-10 text-center">
            {ps.ot.length === 1 ? 'OT' : `OT${i + 1}`}
          </Text>
        ))}
        <Text className="text-muted text-xs font-semibold flex-1 text-center">Final</Text>
      </View>

      {/* Away row */}
      <View className="flex-row items-center py-1.5">
        <Text className="text-white font-bold text-sm w-14">
          {game.away_team.abbreviation}
        </Text>
        {ps.away.map((s, i) => (
          <Text key={i} className="text-white text-sm w-10 text-center">{s ?? '-'}</Text>
        ))}
        {hasOT && ps.ot.map((ot, i) => (
          <Text key={`ot-${i}`} className="text-white text-sm w-10 text-center">{ot.away ?? '-'}</Text>
        ))}
        <Text className="text-accent font-bold text-sm flex-1 text-center">
          {game.away_team_score}
        </Text>
      </View>

      {/* Home row */}
      <View className="flex-row items-center py-1.5 border-t border-border">
        <Text className="text-white font-bold text-sm w-14">
          {game.home_team.abbreviation}
        </Text>
        {ps.home.map((s, i) => (
          <Text key={i} className="text-white text-sm w-10 text-center">{s ?? '-'}</Text>
        ))}
        {hasOT && ps.ot.map((ot, i) => (
          <Text key={`ot-${i}`} className="text-white text-sm w-10 text-center">{ot.home ?? '-'}</Text>
        ))}
        <Text className="text-accent font-bold text-sm flex-1 text-center">
          {game.home_team_score}
        </Text>
      </View>
    </View>
  );
}

/** Build PeriodScores from legacy home_q1..home_ot columns */
function buildPeriodScoresFromColumns(game: GameWithTeams): PeriodScores | null {
  if (game.home_q1 == null) return null;
  const ot: { home: number; away: number }[] = [];
  if (game.home_ot != null || game.away_ot != null) {
    ot.push({ home: game.home_ot ?? 0, away: game.away_ot ?? 0 });
  }
  return {
    home: [game.home_q1 ?? 0, game.home_q2 ?? 0, game.home_q3 ?? 0, game.home_q4 ?? 0],
    away: [game.away_q1 ?? 0, game.away_q2 ?? 0, game.away_q3 ?? 0, game.away_q4 ?? 0],
    ot,
  };
}

// ─── TeamComparisonStats ────────────────────────────────────────────────────

function TeamComparisonStats({ boxScores, game }: { boxScores: BoxScore[]; game: GameWithTeams }) {
  const sport: Sport = game.sport ?? 'nba';
  const provider = getProvider(sport);
  const statDefs = provider.getTeamComparisonStats();

  const awayPlayers = boxScores.filter((b) => b.team_id === game.away_team_id);
  const homePlayers = boxScores.filter((b) => b.team_id === game.home_team_id);

  if (awayPlayers.length === 0 && homePlayers.length === 0) return null;

  const sum = (players: BoxScore[], key: string) =>
    players.reduce((acc, p) => {
      const val = (p.stats ?? {})[key] ?? (p as any)[key];
      return acc + ((typeof val === 'number' ? val : 0));
    }, 0);

  const pct = (made: number, attempted: number) =>
    attempted > 0 ? ((made / attempted) * 100).toFixed(1) + '%' : '-';

  const stats = statDefs.map((def) => {
    if (def.pctKeys) {
      const awayMade = sum(awayPlayers, def.pctKeys.made);
      const awayAtt = sum(awayPlayers, def.pctKeys.attempted);
      const homeMade = sum(homePlayers, def.pctKeys.made);
      const homeAtt = sum(homePlayers, def.pctKeys.attempted);
      return {
        label: def.label,
        away: pct(awayMade, awayAtt),
        home: pct(homeMade, homeAtt),
        isString: true,
        lowerIsBetter: false,
      };
    }
    return {
      label: def.label,
      away: sum(awayPlayers, def.key),
      home: sum(homePlayers, def.key),
      isString: false,
      lowerIsBetter: def.lowerIsBetter ?? false,
    };
  });

  return (
    <View className="mx-4 mt-4 bg-surface border border-border rounded-2xl p-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-accent font-bold text-sm w-16 text-center">
          {game.away_team.abbreviation}
        </Text>
        <Text className="text-muted text-xs font-semibold flex-1 text-center">Team Stats</Text>
        <Text className="text-accent font-bold text-sm w-16 text-center">
          {game.home_team.abbreviation}
        </Text>
      </View>
      {stats.map((stat) => {
        const awayHigher = !stat.isString && (stat.away as number) > (stat.home as number);
        const homeHigher = !stat.isString && (stat.home as number) > (stat.away as number);
        const awayBold = stat.lowerIsBetter ? homeHigher : awayHigher;
        const homeBold = stat.lowerIsBetter ? awayHigher : homeHigher;

        return (
          <View key={stat.label} className="flex-row items-center justify-between py-1.5 border-t border-border">
            <Text className={`text-sm w-16 text-center ${awayBold ? 'text-white font-bold' : 'text-muted'}`}>
              {String(stat.away)}
            </Text>
            <Text className="text-muted text-xs flex-1 text-center">{stat.label}</Text>
            <Text className={`text-sm w-16 text-center ${homeBold ? 'text-white font-bold' : 'text-muted'}`}>
              {String(stat.home)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── DetailsSection ─────────────────────────────────────────────────────────

function DetailsSection({ game }: { game: GameWithTeams }) {
  const sport: Sport = game.sport ?? 'nba';
  const details: { label: string; value: string }[] = [];

  details.push({ label: 'Date', value: formatDate(game.game_date_utc) });
  details.push({ label: 'Sport', value: sport.toUpperCase() });

  if (game.arena) details.push({ label: 'Arena', value: game.arena });
  if (game.attendance) details.push({ label: 'Attendance', value: game.attendance.toLocaleString() });

  const season = game.season;
  if (season) {
    const nextYear = (season.year + 1) % 100;
    details.push({ label: 'Season', value: `${season.year}-${nextYear.toString().padStart(2, '0')}` });
  }

  if (game.postseason) details.push({ label: 'Type', value: 'Playoffs' });
  if (game.playoff_round) {
    const label = getProvider(sport).getPlayoffRoundLabel(game.playoff_round);
    details.push({ label: 'Round', value: label });
  }

  return (
    <View className="mx-4 mt-4 bg-surface border border-border rounded-2xl p-4">
      {details.map((item, i) => (
        <View key={item.label} className={`flex-row justify-between py-2.5 ${i > 0 ? 'border-t border-border' : ''}`}>
          <Text className="text-muted text-sm">{item.label}</Text>
          <Text className="text-white text-sm font-medium">{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Highlights ─────────────────────────────────────────────────────────────

function getHighlightsUrl(game: GameWithTeams): string {
  if (game.highlights_url) return game.highlights_url;
  const d = new Date(game.game_date_utc);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const year = d.getFullYear();
  const sportLabel = (game.sport ?? 'nba').toUpperCase();
  const query = `${sportLabel}+${game.away_team.abbreviation}+vs+${game.home_team.abbreviation}+${month}+${day}+${year}+highlights`;
  return `https://www.youtube.com/results?search_query=${query}`;
}

// ─── PlayByPlaySection ──────────────────────────────────────────────────────

function PlayByPlaySection({ game }: { game: GameWithTeams }) {
  const sport: Sport = game.sport ?? 'nba';
  const { data, isLoading, error } = usePlayByPlay(
    game.id,
    game.provider_game_id,
    game.status,
    sport,
  );

  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

  const actions = data?.actions ?? [];

  const periods = useMemo(() => {
    const set = new Set(actions.map((a) => a.period));
    return Array.from(set).sort((a, b) => a - b);
  }, [actions]);

  const activePeriod = selectedPeriod;

  const filteredActions = useMemo(() => {
    if (activePeriod == null) return actions;
    return actions.filter((a) => a.period === activePeriod);
  }, [actions, activePeriod]);

  const displayActions = useMemo(
    () => [...filteredActions].reverse(),
    [filteredActions],
  );

  if (game.status === 'scheduled') {
    return (
      <View className="items-center py-8 mx-4">
        <Text className="text-muted text-sm">
          Plays will appear when the game starts
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="items-center py-8">
        <ActivityIndicator color={stadiumSlate.accent} size="small" />
      </View>
    );
  }

  if (error || actions.length === 0) {
    return (
      <View className="items-center py-8 mx-4">
        <Text className="text-muted text-sm">
          Play-by-play not available
        </Text>
      </View>
    );
  }

  const periodLabel = (p: number) => (p <= 4 ? `Q${p}` : `OT${p - 4}`);

  const isScoringPlay = (a: PlayByPlayAction) =>
    a.isFieldGoal && a.shotResult === 'Made';

  return (
    <View className="mx-4 mt-4">
      {/* Period filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3"
      >
        <View className="flex-row gap-2">
          <TouchableOpacity
            className="py-1.5 px-3 rounded-lg"
            style={
              activePeriod == null ? { backgroundColor: stadiumSlate.accent } : undefined
            }
            onPress={() => setSelectedPeriod(null)}
            activeOpacity={0.7}
          >
            <Text
              className={`text-xs font-semibold ${
                activePeriod == null ? 'text-background' : 'text-muted'
              }`}
            >
              All
            </Text>
          </TouchableOpacity>
          {periods.map((p) => (
            <TouchableOpacity
              key={p}
              className="py-1.5 px-3 rounded-lg"
              style={
                activePeriod === p
                  ? { backgroundColor: stadiumSlate.accent }
                  : undefined
              }
              onPress={() => setSelectedPeriod(p)}
              activeOpacity={0.7}
            >
              <Text
                className={`text-xs font-semibold ${
                  activePeriod === p ? 'text-background' : 'text-muted'
                }`}
              >
                {periodLabel(p)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Play rows */}
      {displayActions.map((action) => (
        <View
          key={action.actionNumber}
          className={`flex-row py-2.5 border-b border-border ${
            isScoringPlay(action) ? 'bg-surface rounded-lg px-2 -mx-2' : ''
          }`}
        >
          <View className="w-20 flex-row items-start gap-1.5">
            {action.teamTricode ? (
              <View className="bg-surface rounded px-1.5 py-0.5">
                <Text className="text-accent text-xs font-bold">
                  {action.teamTricode}
                </Text>
              </View>
            ) : (
              <View className="w-9" />
            )}
            <Text className="text-muted text-xs mt-0.5">{action.clock}</Text>
          </View>

          <View className="flex-1 ml-2">
            <Text className="text-white text-sm">{action.description}</Text>
            {isScoringPlay(action) && (
              <Text className="text-muted text-xs mt-0.5">
                {game.away_team.abbreviation} {action.scoreAway} -{' '}
                {action.scoreHome} {game.home_team.abbreviation}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

type GameTab = 'overview' | 'box_score' | 'reviews' | 'plays';
const TABS: { key: GameTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'box_score', label: 'Box Score' },
  { key: 'plays', label: 'Play-by-play' },
  { key: 'reviews', label: 'Reviews' },
];

type ReviewSort = 'recent' | 'popular';

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showLogModal, setShowLogModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showRankingFlow, setShowRankingFlow] = useState(false);
  const [isRerank, setIsRerank] = useState(false);
  const [activeTab, setActiveTab] = useState<GameTab>('overview');
  const [reviewSort, setReviewSort] = useState<ReviewSort>('recent');

  const bookmarkMutation = useMutation({
    mutationFn: async (bookmarked: boolean) => {
      if (!user) return;
      const gameId = await resolveGameId(id);
      if (bookmarked) {
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('game_id', gameId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('watchlist')
          .insert({ user_id: user.id, game_id: gameId });
        if (error) throw error;
      }
    },
    onMutate: async (bookmarked) => {
      await queryClient.cancelQueries({ queryKey: ['game-detail', id] });
      const prev = queryClient.getQueryData(['game-detail', id]);
      queryClient.setQueryData(['game-detail', id], (old: any) =>
        old ? { ...old, isBookmarked: !bookmarked } : old,
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['game-detail', id], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['game-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['game-detail', id],
    queryFn: () => fetchGameDetail(id, user!.id),
    enabled: !!id && !!user,
  });

  const predictionMutation = useMutation({
    mutationFn: async (teamId: string) => {
      if (!user) return;
      const gameId = await resolveGameId(id);
      const current = data?.myPrediction;
      if (current === teamId) {
        // Remove prediction
        const { error } = await supabase
          .from('game_predictions')
          .delete()
          .eq('user_id', user.id)
          .eq('game_id', gameId);
        if (error) throw error;
      } else {
        // Upsert prediction
        const { error } = await supabase
          .from('game_predictions')
          .upsert(
            { user_id: user.id, game_id: gameId, predicted_winner_team_id: teamId },
            { onConflict: 'user_id,game_id' },
          );
        if (error) throw error;
      }
    },
    onMutate: async (teamId) => {
      await queryClient.cancelQueries({ queryKey: ['game-detail', id] });
      const prev = queryClient.getQueryData(['game-detail', id]);
      queryClient.setQueryData(['game-detail', id], (old: any) => {
        if (!old) return old;
        const currentPred = old.myPrediction;
        const tally = { ...old.predictionTally };
        if (currentPred) {
          tally[currentPred] = Math.max(0, (tally[currentPred] ?? 0) - 1);
        }
        if (currentPred === teamId) {
          return { ...old, myPrediction: null, predictionTally: tally };
        }
        tally[teamId] = (tally[teamId] ?? 0) + 1;
        return { ...old, myPrediction: teamId, predictionTally: tally };
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['game-detail', id], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['game-detail', id] });
    },
  });

  const statsSport: Sport = data?.game.sport ?? 'nba';
  const gameStatsQuery = useGameStats(
    data?.game.provider_game_id,
    data?.game.status,
    statsSport,
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !data?.game || !id) return;
    const canonicalPath = gamePath(data.game);
    if (`/game/${id}` !== canonicalPath) router.replace(canonicalPath as any);
  }, [data?.game, id, router]);

  const sortedLogs = useMemo(() => {
    if (!data) return [];
    const logs = [...data.logs];
    if (reviewSort === 'popular') {
      logs.sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0));
    }
    return logs;
  }, [data?.logs, reviewSort]);

  if (isLoading) {
    return <GameDetailSkeleton />;
  }

  if (error || !data) {
    return <ErrorState message="Failed to load game details" onRetry={refetch} />;
  }

  const { game, logs, myLog, boxScores, isBookmarked, playerNameMap, myPrediction, predictionTally, myRanking } = data;
  const gamePlayedOrLive = game.status === 'final' || game.status === 'live';
  const sport: Sport = game.sport ?? 'nba';

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={Keyboard.dismiss}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={stadiumSlate.accent}
          />
        }
      >
        <PageContainer showDesktopNav>
        <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: isDesktop ? 20 : 12, paddingBottom: 48 }}>
        {isDesktop ? (
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/feed')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back to games"
            style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 12, paddingRight: 14 }}
          >
            <ChevronLeft size={17} color={stadiumSlate.textMuted} />
            <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, fontWeight: '700' }}>Back to games</Text>
          </TouchableOpacity>
        ) : <View style={{ height: 12 }} />}

        <GameScoreHero game={game} stats={gameStatsQuery.data} isDesktop={isDesktop} />

        {/* Action Buttons */}
        {gamePlayedOrLive ? (
          <>
            <View className="mx-4 mt-4 flex-row gap-3">
              <TouchableOpacity
                className={`flex-1 rounded-xl py-4 items-center ${
                  myLog ? 'bg-surface border border-accent' : 'bg-accent'
                }`}
                style={!myLog ? { backgroundColor: stadiumSlate.accent } : undefined}
                onPress={() => setShowLogModal(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={myLog ? 'Edit my game log' : 'Log this game'}
              >
                <Text
                  className={`font-semibold text-base ${
                    myLog ? 'text-accent' : 'text-background'
                  }`}
                >
                  {myLog ? 'Edit My Log' : 'Log This Game'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-surface border border-border rounded-xl w-12 py-4 items-center justify-center"
                onPress={() => bookmarkMutation.mutate(isBookmarked)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={isBookmarked ? 'Remove game bookmark' : 'Bookmark game'}
              >
                <Bookmark
                  size={22}
                  color={stadiumSlate.accent}
                  fill={isBookmarked ? stadiumSlate.accent : 'transparent'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-surface border border-border rounded-xl w-12 py-4 items-center justify-center"
                onPress={() => setShowListModal(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Add game to list"
              >
                <List size={22} color={stadiumSlate.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-surface border border-border rounded-xl w-12 py-4 items-center justify-center"
                onPress={() => {
                  const url = gameUrl(game);
                  const message = `Check out ${game.away_team.abbreviation} @ ${game.home_team.abbreviation} on Know Ball\n${url}`;
                  RNShare.share(Platform.OS === 'ios' ? { message, url } : { message });
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Share game"
              >
                <Send size={22} color={stadiumSlate.accent} />
              </TouchableOpacity>
            </View>

            {/* Rank button — shown when game is logged */}
            {myLog && (
              <TouchableOpacity
                className="mx-4 mt-2 bg-surface border border-border rounded-xl py-3 flex-row items-center justify-center gap-2"
                onPress={() => {
                  setIsRerank(!!myRanking);
                  setShowRankingFlow(true);
                }}
                activeOpacity={0.7}
              >
                {myRanking ? (
                  <>
                    <RankBadge position={myRanking.position} total={myRanking.total} fanOf={myRanking.fanOf} size="md" />
                    <Text className="text-muted text-sm">Re-rank this game</Text>
                  </>
                ) : (
                  <Text className="text-accent font-semibold text-sm">Rank this game</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View className="mx-4 mt-4 bg-surface border border-border rounded-xl p-4">
            <Text className="text-muted text-xs text-center mb-3">
              {(() => {
                const d = new Date(game.game_date_utc);
                if (d.getUTCHours() === 12 && d.getUTCMinutes() === 0) return 'Tipoff time TBD';
                return `Tipoff at ${d.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'America/New_York',
                })} ET`;
              })()}
            </Text>
            <Text className="text-white font-semibold text-center mb-3">
              Who wins?
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className={`flex-1 items-center py-3 rounded-xl border ${
                  myPrediction === game.away_team_id
                    ? 'border-accent bg-accent/10'
                    : 'border-border'
                }`}
                onPress={() => predictionMutation.mutate(game.away_team_id)}
                activeOpacity={0.7}
              >
                <TeamLogo abbreviation={game.away_team.abbreviation} size={36} />
                <Text className={`font-bold text-sm mt-1 ${
                  myPrediction === game.away_team_id ? 'text-accent' : 'text-white'
                }`}>
                  {game.away_team.abbreviation}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 items-center py-3 rounded-xl border ${
                  myPrediction === game.home_team_id
                    ? 'border-accent bg-accent/10'
                    : 'border-border'
                }`}
                onPress={() => predictionMutation.mutate(game.home_team_id)}
                activeOpacity={0.7}
              >
                <TeamLogo abbreviation={game.home_team.abbreviation} size={36} />
                <Text className={`font-bold text-sm mt-1 ${
                  myPrediction === game.home_team_id ? 'text-accent' : 'text-white'
                }`}>
                  {game.home_team.abbreviation}
                </Text>
              </TouchableOpacity>
            </View>
            {/* Community prediction split */}
            {(() => {
              const awayCount = predictionTally[game.away_team_id] ?? 0;
              const homeCount = predictionTally[game.home_team_id] ?? 0;
              const total = awayCount + homeCount;
              if (total === 0) return null;
              const awayPct = Math.round((awayCount / total) * 100);
              const homePct = 100 - awayPct;
              return (
                <View className="mt-3">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-muted text-xs">{game.away_team.abbreviation} {awayPct}%</Text>
                    <Text className="text-muted text-xs">{game.home_team.abbreviation} {homePct}%</Text>
                  </View>
                  <View className="h-2 bg-border rounded-full overflow-hidden flex-row">
                    <View className="h-full bg-accent rounded-l-full" style={{ width: `${awayPct}%` }} />
                  </View>
                  <Text className="text-muted text-xs text-center mt-1">{total} prediction{total !== 1 ? 's' : ''}</Text>
                </View>
              );
            })()}
          </View>
        )}

        {/* Prediction result (final/live games) */}
        {myPrediction && gamePlayedOrLive && (() => {
          const predictedTeam = myPrediction === game.home_team_id
            ? game.home_team
            : game.away_team;
          const isCorrect = game.status === 'final' && (() => {
            const homeWon = (game.home_team_score ?? 0) > (game.away_team_score ?? 0);
            return myPrediction === (homeWon ? game.home_team_id : game.away_team_id);
          })();
          const awayCount = predictionTally[game.away_team_id] ?? 0;
          const homeCount = predictionTally[game.home_team_id] ?? 0;
          const total = awayCount + homeCount;
          return (
            <View className="mx-4 mt-3 bg-surface border border-border rounded-xl p-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <TeamLogo abbreviation={predictedTeam.abbreviation} size={20} />
                <Text className="text-white text-sm">
                  You predicted {predictedTeam.abbreviation}
                </Text>
                {game.status === 'final' && (
                  <Text className={`font-bold text-sm ${isCorrect ? 'text-green-500' : 'text-accent-red'}`}>
                    {isCorrect ? '\u2713' : '\u2717'}
                  </Text>
                )}
                {game.status === 'live' && (
                  <Text className="text-muted text-xs">(locked)</Text>
                )}
              </View>
              {total > 0 && (
                <Text className="text-muted text-xs">
                  {Math.round(((predictionTally[myPrediction] ?? 0) / total) * 100)}% picked
                </Text>
              )}
            </View>
          );
        })()}

        {/* Watch Highlights */}
        {game.status === 'final' && (
          <TouchableOpacity
            className="mx-4 mt-3 bg-surface border border-border rounded-xl py-4 flex-row items-center justify-center gap-2"
            onPress={() => Linking.openURL(getHighlightsUrl(game))}
            activeOpacity={0.8}
          >
            <Play size={18} color={stadiumSlate.accent} />
            <Text className="text-accent font-semibold text-base">Watch Highlights</Text>
          </TouchableOpacity>
        )}

        {/* Tab Bar */}
        <View
          className="flex-row mx-4 mt-5"
          style={{
            minHeight: 50,
            borderRadius: 16,
            padding: 4,
            backgroundColor: 'rgba(20,27,37,0.92)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="flex-1 py-2.5 rounded-xl items-center justify-center"
              style={activeTab === tab.key ? { backgroundColor: stadiumSlate.accent } : undefined}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.key }}
            >
              <Text
                className={`text-xs font-semibold ${
                  activeTab === tab.key ? 'text-background' : 'text-muted'
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View className="pb-8">
          {activeTab === 'overview' && (
            <View style={{ marginHorizontal: 16, marginTop: 16, gap: 16 }}>
              <GameStatsOverview
                stats={gameStatsQuery.data}
                isLoading={gameStatsQuery.isLoading}
                error={gameStatsQuery.error}
              />
              <DetailsSection game={game} />
            </View>
          )}

          {activeTab === 'box_score' && (
            <View style={{ marginHorizontal: 16, marginTop: 16 }}>
              {sport === 'nba' && !(gameStatsQuery.error && boxScores.length > 0) ? (
                <RemoteBoxScore
                  stats={gameStatsQuery.data}
                  isLoading={gameStatsQuery.isLoading}
                  error={gameStatsQuery.error}
                />
              ) : (
                <BoxScoreSection boxScores={boxScores} game={game} playerNameMap={playerNameMap} />
              )}
            </View>
          )}

          {activeTab === 'reviews' && (
            <View className="px-4 pt-4">
              {logs.length > 1 && (
                <View className="flex-row bg-surface rounded-xl p-1 self-start mb-3">
                  <TouchableOpacity
                    className="py-2 px-4 rounded-lg"
                    style={reviewSort === 'recent' ? { backgroundColor: stadiumSlate.accent } : undefined}
                    onPress={() => setReviewSort('recent')}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-xs font-semibold ${reviewSort === 'recent' ? 'text-background' : 'text-muted'}`}>
                      Recent
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="py-2 px-4 rounded-lg"
                    style={reviewSort === 'popular' ? { backgroundColor: stadiumSlate.accent } : undefined}
                    onPress={() => setReviewSort('popular')}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-xs font-semibold ${reviewSort === 'popular' ? 'text-background' : 'text-muted'}`}>
                      Popular
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {sortedLogs.length === 0 ? (
                <View className="items-center py-8">
                  <Text style={{ fontSize: 40 }} className="mb-2">{'\u270d\ufe0f'}</Text>
                  <Text className="text-white font-semibold mb-1">No reviews yet</Text>
                  <Text className="text-muted text-sm">Be the first to log this game!</Text>
                </View>
              ) : (
                sortedLogs.map((log) => (
                  <GameCard key={log.id} log={log} showUser />
                ))
              )}
            </View>
          )}

          {activeTab === 'plays' && (
            <PlayByPlaySection game={game} />
          )}
        </View>
        </View>
        </PageContainer>
      </ScrollView>

      {/* Log Modal */}
      {showLogModal && (
        <LogModal
          gameId={game.id}
          existingLog={myLog}
          onClose={() => setShowLogModal(false)}
          onSuccess={(result?: LogModalResult) => {
            setShowLogModal(false);
            refetch();
            queryClient.invalidateQueries({ queryKey: ['feed'] });
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            queryClient.invalidateQueries({ queryKey: ['diary-month'] });
            queryClient.invalidateQueries({ queryKey: ['diary-day'] });
            if (result?.showRankingFlow) {
              setIsRerank(false);
              setShowRankingFlow(true);
            }
          }}
        />
      )}

      {/* Ranking Flow Modal */}
      {data?.game && (
        <RankingFlowModal
          visible={showRankingFlow}
          gameId={game.id}
          game={data.game}
          isRerank={isRerank}
          onClose={() => setShowRankingFlow(false)}
          onComplete={() => {
            setShowRankingFlow(false);
            refetch();
            queryClient.invalidateQueries({ queryKey: ['rankings'] });
          }}
        />
      )}

      {/* Add to List Modal */}
      {showListModal && (
        <AddToListModal
          gameId={game.id}
          onClose={() => setShowListModal(false)}
        />
      )}
    </>
  );
}
