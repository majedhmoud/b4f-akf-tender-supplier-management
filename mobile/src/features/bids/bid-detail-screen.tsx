import { useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { getMyBid } from '@/api/bids';
import { ApiError } from '@/api/client';
import { ScreenState } from '@/components/screen-state';
import { useSession } from '@/features/auth';
import { useResource } from '@/hooks/use-resource';
import { useLocale } from '@/locale/locale-provider';
import { formatDeadline, textDirection } from '@/locale/messages';
import { bidStyles as styles } from './bid-styles';

export function BidDetailScreen({ bidId }: { bidId: string }) {
  const { copy, locale } = useLocale();
  const { withAccess } = useSession();
  const load = useCallback(
    (signal: AbortSignal) =>
      withAccess((token) => getMyBid(bidId, token, locale, signal), signal),
    [bidId, locale, withAccess],
  );
  const { resource, retry } = useResource(load);
  if (resource.status === 'loading')
    return <ScreenState message={copy.loadingBids} loading />;
  if (resource.status === 'error') {
    const missing =
      resource.error instanceof ApiError && resource.error.status === 404;
    return (
      <ScreenState
        message={missing ? copy.bidMissing : copy.bidsError}
        retry={missing ? undefined : retry}
      />
    );
  }
  const { tender, parts } = resource.data;
  const direction = textDirection(locale);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text
          accessibilityRole="header"
          accessibilityLanguage={tender.content.language}
          style={[styles.heading, textDirection(tender.content.language)]}
        >
          {tender.content.title}
        </Text>
        <Text style={[styles.accent, direction]}>
          {copy.tenderStatuses[tender.status]}
        </Text>
      </View>
      {parts.map((part) => (
        <View key={part.partType} style={styles.card}>
          <Text style={[styles.title, direction]}>
            {copy.bidParts[part.partType]}
          </Text>
          <Text style={[styles.muted, direction]}>
            {part.deadline
              ? formatDeadline(part.deadline, locale)
              : copy.noDeadline}
          </Text>
          <Text style={[styles.accent, direction]}>
            {part.locked ? copy.locked : copy.unlocked}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
