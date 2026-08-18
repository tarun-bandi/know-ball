import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ArrowRight, KeyRound } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { stadiumSlate } from '@/lib/theme';

interface Props {
  onJoin: (code: string) => Promise<void>;
  onCancel: () => void;
}

const BLUE = '#5ba8ff';
const RED = '#ff5d70';

export default function JoinRoomInput({ onJoin, onCancel }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleChange = (text: string) => {
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
    <Animated.View
      entering={FadeInUp.duration(400).springify().damping(16)}
      style={{
        width: '100%',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.11)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        padding: 18,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 16 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(91,168,255,0.10)',
            borderWidth: 1,
            borderColor: 'rgba(91,168,255,0.24)',
          }}
        >
          <KeyRound size={18} color={BLUE} />
        </View>
        <View>
          <Text style={{ color: stadiumSlate.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>Join a room</Text>
          <Text style={{ color: stadiumSlate.textSubtle, fontSize: 12, marginTop: 2 }}>Enter the six-character code from your host.</Text>
        </View>
      </View>

      <TextInput
        ref={inputRef}
        style={{
          width: '100%',
          minHeight: 62,
          borderRadius: 15,
          borderWidth: 1,
          borderColor: error ? 'rgba(255,93,112,0.62)' : ready ? 'rgba(91,168,255,0.62)' : 'rgba(255,255,255,0.13)',
          backgroundColor: '#0b1119',
          color: stadiumSlate.text,
          paddingHorizontal: 18,
          paddingVertical: 14,
          fontSize: 23,
          fontWeight: '900',
          textAlign: 'center',
          letterSpacing: 9,
          ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
        }}
        placeholder="— — — — — —"
        placeholderTextColor="#394657"
        value={code}
        onChangeText={handleChange}
        onSubmitEditing={handleJoin}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        maxLength={6}
        returnKeyType="go"
        accessibilityLabel="Room code"
      />

      {error ? (
        <Text style={{ color: RED, fontSize: 12, fontWeight: '700', marginTop: 9 }}>{error}</Text>
      ) : (
        <Text style={{ color: stadiumSlate.textSubtle, fontSize: 11, marginTop: 8 }}>No I, O, 0, or 1—keeps codes easy to read aloud.</Text>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          style={({ hovered, pressed }: any) => ({
            minHeight: 52,
            borderRadius: 14,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.10)',
            backgroundColor: hovered || pressed ? 'rgba(255,255,255,0.07)' : 'transparent',
          })}
        >
          <ArrowLeft size={15} color={stadiumSlate.textMuted} />
          <Text style={{ color: stadiumSlate.textMuted, fontSize: 13, fontWeight: '800' }}>Cancel</Text>
        </Pressable>

        <Pressable
          onPress={handleJoin}
          disabled={!ready || loading}
          accessibilityRole="button"
          style={({ hovered, pressed }: any) => ({
            flex: 1,
            minHeight: 52,
            borderRadius: 14,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            backgroundColor: ready ? (hovered || pressed ? '#78b8ff' : BLUE) : '#273343',
            opacity: loading ? 0.78 : 1,
          })}
        >
          {loading ? (
            <ActivityIndicator color="#08101a" size="small" />
          ) : (
            <>
              <Text style={{ color: ready ? '#08101a' : stadiumSlate.textSubtle, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>
                JOIN ROOM
              </Text>
              <ArrowRight size={16} color={ready ? '#08101a' : stadiumSlate.textSubtle} />
            </>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}
