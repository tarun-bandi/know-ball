import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Crown,
  KeyRound,
  Skull,
  Sparkles,
  Users,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '@/lib/store/authStore';
import { useCodenamesMultiplayerStore, getAnonId } from '@/lib/store/codenamesMultiplayerStore';
import { createRoom, joinRoom } from '@/lib/codenamesApi';
import JoinRoomInput from '@/components/codenames/JoinRoomInput';
import { stadiumSlate } from '@/lib/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BLUE = '#5ba8ff';
const RED = '#ff5d70';
const INK = '#070b11';

const PREVIEW_CARDS = [
  ['LAL', 'blue'], ['BOS', 'neutral'], ['NYK', 'red'], ['MIA', 'neutral'], ['GSW', 'blue'],
  ['CHI', 'red'], ['DEN', 'blue'], ['PHX', 'neutral'], ['MIL', 'red'], ['DAL', 'blue'],
  ['CLE', 'neutral'], ['ATL', 'red'], ['SAS', 'blue'], ['BKN', 'assassin'], ['OKC', 'red'],
  ['HOU', 'blue'], ['ORL', 'neutral'], ['MIN', 'red'], ['MEM', 'blue'], ['TOR', 'neutral'],
  ['POR', 'red'], ['SAC', 'blue'], ['UTA', 'neutral'], ['IND', 'red'], ['LAC', 'blue'],
] as const;

const CARD_STYLE = {
  blue: { background: 'rgba(91,168,255,0.14)', border: 'rgba(91,168,255,0.38)', text: '#a8d2ff' },
  red: { background: 'rgba(255,93,112,0.13)', border: 'rgba(255,93,112,0.34)', text: '#ffadb7' },
  neutral: { background: '#171f2a', border: '#2a3645', text: '#aeb9c8' },
  assassin: { background: '#050608', border: '#434956', text: '#f7f8fa' },
} as const;

