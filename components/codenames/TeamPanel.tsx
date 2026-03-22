import { View, Text } from 'react-native';
import PlayerSlot from './PlayerSlot';
import type { CodenamesPlayer } from '@/types/database';
import type { Team } from '@/lib/codenamesEngine';

const TEAM_COLORS = {
  red: '#E03A3E',
  blue: '#1D428A',
} as const;

interface Props {
  team: Team;
  players: CodenamesPlayer[];
  myUserId: string | null;
  onlineUserIds: Set<string>;
  isCurrentTeam: boolean;
  remaining: number;
}

export default function TeamPanel({ team, players, myUserId, onlineUserIds, isCurrentTeam, remaining }: Props) {
  const color = TEAM_COLORS[team];
  const spymaster = players.find((p) => p.role === 'spymaster');
  const guessers = players.filter((p) => p.role === 'guesser');

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: isCurrentTeam ? color : color + '40',
        borderRadius: 12,
        backgroundColor: isCurrentTeam ? color + '18' : color + '0a',
      }}
      className="p-3 flex-1"
    >
      {/* Header */}
      <View className="flex-row items-center gap-2 mb-3">
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
        <Text className="text-white font-bold text-sm uppercase flex-1">
          {team} Team
        </Text>
        <Text style={{ color }} className="font-bold text-lg">{remaining}</Text>
      </View>

      {/* Spymaster */}
      {spymaster && (
        <View className="mb-2">
          <Text className="text-muted text-xs font-medium mb-1 uppercase">Spymaster</Text>
          <PlayerSlot
            player={spymaster}
            isMe={spymaster.user_id === myUserId}
            isOnline={onlineUserIds.has(spymaster.user_id)}
          />
        </View>
      )}

      {/* Guessers */}
      {guessers.length > 0 && (
        <View>
          <Text className="text-muted text-xs font-medium mb-1 uppercase">Guessers</Text>
          {guessers.map((p) => (
            <PlayerSlot
              key={p.id}
              player={p}
              isMe={p.user_id === myUserId}
              isOnline={onlineUserIds.has(p.user_id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
