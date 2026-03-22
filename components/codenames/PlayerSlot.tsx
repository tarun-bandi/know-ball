import { View, Text, Image } from 'react-native';
import { Eye, Users } from 'lucide-react-native';
import type { CodenamesPlayer } from '@/types/database';

interface Props {
  player: CodenamesPlayer;
  isMe: boolean;
  isOnline?: boolean;
}

const ROLE_ICON = {
  spymaster: Eye,
  guesser: Users,
} as const;

export default function PlayerSlot({ player, isMe, isOnline }: Props) {
  const RoleIcon = player.role ? ROLE_ICON[player.role] : null;

  return (
    <View className="flex-row items-center gap-2 py-1.5" style={isOnline === false ? { opacity: 0.45 } : undefined}>
      <View>
        {player.avatar_url ? (
          <Image
            source={{ uri: player.avatar_url }}
            className="w-7 h-7 rounded-full bg-surface"
          />
        ) : (
          <View className="w-7 h-7 rounded-full bg-surface items-center justify-center">
            <Text className="text-muted text-xs font-bold">
              {(player.display_name ?? '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        {isOnline !== undefined && (
          <View
            style={{
              position: 'absolute',
              bottom: -1,
              right: -1,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: isOnline ? '#22c55e' : '#6b7280',
              borderWidth: 2,
              borderColor: '#1a1a1a',
            }}
          />
        )}
      </View>
      <Text className="text-white text-sm font-medium flex-1" numberOfLines={1}>
        {player.display_name ?? 'Player'}
        {isMe ? ' (you)' : ''}
      </Text>
      {RoleIcon && (
        <RoleIcon size={14} color="#7a7d88" />
      )}
    </View>
  );
}
