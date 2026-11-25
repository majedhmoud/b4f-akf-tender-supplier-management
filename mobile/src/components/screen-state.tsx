import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocale } from '@/locale/locale-provider';
import { colors, radii } from './theme';

export function ScreenState({
  message,
  loading,
  retry,
}: {
  message: string;
  loading?: boolean;
  retry?: () => void;
}) {
  const { copy } = useLocale();
  return (
    <View style={styles.container}>
      {loading && (
        <ActivityIndicator accessibilityLabel={message} color={colors.brand} />
      )}
      <Text accessibilityLiveRegion="polite" style={styles.message}>
        {message}
      </Text>
      {retry && (
        <Pressable
          accessibilityRole="button"
          onPress={retry}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{copy.retry}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 28, alignItems: 'center', gap: 12 },
  message: { color: colors.muted, fontSize: 16, textAlign: 'center' },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.control,
    paddingHorizontal: 18,
    backgroundColor: colors.brand,
  },
  buttonText: { color: colors.inverse, fontWeight: '700' },
});
