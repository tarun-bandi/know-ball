import { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';

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

  return (
    <View className="items-center w-full">
      <Text className="text-white text-lg font-bold mb-4">Enter Room Code</Text>
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
      {error ? (
        <Text className="text-red-500 text-sm mt-2">{error}</Text>
      ) : null}
      <View className="flex-row gap-3 mt-4 w-full">
        <TouchableOpacity
          onPress={onCancel}
          className="flex-1 bg-surface border border-border rounded-xl py-3 items-center"
          activeOpacity={0.7}
        >
          <Text className="text-white font-semibold">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleJoin}
          disabled={code.length !== 6 || loading}
          className="flex-1 rounded-xl py-3 items-center"
          style={{ backgroundColor: code.length === 6 ? '#D4A843' : '#2a2a30' }}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white font-bold">Join</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
