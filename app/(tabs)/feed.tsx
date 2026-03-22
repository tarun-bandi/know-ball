import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { enrichLogs } from '@/lib/enrichLogs';
import { useAuthStore } from '@/lib/store/authStore';
import GameCard from '@/components/GameCard';
import TodaysGames from '@/components/TodaysGames';
import ErrorState from '@/components/ErrorState';
import { FeedSkeleton } from '@/components/Skeleton';
import type { GameLogWithGame } from '@/types/database';
import { PageContainer } from '@/components/PageContainer';

const PAGE_SIZE = 20;

interface FeedPage {
  logs: GameLogWithGame[];
  nextOffset: number | null;
  favoriteTeamIds: string[];
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

  const followedIds = (followsRes.data ?? []).map((f) => f.following_id);
  const favoriteTeamIds = (favTeamsRes.data ?? []).map((f) => f.team_id);
  const enabledSports = (profileRes.data?.enabled_sports as string[]) ?? ['nba'];
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
    for (const p of profiles ?? []) {
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

export default function FeedScreen() {
  const { user } = useAuthStore();
  const router = useRouter();

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
      <PageContainer className="flex-1">
      <FlatList
        data={allLogs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <GameCard log={item} showUser />}
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            <TodaysGames />
          </View>
        }
        contentContainerStyle={
          allLogs.length === 0
            ? { flex: 1, justifyContent: 'center', alignItems: 'center' }
            : { paddingTop: 4, paddingBottom: 24, paddingHorizontal: 16 }
        }
        ListEmptyComponent={
          <View className="px-6 items-center" style={{ paddingTop: 40 }}>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: 'rgba(212, 168, 67, 0.1)',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Text style={{ fontSize: 36 }}>{'\u{1F3C0}'}</Text>
            </View>
            <Text className="text-white font-bold mb-2" style={{ fontSize: 22 }}>
              Nothing here yet
            </Text>
            <Text className="text-muted text-center mb-6" style={{ fontSize: 15, lineHeight: 22 }}>
              Follow other fans or search for a game{'\n'}to log your first entry.
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#d4a843',
                borderRadius: 14,
                paddingHorizontal: 32,
                paddingVertical: 14,
                shadowColor: '#d4a843',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
              }}
              onPress={() => router.push('/(tabs)/search')}
              activeOpacity={0.8}
            >
              <Text className="font-bold text-base" style={{ color: '#08080a' }}>
                Search Games
              </Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator color="#d4a843" />
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
            tintColor="#d4a843"
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
