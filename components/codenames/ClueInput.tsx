import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import type { Team } from '@/lib/codenamesEngine';

const TEAM_LABEL = { red: 'Red', blue: 'Blue' } as const;
const TEAM_COLOR = { red: '#E03A3E', blue: '#1D428A' } as const;

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Props {
  team: Team;
  onSubmit: (word: string, number: number) => void;
}

export default function ClueInput({ team, onSubmit }: Props) {
  const [word, setWord] = useState('');
  const [number, setNumber] = useState<number | null>(null);

  const canSubmit = word.trim().length > 0 && !word.trim().includes(' ') && number !== null;
  const color = TEAM_COLOR[team];

  const handleSubmit = () => {
    if (!canSubmit || !number) return;
    onSubmit(word.trim().toUpperCase(), number);
    setWord('');
    setNumber(null);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="px-4 py-3">
        <Text className="text-white text-base font-bold mb-2">
          <Text style={{ color }}>{TEAM_LABEL[team]}</Text> Spymaster — Give a Clue
        </Text>

        <TextInput
          className="bg-surface border border-border rounded-xl px-4 py-3 text-white text-lg mb-3"
          placeholder="One word clue"
          placeholderTextColor="#6b7280"
          value={word}
          onChangeText={setWord}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        {/* Number pills */}
        <View className="flex-row justify-between mb-3">
          {NUMBERS.map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setNumber(n)}
              activeOpacity={0.7}
              style={{
                backgroundColor: number === n ? color : '#1a1a1a',
                borderWidth: 1,
                borderColor: number === n ? color : '#2a2a2a',
                width: 36, height: 36, borderRadius: 18,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text className="text-white font-bold text-sm">{n}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.7}
          className="rounded-xl py-3.5 items-center"
          style={{ backgroundColor: canSubmit ? color : '#2a2a2a' }}
        >
          <Text className="text-white font-bold text-base">
            Submit Clue{number ? ` — ${word.trim().toUpperCase() || '...'} (${number})` : ''}
          </Text>
        </TouchableOpacity>

        <Text className="text-muted text-xs mt-1.5 text-center">
          One word only. Number = how many cards match.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
