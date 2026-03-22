import { View, Text, TouchableOpacity } from 'react-native';
import { Eye, Users } from 'lucide-react-native';
import type { Team } from '@/lib/codenamesEngine';
import type { GamePhase } from '@/lib/store/codenamesStore';

const TEAM_LABEL = { red: 'Red', blue: 'Blue' } as const;
const TEAM_COLOR = { red: '#E03A3E', blue: '#1D428A' } as const;

interface Props {
  team: Team;
  phase: GamePhase;
  onReady: () => void;
}

export default function HandoffScreen({ team, phase, onReady }: Props) {
  const isSpymaster = phase === 'handoff_spymaster';
  const role = isSpymaster ? 'Spymaster' : 'Guessers';
  const color = TEAM_COLOR[team];

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <View
        style={{ backgroundColor: color, width: 64, height: 64, borderRadius: 32 }}
        className="items-center justify-center mb-6"
      >
        {isSpymaster ? (
          <Eye size={28} color="#ffffff" />
        ) : (
          <Users size={28} color="#ffffff" />
        )}
      </View>
      <Text className="text-white text-2xl font-bold text-center mb-2">
        Pass to{'\n'}
        <Text style={{ color }}>{TEAM_LABEL[team]}</Text> {role}
      </Text>
      <Text className="text-muted text-center text-base mb-8">
        {isSpymaster
          ? 'You will see the key map. Give your team a one-word clue and a number.'
          : 'You will see the clue. Tap the cards you think match.'}
      </Text>
      <TouchableOpacity
        className="rounded-xl px-10 py-4"
        style={{ backgroundColor: color }}
        onPress={onReady}
        activeOpacity={0.7}
      >
        <Text className="text-white text-lg font-bold">Ready</Text>
      </TouchableOpacity>
    </View>
  );
}
