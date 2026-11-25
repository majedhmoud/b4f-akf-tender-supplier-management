import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '@/api/client';
import { colors, radii } from '@/components/theme';
import { useLocale } from '@/locale/locale-provider';
import { textDirection } from '@/locale/messages';
import { useSession } from './session-provider';

type SignInProblem =
  | 'signInError'
  | 'badCredentials'
  | 'pendingSetup'
  | 'accountDisabled'
  | 'rateLimited';

function problemFor(error: unknown): SignInProblem {
  if (!(error instanceof ApiError)) return 'signInError';
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'badCredentials';
    case 'ACCOUNT_PENDING_SETUP':
      return 'pendingSetup';
    case 'ACCOUNT_DISABLED':
      return 'accountDisabled';
    case 'RATE_LIMITED':
      return 'rateLimited';
    default:
      return 'signInError';
  }
}

export function SignInScreen() {
  const { locale, copy } = useLocale();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<SignInProblem | null>(null);
  const disabled = !email.trim() || !password || submitting;

  async function submit() {
    if (disabled) return;
    setProblem(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      setProblem(problemFor(error));
    } finally {
      setPassword('');
      setSubmitting(false);
    }
  }

  const direction = textDirection(locale);
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.page}
    >
      <View style={styles.card}>
        <Text accessibilityRole="header" style={[styles.heading, direction]}>
          {copy.signIn}
        </Text>
        <Text style={[styles.label, direction]}>{copy.email}</Text>
        <TextInput
          accessibilityLabel={copy.email}
          autoComplete="email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          editable={!submitting}
          style={[styles.input, direction]}
        />
        <Text style={[styles.label, direction]}>{copy.password}</Text>
        <TextInput
          accessibilityLabel={copy.password}
          autoComplete="current-password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
          onSubmitEditing={() => void submit()}
          style={[styles.input, direction]}
        />
        {problem && (
          <Text accessibilityRole="alert" style={[styles.error, direction]}>
            {copy[problem]}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled, busy: submitting }}
          disabled={disabled}
          onPress={() => void submit()}
          style={[styles.button, disabled && styles.disabled]}
        >
          <Text style={styles.buttonText}>
            {submitting ? copy.signingIn : copy.signIn}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    gap: 12,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  label: { color: colors.ink, fontWeight: '700' },
  input: {
    minHeight: 48,
    color: colors.ink,
    fontSize: 16,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: 12,
  },
  error: { color: colors.danger },
  button: {
    backgroundColor: colors.brand,
    minHeight: 48,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: colors.inverse, fontWeight: '700' },
});
