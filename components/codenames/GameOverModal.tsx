import { View, Text, TouchableOpacity } from 'react-native';
import { Trophy, Skull } from 'lucide-react-native';
import type { Team } from '@/lib/codenamesEngine';

const TEAM_LABEL = { red: 'Red', blue: 'Blue' } as const;
const TEAM_COLOR = { red: '#E03A3E', blue: '#1D428A' } as const;

interface Props {
  winner: Team;
  reason: 'cards' | 'assassin' | null;
  isHost: boolean;
  onPlayAgain?: () => void;
  onBackToLobby: () => void;
}

export default function GameOverModal({ winner, reason, isHost, onPlayAgain, onBackToLobby }: Props) {
  const color = TEAM_COLOR[winner];
  const isAssassin = reason === 'assassin';

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      {/* Icon */}
      <View
        style={{
          backgroundColor: color,
          width: 96, height: 96, borderRadius: 48,
          shadowColor: color, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5, shadowRadius: 16, elevation: 8,
        }}
        className="items-center justify-center mb-6"
      >
        {isAssassin ? <Skull size={42} color="#ffffff" /> : <Trophy size={42} color="#ffffff" />}
      </View>

      <Text className="text-white text-3xl font-bold text-center mb-2">
        <Text style={{ color }}>{TEAM_LABEL[winner]}</Text> Wins!
      </Text>
      <Text className="text-muted text-center text-base mb-8">
        {isAssassin
          ? 'The other team hit the assassin!'
          : `All ${TEAM_LABEL[winner].toLowerCase()} cards revealed.`}
      </Text>

      {isHost && onPlayAgain && (
        <TouchableOpacity
          className="rounded-xl px-10 py-4 mb-3 w-full items-center"
          style={{ backgroundColor: color }}
          onPress={onPlayAgain}
          activeOpacity={0.7}
        >
          <Text className="text-white text-lg font-bold">Play Again</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        className="rounded-xl px-10 py-3 bg-surface border border-border w-full items-center"
        onPress={onBackToLobby}
        activeOpacity={0.7}
      >
        <Text className="text-white text-base font-medium">
          {isHost ? 'Back to Lobby' : 'Leave Game'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
