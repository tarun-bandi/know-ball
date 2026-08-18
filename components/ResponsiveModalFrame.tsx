import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from 'react-native';
import { stadiumSlate } from '@/lib/theme';

interface ResponsiveModalFrameProps {
  children: ReactNode;
  onClose: () => void;
  maxWidth?: number;
  desktopMaxHeight?: number;
  mobileMaxHeight?: `${number}%` | number;
  keyboardAware?: boolean;
  testID?: string;
}

export default function ResponsiveModalFrame({
  children,
  onClose,
  maxWidth = 640,
  desktopMaxHeight = 760,
  mobileMaxHeight = '88%',
  keyboardAware = false,
  testID,
}: ResponsiveModalFrameProps) {
  const { width, height } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;

  const frame = (
    <Pressable
      testID={testID}
      onPress={(event) => event.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: isDesktop ? maxWidth : undefined,
        maxHeight: isDesktop ? Math.min(desktopMaxHeight, height - 48) : mobileMaxHeight,
        minHeight: 0,
        overflow: 'hidden',
        alignSelf: 'center',
        backgroundColor: stadiumSlate.surface,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderTopLeftRadius: isDesktop ? 24 : 26,
        borderTopRightRadius: isDesktop ? 24 : 26,
        borderBottomLeftRadius: isDesktop ? 24 : 0,
        borderBottomRightRadius: isDesktop ? 24 : 0,
        ...(isDesktop
          ? ({
              boxShadow: '0 28px 90px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.035)',
            } as any)
          : null),
      }}
    >
      {!isDesktop ? (
        <View style={{ alignItems: 'center', paddingTop: 11, paddingBottom: 3 }}>
          <View
            style={{
              width: 38,
              height: 4,
              borderRadius: 999,
              backgroundColor: stadiumSlate.borderStrong,
            }}
          />
        </View>
      ) : null}
      {children}
    </Pressable>
  );

  return (
    <Modal
      visible
      transparent
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          justifyContent: isDesktop ? 'center' : 'flex-end',
          alignItems: 'center',
          padding: isDesktop ? 24 : 0,
          zIndex: 10000,
          backgroundColor: 'rgba(2,6,12,0.78)',
          ...(isDesktop
            ? ({
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              } as any)
            : null),
        }}
      >
        {keyboardAware ? (
          <KeyboardAvoidingView
            behavior={isDesktop ? undefined : Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{
              width: '100%',
              maxWidth: isDesktop ? maxWidth : undefined,
              flex: 1,
              justifyContent: isDesktop ? 'center' : 'flex-end',
            }}
          >
            {frame}
          </KeyboardAvoidingView>
        ) : frame}
      </Pressable>
    </Modal>
  );
}
