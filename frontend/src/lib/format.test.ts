import { describe, expect, it } from 'vitest';
import { directionOf, formatRelative, isPast, languageName } from './format';

// Pins the countdown and language helpers the tender screens rely on.
describe('format helpers', () => {
  const now = Date.parse('2026-11-24T09:00:00Z');

  it('counts down in the largest whole unit', () => {
    expect(formatRelative('en', '2026-12-03T09:00:00Z', now)).toBe('in 9 days');
    expect(formatRelative('en', '2026-11-24T14:30:00Z', now)).toBe('in 5 hours');
  });

  it('knows when a deadline has passed', () => {
    expect(isPast('2026-11-24T08:59:00Z', now)).toBe(true);
    expect(isPast('2026-11-24T09:01:00Z', now)).toBe(false);
  });

  it('names languages in the reader’s language and picks the text direction', () => {
    expect(languageName('en', 'ar')).toBe('Arabic');
    expect(directionOf('ar')).toBe('rtl');
    expect(directionOf('fr')).toBe('ltr');
  });
});
