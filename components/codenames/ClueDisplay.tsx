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
    <View
      className="rounded-2xl px-5 py-3 items-center"
      style={{ backgroundColor: color + '12' }}
    >
      <Text className="text-muted text-xs uppercase tracking-wider">Clue</Text>
      <Text style={{ color }} className="text-2xl font-bold mt-0.5">
        {clue.word} — {clue.number}
      </Text>
      <Text className="text-muted text-sm mt-0.5">
        {guessesRemaining} guess{guessesRemaining !== 1 ? 'es' : ''} remaining
      </Text>
    </View>
  );
}
