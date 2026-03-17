import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/googleAuth';
import { PageContainer } from '@/components/PageContainer';
import { getTeamLogoUrl } from '@/lib/teamLogo';

// A fixed set of team abbreviations scattered across the background
const SCATTERED_TEAMS = [
  'LAL', 'BOS', 'GSW', 'CHI', 'MIA', 'NYK', 'PHX', 'BKN',
  'MIL', 'DEN', 'PHI', 'DAL', 'LAC', 'MEM', 'ATL', 'SAC',
];

// Deterministic positions so they don't shift on re-render
const LOGO_POSITIONS = [
  { top: '4%', left: '6%', size: 40, rotate: -12 },
  { top: '8%', right: '10%', size: 34, rotate: 8 },
  { top: '16%', left: '68%', size: 28, rotate: -5 },
  { top: '14%', left: '28%', size: 36, rotate: 15 },
  { top: '24%', right: '4%', size: 32, rotate: -18 },
  { top: '30%', left: '4%', size: 30, rotate: 10 },
  { top: '38%', right: '18%', size: 38, rotate: -8 },
  { top: '44%', left: '16%', size: 26, rotate: 20 },
  { top: '58%', right: '6%', size: 34, rotate: -15 },
  { top: '66%', left: '8%', size: 32, rotate: 6 },
  { top: '72%', right: '22%', size: 28, rotate: -10 },
  { top: '78%', left: '60%', size: 36, rotate: 12 },
  { top: '84%', left: '2%', size: 30, rotate: -20 },
  { top: '88%', right: '8%', size: 34, rotate: 5 },
  { top: '52%', left: '72%', size: 26, rotate: -14 },
  { top: '94%', left: '36%', size: 32, rotate: 18 },
];

function ScatteredLogos() {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: fadeAnim,
      }}
    >
      {SCATTERED_TEAMS.map((abbr, i) => {
        const pos = LOGO_POSITIONS[i];
        return (
          <View
            key={abbr}
            style={{
              position: 'absolute',
              top: pos.top as any,
              left: (pos as any).left,
              right: (pos as any).right,
              opacity: 0.06,
              transform: [{ rotate: `${pos.rotate}deg` }],
            }}
          >
            <Image
              source={{ uri: getTeamLogoUrl(abbr, 'nba') }}
              style={{ width: pos.size, height: pos.size }}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </View>
        );
      })}
    </Animated.View>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Staggered entrance animations
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(subtitleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(formAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(footerAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const fadeSlide = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  });

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Login Failed', error.message);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Google Sign In Failed', error.message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScatteredLogos />

      <View className="flex-1 justify-center px-6">
        <PageContainer>
          {/* Hero title — dramatic type scale, left-aligned */}
          <Animated.View style={[{ marginBottom: 6 }, fadeSlide(titleAnim)]}>
            <Text
              style={{
                color: '#c9a84c',
                fontSize: 52,
                fontWeight: '700',
                letterSpacing: -2,
                lineHeight: 54,
              }}
            >
              Know
            </Text>
            <Text
              style={{
                color: '#ffffff',
                fontSize: 52,
                fontWeight: '700',
                letterSpacing: -2,
                lineHeight: 54,
              }}
            >
              Ball
            </Text>
          </Animated.View>

          {/* Subtitle — understated, creates contrast with the large title */}
          <Animated.View style={[{ marginBottom: 40 }, fadeSlide(subtitleAnim)]}>
            <Text
              style={{
                color: '#6b7280',
                fontSize: 15,
                fontWeight: '400',
                letterSpacing: 0.5,
              }}
            >
              Log games. Rank classics. Share your takes.
            </Text>
          </Animated.View>

          {/* Form */}
          <Animated.View style={[{ gap: 14 }, fadeSlide(formAnim)]}>
            <TextInput
              testID="auth_email_input"
              className="bg-surface border border-border rounded-xl px-4 py-3.5 text-white text-base"
              placeholder="Email"
              placeholderTextColor="#6b7280"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              testID="auth_password_input"
              className="bg-surface border border-border rounded-xl px-4 py-3.5 text-white text-base"
              placeholder="Password"
              placeholderTextColor="#6b7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />

            <TouchableOpacity
              testID="auth_login_submit"
              className="bg-accent rounded-xl py-4 items-center mt-1"
              onPress={handleLogin}
              disabled={loading || googleLoading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#0a0a0a" />
              ) : (
                <Text className="text-background font-bold text-base tracking-wide">
                  Sign In
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center mt-3">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-muted text-xs mx-4 uppercase tracking-widest">or</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            {/* Google Sign In */}
            <TouchableOpacity
              testID="auth_google_signin"
              className="bg-surface border border-border rounded-xl py-4 items-center mt-3"
              onPress={handleGoogleSignIn}
              disabled={loading || googleLoading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Continue with Google
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Sign up link */}
          <Animated.View style={[{ marginTop: 32 }, fadeSlide(footerAnim)]}>
            <View className="flex-row">
              <Text className="text-muted">Don't have an account? </Text>
              <Link href="/(auth)/signup" testID="auth_signup_link">
                <Text className="text-accent font-semibold">Sign Up</Text>
              </Link>
            </View>
          </Animated.View>
        </PageContainer>
      </View>
    </KeyboardAvoidingView>
  );
}
