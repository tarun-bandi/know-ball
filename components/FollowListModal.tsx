import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Avatar from './Avatar';
import ResponsiveModalFrame from './ResponsiveModalFrame';
import type { UserProfile } from '@/types/database';

interface FollowListModalProps {
  userId: string;
  mode: 'followers' | 'following';
  onClose: () => void;
}

export default function FollowListModal({
  userId,
  mode,
  onClose,
}: FollowListModalProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Get follow relationships
      const column = mode === 'followers' ? 'following_id' : 'follower_id';
      const targetColumn = mode === 'followers' ? 'follower_id' : 'following_id';

      const { data: follows } = await supabase
        .from('follows')
        .select(targetColumn)
        .eq(column, userId);

      const ids = (follows ?? []).map((f: any) => f[targetColumn]);

      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      const { data: profs } = await supabase
        .from('user_profiles')
        .select('*')
        .in('user_id', ids)
        .order('display_name', { ascending: true });

      setProfiles((profs ?? []) as UserProfile[]);
      setLoading(false);
    }

    load();
  }, [userId, mode]);

  return (
    <ResponsiveModalFrame
      onClose={onClose}
      maxWidth={600}
      desktopMaxHeight={640}
      mobileMaxHeight="72%"
    >
            <View className="flex-row justify-between items-center px-5 pt-5 pb-3 border-b border-border">
              <Text className="text-white text-lg font-semibold">
                {mode === 'followers' ? 'Followers' : 'Following'}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={22} color="#8fa1b3" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View className="items-center py-8">
                <ActivityIndicator color="#4ea1ff" />
              </View>
            ) : (
              <FlatList
                data={profiles}
                keyExtractor={(item) => item.user_id}
                contentContainerStyle={
                  profiles.length === 0
                    ? { alignItems: 'center', paddingVertical: 32 }
                    : { paddingHorizontal: 20, paddingBottom: 32 }
                }
                ListEmptyComponent={
                  <Text className="text-muted text-sm">
                    {mode === 'followers'
                      ? 'No followers yet'
                      : 'Not following anyone yet'}
                  </Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className="flex-row items-center gap-3 py-3 border-b border-border"
                    onPress={() => {
                      onClose();
                      router.push(`/user/${item.handle}`);
                    }}
                    activeOpacity={0.7}
                  >
                    <Avatar
                      url={item.avatar_url}
                      name={item.display_name}
                      size={40}
                    />
                    <View className="flex-1">
                      <Text className="text-white font-medium">
                        {item.display_name}
                      </Text>
                      <Text className="text-muted text-sm">
                        @{item.handle}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
              />
            )}
    </ResponsiveModalFrame>
  );
}
