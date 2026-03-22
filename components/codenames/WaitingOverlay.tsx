import { View, Text, ActivityIndicator } from 'react-native';

const TEAM_COLOR = { red: '#E03A3E', blue: '#1D428A' } as const;
const TEAM_LABEL = { red: 'Red', blue: 'Blue' } as const;

interface Props {
  team: 'red' | 'blue';
  waitingFor: 'spymaster' | 'guessers';
}

export default function WaitingOverlay({ team, waitingFor }: Props) {
  const color = TEAM_COLOR[team];
  const label = TEAM_LABEL[team];

  return (
    <View className="bg-surface border border-border rounded-2xl px-5 py-4 flex-row items-center gap-3">
      <ActivityIndicator color={color} size="small" />
      <Text className="text-muted text-sm flex-1">
        Waiting for{' '}
        <Text style={{ color }} className="font-bold">
          {label}
        </Text>{' '}
        {waitingFor === 'spymaster' ? 'spymaster to give a clue...' : 'guessers...'}
      </Text>
    </View>
  );
}
