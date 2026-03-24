import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import type { Team } from '@/lib/codenamesEngine';

const TEAM_LABEL = { red: 'Red', blue: 'Blue' } as const;
const TEAM_COLOR = { red: '#E03A3E', blue: '#1D428A' } as const;

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Props {
  team: Team;
  /** Return null on success, or an error string on failure. */
  onSubmit: (word: string, number: number) => Promise<string | null> | void;
}

export default function ClueInput({ team, onSubmit }: Props) {
  const [word, setWord] = useState('');
  const [number, setNumber] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = word.trim().length > 0 && !word.trim().includes(' ') && number !== null && !submitting;
  const color = TEAM_COLOR[team];

  const handleSubmit = async () => {
    if (!canSubmit || !number) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await onSubmit(word.trim().toUpperCase(), number);
      if (result) {
        setError(result);
      } else {
        setWord('');
        setNumber(null);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to submit clue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ gap: 10 }}>
        <Text className="text-white text-sm font-bold">
          <Text style={{ color }}>{TEAM_LABEL[team]}</Text> Spymaster — Give a Clue
        </Text>

        <TextInput
          className="bg-surface border border-border rounded-xl px-4 py-3 text-white text-lg"
          placeholder="One word clue"
          placeholderTextColor="#7a7d88"
          value={word}
          onChangeText={(t) => { setWord(t); setError(null); }}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        {/* Number pills */}
        <View className="flex-row justify-between">
          {NUMBERS.map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setNumber(n)}
              activeOpacity={0.7}
              style={{
                backgroundColor: number === n ? color : '#141416',
                borderWidth: 1,
                borderColor: number === n ? color : '#2a2a30',
                width: 34, height: 34, borderRadius: 17,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text className="text-white font-bold text-sm">{n}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && (
          <Text style={{ color: '#e63946', fontSize: 13 }}>{error}</Text>
        )}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.7}
          className="rounded-xl py-3 items-center"
          style={{ backgroundColor: canSubmit ? color : '#2a2a30' }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white font-bold text-base">
              Submit Clue{number ? ` — ${word.trim().toUpperCase() || '...'} (${number})` : ''}
            </Text>
          )}
        </TouchableOpacity>

        <Text className="text-muted text-xs text-center">
          One word, no team names or cities
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
