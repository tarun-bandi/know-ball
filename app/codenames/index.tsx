import { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useAuthStore } from '@/lib/store/authStore';
import { useCodenamesMultiplayerStore, getAnonId } from '@/lib/store/codenamesMultiplayerStore';
import { createRoom, joinRoom } from '@/lib/codenamesApi';
import JoinRoomInput from '@/components/codenames/JoinRoomInput';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Mini grid card colors to hint at the game board
const GRID_COLORS = [
  '#E03A3E', '#1D428A', '#E03A3E', '#3a3a40', '#1D428A',
  '#1D428A', '#3a3a40', '#E03A3E', '#1D428A', '#E03A3E',
  '#3a3a40', '#E03A3E', '#1D428A', '#3a3a40', '#0a0a0a',
  '#E03A3E', '#1D428A', '#3a3a40', '#E03A3E', '#1D428A',
  '#1D428A', '#E03A3E', '#3a3a40', '#1D428A', '#3a3a40',
];

function MiniBoard() {
  const CARD_SIZE = (SCREEN_WIDTH - 80) / 5;
  const GAP = 3;

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(800)}
      style={{ opacity: 0.12 }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: (CARD_SIZE + GAP) * 5, gap: GAP }}>
        {GRID_COLORS.map((color, i) => (
          <View
            key={i}
            style={{
              width: CARD_SIZE,
              height: CARD_SIZE * 0.6,
              backgroundColor: color,
              borderRadius: 4,
            }}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function PulsingDot({ color, delay: d }: { color: string; delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      d,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export default function CodenamesLanding() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { setRoom, setMyPlayer, setMyUserId } = useCodenamesMultiplayerStore();
  const [mode, setMode] = useState<'landing' | 'join'>('landing');
  const [creating, setCreating] = useState(false);

  const getIdentity = () => {
    const userId = user?.id ?? getAnonId();
    const displayName = user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? 'Guest';
    const avatarUrl = user?.user_metadata?.avatar_url ?? null;
    return { userId, displayName, avatarUrl };
  };

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const { userId, displayName, avatarUrl } = getIdentity();
      const room = await createRoom(userId, displayName, avatarUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMyUserId(userId);
      setRoom(room.id, room.code, true);
      router.push(`/codenames/lobby?code=${room.code}` as any);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  }, [user, setRoom, setMyUserId, router]);

  const handleJoin = useCallback(async (code: string) => {
    const { userId, displayName, avatarUrl } = getIdentity();
    const { room, player } = await joinRoom(code, userId, displayName, avatarUrl);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMyUserId(userId);
    setRoom(room.id, room.code, room.host_id === userId);
    setMyPlayer(player.id, player.team, player.role);
    router.push(`/codenames/lobby?code=${room.code}` as any);
  }, [user, setRoom, setMyPlayer, setMyUserId, router]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} className="flex-row items-center px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="flex-row items-center"
          activeOpacity={0.6}
        >
          <ChevronLeft size={24} color="#ffffff" />
          <Text className="text-white text-base">Back</Text>
        </TouchableOpacity>
      </Animated.View>

      <View className="flex-1 justify-center items-center">
        {/* Background mini board */}
        <View style={{ position: 'absolute', top: '8%', alignSelf: 'center' }}>
          <MiniBoard />
        </View>

        {/* Title block */}
        <View className="items-center px-8 mb-12">
          <Animated.View
            entering={FadeInDown.delay(100).duration(500).springify().damping(14)}
            className="flex-row items-center gap-2 mb-3"
          >
            <PulsingDot color="#E03A3E" delay={0} />
            <Text
              className="text-muted uppercase tracking-[6px] text-xs"
              style={{ letterSpacing: 6 }}
            >
              MULTIPLAYER
            </Text>
            <PulsingDot color="#1D428A" delay={600} />
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(200).duration(600).springify().damping(12)}
            className="text-white text-center font-bold"
            style={{ fontSize: 48, lineHeight: 50, letterSpacing: -1 }}
          >
            CODE{'\n'}NAMES
          </Animated.Text>

          <Animated.View
            entering={FadeInDown.delay(350).duration(500).springify().damping(14)}
            style={{
              marginTop: 12,
              borderTopWidth: 1,
              borderTopColor: '#D4A843',
              paddingTop: 12,
              width: 160,
              alignItems: 'center',
            }}
          >
            <Text
              className="text-center"
              style={{ color: '#D4A843', fontSize: 13, letterSpacing: 4, fontWeight: '600' }}
            >
              NBA EDITION
            </Text>
          </Animated.View>

          <Animated.Text
            entering={FadeIn.delay(500).duration(600)}
            className="text-muted text-center mt-5"
            style={{ fontSize: 15, lineHeight: 22 }}
          >
            Two teams. One spymaster each.{'\n'}
            Guess the players. Don't hit the assassin.
          </Animated.Text>
        </View>

        {/* Actions */}
        <View className="w-full px-8">
          {mode === 'landing' ? (
            <View className="items-center" style={{ gap: 12 }}>
              <Animated.View
                entering={FadeInUp.delay(500).duration(500).springify().damping(14)}
                className="w-full"
              >
                <TouchableOpacity
                  onPress={handleCreate}
                  disabled={creating}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: '#D4A843',
                    borderRadius: 14,
                    paddingVertical: 18,
                    alignItems: 'center',
                    shadowColor: '#D4A843',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 8,
                  }}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold" style={{ fontSize: 17, letterSpacing: 2 }}>
                      CREATE ROOM
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>

              <Animated.View
                entering={FadeInUp.delay(600).duration(500).springify().damping(14)}
                className="w-full"
              >
                <TouchableOpacity
                  onPress={() => setMode('join')}
                  activeOpacity={0.8}
                  style={{
                    borderRadius: 14,
                    paddingVertical: 18,
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: '#3a3a40',
                    backgroundColor: '#141416',
                  }}
                >
                  <Text style={{ color: '#9a9aa0', fontSize: 17, letterSpacing: 2, fontWeight: '600' }}>
                    JOIN ROOM
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Team indicators */}
              <Animated.View
                entering={FadeIn.delay(800).duration(600)}
                className="flex-row items-center justify-center mt-4"
                style={{ gap: 20 }}
              >
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#E03A3E' }} />
                  <Text style={{ color: '#555', fontSize: 12, fontWeight: '500' }}>RED TEAM</Text>
                </View>
                <Text style={{ color: '#2a2a30', fontSize: 12 }}>vs</Text>
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#1D428A' }} />
                  <Text style={{ color: '#555', fontSize: 12, fontWeight: '500' }}>BLUE TEAM</Text>
                </View>
              </Animated.View>
            </View>
          ) : (
            <Animated.View entering={FadeIn.duration(300)}>
              <JoinRoomInput
                onJoin={handleJoin}
                onCancel={() => setMode('landing')}
              />
            </Animated.View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
