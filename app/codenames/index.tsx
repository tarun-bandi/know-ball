import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useCodenamesStore } from '@/lib/store/codenamesStore';
import type { Team } from '@/lib/codenamesEngine';

export default function CodenamesSetup() {
  const router = useRouter();
  const [firstTeam, setFirstTeam] = useState<Team>('red');
  const startNewGame = useCodenamesStore((s) => s.startNewGame);

  const handleStart = () => {
    startNewGame(firstTeam);
    router.push('/codenames/play' as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="flex-row items-center"
          activeOpacity={0.6}
        >
          <ChevronLeft size={24} color="#ffffff" />
          <Text className="text-white text-base">Back</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-white text-3xl font-bold text-center mb-2">
          NBA Codenames
        </Text>
        <Text className="text-muted text-center text-base mb-10">
          A pass-and-play word game for 4+ players.{'\n'}
          Two teams, one spymaster each.
        </Text>

        <Text className="text-white text-lg font-semibold mb-4">
          Who goes first?
        </Text>
        <View className="flex-row gap-3 mb-10">
          <TouchableOpacity
            className="rounded-xl px-6 py-3"
            style={{
              backgroundColor: firstTeam === 'red' ? '#E03A3E' : '#1a1a1a',
              borderWidth: 1,
              borderColor: firstTeam === 'red' ? '#E03A3E' : '#2a2a2a',
            }}
            onPress={() => setFirstTeam('red')}
            activeOpacity={0.7}
          >
            <Text className="text-white font-bold text-base">Red Team</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-xl px-6 py-3"
            style={{
              backgroundColor: firstTeam === 'blue' ? '#1D428A' : '#1a1a1a',
              borderWidth: 1,
              borderColor: firstTeam === 'blue' ? '#1D428A' : '#2a2a2a',
            }}
            onPress={() => setFirstTeam('blue')}
            activeOpacity={0.7}
          >
            <Text className="text-white font-bold text-base">Blue Team</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-muted text-center text-sm mb-6">
          {firstTeam === 'red' ? 'Red' : 'Blue'} gets 9 cards,{' '}
          {firstTeam === 'red' ? 'Blue' : 'Red'} gets 8.
        </Text>

        <TouchableOpacity
          className="rounded-xl px-12 py-4"
          style={{ backgroundColor: firstTeam === 'red' ? '#E03A3E' : '#1D428A' }}
          onPress={handleStart}
          activeOpacity={0.7}
        >
          <Text className="text-white text-lg font-bold">Start Game</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
