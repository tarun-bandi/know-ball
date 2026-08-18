import { View, Text, TouchableOpacity, Share as RNShare, Platform, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback, memo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Share2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/authStore';
import Avatar from './Avatar';
import CommentsSheet from './CommentsSheet';
import TeamLogo from './TeamLogo';
import PlayoffBadge from './PlayoffBadge';
import RankBadge from './RankBadge';
import ReactionPicker, { REACTION_EMOJI, REACTION_CONFIG } from './ReactionPicker';
import { gameUrl } from '@/lib/urls';
import { getTeamAccentColor, withAlpha, ensureTextContrast } from '@/lib/teamColors';
import { stadiumSlate } from '@/lib/theme';
import type { GameLogWithGame, ReactionType } from '@/types/database';

interface GameCardProps {
  log: GameLogWithGame;
  showUser?: boolean;
  showLoggedBadge?: boolean;
}

const WATCH_MODE_LABEL: Record<string, string> = {
  live: 'Live',
  replay: 'Replay',
  condensed: 'Condensed',
  highlights: 'Highlights',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

function getGameLabel(game: GameLogWithGame['game']): string | null {
  if (!game) return null;

  // NBA: show formatted date
  if (game.sport === 'nba') {
    return formatDate(game.game_date_utc);
  }

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

/** Get top 2 reactions sorted by count (excluding 'like') */
function getTopReactions(reactions?: Record<ReactionType, number>): { type: ReactionType; count: number }[] {
  if (!reactions) return [];
  return Object.entries(reactions)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([type, count]) => ({ type: type as ReactionType, count }));
}

function GameCard({ log, showUser = false, showLoggedBadge = false }: GameCardProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 720;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [commentCount, setCommentCount] = useState(log.comment_count ?? 0);
  const game = log.game;

  // Fire overlay animation (for double-tap)
  const fireScale = useSharedValue(0);
  const fireOpacity = useSharedValue(0);
  const reactionButtonScale = useSharedValue(1);
  const reactionGlow = useSharedValue(0);
  const shareScale = useSharedValue(1);
  const shareGlow = useSharedValue(0);
  const commentScale = useSharedValue(1);
  const commentGlow = useSharedValue(0);

  const fireAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fireScale.value }],
    opacity: fireOpacity.value,
  }));

  const reactionButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reactionButtonScale.value }],
    shadowColor: '#ff6a3d',
    shadowOpacity: reactionGlow.value * 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  }));

  const shareButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shareScale.value }],
    shadowColor: '#5fa3ff',
    shadowOpacity: shareGlow.value * 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  }));

  const commentButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: commentScale.value }],
    shadowColor: '#7fd0ff',
    shadowOpacity: commentGlow.value * 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  }));

  const reactionMutation = useMutation({
    mutationFn: async ({ reactionType, isRemoval }: { reactionType: ReactionType; isRemoval: boolean }) => {
      if (!user) return;
      if (isRemoval) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('log_id', log.id);
        if (error) throw error;
      } else {
        // Upsert: insert or update reaction_type
        const { error } = await supabase
          .from('likes')
          .upsert(
            { user_id: user.id, log_id: log.id, reaction_type: reactionType },
            { onConflict: 'user_id,log_id' },
          );
        if (error) throw error;
      }
    },
    onMutate: async ({ reactionType, isRemoval }) => {
      const updater = (old: any) => {
        if (!old) return old;
        const updateLog = (l: GameLogWithGame) => {
          if (l.id !== log.id) return l;
          const prevReaction = l.my_reaction;
          const prevReactions = { ...(l.reactions ?? {}) } as Record<ReactionType, number>;

          if (isRemoval) {
            // Remove current reaction
            if (prevReaction && prevReactions[prevReaction]) {
              prevReactions[prevReaction] = Math.max(0, prevReactions[prevReaction] - 1);
            }
            return {
              ...l,
              liked_by_me: false,
              my_reaction: null,
              reactions: prevReactions,
              like_count: Math.max(0, (l.like_count ?? 0) - 1),
            };
          } else {
            // Decrement old reaction if changing
            if (prevReaction && prevReactions[prevReaction]) {
              prevReactions[prevReaction] = Math.max(0, prevReactions[prevReaction] - 1);
            }
            // Increment new reaction
            prevReactions[reactionType] = (prevReactions[reactionType] ?? 0) + 1;
            return {
              ...l,
              liked_by_me: true,
              my_reaction: reactionType,
              reactions: prevReactions,
              like_count: prevReaction ? (l.like_count ?? 0) : (l.like_count ?? 0) + 1,
            };
          }
        };
        if (Array.isArray(old)) return old.map(updateLog);
        if (old.logs) return { ...old, logs: old.logs.map(updateLog) };
        return old;
      };
      queryClient.setQueriesData({ queryKey: ['feed'] }, updater);
      queryClient.setQueriesData({ queryKey: ['profile'] }, updater);
      queryClient.setQueriesData({ queryKey: ['game-detail'] }, updater);
      queryClient.setQueriesData({ queryKey: ['user-profile'] }, updater);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['game-detail'] });
    },
  });

  if (!game) return null;

  const awayAccent = getTeamAccentColor(game.away_team.abbreviation, game.sport);
  const homeAccent = getTeamAccentColor(game.home_team.abbreviation, game.sport);
  const avatarRingColor =
    log.fan_of === 'home'
      ? homeAccent
      : log.fan_of === 'away'
        ? awayAccent
        : log.fan_of === 'both'
          ? stadiumSlate.accent
          : withAlpha(stadiumSlate.textMuted, 0.7);

  const animateIconTap = (scale: typeof shareScale, glow: typeof shareGlow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withSpring(1.1, { damping: 12, stiffness: 280 }),
      withSpring(1, { damping: 14, stiffness: 220 }),
    );
    glow.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 220 }),
    );
  };

  const handleReaction = useCallback((reactionType: ReactionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reactionButtonScale.value = withSequence(
      withSpring(1.15, { damping: 10, stiffness: 260 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
    reactionGlow.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 260 }),
    );
    const isRemoval = log.my_reaction === reactionType;
    reactionMutation.mutate({ reactionType, isRemoval });
    setShowReactionPicker(false);
  }, [log.my_reaction]);

  const handleReactionButtonPress = useCallback(() => {
    if (log.my_reaction) {
      // Tap removes current reaction
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      reactionButtonScale.value = withSequence(
        withSpring(1.3, { damping: 4, stiffness: 300 }),
        withSpring(1, { damping: 8, stiffness: 200 }),
      );
      reactionGlow.value = withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(0, { duration: 260 }),
      );
      reactionMutation.mutate({ reactionType: log.my_reaction, isRemoval: true });
    } else {
      // No reaction yet — show picker
      setShowReactionPicker(true);
    }
  }, [log.my_reaction]);

  const handleReactionButtonLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowReactionPicker(true);
  }, []);

  const triggerFireReaction = useCallback(() => {
    if (!log.my_reaction) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      reactionMutation.mutate({ reactionType: 'fire', isRemoval: false });
    }
  }, [log.my_reaction]);

  const showFireOverlay = useCallback(() => {
    fireScale.value = withSequence(
      withSpring(1.2, { damping: 6, stiffness: 200 }),
      withDelay(300, withTiming(0, { duration: 200 })),
    );
    fireOpacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(400, withTiming(0, { duration: 200 })),
    );
  }, []);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      runOnJS(triggerFireReaction)();
      runOnJS(showFireOverlay)();
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onStart(() => {
      runOnJS(router.push)(`/game/${game.id}`);
    });

  const composed = Gesture.Exclusive(doubleTap, singleTap);

  const handleShare = () => {
    if (!game) return;
    const snippet = log.review ? ` \u2014 "${log.review.slice(0, 80)}${log.review.length > 80 ? '...' : ''}"` : '';
    const url = gameUrl(game.id);
    const message = `I logged ${game.away_team.abbreviation} @ ${game.home_team.abbreviation} on Know Ball${snippet}\n${url}`;
    RNShare.share(Platform.OS === 'ios' ? { message, url } : { message });
  };

  const topReactions = getTopReactions(log.reactions);
  const totalReactionCount = log.like_count ?? 0;
  const myReaction = log.my_reaction;
  const gameLabel = getGameLabel(game);
  const loggedAtLabel = new Date(log.logged_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const cardContent = (
    <>
      {/* Fire overlay for double-tap */}
      <Animated.View
        style={[
          fireAnimStyle,
          {
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: -40,
            marginLeft: -40,
            zIndex: 10,
          },
        ]}
        pointerEvents="none"
      >
        <Text style={{ fontSize: 72 }}>{'\uD83D\uDD25'}</Text>
      </Animated.View>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: stadiumSlate.accent,
          ...(Platform.OS === 'web'
            ? ({ backgroundImage: `linear-gradient(90deg, ${awayAccent}, ${homeAccent})` } as any)
            : null),
        }}
      />

      {/* Post identity comes first, like a real social feed. */}
      {showUser && log.user_profile ? (
        <TouchableOpacity
          onPress={() => router.push(`/user/${log.user_profile!.handle}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${log.user_profile.display_name}'s profile`}
          activeOpacity={0.72}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <View
            style={{
              borderRadius: 999,
              padding: 2,
              borderWidth: 1,
              borderColor: avatarRingColor,
              backgroundColor: stadiumSlate.surfaceRaised,
            }}
          >
            <Avatar
              url={log.user_profile.avatar_url}
              name={log.user_profile.display_name}
              size={38}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
              <Text style={{ color: stadiumSlate.text, fontSize: 15, fontWeight: '900' }} numberOfLines={1}>
                {log.user_profile.display_name}
              </Text>
              <Text style={{ color: stadiumSlate.textSubtle, fontSize: 12 }} numberOfLines={1}>
                @{log.user_profile.handle}
              </Text>
            </View>
            <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, marginTop: 3 }}>
              Logged a game · {loggedAtLabel}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <Text style={{ color: stadiumSlate.textMuted, fontSize: 12 }}>{loggedAtLabel}</Text>
      )}

      {/* Matchup presented as embedded content instead of a stretched mobile pill. */}
      <View
        style={{
          marginTop: 18,
          borderRadius: isWide ? 18 : 15,
          borderWidth: 1,
          borderColor: withAlpha(stadiumSlate.borderStrong, 0.72),
          backgroundColor: stadiumSlate.surfaceRaised,
          paddingHorizontal: isWide ? 18 : 13,
          paddingVertical: isWide ? 16 : 13,
          overflow: 'hidden',
          ...(Platform.OS === 'web'
            ? ({
                backgroundImage: `linear-gradient(115deg, ${withAlpha(awayAccent, 0.11)}, transparent 38%, transparent 62%, ${withAlpha(homeAccent, 0.11)})`,
              } as any)
            : null),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <View
              style={{
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 4,
                backgroundColor: game.home_team_score !== null ? 'rgba(163,230,53,0.11)' : 'rgba(255,255,255,0.06)',
              }}
            >
              <Text
                style={{
                  color: game.home_team_score !== null ? '#c7f277' : stadiumSlate.textMuted,
                  fontSize: 9,
                  fontWeight: '900',
                  letterSpacing: 1.1,
                }}
              >
                {game.home_team_score !== null ? 'FINAL' : 'UPCOMING'}
              </Text>
            </View>
            {gameLabel ? (
              <Text style={{ color: stadiumSlate.textMuted, fontSize: 11 }} numberOfLines={1}>
                {gameLabel}
              </Text>
            ) : null}
          </View>
          {game.playoff_round ? (
            <PlayoffBadge round={game.playoff_round} sport={game.sport ?? 'nba'} />
          ) : null}
          {showLoggedBadge ? (
            <View
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: withAlpha(stadiumSlate.accent, 0.4),
                backgroundColor: withAlpha(stadiumSlate.accent, 0.12),
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: stadiumSlate.accentSoft, fontSize: 10, fontWeight: '800' }}>Logged</Text>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 13 }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TeamLogo abbreviation={game.away_team.abbreviation} sport={game.sport ?? 'nba'} size={isWide ? 34 : 28} />
            <View style={{ minWidth: 0, flex: 1 }}>
              <Text
                style={{ color: ensureTextContrast(awayAccent), fontSize: isWide ? 16 : 14, fontWeight: '900' }}
                numberOfLines={1}
              >
                {game.away_team.abbreviation}
              </Text>
              {isWide ? (
                <Text style={{ color: stadiumSlate.textSubtle, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                  {game.away_team.full_name}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: isWide ? 12 : 8, paddingHorizontal: isWide ? 18 : 8 }}>
            <Text style={{ color: stadiumSlate.text, fontSize: isWide ? 28 : 23, fontWeight: '900', letterSpacing: -1 }}>
              {game.away_team_score ?? '–'}
            </Text>
            <Text style={{ color: stadiumSlate.textSubtle, fontSize: 13 }}>—</Text>
            <Text style={{ color: stadiumSlate.text, fontSize: isWide ? 28 : 23, fontWeight: '900', letterSpacing: -1 }}>
              {game.home_team_score ?? '–'}
            </Text>
          </View>

          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
            <View style={{ minWidth: 0, flex: 1, alignItems: 'flex-end' }}>
              <Text
                style={{ color: ensureTextContrast(homeAccent), fontSize: isWide ? 16 : 14, fontWeight: '900' }}
                numberOfLines={1}
              >
                {game.home_team.abbreviation}
              </Text>
              {isWide ? (
                <Text style={{ color: stadiumSlate.textSubtle, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                  {game.home_team.full_name}
                </Text>
              ) : null}
            </View>
            <TeamLogo abbreviation={game.home_team.abbreviation} sport={game.sport ?? 'nba'} size={isWide ? 34 : 28} />
          </View>
        </View>

        {game.away_team_record && game.home_team_record ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 2 }}>
            <Text style={{ color: stadiumSlate.textSubtle, fontSize: 10 }}>{game.away_team_record}</Text>
            <Text style={{ color: stadiumSlate.textSubtle, fontSize: 10 }}>{game.home_team_record}</Text>
          </View>
        ) : null}
      </View>

      {(log.watch_mode || (log.position != null && log.rank_total != null)) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14, flexWrap: 'wrap' }}>
          {log.watch_mode ? (
            <View
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: withAlpha(stadiumSlate.borderStrong, 0.72),
                backgroundColor: 'rgba(255,255,255,0.035)',
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Text style={{ color: stadiumSlate.textMuted, fontSize: 11, fontWeight: '700' }}>
                {WATCH_MODE_LABEL[log.watch_mode!]}
              </Text>
            </View>
          ) : null}
          {log.position != null && log.rank_total != null ? (
            <RankBadge position={log.position} total={log.rank_total} fanOf={log.fan_of} />
          ) : null}
        </View>
      ) : null}

      {log.tags && log.tags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 }}>
          {log.tags.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              onPress={() => router.push(`/tag/${tag.slug}`)}
              activeOpacity={0.7}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: withAlpha(stadiumSlate.accent, 0.32),
                backgroundColor: withAlpha(stadiumSlate.accent, 0.09),
                paddingHorizontal: 9,
                paddingVertical: 5,
              }}
            >
              <Text style={{ color: stadiumSlate.accentSoft, fontSize: 11 }}>{tag.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {log.review ? (
        log.has_spoilers && !spoilerRevealed ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSpoilerRevealed(true);
            }}
            activeOpacity={0.7}
            style={{
              marginTop: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: stadiumSlate.border,
              backgroundColor: 'rgba(255,255,255,0.03)',
              paddingHorizontal: 13,
              paddingVertical: 11,
            }}
          >
            <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, fontStyle: 'italic' }}>
              {'\u26A0'} Spoiler — tap to reveal
            </Text>
          </TouchableOpacity>
        ) : (
          <Text
            style={{
              color: stadiumSlate.text,
              fontSize: isWide ? 16 : 15,
              lineHeight: isWide ? 25 : 23,
              marginTop: 17,
              letterSpacing: -0.1,
            }}
            numberOfLines={4}
          >
            {log.review}
          </Text>
        )
      ) : null}

      {log.image_urls && log.image_urls.length > 0 ? (
        log.image_urls.length === 1 ? (
          <Image
            source={{ uri: log.image_urls[0] }}
            style={{ width: '100%', height: isWide ? 280 : 205, borderRadius: 16, marginTop: 16 }}
            contentFit="cover"
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, marginTop: 16 }}
          >
            {log.image_urls.map((url) => (
              <Image
                key={url}
                source={{ uri: url }}
                style={{ width: isWide ? 280 : 220, height: isWide ? 220 : 175, borderRadius: 16 }}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        )
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          marginTop: 18,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.075)',
        }}
      >
        <View style={{ position: 'relative' }}>
          {showReactionPicker ? (
            <ReactionPicker
              currentReaction={myReaction ?? null}
              onSelect={handleReaction}
              onClose={() => setShowReactionPicker(false)}
            />
          ) : null}
          <Animated.View style={reactionButtonAnimStyle}>
            <TouchableOpacity
              onPress={handleReactionButtonPress}
              onLongPress={handleReactionButtonLongPress}
              accessibilityRole="button"
              accessibilityLabel={myReaction ? 'Remove reaction' : 'React to this log'}
              activeOpacity={0.66}
              style={{
                minHeight: 38,
                borderRadius: 11,
                borderWidth: 1,
                borderColor: myReaction ? withAlpha(stadiumSlate.accent, 0.36) : 'rgba(255,255,255,0.08)',
                backgroundColor: myReaction ? withAlpha(stadiumSlate.accent, 0.09) : 'rgba(255,255,255,0.025)',
                paddingHorizontal: isWide ? 12 : 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
              }}
            >
              {myReaction ? (
                <Text style={{ fontSize: 17 }}>{REACTION_EMOJI[myReaction]}</Text>
              ) : (
                <Heart size={17} color={stadiumSlate.textMuted} fill="transparent" />
              )}
              <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, fontWeight: '700' }}>
                {isWide ? 'React' : totalReactionCount || ''}
              </Text>
              {isWide && totalReactionCount > 0 ? (
                <Text style={{ color: stadiumSlate.textSubtle, fontSize: 11 }}>{totalReactionCount}</Text>
              ) : null}
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Animated.View style={commentButtonAnimStyle}>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              animateIconTap(commentScale, commentGlow);
              setShowComments(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Open comments"
            style={({ hovered, pressed }: any) => ({
              minHeight: 38,
              borderRadius: 11,
              borderWidth: 1,
              borderColor: hovered || pressed
                ? withAlpha(stadiumSlate.accent, 0.34)
                : 'rgba(255,255,255,0.08)',
              backgroundColor: hovered || pressed
                ? withAlpha(stadiumSlate.accent, 0.09)
                : 'rgba(255,255,255,0.025)',
              paddingHorizontal: isWide ? 12 : 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
            })}
          >
            <MessageCircle size={17} color={isWide ? stadiumSlate.accentSoft : stadiumSlate.textMuted} />
            <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, fontWeight: '700' }}>
              {isWide ? 'Comments' : commentCount || ''}
            </Text>
            {isWide && commentCount > 0 ? (
              <View
                style={{
                  minWidth: 19,
                  height: 19,
                  paddingHorizontal: 5,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: withAlpha(stadiumSlate.accent, 0.14),
                }}
              >
                <Text style={{ color: stadiumSlate.accentSoft, fontSize: 10, fontWeight: '800' }}>{commentCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>

        <Animated.View style={shareButtonAnimStyle}>
          <TouchableOpacity
            onPress={() => {
              animateIconTap(shareScale, shareGlow);
              handleShare();
            }}
            accessibilityRole="button"
            accessibilityLabel="Share this game log"
            activeOpacity={0.66}
            style={{
              minHeight: 38,
              borderRadius: 11,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              backgroundColor: 'rgba(255,255,255,0.025)',
              paddingHorizontal: isWide ? 12 : 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <Share2 size={17} color={stadiumSlate.textMuted} />
            {isWide ? (
              <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, fontWeight: '700' }}>Share</Text>
            ) : null}
          </TouchableOpacity>
        </Animated.View>

        {isWide && topReactions.length > 0 ? (
          <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {topReactions.map((reaction) => (
              <Text key={reaction.type} style={{ color: stadiumSlate.textMuted, fontSize: 12 }}>
                {REACTION_EMOJI[reaction.type]} {reaction.count}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {showComments && (
        <CommentsSheet
          logId={log.id}
          onClose={() => setShowComments(false)}
          onCommentCountChange={setCommentCount}
        />
      )}
    </>
  );

  if (Platform.OS === 'web') {
    return (
      <Pressable
        style={({ pressed, hovered }: any) => [
          {
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 22,
            padding: isWide ? 22 : 16,
            marginBottom: isWide ? 18 : 14,
            borderWidth: 1,
            borderColor: pressed
              ? withAlpha(stadiumSlate.accent, 0.72)
              : hovered
                ? withAlpha(stadiumSlate.borderStrong, 0.95)
                : withAlpha(stadiumSlate.borderStrong, 0.7),
            transform: [{ translateY: pressed ? 0 : hovered ? -1 : 0 }],
            backgroundColor: hovered ? stadiumSlate.surfaceElevated : stadiumSlate.surface,
          },
          {
            boxShadow: hovered
              ? `0 20px 46px ${withAlpha('#020617', 0.34)}, 0 0 0 1px ${withAlpha('#ffffff', 0.035)}`
              : `0 12px 28px ${withAlpha('#020617', 0.28)}, inset 0 1px 0 ${withAlpha('#ffffff', 0.055)}`,
            transitionDuration: '160ms',
            transitionTimingFunction: 'ease-out',
            transitionProperty: 'transform, box-shadow, border-color, background-color',
            cursor: 'pointer',
          } as any,
        ]}
        onPress={() => router.push(`/game/${game.id}`)}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 18,
          padding: 16,
          marginBottom: 14,
          backgroundColor: stadiumSlate.surface,
          borderWidth: 1,
          borderColor: withAlpha(stadiumSlate.borderStrong, 0.62),
        }}
      >
        {cardContent}
      </Animated.View>
    </GestureDetector>
  );
}

export default memo(GameCard);
