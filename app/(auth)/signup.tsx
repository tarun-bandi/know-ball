import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/googleAuth';
import { getAuthErrorMessage, withAuthTimeout } from '@/lib/authFeedback';
import { PageContainer } from '@/components/PageContainer';

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleSignup() {
    setErrorMessage('');
    setSuccessMessage('');

    if (!displayName.trim() || !email || !password) {
      const message = 'Please fill in all fields';
      setErrorMessage(message);
      if (Platform.OS !== 'web') Alert.alert('Error', message);
      return;
    }
    if (password.length < 6) {
      const message = 'Password must be at least 6 characters';
      setErrorMessage(message);
      if (Platform.OS !== 'web') Alert.alert('Error', message);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await withAuthTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName.trim() },
          },
        })
      );

      if (error) {
        const message = getAuthErrorMessage(error);
        setErrorMessage(message);
        if (Platform.OS !== 'web') Alert.alert('Sign Up Failed', message);
        return;
      }

      if (data.user && !data.session) {
        setSuccessMessage('Account created. Check your email to confirm your address, then sign in.');
      }
    } catch (error) {
      const message = getAuthErrorMessage(error);
      setErrorMessage(message);
      if (Platform.OS !== 'web') Alert.alert('Sign Up Failed', message);
    } finally {
      setLoading(false);
    }
    // If email confirmation is disabled, onAuthStateChange in _layout.tsx
    // picks up the new session automatically and redirects to (tabs)
  }

  async function handleGoogleSignIn() {
    setErrorMessage('');
    setSuccessMessage('');
    setGoogleLoading(true);
    try {
      await withAuthTimeout(signInWithGoogle());
    } catch (error: any) {
      const message = getAuthErrorMessage(error);
      setErrorMessage(message);
      if (Platform.OS !== 'web') Alert.alert('Google Sign In Failed', message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <PageContainer className="px-6">
          {/* Header */}
          <View className="mb-12 items-center">
            <Text className="text-accent text-4xl font-bold tracking-tight">
              Know Ball
            </Text>
            <Text className="text-muted text-base mt-2">
              Create your account
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            <TextInput
              testID="signup_name_input"
              className="bg-surface border border-border rounded-xl px-4 py-3.5 text-white text-base"
              placeholder="Display Name"
              placeholderTextColor="#8fa1b3"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoComplete="name"
            />
            <TextInput
              testID="signup_email_input"
              className="bg-surface border border-border rounded-xl px-4 py-3.5 text-white text-base"
              placeholder="Email"
              placeholderTextColor="#8fa1b3"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              testID="signup_password_input"
              className="bg-surface border border-border rounded-xl px-4 py-3.5 text-white text-base"
              placeholder="Password (min 6 characters)"
              placeholderTextColor="#8fa1b3"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            {errorMessage ? (
              <View className="bg-accent-red/10 border border-accent-red/30 rounded-xl px-4 py-3">
                <Text className="text-[#ff6b76] text-sm leading-5">
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {successMessage ? (
              <View className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3">
                <Text className="text-accent text-sm leading-5">
                  {successMessage}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              testID="signup_submit"
              className="bg-accent rounded-xl py-4 items-center mt-2"
              onPress={handleSignup}
              disabled={loading || googleLoading}
            >
              {loading ? (
                <ActivityIndicator color="#0b1118" />
              ) : (
                <Text className="text-background font-semibold text-base">
                  Create Account
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center mt-4">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-muted text-sm mx-4">or</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            {/* Google Sign In */}
            <TouchableOpacity
              className="bg-surface border border-border rounded-xl py-4 items-center mt-4"
              onPress={handleGoogleSignIn}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Continue with Google
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login link */}
          <View className="mt-8 flex-row justify-center">
            <Text className="text-muted">Already have an account? </Text>
            <Link href="/(auth)/login">
              <Text className="text-accent font-medium">Sign In</Text>
            </Link>
          </View>
        </PageContainer>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
