import { View, Text } from 'react-native';

interface Props {
  redRemaining: number;
  blueRemaining: number;
}

export default function ScoreBar({ redRemaining, blueRemaining }: Props) {
  return (
    <View className="flex-row items-center justify-center gap-3 py-1.5">
      <View className="flex-row items-center gap-1.5">
        <View
          style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: '#E03A3E',
          }}
        />
        <Text style={{ color: '#E03A3E' }} className="font-bold text-sm">
          {redRemaining}
        </Text>
      </View>
      <Text className="text-muted text-xs">—</Text>
      <View className="flex-row items-center gap-1.5">
        <Text style={{ color: '#1D428A' }} className="font-bold text-sm">
          {blueRemaining}
        </Text>
        <View
          style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: '#1D428A',
          }}
        />
      </View>
    </View>
  );
}
