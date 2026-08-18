import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, MessageCircleQuestion } from 'lucide-react-native';
import { PageContainer } from '@/components/PageContainer';
import DesktopPageHeader from '@/components/DesktopPageHeader';
import DesktopContentColumn from '@/components/DesktopContentColumn';
import { stadiumSlate } from '@/lib/theme';

export default function Support() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0b1118' }}>
      <PageContainer className="flex-1" showDesktopNav>
      <DesktopPageHeader
        eyebrow="We're here"
        title="Support"
        description="Questions, bugs, and product ideas all go straight to the Know Ball team."
        maxWidth={760}
      />
      <DesktopContentColumn maxWidth={760}>
      <View style={{ padding: 20 }}>
      <View
        style={{
          padding: 32,
          alignItems: 'center',
          borderRadius: 24,
          borderWidth: 1,
          borderColor: stadiumSlate.border,
          backgroundColor: stadiumSlate.surface,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,106,61,0.13)',
            borderWidth: 1,
            borderColor: 'rgba(255,106,61,0.22)',
            marginBottom: 20,
          }}
        >
          <MessageCircleQuestion size={25} color={stadiumSlate.accent} />
        </View>
        <Text style={{ color: stadiumSlate.text, fontSize: 24, fontWeight: '900', marginBottom: 8 }}>
          How can we help?
        </Text>
        <Text
          style={{
            color: stadiumSlate.textMuted,
            fontSize: 15,
            textAlign: 'center',
            marginBottom: 24,
            lineHeight: 23,
            maxWidth: 520,
          }}
        >
          Have a question, found a bug, or want to share feedback? We'd love to hear from you.
        </Text>

        <TouchableOpacity
          onPress={() => Linking.openURL('mailto:knowballapp@gmail.com')}
          style={{
            backgroundColor: stadiumSlate.accent,
            paddingHorizontal: 24,
            paddingVertical: 13,
            borderRadius: 14,
            marginBottom: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
          }}
          activeOpacity={0.8}
        >
          <Mail size={17} color={stadiumSlate.background} />
          <Text style={{ color: stadiumSlate.background, fontSize: 15, fontWeight: '800' }}>
            Email Us
          </Text>
        </TouchableOpacity>

        <Text style={{ color: stadiumSlate.textSubtle, fontSize: 13 }}>knowballapp@gmail.com</Text>
      </View>
      </View>
      </DesktopContentColumn>
      </PageContainer>
    </SafeAreaView>
  );
}
