import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { UserPlus, Users, Gamepad2, TrendingUp, Flame, Trophy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/authStore';
import { useToastStore } from '@/lib/store/toastStore';
import Avatar from '@/components/Avatar';
import TeamLogo from '@/components/TeamLogo';
import PlayoffBadge from '@/components/PlayoffBadge';
import { DiscoverSkeleton } from '@/components/Skeleton';
import { PageContainer } from '@/components/PageContainer';
import FindFriendsSheet from '@/components/FindFriendsSheet';
import type { GameWithTeams, UserProfile, LogTag } from '@/types/database';

interface MostLoggedGame {
  game: GameWithTeams;
  logCount: number;
}

interface PopularUser {
  profile: UserProfile;
  logCount: number;
}

interface SuggestedUser {
  profile: UserProfile;
  logCount: number;
}

interface TrendingTag {
  tag: LogTag;
  count: number;
}

interface DiscoverData {
  mostLogged: MostLoggedGame[];
  popularUsers: PopularUser[];
  suggestedUsers: SuggestedUser[];
  trendingTags: TrendingTag[];
  followingCount: number;
}

async function fetchDiscover(userId: string): Promise<DiscoverData> {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [recentLogsRes, followsRes, tagMapRes] = await Promise.all([
    supabase
      .from('game_logs')
      .select('game_id, rating, user_id')
      .gte('logged_at', sevenDaysAgo),
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId),
    supabase
      .from('game_log_tag_map')
      .select('tag_id, log:game_logs!inner(logged_at)')
      .gte('log.logged_at', sevenDaysAgo),
  ]);

  if (recentLogsRes.error) throw recentLogsRes.error;

  const recentLogs = recentLogsRes.data ?? [];
  const followedIds = new Set((followsRes.data ?? []).map((f) => f.following_id));

  const gameStats: Record<string, { count: number }> = {};
  const userLogCount: Record<string, number> = {};

  for (const log of recentLogs) {
    if (!gameStats[log.game_id]) {
      gameStats[log.game_id] = { count: 0 };
    }
    gameStats[log.game_id].count++;
    userLogCount[log.user_id] = (userLogCount[log.user_id] ?? 0) + 1;
  }

  const mostLoggedIds = Object.entries(gameStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([id]) => id);

  const popularUserIds = Object.entries(userLogCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  const suggestedUserIds = Object.entries(userLogCount)
    .filter(([id]) => id !== userId && !followedIds.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  const tagCountMap: Record<string, number> = {};
  for (const row of (tagMapRes.data ?? []) as any[]) {
    tagCountMap[row.tag_id] = (tagCountMap[row.tag_id] ?? 0) + 1;
  }
  const topTagIds = Object.entries(tagCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const allGameIds = [...new Set(mostLoggedIds)];
  const allUserIds = [...new Set([...popularUserIds, ...suggestedUserIds])];
  const tagIds = topTagIds.map(([id]) => id);

  const [gamesRes, profilesRes, tagsRes] = await Promise.all([
    allGameIds.length > 0
      ? supabase
          .from('games')
          .select(`
            *,
            home_team:teams!games_home_team_id_fkey (*),
            away_team:teams!games_away_team_id_fkey (*),
            season:seasons (*)
          `)
          .in('id', allGameIds)
      : Promise.resolve({ data: [], error: null }),
    allUserIds.length > 0
      ? supabase
          .from('user_profiles')
          .select('*')
          .in('user_id', allUserIds)
      : Promise.resolve({ data: [], error: null }),
    tagIds.length > 0
      ? supabase.from('log_tags').select('*').in('id', tagIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const gameMap: Record<string, GameWithTeams> = {};
  for (const g of (gamesRes.data ?? []) as any[]) {
    gameMap[g.id] = g;
  }

  const profileMap: Record<string, UserProfile> = {};
  for (const p of (profilesRes.data ?? []) as UserProfile[]) {
    profileMap[p.user_id] = p;
  }

  const tagMap: Record<string, LogTag> = {};
  for (const t of (tagsRes.data ?? []) as LogTag[]) {
    tagMap[t.id] = t;
  }

  const mostLogged: MostLoggedGame[] = mostLoggedIds
    .filter((id) => gameMap[id])
    .map((id) => ({
      game: gameMap[id],
      logCount: gameStats[id].count,
    }));

  const popularUsers: PopularUser[] = popularUserIds
    .filter((id) => profileMap[id])
    .map((id) => ({
      profile: profileMap[id],
      logCount: userLogCount[id],
    }));

  const suggestedUsers: SuggestedUser[] = suggestedUserIds
    .filter((id) => profileMap[id])
    .map((id) => ({
      profile: profileMap[id],
      logCount: userLogCount[id],
    }));

  const trendingTags: TrendingTag[] = topTagIds
    .filter(([id]) => tagMap[id])
    .map(([id, count]) => ({
      tag: tagMap[id],
      count,
    }));

  return {
    mostLogged,
    popularUsers,
    suggestedUsers,
    trendingTags,
    followingCount: followedIds.size,
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function SectionHeader({ icon: Icon, title, color = '#d4a843' }: { icon: any; title: string; color?: string }) {
  return (
    <View className="flex-row items-center gap-2 mb-3">
      <View style={{ backgroundColor: color + '20', borderRadius: 8, padding: 6 }}>
        <Icon size={16} color={color} strokeWidth={2.5} />
      </View>
      <Text className="text-white text-lg font-bold">{title}</Text>
    </View>
  );
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const toast = useToastStore();
  const queryClient = useQueryClient();
  const [showFindFriends, setShowFindFriends] = useState(false);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['discover', user?.id],
    queryFn: () => fetchDiscover(user!.id),
    enabled: !!user,
  });

  const followMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user) return;
      const { error } = await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: targetUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: ['discover'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      toast.show('Followed!');
    },
  });

  if (isLoading) {
    return <DiscoverSkeleton />;
  }

  if (error || !data) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-accent-red text-center">
          Failed to load discover. Pull to refresh.
        </Text>
      </View>
    );
  }

  const { mostLogged, popularUsers, suggestedUsers, trendingTags, followingCount } = data;
  const showSuggestions = suggestedUsers.length > 0 && followingCount < 3;

  return (
    <ScrollView
      className="flex-1 bg-background"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor="#d4a843"
        />
      }
    >
      <PageContainer>
      {/* Hero banners */}
      <View className="px-4 pt-5 gap-3">
        {/* Find Friends — gold tinted hero */}
        <TouchableOpacity
          onPress={() => setShowFindFriends(true)}
          activeOpacity={0.7}
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <View style={{
            backgroundColor: '#141416',
            borderWidth: 1,
            borderColor: 'rgba(212, 168, 67, 0.15)',
            borderRadius: 16,
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}>
            {/* Gold glow orb */}
            <View style={{
              position: 'absolute', top: -20, right: -20,
              width: 100, height: 100, borderRadius: 50,
              backgroundColor: 'rgba(212, 168, 67, 0.06)',
            }} />
            <View style={{
              backgroundColor: 'rgba(212, 168, 67, 0.15)',
              width: 44, height: 44, borderRadius: 12,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Users size={22} color="#d4a843" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-white font-bold text-base">Find Friends</Text>
              <Text className="text-muted text-xs mt-0.5">See who from your contacts is here</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* NBA Codenames — richer banner */}
        <TouchableOpacity
          onPress={() => router.push('/codenames' as any)}
          activeOpacity={0.7}
          style={{
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          <View style={{
            backgroundColor: '#141416',
            borderWidth: 1,
            borderColor: 'rgba(212, 168, 67, 0.1)',
            borderRadius: 16,
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}>
            {/* Accent glow */}
            <View style={{
              position: 'absolute', bottom: -15, left: -15,
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: 'rgba(230, 57, 70, 0.04)',
            }} />
            <View style={{
              backgroundColor: 'rgba(212, 168, 67, 0.12)',
              width: 44, height: 44, borderRadius: 12,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Gamepad2 size={22} color="#d4a843" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-white font-bold text-base">NBA Codenames</Text>
              <Text className="text-muted text-xs mt-0.5">Real-time multiplayer word game</Text>
            </View>
            <View style={{
              backgroundColor: 'rgba(212, 168, 67, 0.15)',
              borderRadius: 20,
              paddingHorizontal: 10, paddingVertical: 4,
            }}>
              <Text style={{ color: '#d4a843', fontSize: 11, fontWeight: '700' }}>PLAY</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* People to Follow */}
      {showSuggestions && (
        <View className="px-4 pt-6">
          <SectionHeader icon={UserPlus} title="People to Follow" />
          {suggestedUsers.map((item) => (
            <View
              key={item.profile.user_id}
              className="bg-surface border border-border rounded-2xl p-4 mb-2 flex-row items-center gap-3"
            >
              <TouchableOpacity
                className="flex-row items-center gap-3 flex-1"
                onPress={() => router.push(`/user/${item.profile.handle}`)}
                activeOpacity={0.7}
              >
                <Avatar
                  url={item.profile.avatar_url}
                  name={item.profile.display_name}
                  size={40}
                />
                <View className="flex-1">
                  <Text className="text-white font-semibold">
                    {item.profile.display_name}
                  </Text>
                  <Text className="text-muted text-sm">
                    {item.logCount} {item.logCount === 1 ? 'log' : 'logs'} this week
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-accent rounded-full px-4 py-2 flex-row items-center gap-1.5"
                onPress={() => followMutation.mutate(item.profile.user_id)}
                disabled={followMutation.isPending}
                activeOpacity={0.7}
              >
                <UserPlus size={14} color="#08080a" strokeWidth={2.5} />
                <Text style={{ color: '#08080a', fontSize: 12, fontWeight: '700' }}>Follow</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Trending Tags */}
      {trendingTags.length > 0 && (
        <View className="px-4 pt-6">
          <SectionHeader icon={TrendingUp} title="Trending Tags" />
          <View className="flex-row flex-wrap gap-2 mb-2">
            {trendingTags.map((item) => (
              <TouchableOpacity
                key={item.tag.id}
                onPress={() => router.push(`/tag/${item.tag.slug}`)}
                activeOpacity={0.7}
                style={{
                  backgroundColor: 'rgba(212, 168, 67, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(212, 168, 67, 0.25)',
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                }}
              >
                <Text style={{ color: '#d4a843', fontSize: 13, fontWeight: '600' }}>
                  {item.tag.name}
                  <Text style={{ color: '#7a7d88' }}> {item.count}</Text>
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Most Logged This Week */}
      <View className="px-4 pt-6">
        <SectionHeader icon={Flame} title="Most Logged This Week" color="#e63946" />
        {mostLogged.length === 0 ? (
          <View className="items-center py-6 mb-4">
            <Text className="text-muted text-sm">No activity this week yet</Text>
          </View>
        ) : (
          mostLogged.map((item, idx) => (
            <TouchableOpacity
              key={item.game.id}
              className="bg-surface border border-border rounded-2xl p-4 mb-2"
              onPress={() => router.push(`/game/${item.game.id}`)}
              activeOpacity={0.7}
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center gap-2">
                  <View style={{
                    width: 24, height: 24, borderRadius: 12,
                    backgroundColor: idx === 0 ? 'rgba(212, 168, 67, 0.2)' : 'rgba(122, 125, 136, 0.1)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{
                      color: idx === 0 ? '#d4a843' : '#7a7d88',
                      fontSize: 11, fontWeight: '800',
                    }}>
                      {idx + 1}
                    </Text>
                  </View>
                  <TeamLogo abbreviation={item.game.away_team.abbreviation} sport={item.game.sport ?? 'nba'} size={22} />
                  <Text className="text-white font-semibold">
                    {item.game.away_team.abbreviation}
                  </Text>
                  <Text className="text-muted text-xs">@</Text>
                  <TeamLogo abbreviation={item.game.home_team.abbreviation} sport={item.game.sport ?? 'nba'} size={22} />
                  <Text className="text-white font-semibold">
                    {item.game.home_team.abbreviation}
                  </Text>
                  {item.game.playoff_round && <PlayoffBadge round={item.game.playoff_round} sport={item.game.sport ?? 'nba'} />}
                </View>
                <View style={{
                  backgroundColor: 'rgba(212, 168, 67, 0.1)',
                  borderRadius: 12,
                  paddingHorizontal: 8, paddingVertical: 3,
                }}>
                  <Text style={{ color: '#d4a843', fontSize: 12, fontWeight: '700' }}>
                    {item.logCount}
                  </Text>
                </View>
              </View>
              <Text className="text-muted text-xs mt-1.5" style={{ marginLeft: 34 }}>
                {formatDate(item.game.game_date_utc)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Active Reviewers */}
      <View className="px-4 pt-6 pb-8">
        <SectionHeader icon={Trophy} title="Active Reviewers" />
        {popularUsers.length === 0 ? (
          <View className="items-center py-6">
            <Text className="text-muted text-sm">No active reviewers this week</Text>
          </View>
        ) : (
          popularUsers.map((item) => (
            <TouchableOpacity
              key={item.profile.user_id}
              className="bg-surface border border-border rounded-2xl p-4 mb-2 flex-row items-center gap-3"
              onPress={() => router.push(`/user/${item.profile.handle}`)}
              activeOpacity={0.7}
            >
              <Avatar
                url={item.profile.avatar_url}
                name={item.profile.display_name}
                size={40}
              />
              <View className="flex-1">
                <Text className="text-white font-semibold">
                  {item.profile.display_name}
                </Text>
                <Text className="text-muted text-sm">@{item.profile.handle}</Text>
              </View>
              <View style={{
                backgroundColor: 'rgba(212, 168, 67, 0.1)',
                borderRadius: 12,
                paddingHorizontal: 8, paddingVertical: 3,
              }}>
                <Text style={{ color: '#d4a843', fontSize: 12, fontWeight: '700' }}>
                  {item.logCount}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
      {showFindFriends && (
        <FindFriendsSheet onClose={() => setShowFindFriends(false)} />
      )}
      </PageContainer>
    </ScrollView>
  );
}
