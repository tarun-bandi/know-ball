import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut } from 'lucide-react-native';
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
import TeamPanel from '@/components/codenames/TeamPanel';
import ClueHistory from '@/components/codenames/ClueHistory';
import type { Team } from '@/lib/codenamesEngine';
import type { Sport } from '@/types/database';

const DESKTOP_BREAKPOINT = 900;
const DESKTOP_BOARD_MAX_WIDTH = 520;

export default function CodenamesPlay() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth > DESKTOP_BREAKPOINT;
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
  const { room: roomData, players: roomPlayers, onlineUserIds } = useCodenamesRoom(roomId);

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
  const clueHistory = (Array.isArray(gameState?.clue_history) ? gameState.clue_history : []) as unknown as CluePayload[];
  const sport = ((roomData as any)?.league ?? 'nba') as Sport;

  const isSpymaster = myRole === 'spymaster';
  const isMyTeamTurn = myTeam === currentTeam;
  const isMyTurn = isMyTeamTurn && (
    (phase === 'spymaster_clue' && isSpymaster) ||
    (phase === 'guessing' && !isSpymaster)
  );

  const redRemaining = cards.filter((c) => c.role === 'red' && !c.revealed).length;
  const blueRemaining = cards.filter((c) => c.role === 'blue' && !c.revealed).length;

  const redPlayers = roomPlayers.filter((p) => p.team === 'red');
  const bluePlayers = roomPlayers.filter((p) => p.team === 'blue');

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

  const handleSubmitClue = useCallback(async (word: string, number: number): Promise<string | null> => {
    if (!roomId || !myTeam) return 'No active room.';
    try {
      await apiSubmitClue(roomId, word, number, myTeam);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return null;
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return e.message ?? 'Failed to submit clue.';
    }
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

  const handlePlayAgain = useCallback(async () => {
    if (!roomId || !isHost) return;
    const { startGame } = await import('@/lib/codenamesApi');
    const league = ((roomData as any)?.league ?? 'nba') as any;
    const firstTeam: Team = Math.random() < 0.5 ? 'red' : 'blue';
    try {
      await startGame(roomId, firstTeam, league);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }, [roomId, isHost, roomData]);

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
        onPlayAgain={isHost ? handlePlayAgain : undefined}
        onBackToLobby={handleExit}
      />
    );
  }

  // Determine what the spymaster sees vs guessers
  const showSpymasterKeyMap = isSpymaster;
  const canTapCards = phase === 'guessing' && isMyTeamTurn && !isSpymaster;

  const controlsBlock = (
    <View className="px-4 pb-3" style={isDesktop ? { paddingHorizontal: 0, paddingBottom: 0 } : undefined}>
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
              activeOpacity={0.7}
              style={{
                backgroundColor: '#D4A843',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>End Turn</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {phase === 'guessing' && !isMyTeamTurn && !currentClue && (
        <WaitingOverlay team={currentTeam} waitingFor="guessers" />
      )}
    </View>
  );

  // Desktop: 3-column layout
  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-1 flex-row px-4 py-3" style={{ gap: 16 }}>
          {/* Left panel — Blue team */}
          <View style={{ width: 220 }}>
            <TeamPanel
              team="blue"
              players={bluePlayers}
              myUserId={myUserId}
              onlineUserIds={onlineUserIds}
              isCurrentTeam={currentTeam === 'blue'}
              remaining={blueRemaining}
            />
          </View>

          {/* Center — Board + controls */}
          <View className="flex-1 items-center" style={{ gap: 12 }}>
            {/* Turn banner + score */}
            <View
              className="flex-row items-center px-4 py-2.5 rounded-xl w-full"
              style={{
                backgroundColor: (currentTeam === 'red' ? '#E03A3E' : '#1D428A') + '10',
                maxWidth: DESKTOP_BOARD_MAX_WIDTH,
              }}
            >
              <TurnBanner team={currentTeam} phase={phase} isMyTurn={isMyTurn} />
              <ScoreBar redRemaining={redRemaining} blueRemaining={blueRemaining} />
              <TouchableOpacity
                onPress={handleExit}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.6}
                style={{ marginLeft: 8 }}
              >
                <LogOut size={18} color="#7a7d88" />
              </TouchableOpacity>
            </View>

            {/* Board */}
            <View className="justify-center">
              <CodenamesBoard
                cards={cards}
                isSpymasterView={showSpymasterKeyMap}
                onCardPress={handleCardPress}
                disabled={!canTapCards}
                maxWidth={DESKTOP_BOARD_MAX_WIDTH}
                sport={sport}
              />
            </View>

            {/* Controls */}
            <View style={{ width: '100%', maxWidth: DESKTOP_BOARD_MAX_WIDTH }}>
              {controlsBlock}
            </View>
          </View>

          {/* Right panel — Red team + Clue history */}
          <View style={{ width: 220, gap: 12 }}>
            <TeamPanel
              team="red"
              players={redPlayers}
              myUserId={myUserId}
              onlineUserIds={onlineUserIds}
              isCurrentTeam={currentTeam === 'red'}
              remaining={redRemaining}
            />
            <ClueHistory clueHistory={clueHistory} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Mobile: original vertical layout
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      {/* Game status header: turn + score + exit */}
      <View className="flex-row items-center px-4 py-2.5" style={{ backgroundColor: (currentTeam === 'red' ? '#E03A3E' : '#1D428A') + '10' }}>
        <TurnBanner team={currentTeam} phase={phase} isMyTurn={isMyTurn} />
        <ScoreBar redRemaining={redRemaining} blueRemaining={blueRemaining} />
        <TouchableOpacity
          onPress={handleExit}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
          style={{ marginLeft: 8 }}
        >
          <LogOut size={18} color="#7a7d88" />
        </TouchableOpacity>
      </View>

      {/* Board — the hero */}
      <View className="flex-1 justify-center">
        <CodenamesBoard
          cards={cards}
          isSpymasterView={showSpymasterKeyMap}
          onCardPress={handleCardPress}
          disabled={!canTapCards}
          sport={sport}
        />
      </View>

      {/* Bottom area — consistent padding across all states */}
      {controlsBlock}
    </SafeAreaView>
  );
}