function GamePreview({ isDesktop }: { isDesktop: boolean }) {
  const { width } = useWindowDimensions();
  const boardWidth = isDesktop ? 480 : Math.min(width - 52, 430);
  const gap = isDesktop ? 8 : 6;
  const cardWidth = (boardWidth - gap * 4 - 4) / 5;
  const cardHeight = cardWidth * 0.72;

  return (
    <Animated.View
      entering={FadeIn.delay(180).duration(600)}
      style={{
        width: boardWidth + 36,
        maxWidth: '100%',
        borderRadius: isDesktop ? 30 : 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        backgroundColor: 'rgba(15,21,29,0.96)',
        padding: 18,
        overflow: 'hidden',
        ...(Platform.OS === 'web'
          ? ({
              boxShadow: '0 34px 90px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.04)',
            } as any)
          : {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.42,
              shadowRadius: 28,
              elevation: 16,
            }),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
        <View>
          <Text style={{ color: stadiumSlate.textSubtle, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 }}>
            LIVE BOARD PREVIEW
          </Text>
          <Text style={{ color: stadiumSlate.text, fontSize: 18, fontWeight: '900', marginTop: 3, letterSpacing: -0.4 }}>
            Round 4 · Blue turn
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: BLUE }} />
          <Text style={{ color: '#a8d2ff', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }}>THINKING</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {PREVIEW_CARDS.map(([team, role], index) => {
          const colors = CARD_STYLE[role];
          return (
            <Animated.View
              key={team}
              entering={FadeInDown.delay(260 + index * 16).duration(320)}
              style={{
                width: cardWidth,
                height: cardHeight,
                borderRadius: isDesktop ? 12 : 9,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {role === 'assassin' ? <Skull size={isDesktop ? 17 : 14} color={colors.text} /> : null}
              <Text
                style={{
                  color: colors.text,
                  fontSize: isDesktop ? 13 : 11,
                  fontWeight: '900',
                  letterSpacing: 0.5,
                  marginTop: role === 'assassin' ? 3 : 0,
                }}
              >
                {team}
              </Text>
            </Animated.View>
          );
        })}
      </View>

      <View
        style={{
          marginTop: 15,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: 'rgba(91,168,255,0.24)',
          backgroundColor: 'rgba(91,168,255,0.08)',
          paddingHorizontal: 14,
          paddingVertical: 11,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <KeyRound size={15} color={BLUE} />
          <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, fontWeight: '700' }}>Current clue</Text>
        </View>
        <Text style={{ color: stadiumSlate.text, fontSize: 14, fontWeight: '900' }}>Showtime · 3</Text>
      </View>
    </Animated.View>
  );
}

function Rule({ icon: Icon, title, copy, color }: { icon: any; title: string; copy: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minWidth: 150 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${color}16`,
          borderWidth: 1,
          borderColor: `${color}30`,
        }}
      >
        <Icon size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: stadiumSlate.text, fontSize: 12, fontWeight: '900' }}>{title}</Text>
        <Text style={{ color: stadiumSlate.textSubtle, fontSize: 11, lineHeight: 15, marginTop: 1 }}>{copy}</Text>
      </View>
    </View>
  );
}

export default function CodenamesLanding() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const user = useAuthStore((s) => s.user);
  const { setRoom, setMyPlayer, setMyUserId } = useCodenamesMultiplayerStore();
  const [mode, setMode] = useState<'landing' | 'join'>('landing');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const getIdentity = () => {
    const userId = user?.id ?? getAnonId();
    const displayName = user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? 'Guest';
    const avatarUrl = user?.user_metadata?.avatar_url ?? null;
    return { userId, displayName, avatarUrl };
  };

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setCreateError('');
    try {
      const { userId, displayName, avatarUrl } = getIdentity();
      const room = await createRoom(userId, displayName, avatarUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMyUserId(userId);
      setRoom(room.id, room.code, true);
      router.push(`/codenames/lobby?code=${room.code}` as any);
    } catch (e: any) {
      setCreateError(e.message ?? 'Failed to create room');
    } finally {
      setCreating(false);
    }
  }, [user, setRoom, setMyUserId, router]);

  const handleJoin = useCallback(async (code: string) => {
    const { userId, displayName, avatarUrl } = getIdentity();
    const { room, player } = await joinRoom(code, userId, displayName, avatarUrl);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMyUserId(userId);
    setRoom(room.id, room.code, room.host_id === userId);
    setMyPlayer(player.id, player.team, player.role);
    router.push(`/codenames/lobby?code=${room.code}` as any);
  }, [user, setRoom, setMyPlayer, setMyUserId, router]);

  const switchMode = (next: 'landing' | 'join') => {
    LayoutAnimation.configureNext(LayoutAnimation.create(250, 'easeInEaseOut', 'opacity'));
    setMode(next);
    setCreateError('');
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: INK,
        ...(Platform.OS === 'web'
          ? ({
              backgroundImage:
                'radial-gradient(circle at 14% 12%, rgba(255,112,72,0.12), transparent 29%), radial-gradient(circle at 88% 18%, rgba(91,168,255,0.13), transparent 32%), linear-gradient(180deg, #090e15 0%, #070b11 100%)',
            } as any)
          : null),
      }}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={{ minHeight: Math.max(height, 680) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: isDesktop ? 30 : 20 }}>
          <Animated.View
            entering={FadeIn.duration(350)}
            style={{ minHeight: isDesktop ? 82 : 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Pressable
              onPress={() => router.replace('/(tabs)/feed')}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ hovered, pressed }: any) => ({
                height: 42,
                borderRadius: 13,
                paddingHorizontal: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.09)',
                backgroundColor: hovered || pressed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.035)',
              })}
            >
              <ArrowLeft size={17} color={stadiumSlate.textMuted} />
              <Text style={{ color: stadiumSlate.text, fontSize: 13, fontWeight: '800' }}>Back</Text>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <Sparkles size={14} color={stadiumSlate.accent} />
              <Text style={{ color: stadiumSlate.textSubtle, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>
                KNOW BALL · PARTY MODE
              </Text>
            </View>
          </Animated.View>

          <View
            style={{
              minHeight: isDesktop ? Math.max(height - 112, 650) : undefined,
              paddingTop: isDesktop ? 24 : 34,
              paddingBottom: isDesktop ? 56 : 42,
              flexDirection: isDesktop ? 'row' : 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: isDesktop ? 66 : 42,
            }}
          >
            <View style={{ width: isDesktop ? '48%' : '100%', maxWidth: 570 }}>
              <Animated.View entering={FadeInDown.delay(60).duration(500)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 17 }}>
                  <View style={{ width: 22, height: 3, borderRadius: 99, backgroundColor: BLUE }} />
                  <View style={{ width: 22, height: 3, borderRadius: 99, backgroundColor: RED }} />
                  <Text style={{ color: stadiumSlate.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1.3 }}>
                    THE BASKETBALL WORD GAME
                  </Text>
                </View>

                <Text
                  style={{
                    color: stadiumSlate.text,
                    fontSize: isDesktop ? 72 : 48,
                    lineHeight: isDesktop ? 70 : 48,
                    fontWeight: '900',
                    letterSpacing: isDesktop ? -3.6 : -2.2,
                  }}
                >
                  NBA{isDesktop ? '\n' : ' '}CODENAMES
                </Text>

                <Text
                  style={{
                    color: stadiumSlate.textMuted,
                    fontSize: isDesktop ? 18 : 16,
                    lineHeight: isDesktop ? 28 : 24,
                    marginTop: 20,
                    maxWidth: 510,
                  }}
                >
                  Give the perfect clue, connect the right teams, and prove your group actually knows ball. Just don&apos;t pick the assassin.
                </Text>
              </Animated.View>

              <Animated.View
                entering={FadeIn.delay(260).duration(500)}
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 26 }}
              >
                <Rule icon={Crown} title="Pick a spymaster" copy="One clue. One number." color={stadiumSlate.accent} />
                <Rule icon={Users} title="Read your team" copy="Connect the NBA dots." color={BLUE} />
                <Rule icon={Skull} title="Dodge the trap" copy="One bad pick ends it." color={RED} />
              </Animated.View>

              <View style={{ marginTop: 34, width: '100%', maxWidth: 500 }}>
                {mode === 'landing' ? (
                  <Animated.View entering={FadeInUp.delay(320).duration(500)}>
                    <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 11 }}>
                      <Pressable
                        onPress={handleCreate}
                        disabled={creating}
                        accessibilityRole="button"
                        style={({ hovered, pressed }: any) => ({
                          flex: 1,
                          minHeight: 58,
                          borderRadius: 16,
                          paddingHorizontal: 18,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 10,
                          backgroundColor: hovered || pressed ? '#ff805d' : stadiumSlate.accent,
                          transform: [{ translateY: pressed ? 1 : 0 }],
                          ...(Platform.OS === 'web'
                            ? ({ boxShadow: '0 14px 34px rgba(255,112,72,0.20)' } as any)
                            : null),
                        })}
                      >
                        {creating ? (
                          <ActivityIndicator color={INK} />
                        ) : (
                          <>
                            <Text style={{ color: INK, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>CREATE A ROOM</Text>
                            <ArrowRight size={17} color={INK} strokeWidth={2.6} />
                          </>
                        )}
                      </Pressable>

                      <Pressable
                        onPress={() => switchMode('join')}
                        accessibilityRole="button"
                        style={({ hovered, pressed }: any) => ({
                          flex: 1,
                          minHeight: 58,
                          borderRadius: 16,
                          paddingHorizontal: 18,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 9,
                          borderWidth: 1,
                          borderColor: hovered || pressed ? 'rgba(91,168,255,0.50)' : 'rgba(255,255,255,0.12)',
                          backgroundColor: hovered || pressed ? 'rgba(91,168,255,0.10)' : 'rgba(255,255,255,0.045)',
                        })}
                      >
                        <KeyRound size={16} color={BLUE} />
                        <Text style={{ color: stadiumSlate.text, fontSize: 14, fontWeight: '900', letterSpacing: 0.4 }}>JOIN WITH CODE</Text>
                      </Pressable>
                    </View>

                    {createError ? (
                      <Text style={{ color: RED, fontSize: 13, fontWeight: '700', marginTop: 10 }}>{createError}</Text>
                    ) : null}

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <Users size={14} color={stadiumSlate.textSubtle} />
                        <Text style={{ color: stadiumSlate.textSubtle, fontSize: 12, fontWeight: '700' }}>4–8 players</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <Clock3 size={14} color={stadiumSlate.textSubtle} />
                        <Text style={{ color: stadiumSlate.textSubtle, fontSize: 12, fontWeight: '700' }}>About 15 min</Text>
                      </View>
                    </View>
                  </Animated.View>
                ) : (
                  <JoinRoomInput onJoin={handleJoin} onCancel={() => switchMode('landing')} />
                )}
              </View>
            </View>

            <View style={{ width: isDesktop ? 520 : '100%', maxWidth: 520, alignItems: 'center' }}>
              <GamePreview isDesktop={isDesktop} />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
