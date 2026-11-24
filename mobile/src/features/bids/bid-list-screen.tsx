import { Link } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { listMyBids } from '@/api/bids';
import { ScreenState } from '@/components/screen-state';
import { useSession } from '@/features/auth';
import { useResource } from '@/hooks/use-resource';
import { useLocale } from '@/locale/locale-provider';
import { formatDeadline, textDirection } from '@/locale/messages';
import { bidStyles as styles } from './bid-styles';

export function BidListScreen() {
  const { copy, locale } = useLocale();
  const { withAccess } = useSession();
  const load = useCallback(
    (signal: AbortSignal) =>
      withAccess((token) => listMyBids(token, locale, signal), signal),
    [locale, withAccess],
  );
  const { resource, retry } = useResource(load);
  const direction = textDirection(locale);
  return (
    <FlatList
      data={resource.status === 'ready' ? resource.data : []}
      keyExtractor={(bid) => bid.bidId}
      contentContainerStyle={styles.page}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.heading, direction]}>
            {copy.myBids}
          </Text>
        </View>
      }
      ListEmptyComponent={
        resource.status === 'loading' ? (
          <ScreenState message={copy.loadingBids} loading />
        ) : resource.status === 'error' ? (
          <ScreenState message={copy.bidsError} retry={retry} />
        ) : (
          <ScreenState message={copy.noBids} />
        )
      }
      renderItem={({ item }) => (
        <Link
          href={{ pathname: '/bids/[bidId]', params: { bidId: item.bidId } }}
          asChild
        >
          <Pressable accessibilityRole="link" style={styles.card}>
            <Text
              style={[
                styles.title,
                textDirection(item.tender.content.language),
              ]}
              accessibilityLanguage={item.tender.content.language}
            >
              {item.tender.content.title}
            </Text>
            <Text style={[styles.accent, direction]}>
              {copy.tenderStatuses[item.tender.status]}
            </Text>
            <Text style={[styles.muted, direction]}>
              {item.nextDeadline
                ? `${copy.nextDeadline} · ${formatDeadline(item.nextDeadline, locale)}`
                : copy.noDeadline}
            </Text>
            {item.lockedParts.map((part) => (
              <Text key={part} style={[styles.muted, direction]}>
                {copy.bidParts[part]} · {copy.locked}
              </Text>
            ))}
          </Pressable>
        </Link>
      )}
    />
  );
}
