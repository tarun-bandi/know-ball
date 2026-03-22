import { useEffect } from 'react';
import { TouchableOpacity, Text, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { Skull } from 'lucide-react-native';
import TeamLogo from '@/components/TeamLogo';
import type { CodenamesCard as CardType } from '@/lib/codenamesEngine';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_SIZE = (SCREEN_WIDTH - 48) / 5;

const ROLE_COLORS = {
  red: 'rgba(224, 58, 62, 0.85)',
  blue: 'rgba(29, 66, 138, 0.85)',
  neutral: 'rgba(107, 114, 128, 0.5)',
  assassin: 'rgba(0, 0, 0, 0.9)',
};

const SPYMASTER_BORDER = {
  red: '#E03A3E',
  blue: '#1D428A',
  neutral: '#6B7280',
  assassin: '#000000',
};

interface Props {
  card: CardType;
  index: number;
  isSpymasterView: boolean;
  onPress: (index: number) => void;
  disabled: boolean;
}

export default function CodenamesCard({
  card,
  index,
  isSpymasterView,
  onPress,
  disabled,
}: Props) {
  const flipProgress = useSharedValue(card.revealed ? 1 : 0);

  useEffect(() => {
    if (card.revealed) {
      flipProgress.value = withSpring(1, { damping: 12, stiffness: 100 });
    }
  }, [card.revealed]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` },
    ],
    opacity: interpolate(flipProgress.value, [0, 0.5, 0.5, 1], [1, 1, 0, 0]),
    backfaceVisibility: 'hidden' as const,
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg` },
    ],
    opacity: interpolate(flipProgress.value, [0, 0.5, 0.5, 1], [0, 0, 1, 1]),
    backfaceVisibility: 'hidden' as const,
  }));

  const logoSize = CARD_SIZE * 0.45;

  return (
    <TouchableOpacity
      onPress={() => onPress(index)}
      disabled={disabled || card.revealed}
      activeOpacity={0.7}
      style={{ width: CARD_SIZE, height: CARD_SIZE, margin: 2 }}
    >
      {/* Front face (unrevealed) */}
      <Animated.View
        style={[
          frontStyle,
          {
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: 8,
            borderWidth: isSpymasterView ? 2.5 : 1,
            borderColor: isSpymasterView ? SPYMASTER_BORDER[card.role] : '#2a2a2a',
            backgroundColor: '#1a1a1a',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 4,
          },
        ]}
      >
        {isSpymasterView && (
          <View
            style={{
              position: 'absolute',
              top: 3,
              right: 3,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: SPYMASTER_BORDER[card.role],
            }}
          />
        )}
        <TeamLogo abbreviation={card.team} size={logoSize} />
        <Text
          style={{ fontSize: CARD_SIZE * 0.15, marginTop: 2 }}
          className="text-muted font-semibold"
          numberOfLines={1}
        >
          {card.team}
        </Text>
      </Animated.View>

      {/* Back face (revealed) */}
      <Animated.View
        style={[
          backStyle,
          {
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: 8,
            backgroundColor: ROLE_COLORS[card.role],
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 4,
          },
        ]}
      >
        {card.role === 'assassin' ? (
          <Skull size={logoSize * 0.7} color="#ffffff" />
        ) : (
          <TeamLogo abbreviation={card.team} size={logoSize} />
        )}
        <Text
          style={{ fontSize: CARD_SIZE * 0.15, marginTop: 2 }}
          className="text-white font-semibold"
          numberOfLines={1}
        >
          {card.team}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
