import { View, Text, TouchableOpacity } from 'react-native';
import { Trophy, Skull } from 'lucide-react-native';
import type { Team } from '@/lib/codenamesEngine';

const TEAM_LABEL = { red: 'Red', blue: 'Blue' } as const;
const TEAM_COLOR = { red: '#E03A3E', blue: '#1D428A' } as const;

interface Props {
  winner: Team;
  reason: 'cards' | 'assassin' | null;
  onPlayAgain: () => void;
  onExit: () => void;
}

export default function GameOverModal({ winner, reason, onPlayAgain, onExit }: Props) {
  const color = TEAM_COLOR[winner];
  const isAssassin = reason === 'assassin';

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <View
        style={{ backgroundColor: color, width: 80, height: 80, borderRadius: 40 }}
        className="items-center justify-center mb-6"
      >
        {isAssassin ? (
          <Skull size={36} color="#ffffff" />
        ) : (
          <Trophy size={36} color="#ffffff" />
        )}
      </View>
      <Text className="text-white text-3xl font-bold text-center mb-2">
        <Text style={{ color }}>{TEAM_LABEL[winner]}</Text> Wins!
      </Text>
      <Text className="text-muted text-center text-base mb-8">
        {isAssassin
          ? `The other team hit the assassin!`
          : `All ${TEAM_LABEL[winner].toLowerCase()} cards have been revealed.`}
      </Text>
      <TouchableOpacity
        className="rounded-xl px-10 py-4 mb-3"
        style={{ backgroundColor: color }}
        onPress={onPlayAgain}
        activeOpacity={0.7}
      >
        <Text className="text-white text-lg font-bold">Play Again</Text>
      </TouchableOpacity>
      <TouchableOpacity
        className="rounded-xl px-10 py-3 bg-surface border border-border"
        onPress={onExit}
        activeOpacity={0.7}
      >
        <Text className="text-white text-base font-medium">Exit</Text>
      </TouchableOpacity>
    </View>
  );
}
