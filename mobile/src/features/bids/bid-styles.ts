import { StyleSheet } from 'react-native';
import { colors, radii } from '@/components/theme';

export const bidStyles = StyleSheet.create({
  page: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: 20,
    gap: 12,
  },
  header: { gap: 4 },
  heading: { color: colors.ink, fontSize: 26, fontWeight: '800' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 18,
    gap: 8,
  },
  title: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  accent: { color: colors.brand, fontWeight: '700' },
  muted: { color: colors.muted },
});
