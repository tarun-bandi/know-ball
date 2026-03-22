import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, LayoutAnimation, UIManager, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useAuthStore } from '@/lib/store/authStore';
import { useCodenamesMultiplayerStore, getAnonId } from '@/lib/store/codenamesMultiplayerStore';
import { createRoom, joinRoom } from '@/lib/codenamesApi';
import JoinRoomInput from '@/components/codenames/JoinRoomInput';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  // Cap at mobile width so it doesn't blow up on web/tablet
  const boardWidth = Math.min(SCREEN_WIDTH, 420) - 64;
  const CARD_SIZE = boardWidth / 5;
  const GAP = 3;

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(800)}
      style={{ opacity: 0.08 }}
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

export default function CodenamesLanding() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { setRoom, setMyPlayer, setMyUserId } = useCodenamesMultiplayerStore();
  const [mode, setMode] = useState<'landing' | 'join'>('landing');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const getIdentity = () => {
    const userId = user?.id ?? getAnonId();
    const displayName = user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? 'Guest';
    const avatarUrl = user?.user_metadata?.avatar_url ?? null;
    return { userId, displayName, avatarUrl };
  };

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setCreateError('');
    try {
      const { userId, displayName, avatarUrl } = getIdentity();
      const room = await createRoom(userId, displayName, avatarUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMyUserId(userId);
      setRoom(room.id, room.code, true);
      router.push(`/codenames/lobby?code=${room.code}` as any);
    } catch (e: any) {
      setCreateError(e.message ?? 'Failed to create room');
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

  const switchMode = (next: 'landing' | 'join') => {
    LayoutAnimation.configureNext(LayoutAnimation.create(250, 'easeInEaseOut', 'opacity'));
    setMode(next);
    setCreateError('');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} className="flex-row items-center px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="flex-row items-center"
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#ffffff" />
          <Text className="text-white text-base">Back</Text>
        </TouchableOpacity>
      </Animated.View>

      <View className="flex-1 justify-center items-center">
        {/* Background mini board */}
        <View style={{ position: 'absolute', top: '10%', alignSelf: 'center' }}>
          <MiniBoard />
        </View>

        {/* Title block */}
        <View style={{ alignItems: 'center', paddingHorizontal: 32, marginBottom: 40, maxWidth: 400 }}>
          <Animated.View
            entering={FadeInDown.delay(100).duration(500).springify().damping(14)}
          >
            <Text
              className="text-center"
              style={{ color: '#D4A843', fontSize: 13, letterSpacing: 4, fontWeight: '600' }}
            >
              NBA
            </Text>
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(200).duration(600).springify().damping(12)}
            className="text-white text-center font-bold"
            style={{ fontSize: 52, lineHeight: 54, letterSpacing: -1.5, marginTop: 2 }}
          >
            CODENAMES
          </Animated.Text>

          <Animated.Text
            entering={FadeIn.delay(400).duration(600)}
            className="text-muted text-center mt-5"
            style={{ fontSize: 15, lineHeight: 22 }}
          >
            Guess the players. Don't hit the assassin.{'\n'}
            Two teams, one spymaster each.
          </Animated.Text>
        </View>

        {/* Actions */}
        <View style={{ width: '100%', maxWidth: 400, paddingHorizontal: 32, alignSelf: 'center' }}>
          {mode === 'landing' ? (
            <View className="items-center" style={{ gap: 12 }}>
              <Animated.View
                entering={FadeInUp.delay(450).duration(500).springify().damping(14)}
                className="w-full"
              >
                <TouchableOpacity
                  onPress={handleCreate}
                  disabled={creating}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: '#D4A843',
                    borderRadius: 14,
                    paddingVertical: 18,
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 6,
                  }}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold" style={{ fontSize: 17, letterSpacing: 1.5 }}>
                      CREATE ROOM
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {createError ? (
                <Text style={{ color: '#e63946', fontSize: 13, textAlign: 'center' }}>{createError}</Text>
              ) : null}

              <Animated.View
                entering={FadeInUp.delay(550).duration(500).springify().damping(14)}
                className="w-full"
              >
                <TouchableOpacity
                  onPress={() => switchMode('join')}
                  activeOpacity={0.7}
                  style={{
                    borderRadius: 14,
                    paddingVertical: 18,
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: '#3a3a40',
                    backgroundColor: '#141416',
                  }}
                >
                  <Text style={{ color: '#9a9aa0', fontSize: 17, letterSpacing: 1.5, fontWeight: '600' }}>
                    JOIN ROOM
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Practical info */}
              <Animated.Text
                entering={FadeIn.delay(700).duration(600)}
                className="text-center mt-1"
                style={{ color: '#555', fontSize: 12 }}
              >
                4–8 players · ~15 min
              </Animated.Text>
            </View>
          ) : (
            <JoinRoomInput
              onJoin={handleJoin}
              onCancel={() => switchMode('landing')}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
