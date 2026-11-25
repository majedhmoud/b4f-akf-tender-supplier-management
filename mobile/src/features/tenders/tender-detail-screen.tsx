import { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '@/api/client';
import { getTender, getTenderDownload, type TenderDetail } from '@/api/tenders';
import { ScreenState } from '@/components/screen-state';
import { colors, radii } from '@/components/theme';
import { useResource } from '@/hooks/use-resource';
import { useLocale } from '@/locale/locale-provider';
import { formatDeadline, textDirection } from '@/locale/messages';

type Clock = { serverMs: number; receivedAt: number };
const deadlineKinds = ['application', 'technical', 'financial'] as const;

function Deadlines({
  deadlines,
  clock,
}: {
  deadlines: TenderDetail['deadlines'];
  clock: Clock;
}) {
  const { copy, locale } = useLocale();
  const [elapsed, setElapsed] = useState(
    () => performance.now() - clock.receivedAt,
  );
  useEffect(() => {
    const timer = setInterval(
      () => setElapsed(performance.now() - clock.receivedAt),
      1000,
    );
    return () => clearInterval(timer);
  }, [clock.receivedAt]);

  return (
    <View style={[styles.section, styles.deadlineSection]}>
      <Text
        accessibilityRole="header"
        style={[styles.deadlineHeading, textDirection(locale)]}
      >
        {copy.deadlines}
      </Text>
      {deadlineKinds.map((kind) => {
        const secondsLeft = Math.ceil(
          (Date.parse(deadlines[kind]) - clock.serverMs - elapsed) / 1000,
        );
        const remaining = !Number.isFinite(secondsLeft)
          ? copy.unknownTime
          : secondsLeft <= 0
            ? copy.closed
            : copy.remaining({
                days: Math.floor(secondsLeft / 86400),
                hours: Math.floor((secondsLeft % 86400) / 3600),
                minutes: Math.floor((secondsLeft % 3600) / 60),
                seconds: secondsLeft % 60,
              });
        return (
          <View key={kind} style={styles.deadline}>
            <Text style={[styles.deadlineLabel, textDirection(locale)]}>
              {copy[kind]}
            </Text>
            <Text style={[styles.deadlineDate, textDirection(locale)]}>
              {formatDeadline(deadlines[kind], locale)}
            </Text>
            <Text
              style={[
                styles.countdown,
                styles.deadlineBadge,
                textDirection(locale),
              ]}
            >
              {remaining}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Terms({ tender }: { tender: TenderDetail }) {
  const { copy, locale } = useLocale();
  const [opening, setOpening] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const files = tender.documents
    .filter((file) => file.kind === 'terms_of_reference')
    .flatMap((file) => [file, ...file.translations]);

  async function open(id: string) {
    setFailed(false);
    setOpening(id);
    try {
      await Linking.openURL(await getTenderDownload(tender.id, id, locale));
    } catch {
      setFailed(true);
    } finally {
      setOpening(null);
    }
  }

  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        style={[styles.heading, textDirection(locale)]}
      >
        {copy.terms}
      </Text>
      {files.length === 0 && (
        <Text style={[styles.muted, textDirection(locale)]}>
          {copy.noTerms}
        </Text>
      )}
      {files.map((file) => (
        <Pressable
          key={file.id}
          accessibilityRole="button"
          accessibilityLabel={copy.openDocument(file.name)}
          accessibilityState={{
            busy: opening === file.id,
            disabled: opening !== null,
          }}
          disabled={opening !== null}
          onPress={() => void open(file.id)}
          style={styles.document}
        >
          <Text style={[styles.countdown, textDirection(locale)]}>
            {file.name} · {file.language.toUpperCase()}
          </Text>
        </Pressable>
      ))}
      {failed && (
        <Text
          accessibilityRole="alert"
          style={[styles.error, textDirection(locale)]}
        >
          {copy.downloadError}
        </Text>
      )}
    </View>
  );
}

export function TenderDetailScreen({ tenderId }: { tenderId: string }) {
  const { copy, locale } = useLocale();
  const load = useCallback(
    (signal: AbortSignal) => getTender(tenderId, locale, signal),
    [tenderId, locale],
  );
  const { resource, retry } = useResource(load);
  if (resource.status === 'loading')
    return <ScreenState message={copy.loadingDetail} loading />;
  if (resource.status === 'error') {
    const missing =
      resource.error instanceof ApiError && resource.error.status === 404;
    return (
      <ScreenState
        message={missing ? copy.notFound : copy.loadError}
        retry={missing ? undefined : retry}
      />
    );
  }
  const { tender, clock } = resource.data;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <Text
          accessibilityRole="header"
          accessibilityLanguage={tender.content.language}
          style={[styles.title, textDirection(tender.content.language)]}
        >
          {tender.content.title}
        </Text>
        {tender.isFallback && (
          <Text style={[styles.heroMuted, textDirection(locale)]}>
            {copy.fallback}
          </Text>
        )}
        <Text
          accessibilityLanguage={tender.content.language}
          style={[styles.description, textDirection(tender.content.language)]}
        >
          {tender.content.description}
        </Text>
      </View>
      <Terms tender={tender} />
      <Deadlines deadlines={tender.deadlines} clock={clock} />
    </ScrollView>
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
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 18,
    gap: 12,
  },
  hero: {
    backgroundColor: colors.brandDeep,
    borderRadius: radii.hero,
    padding: 23,
    gap: 10,
  },
  title: {
    fontSize: 27,
    lineHeight: 35,
    fontWeight: '800',
    color: colors.inverse,
  },
  heading: { fontSize: 19, fontWeight: '800', color: colors.ink },
  description: { fontSize: 16, lineHeight: 24, color: colors.inverse },
  heroMuted: { fontSize: 13, color: colors.inverseMuted },
  deadlineSection: { padding: 20, borderColor: colors.brand },
  deadlineHeading: { fontSize: 21, fontWeight: '800', color: colors.ink },
  deadlineLabel: { fontSize: 15, fontWeight: '700', color: colors.brand },
  deadlineDate: { fontSize: 16, fontWeight: '700', color: colors.ink },
  muted: { fontSize: 14, color: colors.muted },
  deadline: {
    gap: 6,
    borderRadius: radii.control,
    backgroundColor: colors.tint,
    padding: 12,
  },
  countdown: { color: colors.brand, fontWeight: '700' },
  deadlineBadge: {
    backgroundColor: colors.highlight,
    color: colors.highlightInk,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: radii.control,
    overflow: 'hidden',
  },
  document: {
    minHeight: 44,
    justifyContent: 'center',
    padding: 10,
    borderRadius: radii.control,
    backgroundColor: colors.tint,
  },
  error: { color: colors.danger },
});
