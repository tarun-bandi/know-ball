import { View, Text, TouchableOpacity } from 'react-native';
import { Eye, Users } from 'lucide-react-native';
import PlayerSlot from './PlayerSlot';
import type { CodenamesPlayer } from '@/types/database';

const TEAM_LABEL = { red: 'Red', blue: 'Blue' } as const;
const TEAM_COLOR = { red: '#E03A3E', blue: '#1D428A' } as const;

interface Props {
  team: 'red' | 'blue';
  players: CodenamesPlayer[];
  myUserId: string;
  onAssign: (team: 'red' | 'blue', role: 'spymaster' | 'guesser') => void;
  onlineUserIds?: Set<string>;
}

export default function LobbyTeamColumn({ team, players, myUserId, onAssign, onlineUserIds }: Props) {
  const spymaster = players.find((p) => p.role === 'spymaster');
  const guessers = players.filter((p) => p.role === 'guesser');
  const color = TEAM_COLOR[team];

  return (
    <View className="flex-1 bg-surface border border-border rounded-2xl p-3">
      <View className="items-center mb-3">
        <View style={{ backgroundColor: color, width: 10, height: 10, borderRadius: 5 }} />
        <Text className="text-white font-bold text-base mt-1">{TEAM_LABEL[team]}</Text>
      </View>

      {/* Spymaster slot */}
      <TouchableOpacity
        onPress={() => onAssign(team, 'spymaster')}
        activeOpacity={0.7}
        className="border border-border rounded-xl p-2 mb-2"
        style={{ borderColor: color + '40' }}
      >
        <View className="flex-row items-center gap-1 mb-1">
          <Eye size={12} color={color} />
          <Text style={{ color }} className="text-xs font-bold uppercase">
            Spymaster
          </Text>
        </View>
        {spymaster ? (
          <PlayerSlot player={spymaster} isMe={spymaster.user_id === myUserId} isOnline={onlineUserIds ? onlineUserIds.has(spymaster.user_id) : undefined} />
        ) : (
          <Text className="text-muted text-xs italic py-1.5">Tap to join</Text>
        )}
      </TouchableOpacity>

      {/* Guessers */}
      <TouchableOpacity
        onPress={() => onAssign(team, 'guesser')}
        activeOpacity={0.7}
        className="border border-border rounded-xl p-2"
        style={{ borderColor: color + '20' }}
      >
        <View className="flex-row items-center gap-1 mb-1">
          <Users size={12} color={color} />
          <Text style={{ color }} className="text-xs font-bold uppercase">
            Guessers
          </Text>
        </View>
        {guessers.length > 0 ? (
          guessers.map((p) => (
            <PlayerSlot key={p.id} player={p} isMe={p.user_id === myUserId} isOnline={onlineUserIds ? onlineUserIds.has(p.user_id) : undefined} />
          ))
        ) : (
          <Text className="text-muted text-xs italic py-1.5">Tap to join</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
