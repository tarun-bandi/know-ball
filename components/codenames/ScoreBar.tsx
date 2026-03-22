import { View, Text } from 'react-native';

interface Props {
  redRemaining: number;
  blueRemaining: number;
}

export default function ScoreBar({ redRemaining, blueRemaining }: Props) {
  return (
    <View className="flex-row items-center justify-center gap-4 px-4 py-2">
      <View className="flex-row items-center gap-2">
        <View className="rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(224, 58, 62, 0.15)' }}>
          <Text style={{ color: '#E03A3E' }} className="font-bold text-base">
            {redRemaining}
          </Text>
        </View>
      </View>
      <Text className="text-muted text-xs">cards left</Text>
      <View className="flex-row items-center gap-2">
        <View className="rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(29, 66, 138, 0.15)' }}>
          <Text style={{ color: '#1D428A' }} className="font-bold text-base">
            {blueRemaining}
          </Text>
        </View>
      </View>
    </View>
  );
}
