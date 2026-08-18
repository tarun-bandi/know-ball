import type { ReactNode } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { stadiumSlate } from '@/lib/theme';

interface DesktopPageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
  maxWidth?: number;
}

export default function DesktopPageHeader({
  title,
  description,
  eyebrow,
  action,
  maxWidth = 980,
}: DesktopPageHeaderProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;

  if (!isDesktop) return null;

  return (
    <View
      style={{
        width: '100%',
        maxWidth,
        alignSelf: 'center',
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 20,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 20,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? (
          <Text
            style={{
              color: stadiumSlate.accent,
              fontSize: 10,
              lineHeight: 14,
              fontWeight: '900',
              letterSpacing: 1.7,
              textTransform: 'uppercase',
              marginBottom: 7,
            }}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text
          style={{
            color: stadiumSlate.text,
            fontSize: 32,
            lineHeight: 36,
            fontWeight: '900',
            letterSpacing: -1.1,
          }}
        >
          {title}
        </Text>
        {description ? (
          <Text
            style={{
              color: stadiumSlate.textMuted,
              fontSize: 14,
              lineHeight: 21,
              marginTop: 7,
              maxWidth: 620,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
