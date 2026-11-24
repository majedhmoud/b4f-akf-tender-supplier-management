import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactElement, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SupplierMenu } from '@/components/supplier-menu';
import { colors, radii } from '@/components/theme';
import { SessionProvider } from '@/features/auth';
import { LocaleProvider, useLocale } from '@/locale/locale-provider';

function Navigator() {
  const { copy, locale, toggle } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = () => setMenuOpen(true);
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.brandDeep,
          headerTitleStyle: { fontWeight: '700', fontSize: 16 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.canvas },
          ...headerButtons(
            route.name === 'index'
              ? <MenuButton label={copy.openMenu} onPress={openMenu} />
              : undefined,
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.language}
              onPress={toggle}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            >
              <Text style={styles.languageLabel}>
                {locale === 'ar' ? 'EN' : 'عربي'}
              </Text>
            </Pressable>,
          ),
        })}
      >
        <Stack.Screen name="index" options={{ title: copy.appName }} />
        <Stack.Screen
          name="bids/index"
          options={{
            title: copy.myBids,
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
        <Stack.Screen
          name="bids/[bidId]"
          options={{
            title: copy.bidDetail,
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
        <Stack.Screen
          name="tenders/[tenderId]"
          options={{
            title: copy.detail,
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
      </Stack>
      <SupplierMenu visible={menuOpen} close={() => setMenuOpen(false)} />
    </>
  );
}

// On iOS 26, header items sit inside a shared liquid-glass capsule, which
// draws a second shape around each button. Custom items with
// hidesSharedBackground show only our own button. Other platforms keep the
// plain headerLeft/headerRight slots.
function headerButtons(left: ReactElement | undefined, right: ReactElement) {
  if (Platform.OS === 'ios') {
    return {
      unstable_headerLeftItems: left
        ? () => [{ type: 'custom' as const, element: left, hidesSharedBackground: true }]
        : undefined,
      unstable_headerRightItems: () => [
        { type: 'custom' as const, element: right, hidesSharedBackground: true },
      ],
    };
  }
  return {
    headerLeft: left ? () => left : undefined,
    headerRight: () => right,
  };
}

function MenuButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      <View accessible={false} style={styles.menuBars}>
        <View style={styles.bar} />
        <View style={[styles.bar, styles.shortBar]} />
        <View style={styles.bar} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // One look for every header button: same size, radius, border, and fill.
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageLabel: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  menuBars: { gap: 3, alignItems: 'flex-start' },
  bar: { height: 2, width: 17, borderRadius: 1, backgroundColor: colors.brand },
  shortBar: { width: 12 },
  pressed: { opacity: 0.72 },
});

export default function RootLayout() {
  return (
    <LocaleProvider>
      <SessionProvider>
        <Navigator />
      </SessionProvider>
    </LocaleProvider>
  );
}
