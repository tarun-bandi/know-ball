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
    ? 'Giving clue...'
    : phase === 'guessing'
      ? 'Picking cards...'
      : '';

  return (
    <View className="flex-row items-center gap-2 flex-1">
      <Animated.View
        style={[dotStyle, {
          width: 8, height: 8, borderRadius: 4, backgroundColor: color,
        }]}
      />
      <Text className="text-white font-bold text-base">
        {TEAM_LABEL[team]}
        {isMyTurn ? ' — Your Turn' : "'s Turn"}
      </Text>
      {phaseLabel ? (
        <Text className="text-muted text-xs">{phaseLabel}</Text>
      ) : null}
    </View>
  );
}
