import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/lib/store/authStore';
import { useCodenamesMultiplayerStore } from '@/lib/store/codenamesMultiplayerStore';
import { createRoom, joinRoom } from '@/lib/codenamesApi';
import JoinRoomInput from '@/components/codenames/JoinRoomInput';

export default function CodenamesLanding() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { setRoom, setMyPlayer } = useCodenamesMultiplayerStore();
  const [mode, setMode] = useState<'landing' | 'join'>('landing');
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!user) return;
    setCreating(true);
    try {
      const displayName = user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Player';
      const avatarUrl = user.user_metadata?.avatar_url ?? null;
      const room = await createRoom(user.id, displayName, avatarUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRoom(room.id, room.code, true);
      router.push('/codenames/lobby' as any);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  }, [user, setRoom, router]);

  const handleJoin = useCallback(async (code: string) => {
    if (!user) return;
    const displayName = user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Player';
    const avatarUrl = user.user_metadata?.avatar_url ?? null;
    const { room, player } = await joinRoom(code, user.id, displayName, avatarUrl);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRoom(room.id, room.code, room.host_id === user.id);
    setMyPlayer(player.id, player.team, player.role);
    router.push('/codenames/lobby' as any);
  }, [user, setRoom, setMyPlayer, router]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="flex-row items-center"
          activeOpacity={0.6}
        >
          <ChevronLeft size={24} color="#ffffff" />
          <Text className="text-white text-base">Back</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-white text-3xl font-bold text-center mb-2">
          NBA Codenames
        </Text>
        <Text className="text-muted text-center text-base mb-10">
          Real-time multiplayer word game.{'\n'}
          Two teams, one spymaster each.
        </Text>

        {mode === 'landing' ? (
          <View className="w-full items-center gap-3">
            <TouchableOpacity
              onPress={handleCreate}
              disabled={creating}
              className="rounded-xl px-12 py-4 w-full items-center"
              style={{ backgroundColor: '#D4A843' }}
              activeOpacity={0.7}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-lg font-bold">CREATE ROOM</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMode('join')}
              className="rounded-xl px-12 py-4 w-full items-center bg-surface border border-border"
              activeOpacity={0.7}
            >
              <Text className="text-white text-lg font-bold">JOIN ROOM</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <JoinRoomInput
            onJoin={handleJoin}
            onCancel={() => setMode('landing')}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
