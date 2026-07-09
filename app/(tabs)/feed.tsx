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
import { Flame, Search, TrendingUp, Trophy, UserPlus } from 'lucide-react-native';
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
  color = '#4ea1ff',
}: {
  icon: any;
  title: string;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          backgroundColor: `${color}18`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={15} color={color} strokeWidth={2.4} />
      </View>
      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800' }}>
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
          borderRadius: 8,
          borderWidth: 1,
          borderColor: 'rgba(70,96,121,0.55)',
          backgroundColor: stadiumSlate.surface,
          padding: 16,
          overflow: 'hidden',
        },
        Platform.OS === 'web'
          ? ({
              boxShadow: '0 18px 36px rgba(0,0,0,0.18)',
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
        borderRadius: 8,
        borderWidth: 1,
        borderColor: hovered || pressed ? 'rgba(78,161,255,0.36)' : 'rgba(70,96,121,0.42)',
        backgroundColor: hovered || pressed ? 'rgba(78,161,255,0.07)' : 'rgba(255,255,255,0.025)',
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
              backgroundColor: index === 0 ? 'rgba(78,161,255,0.16)' : 'rgba(143,161,179,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: index === 0 ? '#4ea1ff' : '#8fa1b3', fontSize: 11, fontWeight: '900' }}>
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
            backgroundColor: 'rgba(78,161,255,0.11)',
            paddingHorizontal: 9,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: '#4ea1ff', fontSize: 12, fontWeight: '800' }}>
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
        borderRadius: 8,
        padding: 10,
        marginBottom: 6,
        backgroundColor: hovered || pressed ? 'rgba(78,161,255,0.07)' : 'transparent',
      })}
    >
      <Avatar url={profile.avatar_url} name={profile.display_name} size={34} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
          {profile.display_name}
        </Text>
        <Text style={{ color: '#8fa1b3', fontSize: 12 }} numberOfLines={1}>
          @{profile.handle}
        </Text>
      </View>
      <Text style={{ color: '#4ea1ff', fontSize: 12, fontWeight: '800' }}>
        {logCount}
      </Text>
    </Pressable>
  );
}

