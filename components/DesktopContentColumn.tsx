import type { ReactNode } from 'react';
import { View } from 'react-native';

interface DesktopContentColumnProps {
  children: ReactNode;
  maxWidth?: number;
  fill?: boolean;
}

export default function DesktopContentColumn({
  children,
  maxWidth = 960,
  fill = false,
}: DesktopContentColumnProps) {
  return (
    <View
      style={{
        width: '100%',
        maxWidth,
        minWidth: 0,
        alignSelf: 'center',
        ...(fill ? { flex: 1 } : null),
      }}
    >
      {children}
    </View>
  );
}
