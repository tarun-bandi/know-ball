import { View, Text } from 'react-native';
import type { CluePayload } from '@/lib/codenamesApi';

const TEAM_COLOR = { red: '#E03A3E', blue: '#1D428A' } as const;

interface Props {
  clue: CluePayload;
  guessesRemaining: number;
  team: 'red' | 'blue';
}

export default function ClueDisplay({ clue, guessesRemaining, team }: Props) {
  const color = TEAM_COLOR[team];

  return (
    <View className="items-center px-4 py-3">
      <View
        className="rounded-2xl px-6 py-3 items-center w-full"
        style={{ backgroundColor: color + '18' }}
      >
        <Text className="text-muted text-xs uppercase tracking-wider mb-1">Clue</Text>
        <Text style={{ color }} className="text-2xl font-bold">
          {clue.word} — {clue.number}
        </Text>
        <Text className="text-muted text-sm mt-1">
          {guessesRemaining} guess{guessesRemaining !== 1 ? 'es' : ''} remaining
        </Text>
      </View>
    </View>
  );
}
