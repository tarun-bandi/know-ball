import { View, Text, ScrollView } from 'react-native';
import type { CluePayload } from '@/lib/codenamesApi';

const TEAM_DOT_COLORS = {
  red: '#E03A3E',
  blue: '#1D428A',
} as const;

interface Props {
  clueHistory: CluePayload[];
}

export default function ClueHistory({ clueHistory }: Props) {
  if (clueHistory.length === 0) {
    return (
      <View className="p-3 rounded-xl bg-surface border border-border flex-1">
        <Text className="text-muted text-xs font-medium uppercase mb-2">Clue Log</Text>
        <Text className="text-muted text-xs">No clues yet</Text>
      </View>
    );
  }

  // Most recent first
  const reversed = [...clueHistory].reverse();

  return (
    <View className="p-3 rounded-xl bg-surface border border-border flex-1">
      <Text className="text-muted text-xs font-medium uppercase mb-2">Clue Log</Text>
      <ScrollView style={{ maxHeight: 200 }}>
        {reversed.map((clue, i) => (
          <View key={i} className="flex-row items-center gap-2 py-1">
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: TEAM_DOT_COLORS[clue.team as keyof typeof TEAM_DOT_COLORS] ?? '#6b7280',
              }}
            />
            <Text className="text-white text-sm font-medium">
              {clue.word}
            </Text>
            <Text className="text-muted text-sm">— {clue.number}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
