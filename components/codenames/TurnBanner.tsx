import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';

const TEAM_LABEL = { red: 'Red', blue: 'Blue' } as const;
const TEAM_COLOR = { red: '#E03A3E', blue: '#1D428A' } as const;

interface Props {
  team: 'red' | 'blue';
  phase: string;
  isMyTurn: boolean;
}

export default function TurnBanner({ team, phase, isMyTurn }: Props) {
  const pulseOpacity = useSharedValue(1);
  const color = TEAM_COLOR[team];

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const phaseLabel = phase === 'spymaster_clue'
    ? 'Spymaster giving clue'
    : phase === 'guessing'
      ? 'Guessers picking cards'
      : '';

  return (
    <View className="px-4 py-4" style={{ backgroundColor: color + '10' }}>
      <View className="flex-row items-center gap-2">
        <Animated.View
          style={[dotStyle, {
            width: 10, height: 10, borderRadius: 5, backgroundColor: color,
          }]}
        />
        <Text className="text-white font-bold text-xl">
          {TEAM_LABEL[team]} Team
          {isMyTurn ? ' — Your Turn' : "'s Turn"}
        </Text>
      </View>
      {phaseLabel ? (
        <Text className="text-muted text-sm mt-0.5 ml-5">{phaseLabel}</Text>
      ) : null}
    </View>
  );
}
