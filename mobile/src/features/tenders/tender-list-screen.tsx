import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { listTenders } from '@/api/tenders';
import { ScreenState } from '@/components/screen-state';
import { colors, radii } from '@/components/theme';
import { useResource } from '@/hooks/use-resource';
import { useLocale } from '@/locale/locale-provider';
import { formatDeadline, textDirection } from '@/locale/messages';

function searchKey(text: string) {
  return text
    .normalize('NFKD')
    .replace(/[\p{M}\u0640]/gu, '')
    .trim()
    .toLowerCase();
}

export function TenderListScreen() {
  const { copy, locale } = useLocale();
  const [query, setQuery] = useState('');
  const load = useCallback(
    (signal: AbortSignal) => listTenders(locale, signal),
    [locale],
  );
  const { resource, retry } = useResource(load);
  const keyword = searchKey(query);
  const rtl = locale === 'ar';
  const direction = textDirection(locale);
  const results =
    resource.status === 'ready'
      ? resource.data.filter((item) =>
          searchKey(item.content.title).includes(keyword),
        )
      : [];

  return (
    <FlatList
      data={results}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.page}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.hero}>
            <Text
              accessibilityRole="header"
              style={[styles.heading, direction]}
            >
              {copy.browse}
            </Text>
            <Text style={[styles.intro, direction]}>{copy.intro}</Text>
          </View>
          <TextInput
            accessibilityLabel={copy.search}
            placeholder={copy.search}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            value={query}
            onChangeText={setQuery}
            style={[styles.search, direction]}
          />
          <View style={[styles.sectionHeader, rtl && styles.reverse]}>
            <Text
              accessibilityRole="header"
              style={[styles.sectionTitle, direction]}
            >
              {copy.availableTenders}
            </Text>
            {resource.status === 'ready' && (
              <View style={styles.count}>
                <Text style={styles.countText}>
                  {new Intl.NumberFormat(locale).format(results.length)}
                </Text>
              </View>
            )}
          </View>
        </View>
      }
      ListEmptyComponent={
        resource.status === 'loading' ? (
          <ScreenState message={copy.loading} loading />
        ) : resource.status === 'error' ? (
          <ScreenState message={copy.loadError} retry={retry} />
        ) : (
          <ScreenState message={keyword ? copy.noMatches : copy.empty} />
        )
      }
      renderItem={({ item }) => {
        const category = Object.hasOwn(copy.categories, item.categoryCode)
          ? copy.categories[item.categoryCode as keyof typeof copy.categories]
          : null;
        return (
          <Link
            href={{
              pathname: '/tenders/[tenderId]',
              params: { tenderId: item.id },
            }}
            asChild
          >
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              {category && (
                <View style={[styles.category, rtl && styles.categoryRight]}>
                  <Text style={[styles.categoryLabel, direction]}>
                    {category}
                  </Text>
                </View>
              )}
              <Text
                accessibilityLanguage={item.content.language}
                style={[styles.title, textDirection(item.content.language)]}
              >
                {item.content.title}
              </Text>
              {item.isFallback && (
                <Text style={[styles.muted, direction]}>{copy.fallback}</Text>
              )}
              <View style={styles.deadline}>
                <Text style={[styles.deadlineCaption, direction]}>
                  {copy.dateLabel}
                </Text>
                <Text style={[styles.deadlineValue, direction]}>
                  {formatDeadline(item.applicationDeadline, locale)}
                </Text>
              </View>
              <View style={[styles.cardFooter, rtl && styles.reverse]}>
                <Text style={styles.action}>{copy.tenderDetails}</Text>
                <Text accessible={false} style={styles.arrow}>
                  {rtl ? '‹' : '›'}
                </Text>
              </View>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: 20,
    gap: 14,
  },
  header: { gap: 14 },
  hero: {
    borderRadius: radii.hero,
    backgroundColor: colors.brandDeep,
    padding: 24,
    gap: 8,
  },
  heading: {
    fontSize: 31,
    lineHeight: 39,
    fontWeight: '800',
    color: colors.inverse,
  },
  intro: { fontSize: 15, lineHeight: 22, color: colors.inverseMuted },
  muted: { fontSize: 13, color: colors.muted },
  search: {
    minHeight: 52,
    backgroundColor: colors.surface,
    color: colors.ink,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  reverse: { flexDirection: 'row-reverse' },
  sectionTitle: { color: colors.ink, fontWeight: '800', fontSize: 19 },
  count: {
    backgroundColor: colors.tint,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  countText: { color: colors.brand, fontWeight: '700', fontSize: 13 },
  card: {
    padding: 17,
    gap: 10,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    shadowColor: colors.brandDeep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 1,
  },
  category: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: colors.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryRight: { alignSelf: 'flex-end' },
  categoryLabel: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 20, lineHeight: 28, fontWeight: '800' },
  deadline: {
    backgroundColor: colors.highlight,
    borderRadius: radii.control,
    padding: 11,
    gap: 4,
  },
  deadlineCaption: {
    color: colors.highlightInk,
    fontSize: 12,
    fontWeight: '600',
  },
  deadlineValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  action: { color: colors.brand, fontWeight: '800', fontSize: 14 },
  arrow: {
    color: colors.brand,
    fontSize: 25,
    lineHeight: 28,
    fontWeight: '600',
  },
  pressed: { borderColor: colors.brand, backgroundColor: colors.tint },
});
