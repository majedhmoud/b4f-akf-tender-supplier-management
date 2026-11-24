// Locale-aware formatting with the browser's Intl, in the user's time zone.

export function formatDateTime(locale: string, iso: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

// "in 9 days", "in 5 hours": the largest whole unit until the target.
export function formatRelative(locale: string, targetIso: string, nowMs: number): string {
  const diff = Date.parse(targetIso) - nowMs;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(diff) >= size) return formatter.format(Math.trunc(diff / size), unit);
  }
  return formatter.format(Math.round(diff / 60_000), 'minute');
}

export function isPast(targetIso: string, nowMs: number): boolean {
  return Date.parse(targetIso) <= nowMs;
}

// The name of a language code in the reader's language: "ar" → "Arabic".
export function languageName(locale: string, code: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

// Text direction for a content block, from its own language (API_CONTRACT.md §1.7).
export function directionOf(language: string): 'rtl' | 'ltr' {
  return ['ar', 'fa', 'he', 'ur'].includes(language) ? 'rtl' : 'ltr';
}
