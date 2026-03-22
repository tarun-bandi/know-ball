import { View, Text, TouchableOpacity } from 'react-native';
import type { Team } from '@/lib/codenamesEngine';
import type { ClueEntry } from '@/lib/store/codenamesStore';

const TEAM_LABEL = { red: 'Red', blue: 'Blue' } as const;
const TEAM_COLOR = { red: '#E03A3E', blue: '#1D428A' } as const;

interface Props {
  team: Team;
  clue: ClueEntry | null;
  guessesRemaining: number;
  redRemaining: number;
  blueRemaining: number;
  onEndTurn: () => void;
}

export default function TurnBanner({
  team,
  clue,
  guessesRemaining,
  redRemaining,
  blueRemaining,
  onEndTurn,
}: Props) {
  return (
    <View className="px-4 py-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            style={{ backgroundColor: TEAM_COLOR[team], width: 12, height: 12, borderRadius: 6 }}
          />
          <Text className="text-white font-bold text-base">
            {TEAM_LABEL[team]} Team's Turn
          </Text>
        </View>
        <View className="flex-row gap-3">
          <Text style={{ color: '#E03A3E' }} className="font-bold">{redRemaining}</Text>
          <Text className="text-muted">-</Text>
          <Text style={{ color: '#1D428A' }} className="font-bold">{blueRemaining}</Text>
        </View>
      </View>
      {clue && (
        <View className="flex-row items-center justify-between mt-1">
          <Text className="text-accent font-bold text-lg">
            {clue.word} — {clue.number}
          </Text>
          <View className="flex-row items-center gap-3">
            <Text className="text-muted text-sm">
              {guessesRemaining} guess{guessesRemaining !== 1 ? 'es' : ''} left
            </Text>
            <TouchableOpacity
              onPress={onEndTurn}
              className="bg-surface border border-border rounded-lg px-3 py-1"
              activeOpacity={0.7}
            >
              <Text className="text-white text-sm font-medium">End Turn</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
