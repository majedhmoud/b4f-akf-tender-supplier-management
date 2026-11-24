import { usePathname, useRouter } from 'expo-router';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/features/auth';
import { useLocale } from '@/locale/locale-provider';
import { textDirection } from '@/locale/messages';
import { colors, radii } from './theme';

export function SupplierMenu({
  visible,
  close,
}: {
  visible: boolean;
  close: () => void;
}) {
  const { copy, locale, toggle } = useLocale();
  const { state, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const rtl = locale === 'ar';
  const direction = textDirection(locale);
  const signedIn = state.status === 'signedIn';
  const navigate = (path: '/' | '/bids') => {
    close();
    if (path !== pathname) router.navigate(path);
  };

  function endSession() {
    close();
    void signOut().then((confirmed) => {
      if (!confirmed) Alert.alert(copy.signOut, copy.signOutWarning);
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={[styles.overlay, rtl && styles.fromRight]}>
        <Pressable
          accessible={false}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView accessibilityViewIsModal style={styles.drawer}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View style={[styles.top, rtl && styles.reverse]}>
              <Text
                accessibilityRole="header"
                style={[styles.title, direction]}
              >
                {copy.supplierMenu}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.closeMenu}
                onPress={close}
                style={styles.close}
              >
                <Text accessible={false} style={styles.closeMark}>
                  ×
                </Text>
              </Pressable>
            </View>
            {state.status !== 'restoring' && (
              <View style={styles.account}>
                <Text style={[styles.accountText, direction]}>
                  {signedIn ? copy.supplierAccount : copy.guest}
                </Text>
              </View>
            )}
            <MenuRow
              label={copy.browse}
              selected={pathname === '/'}
              onPress={() => navigate('/')}
            />
            <MenuRow
              label={signedIn ? copy.myBids : copy.signIn}
              selected={pathname.startsWith('/bids')}
              onPress={() => navigate('/bids')}
            />
            <View style={styles.divider} />
            <MenuRow label={copy.language} onPress={toggle} />
            {signedIn && (
              <MenuRow label={copy.signOut} onPress={endSession} danger />
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function MenuRow({
  label,
  selected,
  danger,
  onPress,
}: {
  label: string;
  selected?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  const { locale } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        (selected || pressed) && styles.rowSelected,
      ]}
    >
      <Text
        style={[
          styles.rowLabel,
          danger && styles.danger,
          textDirection(locale),
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    direction: 'ltr',
    flexDirection: 'row',
    backgroundColor: colors.overlay,
  },
  fromRight: { flexDirection: 'row-reverse' },
  drawer: { width: '86%', maxWidth: 350, backgroundColor: colors.surface },
  content: { padding: 20, gap: 8 },
  top: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', gap: 8 },
  reverse: { flexDirection: 'row-reverse' },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.ink },
  close: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: radii.control,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeMark: { color: colors.brand, fontSize: 24, lineHeight: 27 },
  account: {
    backgroundColor: colors.brandDeep,
    borderRadius: radii.card,
    padding: 16,
    marginVertical: 10,
  },
  accountText: { color: colors.inverse, fontWeight: '700', fontSize: 16 },
  row: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    borderRadius: radii.control,
  },
  rowSelected: { backgroundColor: colors.tint },
  rowLabel: { fontSize: 16, color: colors.brand, fontWeight: '700' },
  danger: { color: colors.danger },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 6,
  },
});
