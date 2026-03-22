import { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface Props {
  onJoin: (code: string) => Promise<void>;
  onCancel: () => void;
}

export default function JoinRoomInput({ onJoin, onCancel }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleChange = (text: string) => {
    // Filter to allowed chars, uppercase, max 6
    const filtered = text.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 6);
    setCode(filtered);
    setError('');
  };

  const handleJoin = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      await onJoin(code);
    } catch (e: any) {
      setError(e.message ?? 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const ready = code.length === 6;

  return (
    <View className="items-center w-full">
      <Animated.View entering={FadeInUp.delay(50).duration(400).springify().damping(16)} className="w-full">
        <Text className="text-white text-lg font-bold mb-4 text-center">Enter Room Code</Text>
        <TextInput
          ref={inputRef}
          className="bg-surface border border-border rounded-2xl px-6 py-4 text-white text-2xl font-bold text-center tracking-[8px] w-full"
          placeholder="------"
          placeholderTextColor="#333"
          value={code}
          onChangeText={handleChange}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          maxLength={6}
        />
      </Animated.View>

      {error ? (
        <Text style={{ color: '#e63946', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</Text>
      ) : null}

      <Animated.View
        entering={FadeInUp.delay(150).duration(400).springify().damping(16)}
        className="flex-row w-full mt-4"
        style={{ gap: 12 }}
      >
        <TouchableOpacity
          onPress={onCancel}
          activeOpacity={0.7}
          style={{
            flex: 1,
            paddingVertical: 18,
            alignItems: 'center',
            borderRadius: 14,
          }}
        >
          <Text style={{ color: '#7a7d88', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleJoin}
          disabled={!ready || loading}
          activeOpacity={0.7}
          style={{
            flex: 1,
            borderRadius: 14,
            paddingVertical: 18,
            alignItems: 'center',
            backgroundColor: ready ? '#D4A843' : '#2a2a30',
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white font-bold" style={{ fontSize: 17, letterSpacing: 1.5 }}>
              JOIN
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
