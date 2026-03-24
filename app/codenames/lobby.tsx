import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCodenamesMultiplayerStore, getAnonId } from '@/lib/store/codenamesMultiplayerStore';
import { useAuthStore } from '@/lib/store/authStore';
import { useCodenamesRoom } from '@/hooks/useCodenamesRoom';
import { updatePlayerAssignment, startGame, leaveRoom, joinRoom } from '@/lib/codenamesApi';
import RoomCodeDisplay from '@/components/codenames/RoomCodeDisplay';
import LobbyTeamColumn from '@/components/codenames/LobbyTeamColumn';
import type { Team, League } from '@/lib/codenamesEngine';

export default function CodenamesLobby() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const user = useAuthStore((s) => s.user);
  const { roomId, roomCode, isHost, myPlayerId, myUserId, reset, updateMyAssignment: updateStoreAssignment, setRoom, setMyPlayer, setMyUserId } =
    useCodenamesMultiplayerStore();
  const [rejoining, setRejoining] = useState(false);

  // Rejoin on mount if store is empty but code param exists
  useEffect(() => {
    if (roomId || !code || rejoining) return;
    setRejoining(true);

    const userId = user?.id ?? getAnonId();
    const displayName = user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? 'Guest';
    const avatarUrl = user?.user_metadata?.avatar_url ?? null;

    joinRoom(code, userId, displayName, avatarUrl)
      .then(({ room, player }) => {
        setMyUserId(userId);
        setRoom(room.id, room.code, room.host_id === userId);
        setMyPlayer(player.id, player.team, player.role);
      })
      .catch(async () => {
        // Room might be in 'playing' status — try to rejoin play screen
        try {
          const { fetchRoomByCode, fetchPlayers: fetchPlayersApi } = await import('@/lib/codenamesApi');
          const existingRoom = await fetchRoomByCode(code);
          if (existingRoom?.status === 'playing') {
            const players = await fetchPlayersApi(existingRoom.id);
            const me = players.find((p) => p.user_id === userId);
            if (me) {
              setMyUserId(userId);
              setRoom(existingRoom.id, existingRoom.code, existingRoom.host_id === userId);
              setMyPlayer(me.id, me.team, me.role);
              router.replace(`/codenames/play?code=${code}` as any);
              return;
            }
          }
        } catch {}
        router.replace('/codenames' as any);
      })
      .finally(() => setRejoining(false));
  }, [code, roomId]);

  // Redirect if no room and no code
  useEffect(() => {
    if (!roomId && !code && !rejoining) {
      router.replace('/codenames' as any);
    }
  }, [roomId, code, rejoining]);

  const { room, players, isLoading, onlineUserIds } = useCodenamesRoom(roomId);
  const [starting, setStarting] = useState(false);
  const [firstTeam, setFirstTeam] = useState<Team>('red');
  const [league, setLeague] = useState<League>('nba');

  // Navigate to game when room status changes to 'playing'
  useEffect(() => {
    if (room?.status === 'playing') {
      const rc = roomCode ?? code;
      router.replace(`/codenames/play?code=${rc}` as any);
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

  // Keep isHost in sync when host_id changes (host rotation)
  useEffect(() => {
    if (!room || !myUserId) return;
    const shouldBeHost = room.host_id === myUserId;
    if (shouldBeHost !== isHost) {
      useCodenamesMultiplayerStore.getState().setRoom(room.id, room.code, shouldBeHost);
    }
  }, [room?.host_id, myUserId]);

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
      await startGame(roomId, firstTeam, league);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Cannot Start', e.message);
    } finally {
      setStarting(false);
    }
  }, [roomId, firstTeam, league]);

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

  if (isLoading || rejoining) {
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
      <View className="flex-row px-4 flex-1" style={{ gap: 8 }}>
        <LobbyTeamColumn
          team="red"
          players={redPlayers}
          myUserId={myUserId ?? ''}
          onAssign={handleAssign}
          onlineUserIds={onlineUserIds}
        />
        <LobbyTeamColumn
          team="blue"
          players={bluePlayers}
          myUserId={myUserId ?? ''}
          onAssign={handleAssign}
          onlineUserIds={onlineUserIds}
        />
      </View>

      {/* Unassigned players */}
      {unassigned.length > 0 && (
        <View className="px-4 py-3">
          <View className="bg-surface border border-border rounded-2xl p-3">
            <Text className="text-muted text-xs font-medium uppercase tracking-wider mb-2">Unassigned</Text>
            {unassigned.map((p) => (
              <Text key={p.id} className="text-white text-sm py-0.5">
                {p.display_name ?? 'Player'}
                {p.user_id === myUserId ? ' (you)' : ''}
              </Text>
            ))}
            <Text className="text-muted text-xs mt-2">Tap a team slot above to join</Text>
          </View>
        </View>
      )}

      {/* Host controls */}
      {isHost && (
        <View className="px-4 pb-4" style={{ gap: 12 }}>
          {/* League picker */}
          <View style={{ gap: 6 }}>
            <Text className="text-muted text-xs font-medium uppercase tracking-wider">League</Text>
            <View className="flex-row" style={{ gap: 8 }}>
              {(['nba', 'nfl', 'mixed'] as const).map((l) => (
                <TouchableOpacity
                  key={l}
                  onPress={() => setLeague(l)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderRadius: 10,
                    backgroundColor: league === l ? '#D4A843' : '#141416',
                    borderWidth: 1.5,
                    borderColor: league === l ? '#D4A843' : '#2a2a30',
                  }}
                >
                  <Text style={{
                    color: league === l ? '#ffffff' : '#7a7d88',
                    fontSize: 14,
                    fontWeight: '700',
                  }}>{l.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* First team picker */}
          <View style={{ gap: 6 }}>
            <Text className="text-muted text-xs font-medium uppercase tracking-wider">First Turn</Text>
            <View className="flex-row" style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={() => setFirstTeam('red')}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderRadius: 10,
                  backgroundColor: firstTeam === 'red' ? '#E03A3E' : '#141416',
                  borderWidth: 1.5,
                  borderColor: firstTeam === 'red' ? '#E03A3E' : '#2a2a30',
                }}
              >
                <Text style={{
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: '700',
                  opacity: firstTeam === 'red' ? 1 : 0.5,
                }}>Red</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFirstTeam('blue')}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderRadius: 10,
                  backgroundColor: firstTeam === 'blue' ? '#1D428A' : '#141416',
                  borderWidth: 1.5,
                  borderColor: firstTeam === 'blue' ? '#1D428A' : '#2a2a30',
                }}
              >
                <Text style={{
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: '700',
                  opacity: firstTeam === 'blue' ? 1 : 0.5,
                }}>Blue</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Start button */}
          <TouchableOpacity
            onPress={handleStart}
            disabled={!canStart || starting}
            activeOpacity={0.7}
            style={{
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              backgroundColor: canStart ? '#D4A843' : '#2a2a30',
            }}
          >
            {starting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{
                color: '#ffffff',
                fontSize: 17,
                fontWeight: '700',
                letterSpacing: 1,
              }}>
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
