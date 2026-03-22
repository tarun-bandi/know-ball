import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCodenamesMultiplayerStore, getAnonId } from '@/lib/store/codenamesMultiplayerStore';
import { useAuthStore } from '@/lib/store/authStore';
import { useCodenamesGame } from '@/hooks/useCodenamesGame';
import { useCodenamesRoom } from '@/hooks/useCodenamesRoom';
import {
  submitClue as apiSubmitClue,
  revealCard as apiRevealCard,
  endTurn as apiEndTurn,
  leaveRoom,
  fetchRoomByCode,
  fetchPlayers,
} from '@/lib/codenamesApi';
import type { GameStateCards, CluePayload } from '@/lib/codenamesApi';
import CodenamesBoard from '@/components/codenames/CodenamesBoard';
import ClueInput from '@/components/codenames/ClueInput';
import TurnBanner from '@/components/codenames/TurnBanner';
import ScoreBar from '@/components/codenames/ScoreBar';
import ClueDisplay from '@/components/codenames/ClueDisplay';
import WaitingOverlay from '@/components/codenames/WaitingOverlay';
import GameOverModal from '@/components/codenames/GameOverModal';
import type { Team } from '@/lib/codenamesEngine';

export default function CodenamesPlay() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const user = useAuthStore((s) => s.user);
  const { roomId, myUserId, myTeam, myRole, isHost, reset, setRoom, setMyPlayer, setMyUserId } = useCodenamesMultiplayerStore();
  const [rejoining, setRejoining] = useState(false);

  // Rejoin on mount if store is empty but code param exists
  useEffect(() => {
    if (roomId || !code || rejoining) return;
    setRejoining(true);

    const userId = user?.id ?? getAnonId();

    (async () => {
      try {
        const room = await fetchRoomByCode(code);
        if (!room) throw new Error('Room not found');
        const players = await fetchPlayers(room.id);
        const me = players.find((p) => p.user_id === userId);
        if (!me) throw new Error('Not in this room');
        setMyUserId(userId);
        setRoom(room.id, room.code, room.host_id === userId);
        setMyPlayer(me.id, me.team, me.role);
      } catch {
        router.replace('/codenames' as any);
      } finally {
        setRejoining(false);
      }
    })();
  }, [code, roomId]);

  // Redirect if no room and no code
  useEffect(() => {
    if (!roomId && !code && !rejoining) {
      router.replace('/codenames' as any);
    }
  }, [roomId, code, rejoining]);

  const { gameState, isLoading } = useCodenamesGame(roomId);

  // Subscribe to room channel for presence tracking (host rotation, stale cleanup)
  const { room: roomData } = useCodenamesRoom(roomId);

  // Keep isHost in sync when host_id changes (host rotation)
  useEffect(() => {
    if (!roomData || !myUserId) return;
    const shouldBeHost = roomData.host_id === myUserId;
    if (shouldBeHost !== isHost) {
      useCodenamesMultiplayerStore.getState().setRoom(roomData.id, roomData.code, shouldBeHost);
    }
  }, [roomData?.host_id, myUserId]);

  const cards = (gameState?.cards ?? []) as unknown as GameStateCards[];
  const currentTeam = (gameState?.current_team ?? 'red') as Team;
  const phase = gameState?.phase ?? 'spymaster_clue';
  const currentClue = gameState?.current_clue as CluePayload | null;
  const guessesRemaining = gameState?.guesses_remaining ?? 0;
  const winner = gameState?.winner as Team | null;
  const winReason = gameState?.win_reason as 'cards' | 'assassin' | null;

  const isSpymaster = myRole === 'spymaster';
  const isMyTeamTurn = myTeam === currentTeam;
  const isMyTurn = isMyTeamTurn && (
    (phase === 'spymaster_clue' && isSpymaster) ||
    (phase === 'guessing' && !isSpymaster)
  );

  const redRemaining = cards.filter((c) => c.role === 'red' && !c.revealed).length;
  const blueRemaining = cards.filter((c) => c.role === 'blue' && !c.revealed).length;

  const handleCardPress = useCallback(async (index: number) => {
    if (!roomId || !isMyTurn || phase !== 'guessing') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const outcome = await apiRevealCard(roomId, index);
      if (!outcome) return;
      switch (outcome) {
        case 'correct':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'wrong_team':
        case 'neutral':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'assassin':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    } catch {}
  }, [roomId, isMyTurn, phase]);

  const handleSubmitClue = useCallback(async (word: string, number: number) => {
    if (!roomId || !myTeam) return;
    try {
      await apiSubmitClue(roomId, word, number, myTeam);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }, [roomId, myTeam]);

  const handleEndTurn = useCallback(async () => {
    if (!roomId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiEndTurn(roomId);
    } catch {}
  }, [roomId]);

  const handleExit = useCallback(async () => {
    if (roomId && myUserId) {
      try { await leaveRoom(roomId, myUserId); } catch {}
    }
    reset();
    router.replace('/codenames' as any);
  }, [roomId, myUserId, reset, router]);

  if (isLoading || rejoining || !gameState) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#fff" size="large" />
      </SafeAreaView>
    );
  }

  // Game over
  if (phase === 'game_over' && winner) {
    return (
      <GameOverModal
        winner={winner}
        reason={winReason}
        isHost={isHost}
        onBackToLobby={handleExit}
      />
    );
  }

  // Determine what the spymaster sees vs guessers
  const showSpymasterKeyMap = isSpymaster;
  const canTapCards = phase === 'guessing' && isMyTeamTurn && !isSpymaster;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      {/* Game status header: turn + score in one row */}
      <View className="flex-row items-center px-4 py-2.5" style={{ backgroundColor: (currentTeam === 'red' ? '#E03A3E' : '#1D428A') + '08' }}>
        <TurnBanner team={currentTeam} phase={phase} isMyTurn={isMyTurn} />
        <ScoreBar redRemaining={redRemaining} blueRemaining={blueRemaining} />
      </View>

      {/* Board — the hero */}
      <View className="flex-1 justify-center">
        <CodenamesBoard
          cards={cards}
          isSpymasterView={showSpymasterKeyMap}
          onCardPress={handleCardPress}
          disabled={!canTapCards}
        />
      </View>

      {/* Bottom area — consistent padding across all states */}
      <View className="px-4 pb-3">
        {phase === 'spymaster_clue' && isSpymaster && isMyTeamTurn && (
          <ClueInput team={currentTeam} onSubmit={handleSubmitClue} />
        )}

        {phase === 'spymaster_clue' && !isMyTurn && (
          <WaitingOverlay team={currentTeam} waitingFor="spymaster" />
        )}

        {phase === 'guessing' && currentClue && (
          <View style={{ gap: 8 }}>
            <ClueDisplay
              clue={currentClue}
              guessesRemaining={guessesRemaining}
              team={currentTeam}
            />
            {canTapCards && (
              <TouchableOpacity
                onPress={handleEndTurn}
                className="bg-surface border border-border rounded-xl py-3 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-white font-semibold">End Turn</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {phase === 'guessing' && !isMyTeamTurn && !currentClue && (
          <WaitingOverlay team={currentTeam} waitingFor="guessers" />
        )}
      </View>
    </SafeAreaView>
  );
}
