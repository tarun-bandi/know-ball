import { useCallback } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCodenamesStore } from '@/lib/store/codenamesStore';
import CodenamesBoard from '@/components/codenames/CodenamesBoard';
import ClueInput from '@/components/codenames/ClueInput';
import TurnBanner from '@/components/codenames/TurnBanner';
import HandoffScreen from '@/components/codenames/HandoffScreen';
import GameOverModal from '@/components/codenames/GameOverModal';

export default function CodenamesPlay() {
  const router = useRouter();
  const {
    cards,
    currentTeam,
    phase,
    currentClue,
    guessesRemaining,
    winner,
    winReason,
    confirmHandoff,
    submitClue,
    revealCard,
    endTurn,
    startNewGame,
    resetGame,
    firstTeam,
  } = useCodenamesStore();

  const redRemaining = cards.filter((c) => c.role === 'red' && !c.revealed).length;
  const blueRemaining = cards.filter((c) => c.role === 'blue' && !c.revealed).length;

  const handleCardPress = useCallback(
    (index: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const outcome = revealCard(index);
      if (!outcome) return;

      switch (outcome) {
        case 'correct':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'wrong_team':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'neutral':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'assassin':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    },
    [revealCard],
  );

  const handlePlayAgain = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Alternate who goes first
    const nextFirst = firstTeam === 'red' ? 'blue' : 'red';
    startNewGame(nextFirst);
  }, [firstTeam, startNewGame]);

  const handleExit = useCallback(() => {
    resetGame();
    router.back();
  }, [resetGame, router]);

  // Handoff interstitials
  if (phase === 'handoff_spymaster' || phase === 'handoff_guessers') {
    return <HandoffScreen team={currentTeam} phase={phase} onReady={confirmHandoff} />;
  }

  // Game over
  if (phase === 'game_over' && winner) {
    return (
      <GameOverModal
        winner={winner}
        reason={winReason}
        onPlayAgain={handlePlayAgain}
        onExit={handleExit}
      />
    );
  }

  const isSpymasterView = phase === 'spymaster_clue';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <TurnBanner
        team={currentTeam}
        clue={currentClue}
        guessesRemaining={guessesRemaining}
        redRemaining={redRemaining}
        blueRemaining={blueRemaining}
        onEndTurn={endTurn}
      />

      <View className="flex-1 justify-center">
        <CodenamesBoard
          cards={cards}
          isSpymasterView={isSpymasterView}
          onCardPress={handleCardPress}
          disabled={phase !== 'guessing'}
        />
      </View>

      {phase === 'spymaster_clue' && (
        <ClueInput team={currentTeam} onSubmit={submitClue} />
      )}
    </SafeAreaView>
  );
}
