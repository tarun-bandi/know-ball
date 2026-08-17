import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import type { ReactNode } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ArrowUpRight,
  Flame,
  Radio,
  Search,
  Sparkles,
  TrendingUp,
  Trophy,
  UserPlus,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { enrichLogs } from '@/lib/enrichLogs';
import { useAuthStore } from '@/lib/store/authStore';
import GameCard from '@/components/GameCard';
import TodaysGames from '@/components/TodaysGames';
import ErrorState from '@/components/ErrorState';
import { FeedSkeleton } from '@/components/Skeleton';
import Avatar from '@/components/Avatar';
import TeamLogo from '@/components/TeamLogo';
import PlayoffBadge from '@/components/PlayoffBadge';
import type { GameLogWithGame, GameWithTeams, UserProfile } from '@/types/database';
import { PageContainer } from '@/components/PageContainer';
import { stadiumSlate } from '@/lib/theme';

const PAGE_SIZE = 20;

interface FeedPage {
  logs: GameLogWithGame[];
  nextOffset: number | null;
  favoriteTeamIds: string[];
}

interface DashboardGame {
  game: GameWithTeams;
  logCount: number;
}

interface DashboardUser {
  profile: UserProfile;
  logCount: number;
}

interface FeedDashboardData {
  mostLogged: DashboardGame[];
  suggestedUsers: DashboardUser[];
  activeUsers: DashboardUser[];
}

async function fetchFeedPage(
  userId: string,
  offset: number,
): Promise<FeedPage> {
  // 1. Get followed user IDs, favorite team IDs, and enabled sports in parallel
  const [followsRes, favTeamsRes, profileRes] = await Promise.all([
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId),
    supabase
      .from('user_favorite_teams')
      .select('team_id')
      .eq('user_id', userId),
    supabase
      .from('user_profiles')
      .select('enabled_sports')
      .eq('user_id', userId)
      .single(),
  ]);

  if (followsRes.error) throw followsRes.error;

  const followedIds = ((followsRes.data ?? []) as { following_id: string }[]).map((f) => f.following_id);
  const favoriteTeamIds = ((favTeamsRes.data ?? []) as { team_id: string }[]).map((f) => f.team_id);
  const enabledSports = ((profileRes.data as { enabled_sports?: string[] } | null)?.enabled_sports) ?? ['nba'];
  const userIds = [userId, ...followedIds];

  if (userIds.length === 0) return { logs: [], nextOffset: null, favoriteTeamIds };

  // 2. Fetch logs with game + team details, filtered by enabled sports
  const { data, error } = await supabase
    .from('game_logs')
    .select(`
      *,
      game:games!inner (
        *,
        home_team:teams!games_home_team_id_fkey (*),
        away_team:teams!games_away_team_id_fkey (*),
        season:seasons (*)
      )
    `)
    .in('user_id', userIds)
    .in('game.sport', enabledSports)
    .order('logged_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw error;

  const rawLogs = (data ?? []) as unknown as GameLogWithGame[];

  // Fetch profiles separately
  const logUserIds = [...new Set(rawLogs.map((l) => l.user_id))];
  let profileMap: Record<string, any> = {};
  if (logUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('*')
      .in('user_id', logUserIds);
    for (const p of (profiles ?? []) as { user_id: string }[]) {
      profileMap[p.user_id] = p;
    }
  }

  const logsWithProfiles = rawLogs.map((l) => ({
    ...l,
    user_profile: profileMap[l.user_id] ?? undefined,
  }));

  const logs = await enrichLogs(logsWithProfiles, userId);
  const nextOffset = rawLogs.length === PAGE_SIZE ? offset + PAGE_SIZE : null;

  return { logs, nextOffset, favoriteTeamIds };
}

