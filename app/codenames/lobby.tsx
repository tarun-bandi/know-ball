import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCodenamesMultiplayerStore } from '@/lib/store/codenamesMultiplayerStore';
import { useCodenamesRoom } from '@/hooks/useCodenamesRoom';
import { updatePlayerAssignment, startGame, leaveRoom } from '@/lib/codenamesApi';
import RoomCodeDisplay from '@/components/codenames/RoomCodeDisplay';
import LobbyTeamColumn from '@/components/codenames/LobbyTeamColumn';
import type { Team } from '@/lib/codenamesEngine';

export default function CodenamesLobby() {
  const router = useRouter();
  const { roomId, roomCode, isHost, myPlayerId, myUserId, reset, updateMyAssignment: updateStoreAssignment } =
    useCodenamesMultiplayerStore();
  const { room, players, isLoading } = useCodenamesRoom(roomId);
  const [starting, setStarting] = useState(false);
  const [firstTeam, setFirstTeam] = useState<Team>('red');

  // Navigate to game when room status changes to 'playing'
  useEffect(() => {
    if (room?.status === 'playing') {
      router.replace('/codenames/play' as any);
    }
  }, [room?.status]);

  // Keep store in sync with my player from the players list
  useEffect(() => {
    if (!myUserId || !players.length) return;
    const me = players.find((p) => p.user_id === myUserId);
    if (me && myPlayerId !== me.id) {
      useCodenamesMultiplayerStore.getState().setMyPlayer(me.id, me.team, me.role);
    }
    if (me) {
      updateStoreAssignment(me.team, me.role);
    }
  }, [players, myUserId]);

  const handleAssign = useCallback(async (team: 'red' | 'blue', role: 'spymaster' | 'guesser') => {
    if (!myPlayerId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await updatePlayerAssignment(myPlayerId, team, role);
      updateStoreAssignment(team, role);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }, [myPlayerId, updateStoreAssignment]);

  const handleStart = useCallback(async () => {
    if (!roomId) return;
    setStarting(true);
    try {
      await startGame(roomId, firstTeam);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Cannot Start', e.message);
    } finally {
      setStarting(false);
    }
  }, [roomId, firstTeam]);

  const handleLeave = useCallback(async () => {
    if (!roomId || !myUserId) return;
    try {
      await leaveRoom(roomId, myUserId);
    } catch {}
    reset();
    router.back();
  }, [roomId, myUserId, reset, router]);

  const redPlayers = players.filter((p) => p.team === 'red');
  const bluePlayers = players.filter((p) => p.team === 'blue');
  const unassigned = players.filter((p) => !p.team);

  // Validation for start button
  const canStart = (() => {
    if (!isHost) return false;
    for (const t of ['red', 'blue'] as const) {
      const tp = players.filter((p) => p.team === t);
      if (tp.filter((p) => p.role === 'spymaster').length !== 1) return false;
      if (tp.filter((p) => p.role === 'guesser').length < 1) return false;
    }
    return true;
  })();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity
          onPress={handleLeave}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="flex-row items-center"
          activeOpacity={0.6}
        >
          <ChevronLeft size={24} color="#ffffff" />
          <Text className="text-white text-base">Leave</Text>
        </TouchableOpacity>
        <View className="flex-1" />
        <Text className="text-muted text-sm">
          {players.length} player{players.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Room code */}
      <View className="items-center py-4">
        {roomCode && <RoomCodeDisplay code={roomCode} />}
      </View>

      {/* Team columns */}
      <View className="flex-row px-3 flex-1">
        <LobbyTeamColumn
          team="red"
          players={redPlayers}
          myUserId={myUserId ?? ''}
          onAssign={handleAssign}
        />
        <LobbyTeamColumn
          team="blue"
          players={bluePlayers}
          myUserId={myUserId ?? ''}
          onAssign={handleAssign}
        />
      </View>

      {/* Unassigned players */}
      {unassigned.length > 0 && (
        <View className="px-4 py-2">
          <Text className="text-muted text-xs uppercase tracking-wider mb-1">Unassigned</Text>
          {unassigned.map((p) => (
            <Text key={p.id} className="text-white text-sm">
              {p.display_name ?? 'Player'}
              {p.user_id === myUserId ? ' (you)' : ''}
            </Text>
          ))}
        </View>
      )}

      {/* Host controls */}
      {isHost && (
        <View className="px-4 pb-4">
          {/* First team picker */}
          <View className="flex-row items-center justify-center gap-2 mb-3">
            <Text className="text-muted text-sm">First turn:</Text>
            <TouchableOpacity
              onPress={() => setFirstTeam('red')}
              className="rounded-lg px-3 py-1"
              style={{
                backgroundColor: firstTeam === 'red' ? '#E03A3E' : '#141416',
                borderWidth: 1,
                borderColor: firstTeam === 'red' ? '#E03A3E' : '#2a2a30',
              }}
              activeOpacity={0.7}
            >
              <Text className="text-white text-sm font-bold">Red</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFirstTeam('blue')}
              className="rounded-lg px-3 py-1"
              style={{
                backgroundColor: firstTeam === 'blue' ? '#1D428A' : '#141416',
                borderWidth: 1,
                borderColor: firstTeam === 'blue' ? '#1D428A' : '#2a2a30',
              }}
              activeOpacity={0.7}
            >
              <Text className="text-white text-sm font-bold">Blue</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={handleStart}
            disabled={!canStart || starting}
            className="rounded-xl py-4 items-center"
            style={{ backgroundColor: canStart ? '#D4A843' : '#2a2a30' }}
            activeOpacity={0.7}
          >
            {starting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-lg font-bold">
                {canStart ? 'START GAME' : 'Waiting for teams...'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {!isHost && (
        <View className="px-4 pb-4">
          <View className="bg-surface border border-border rounded-xl py-4 items-center">
            <Text className="text-muted text-base">
              Waiting for host to start...
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
