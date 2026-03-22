import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { Team } from '@/lib/codenamesEngine';

const TEAM_LABEL = { red: 'Red', blue: 'Blue' } as const;
const TEAM_COLOR = { red: '#E03A3E', blue: '#1D428A' } as const;

interface Props {
  team: Team;
  onSubmit: (word: string, number: number) => void;
}

export default function ClueInput({ team, onSubmit }: Props) {
  const [word, setWord] = useState('');
  const [number, setNumber] = useState('');

  const canSubmit =
    word.trim().length > 0 &&
    !word.trim().includes(' ') &&
    Number(number) >= 1 &&
    Number(number) <= 9;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(word.trim().toUpperCase(), Number(number));
    setWord('');
    setNumber('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="px-4 py-3">
        <Text className="text-white text-base font-bold mb-2">
          <Text style={{ color: TEAM_COLOR[team] }}>{TEAM_LABEL[team]}</Text> Spymaster — Give a Clue
        </Text>
        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-white"
            placeholder="One word clue"
            placeholderTextColor="#6b7280"
            value={word}
            onChangeText={setWord}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TextInput
            className="w-14 bg-surface border border-border rounded-lg px-3 py-2 text-white text-center"
            placeholder="#"
            placeholderTextColor="#6b7280"
            value={number}
            onChangeText={(t) => setNumber(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={1}
          />
          <TouchableOpacity
            className="rounded-lg px-4 py-2 justify-center"
            style={{ backgroundColor: canSubmit ? TEAM_COLOR[team] : '#2a2a2a' }}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.7}
          >
            <Text className="text-white font-bold">Go</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-muted text-xs mt-1">
          One word only. Number = how many cards match.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