async function fetchFeedDashboard(userId: string): Promise<FeedDashboardData> {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [recentLogsRes, followsRes] = await Promise.all([
    supabase
      .from('game_logs')
      .select('game_id, user_id')
      .gte('logged_at', sevenDaysAgo),
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId),
  ]);

  if (recentLogsRes.error) throw recentLogsRes.error;
  if (followsRes.error) throw followsRes.error;

  const recentLogs = (recentLogsRes.data ?? []) as { game_id: string; user_id: string }[];
  const followedIds = new Set(
    ((followsRes.data ?? []) as { following_id: string }[]).map((f) => f.following_id),
  );
  const gameCount: Record<string, number> = {};
  const userLogCount: Record<string, number> = {};

  for (const log of recentLogs) {
    gameCount[log.game_id] = (gameCount[log.game_id] ?? 0) + 1;
    userLogCount[log.user_id] = (userLogCount[log.user_id] ?? 0) + 1;
  }

  const gameIds = Object.entries(gameCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => id);

  const activeUserIds = Object.entries(userLogCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => id);

  const suggestedUserIds = Object.entries(userLogCount)
    .filter(([id]) => id !== userId && !followedIds.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => id);

  const profileIds = [...new Set([...activeUserIds, ...suggestedUserIds])];

  const [gamesRes, profilesRes] = await Promise.all([
    gameIds.length > 0
      ? supabase
          .from('games')
          .select(`
            *,
            home_team:teams!games_home_team_id_fkey (*),
            away_team:teams!games_away_team_id_fkey (*),
            season:seasons (*)
          `)
          .in('id', gameIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length > 0
      ? supabase
          .from('user_profiles')
          .select('*')
          .in('user_id', profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (gamesRes.error) throw gamesRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const gameMap: Record<string, GameWithTeams> = {};
  for (const game of (gamesRes.data ?? []) as unknown as GameWithTeams[]) {
    gameMap[game.id] = game;
  }

  const profileMap: Record<string, UserProfile> = {};
  for (const profile of (profilesRes.data ?? []) as UserProfile[]) {
    profileMap[profile.user_id] = profile;
  }

  return {
    mostLogged: gameIds
      .filter((id) => gameMap[id])
      .map((id) => ({ game: gameMap[id], logCount: gameCount[id] })),
    suggestedUsers: suggestedUserIds
      .filter((id) => profileMap[id])
      .map((id) => ({ profile: profileMap[id], logCount: userLogCount[id] })),
    activeUsers: activeUserIds
      .filter((id) => profileMap[id])
      .map((id) => ({ profile: profileMap[id], logCount: userLogCount[id] })),
  };
}

function formatGameDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function SectionTitle({
  icon: Icon,
  title,
  color = '#ff6a3d',
}: {
  icon: any;
  title: string;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16 }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          backgroundColor: `${color}18`,
          borderWidth: 1,
          borderColor: `${color}30`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={15} color={color} strokeWidth={2.4} />
      </View>
      <Text style={{ color: stadiumSlate.text, fontSize: 13, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {title}
      </Text>
    </View>
  );
}

function DashboardPanel({ children, style }: { children: ReactNode; style?: any }) {
  return (
    <View
      style={[
        {
          borderRadius: 22,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.09)',
          backgroundColor: stadiumSlate.surface,
          padding: 18,
          overflow: 'hidden',
        },
        Platform.OS === 'web'
          ? ({
              boxShadow: '0 20px 50px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.035)',
            } as any)
          : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

function MatchupRow({
  item,
  index,
  compact = false,
}: {
  item: DashboardGame;
  index: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const { game, logCount } = item;

  return (
    <Pressable
      onPress={() => router.push(`/game/${game.id}`)}
      style={({ hovered, pressed }: any) => ({
        borderRadius: 14,
        borderWidth: 1,
        borderColor: hovered || pressed ? 'rgba(255,106,61,0.38)' : 'rgba(255,255,255,0.07)',
        backgroundColor: hovered || pressed ? 'rgba(255,106,61,0.07)' : 'rgba(255,255,255,0.025)',
        padding: compact ? 10 : 12,
        marginBottom: 8,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: index === 0 ? 'rgba(255,106,61,0.16)' : 'rgba(143,161,179,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: index === 0 ? stadiumSlate.accent : stadiumSlate.textMuted, fontSize: 11, fontWeight: '900' }}>
              {index + 1}
            </Text>
          </View>
          <TeamLogo abbreviation={game.away_team.abbreviation} sport={game.sport ?? 'nba'} size={22} />
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '800' }}>
            {game.away_team.abbreviation}
          </Text>
          <Text style={{ color: '#60636f', fontSize: 12 }}>@</Text>
          <TeamLogo abbreviation={game.home_team.abbreviation} sport={game.sport ?? 'nba'} size={22} />
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '800' }}>
            {game.home_team.abbreviation}
          </Text>
          {game.playoff_round ? (
            <PlayoffBadge round={game.playoff_round} sport={game.sport ?? 'nba'} />
          ) : null}
        </View>
        <View
          style={{
            borderRadius: 999,
            backgroundColor: 'rgba(255,106,61,0.11)',
            paddingHorizontal: 9,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: stadiumSlate.accent, fontSize: 12, fontWeight: '800' }}>
            {logCount}
          </Text>
        </View>
      </View>
      <Text style={{ color: '#747884', fontSize: 12, marginTop: 7, marginLeft: 32 }}>
        {formatGameDate(game.game_date_utc)}
      </Text>
    </Pressable>
  );
}

function UserRow({ item }: { item: DashboardUser }) {
  const router = useRouter();
  const { profile, logCount } = item;

  return (
    <Pressable
      onPress={() => router.push(`/user/${profile.handle}`)}
      style={({ hovered, pressed }: any) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 13,
        padding: 10,
        marginBottom: 6,
        backgroundColor: hovered || pressed ? 'rgba(255,106,61,0.07)' : 'transparent',
      })}
    >
      <Avatar url={profile.avatar_url} name={profile.display_name} size={34} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
          {profile.display_name}
        </Text>
        <Text style={{ color: '#9aa6b5', fontSize: 12 }} numberOfLines={1}>
          @{profile.handle}
        </Text>
      </View>
      <Text style={{ color: stadiumSlate.accent, fontSize: 12, fontWeight: '800' }}>
        {logCount}
      </Text>
    </Pressable>
  );
}

function EmptyFeedNudge({ onSearch, onDiscover }: { onSearch: () => void; onDiscover: () => void }) {
  return (
    <DashboardPanel style={{ marginTop: 14, backgroundColor: stadiumSlate.surfaceElevated, padding: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,106,61,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(255,106,61,0.24)',
          }}
        >
          <Sparkles size={19} color={stadiumSlate.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: stadiumSlate.text, fontSize: 19, fontWeight: '900', letterSpacing: -0.4 }}>
            Your feed starts with one take.
          </Text>
          <Text style={{ color: stadiumSlate.textMuted, fontSize: 13, lineHeight: 19, marginTop: 5 }}>
            Log a game or follow a few fans. We’ll turn it into a timeline worth checking after every final buzzer.
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <TouchableOpacity
          onPress={onSearch}
          activeOpacity={0.8}
          style={{
            borderRadius: 13,
            backgroundColor: stadiumSlate.accent,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Search size={15} color={stadiumSlate.background} strokeWidth={2.5} />
          <Text style={{ color: stadiumSlate.background, fontSize: 13, fontWeight: '900' }}>
            Log a game
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDiscover}
          activeOpacity={0.8}
          style={{
            borderRadius: 13,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(255,255,255,0.035)',
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <UserPlus size={15} color="#ffffff" strokeWidth={2.3} />
          <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '800' }}>
            Find people
          </Text>
        </TouchableOpacity>
      </View>
    </DashboardPanel>
  );
}

function FeedDashboard({
  dashboard,
  hasLogs,
}: {
  dashboard?: FeedDashboardData;
  hasLogs: boolean;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const people = dashboard?.suggestedUsers.length
    ? dashboard.suggestedUsers
    : dashboard?.activeUsers ?? [];

  return (
    <View style={{ width: '100%', minWidth: 0, paddingHorizontal: isDesktop ? 20 : 14, paddingTop: isDesktop ? 10 : 14, paddingBottom: 14 }}>
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', alignItems: 'flex-start', gap: 16, width: '100%', minWidth: 0 }}>
        <View style={{ flex: isDesktop ? 1 : undefined, width: '100%', minWidth: 0 }}>
          <DashboardPanel
            style={{
              padding: 0,
              minHeight: isDesktop ? 300 : undefined,
              backgroundColor: '#0a0d12',
              ...(Platform.OS === 'web'
                ? ({
                    backgroundImage:
                      'radial-gradient(circle at 84% 18%, rgba(255,106,61,0.20), transparent 30%), radial-gradient(circle at 12% 105%, rgba(73,102,255,0.14), transparent 34%)',
                  } as any)
                : null),
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: isDesktop ? 34 : -26,
                top: isDesktop ? 22 : 80,
                width: isDesktop ? 170 : 120,
                height: isDesktop ? 170 : 120,
                borderRadius: 999,
                borderWidth: 28,
                borderColor: 'rgba(255,106,61,0.055)',
              }}
            />
            <View style={{ padding: isDesktop ? 30 : 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: stadiumSlate.accent,
                    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 18px rgba(255,106,61,0.9)' } as any) : null),
                  }}
                />
                <Text style={{ color: stadiumSlate.accentSoft, fontSize: 11, fontWeight: '900', letterSpacing: 1.7 }}>
                  YOUR COURTSIDE
                </Text>
              </View>

              <Text
                style={{
                  color: stadiumSlate.text,
                  fontSize: isDesktop ? 46 : 33,
                  lineHeight: isDesktop ? 48 : 36,
                  fontWeight: '900',
                  letterSpacing: isDesktop ? -2.2 : -1.4,
                  maxWidth: 610,
                  marginTop: 14,
                }}
              >
                Every game. Every take. One feed.
              </Text>
              <Text
                style={{
                  color: stadiumSlate.textMuted,
                  fontSize: isDesktop ? 15 : 14,
                  lineHeight: isDesktop ? 23 : 21,
                  maxWidth: 560,
                  marginTop: 12,
                }}
              >
                Track the games you watch, rank the classics, and keep up with the people who actually know ball.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/search')}
                  activeOpacity={0.82}
                  style={{
                    minHeight: 46,
                    borderRadius: 14,
                    backgroundColor: stadiumSlate.accent,
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 9,
                  }}
                >
                  <Search size={17} color={stadiumSlate.background} strokeWidth={2.7} />
                  <Text style={{ color: stadiumSlate.background, fontSize: 13, fontWeight: '900' }}>Browse games</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/rankings')}
                  activeOpacity={0.75}
                  style={{
                    minHeight: 46,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.11)',
                    backgroundColor: 'rgba(255,255,255,0.035)',
                    paddingHorizontal: 17,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 9,
                  }}
                >
                  <Trophy size={16} color={stadiumSlate.text} strokeWidth={2.5} />
                  <Text style={{ color: stadiumSlate.text, fontSize: 13, fontWeight: '800' }}>Open rankings</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.075)',
                backgroundColor: 'rgba(255,255,255,0.018)',
                paddingHorizontal: isDesktop ? 30 : 20,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              {[
                { value: dashboard?.mostLogged.length ?? 0, label: 'hot games' },
                { value: people.length, label: 'fans moving' },
                { value: hasLogs ? 'LIVE' : 'READY', label: 'your feed' },
              ].map((metric, index) => (
                <View
                  key={metric.label}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    paddingLeft: index ? 14 : 0,
                    marginLeft: index ? 14 : 0,
                    borderLeftWidth: index ? 1 : 0,
                    borderLeftColor: 'rgba(255,255,255,0.08)',
                  }}
                >
                  <Text style={{ color: stadiumSlate.text, fontSize: typeof metric.value === 'number' ? 19 : 13, fontWeight: '900', letterSpacing: -0.3 }}>
                    {metric.value}
                  </Text>
                  <Text style={{ color: stadiumSlate.textSubtle, fontSize: 10, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>
                    {metric.label}
                  </Text>
                </View>
              ))}
            </View>
          </DashboardPanel>

          <View style={{ marginTop: 14, width: '100%', minWidth: 0 }}>
            <TodaysGames />
          </View>

          {!hasLogs ? (
            <EmptyFeedNudge
              onSearch={() => router.push('/(tabs)/search')}
              onDiscover={() => router.push('/(tabs)/discover')}
            />
          ) : null}

          {dashboard?.mostLogged.length ? (
            <DashboardPanel style={{ marginTop: 14 }}>
              <SectionTitle icon={Flame} title="Most Logged This Week" color={stadiumSlate.danger} />
              {dashboard.mostLogged.map((item, index) => (
                <MatchupRow key={item.game.id} item={item} index={index} />
              ))}
            </DashboardPanel>
          ) : null}
        </View>

        <View style={{ width: isDesktop ? 352 : '100%', minWidth: 0, gap: 16 }}>
          <Pressable
            onPress={() => router.push('/world-cup')}
            style={({ hovered, pressed }: any) => ({
              minHeight: 190,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: hovered || pressed ? 'rgba(114,135,255,0.52)' : 'rgba(114,135,255,0.25)',
              backgroundColor: hovered || pressed ? '#151b31' : '#111629',
              padding: 20,
              overflow: 'hidden',
              ...(Platform.OS === 'web'
                ? ({
                    backgroundImage: 'radial-gradient(circle at 92% 8%, rgba(114,135,255,0.32), transparent 38%)',
                    boxShadow: '0 20px 45px rgba(0,0,0,0.22)',
                  } as any)
                : null),
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: 'rgba(165,178,255,0.28)',
                  backgroundColor: 'rgba(165,178,255,0.1)',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Radio size={12} color="#a5b2ff" />
                <Text style={{ color: '#a5b2ff', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }}>TOURNAMENT WATCH</Text>
              </View>
              <ArrowUpRight size={18} color="#a5b2ff" />
            </View>
            <Text style={{ color: stadiumSlate.text, fontSize: 24, lineHeight: 27, fontWeight: '900', letterSpacing: -0.8, marginTop: 24 }}>
              World Cup 2026
            </Text>
            <Text style={{ color: '#9aa7cb', fontSize: 13, lineHeight: 19, marginTop: 7 }}>
              Live matches, the bracket, standings, and Golden Boot race—without leaving your feed.
            </Text>
          </Pressable>

          <DashboardPanel>
            <SectionTitle icon={Trophy} title="Fan Passport" color={stadiumSlate.accent} />
            <Text style={{ color: stadiumSlate.text, fontSize: 21, fontWeight: '900', lineHeight: 25, letterSpacing: -0.5 }}>
              Keep the receipts.
            </Text>
            <Text style={{ color: stadiumSlate.textMuted, fontSize: 13, lineHeight: 19, marginTop: 7 }}>
              Your logs, rankings, predictions, and favorites become a sports identity that is unmistakably yours.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
              {['Watched', 'Ranked', 'Predicted'].map((label) => (
                <View
                  key={label}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.09)',
                    backgroundColor: 'rgba(255,255,255,0.035)',
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                  }}
                >
                  <Text style={{ color: stadiumSlate.textMuted, fontSize: 10, fontWeight: '800' }}>{label}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.75}
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,106,61,0.3)',
                paddingVertical: 12,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 16,
                backgroundColor: 'rgba(255,106,61,0.07)',
              }}
            >
              <Text style={{ color: stadiumSlate.accentSoft, fontSize: 13, fontWeight: '900' }}>View your passport</Text>
              <ArrowUpRight size={16} color={stadiumSlate.accent} />
            </TouchableOpacity>
          </DashboardPanel>

          {people.length ? (
            <DashboardPanel>
              <SectionTitle
                icon={TrendingUp}
                title={dashboard?.suggestedUsers.length ? 'People to Follow' : 'Active Reviewers'}
              />
              {people.map((item) => (
                <UserRow key={item.profile.user_id} item={item} />
              ))}
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/discover')}
                activeOpacity={0.75}
                style={{
                  borderRadius: 13,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.09)',
                  paddingVertical: 11,
                  alignItems: 'center',
                  marginTop: 4,
                  backgroundColor: 'rgba(255,255,255,0.025)',
                }}
              >
                <Text style={{ color: stadiumSlate.text, fontSize: 13, fontWeight: '800' }}>Open Discover</Text>
              </TouchableOpacity>
            </DashboardPanel>
          ) : null}
        </View>
      </View>

      {hasLogs ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 10 }}>
          <View style={{ width: 28, height: 3, borderRadius: 999, backgroundColor: stadiumSlate.accent }} />
          <Text style={{ color: stadiumSlate.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 }}>
            Latest from your feed
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function FeedScreen() {
  const { user } = useAuthStore();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed', user?.id],
    queryFn: ({ pageParam = 0 }) => fetchFeedPage(user!.id, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    enabled: !!user,
  });

  const { data: dashboard } = useQuery({
    queryKey: ['feed-dashboard', user?.id],
    queryFn: () => fetchFeedDashboard(user!.id),
    enabled: !!user,
  });

  if (isLoading) {
    return <FeedSkeleton />;
  }

  if (error) {
    return <ErrorState message="Failed to load feed" onRetry={refetch} />;
  }

  // Flatten pages and sort by favorite teams on first page
  const allLogs = data?.pages.flatMap((p) => p.logs) ?? [];
  const favoriteTeamIds = new Set(data?.pages[0]?.favoriteTeamIds ?? []);

  // Sort: favorite team games first within the full list
  if (favoriteTeamIds.size > 0) {
    allLogs.sort((a, b) => {
      const aFav = a.game &&
        (favoriteTeamIds.has(a.game.home_team_id) || favoriteTeamIds.has(a.game.away_team_id))
        ? 1 : 0;
      const bFav = b.game &&
        (favoriteTeamIds.has(b.game.home_team_id) || favoriteTeamIds.has(b.game.away_team_id))
        ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime();
    });
  }

  return (
    <View className="flex-1 bg-background">
      <PageContainer className="flex-1" showDesktopNav>
      <FlatList
        data={allLogs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ width: '100%', maxWidth: 800, alignSelf: 'center', paddingHorizontal: isDesktop ? 20 : 14 }}>
            <GameCard log={item} showUser />
          </View>
        )}
        ListHeaderComponent={
          <FeedDashboard dashboard={dashboard} hasLogs={allLogs.length > 0} />
        }
        contentContainerStyle={
          { paddingTop: 4, paddingBottom: 32, paddingHorizontal: 0 }
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator color="#ff6a3d" />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={refetch}
            tintColor="#ff6a3d"
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
      />
      </PageContainer>
    </View>
  );
}
