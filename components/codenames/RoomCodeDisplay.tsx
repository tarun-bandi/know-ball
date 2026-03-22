import { View, Text, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Copy, Check } from 'lucide-react-native';
import { useState } from 'react';

interface Props {
  code: string;
}

export default function RoomCodeDisplay({ code }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TouchableOpacity
      onPress={handleCopy}
      activeOpacity={0.7}
      className="items-center"
    >
      <Text className="text-muted text-sm font-medium mb-1 uppercase tracking-widest">
        Room Code
      </Text>
      <View className="flex-row items-center gap-3 bg-surface border border-border rounded-2xl px-6 py-3">
        <Text className="text-white text-3xl font-bold tracking-[8px]">
          {code}
        </Text>
        {copied ? (
          <Check size={20} color="#22c55e" />
        ) : (
          <Copy size={20} color="#6b7280" />
        )}
      </View>
      <Text className="text-muted text-xs mt-1">
        {copied ? 'Copied!' : 'Tap to copy'}
      </Text>
    </TouchableOpacity>
  );
}
