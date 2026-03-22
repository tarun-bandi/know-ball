import { useEffect } from 'react';
import { TouchableOpacity, Text, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence,
  interpolate,
} from 'react-native-reanimated';
import { Skull } from 'lucide-react-native';
import TeamLogo from '@/components/TeamLogo';
import type { GameStateCards } from '@/lib/codenamesApi';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_SIZE = (SCREEN_WIDTH - 16) / 5;
const GAP = 2;

const ROLE_COLORS: Record<string, string> = {
  red: 'rgba(224, 58, 62, 0.9)',
  blue: 'rgba(29, 66, 138, 0.9)',
  neutral: 'rgba(107, 114, 128, 0.5)',
  assassin: 'rgba(0, 0, 0, 0.95)',
};

const SPYMASTER_STRIP: Record<string, string> = {
  red: '#E03A3E',
  blue: '#1D428A',
  neutral: '#6B7280',
  assassin: '#000000',
};

interface Props {
  card: GameStateCards;
  index: number;
  isSpymasterView: boolean;
  onPress: (index: number) => void;
  disabled: boolean;
}

export default function CodenamesCard({ card, index, isSpymasterView, onPress, disabled }: Props) {
  const flipProgress = useSharedValue(card.revealed ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (card.revealed && flipProgress.value === 0) {
      scale.value = withSequence(
        withSpring(1.05, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 100 }),
      );
      flipProgress.value = withSpring(1, { damping: 12, stiffness: 100 });
    }
  }, [card.revealed]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` },
      { scale: scale.value },
    ],
    opacity: interpolate(flipProgress.value, [0, 0.5, 0.5, 1], [1, 1, 0, 0]),
    backfaceVisibility: 'hidden' as const,
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg` },
      { scale: scale.value },
    ],
    opacity: interpolate(flipProgress.value, [0, 0.5, 0.5, 1], [0, 0, 1, 1]),
    backfaceVisibility: 'hidden' as const,
  }));

  const logoSize = CARD_SIZE * 0.42;

  return (
    <TouchableOpacity
      onPress={() => onPress(index)}
      disabled={disabled || card.revealed}
      activeOpacity={0.7}
      style={{
        width: CARD_SIZE - GAP,
        height: CARD_SIZE - GAP,
        margin: GAP / 2,
      }}
    >
      {/* Front face (unrevealed) */}
      <Animated.View
        style={[frontStyle, {
          position: 'absolute', width: '100%', height: '100%',
          borderRadius: 12, backgroundColor: '#141416',
          borderWidth: 1, borderColor: '#2a2a30',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
        }]}
      >
        <TeamLogo abbreviation={card.team} size={logoSize} />
        <Text
          style={{ fontSize: CARD_SIZE * 0.14, marginTop: 1 }}
          className="text-muted font-semibold"
          numberOfLines={1}
        >
          {card.team}
        </Text>
        {/* Spymaster: colored bottom strip */}
        {isSpymasterView && (
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 4, backgroundColor: SPYMASTER_STRIP[card.role],
          }} />
        )}
      </Animated.View>

      {/* Back face (revealed) */}
      <Animated.View
        style={[backStyle, {
          position: 'absolute', width: '100%', height: '100%',
          borderRadius: 12, backgroundColor: ROLE_COLORS[card.role],
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
        }]}
      >
        {card.role === 'assassin' ? (
          <Skull size={logoSize * 0.7} color="#ffffff" />
        ) : (
          <TeamLogo abbreviation={card.team} size={logoSize} />
        )}
        <Text
          style={{ fontSize: CARD_SIZE * 0.14, marginTop: 1 }}
          className="text-white font-semibold"
          numberOfLines={1}
        >
          {card.team}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