function EmptyFeedNudge({ onSearch, onDiscover }: { onSearch: () => void; onDiscover: () => void }) {
  return (
    <DashboardPanel style={{ marginTop: 10, backgroundColor: stadiumSlate.surfaceElevated }}>
      <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '800' }}>
        Build your courtside feed
      </Text>
      <Text style={{ color: '#8c909c', fontSize: 14, lineHeight: 20, marginTop: 6 }}>
        Follow fans or log a game. The timeline will fill in here, but the live board stays useful right away.
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <TouchableOpacity
          onPress={onSearch}
          activeOpacity={0.8}
          style={{
            borderRadius: 8,
            backgroundColor: '#4ea1ff',
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Search size={15} color="#0b1118" strokeWidth={2.5} />
          <Text style={{ color: '#0b1118', fontSize: 13, fontWeight: '900' }}>
            Log a game
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDiscover}
          activeOpacity={0.8}
          style={{
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(70,96,121,0.6)',
            paddingHorizontal: 14,
            paddingVertical: 10,
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
    <View style={{ paddingHorizontal: isDesktop ? 24 : 16, paddingTop: isDesktop ? 8 : 14, paddingBottom: 12 }}>
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
        <View style={{ flex: isDesktop ? 1.9 : undefined, minWidth: 0 }}>
          <DashboardPanel style={{ padding: 0, backgroundColor: stadiumSlate.background }}>
            <View style={{ padding: 16, paddingBottom: 0 }}>
              <View
                style={{
                  flexDirection: isDesktop ? 'row' : 'column',
                  alignItems: isDesktop ? 'center' : 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <View style={{ flexShrink: 1 }}>
                  <Text style={{ color: '#8fa1b3', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>
                    Tonight in the NBA
                  </Text>
                  <Text style={{ color: '#ffffff', fontSize: isDesktop ? 28 : 22, fontWeight: '900', marginTop: 2 }}>
                    Start from the scoreboard
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/search')}
                  activeOpacity={0.8}
                  style={{
                    borderRadius: 8,
                    backgroundColor: '#4ea1ff',
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    alignSelf: isDesktop ? 'auto' : 'flex-start',
                  }}
                >
                  <Text style={{ color: '#0b1118', fontSize: 12, fontWeight: '900' }}>
                    Log Game
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ marginTop: 8 }}>
              <TodaysGames />
            </View>
          </DashboardPanel>

          <Pressable
            onPress={() => router.push('/world-cup')}
            style={({ hovered, pressed }: any) => ({
              marginTop: 14,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: hovered || pressed ? 'rgba(78,161,255,0.62)' : 'rgba(70,96,121,0.6)',
              backgroundColor: 'rgba(17,25,35,0.92)',
              padding: 16,
              flexDirection: isDesktop ? 'row' : 'column',
              alignItems: isDesktop ? 'center' : 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(78,161,255,0.14)',
                  borderWidth: 1,
                  borderColor: 'rgba(78,161,255,0.32)',
                }}
              >
                <Trophy size={19} color={stadiumSlate.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900' }}>
                  World Cup 2026 hub
                </Text>
                <Text style={{ color: '#8fa1b3', fontSize: 13, marginTop: 3 }}>
                  Standings, bracket, live matches, and the Golden Boot race.
                </Text>
              </View>
            </View>
            <Text style={{ color: stadiumSlate.accent, fontSize: 12, fontWeight: '900' }}>
              Open hub
            </Text>
          </Pressable>

          {!hasLogs ? (
            <EmptyFeedNudge
              onSearch={() => router.push('/(tabs)/search')}
              onDiscover={() => router.push('/(tabs)/discover')}
            />
          ) : null}

          {dashboard?.mostLogged.length ? (
            <DashboardPanel style={{ marginTop: 14 }}>
              <SectionTitle icon={Flame} title="Most Logged This Week" color="#ff6b76" />
              {dashboard.mostLogged.map((item, index) => (
                <MatchupRow key={item.game.id} item={item} index={index} />
              ))}
            </DashboardPanel>
          ) : null}
        </View>

        <View style={{ width: isDesktop ? 330 : undefined, gap: 14 }}>
          <DashboardPanel>
            <SectionTitle icon={TrendingUp} title="Activity Pulse" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '900' }}>
                  {dashboard?.mostLogged.length ?? 0}
                </Text>
                <Text style={{ color: '#8fa1b3', fontSize: 12, marginTop: 2 }}>
                  hot games
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '900' }}>
                  {people.length}
                </Text>
                <Text style={{ color: '#8fa1b3', fontSize: 12, marginTop: 2 }}>
                  fans active
                </Text>
              </View>
            </View>
          </DashboardPanel>

          {people.length ? (
            <DashboardPanel>
              <SectionTitle
                icon={UserPlus}
                title={dashboard?.suggestedUsers.length ? 'People to Follow' : 'Active Reviewers'}
              />
              {people.map((item) => (
                <UserRow key={item.profile.user_id} item={item} />
              ))}
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/discover')}
                activeOpacity={0.75}
                style={{
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(78,161,255,0.32)',
                  paddingVertical: 10,
                  alignItems: 'center',
                  marginTop: 4,
                }}
              >
                <Text style={{ color: '#4ea1ff', fontSize: 13, fontWeight: '800' }}>
                  Open Discover
                </Text>
              </TouchableOpacity>
            </DashboardPanel>
          ) : null}
        </View>
      </View>

      {hasLogs ? (
        <View style={{ marginTop: 16, marginBottom: 4 }}>
          <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900' }}>
            Latest from your feed
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function FeedScreen() {
  const { user } = useAuthStore();

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
          <View style={{ paddingHorizontal: 16 }}>
            <GameCard log={item} showUser />
          </View>
        )}
        ListHeaderComponent={
          <FeedDashboard dashboard={dashboard} hasLogs={allLogs.length > 0} />
        }
        contentContainerStyle={
          { paddingTop: 4, paddingBottom: 24, paddingHorizontal: 0 }
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator color="#4ea1ff" />
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
            tintColor="#4ea1ff"
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
