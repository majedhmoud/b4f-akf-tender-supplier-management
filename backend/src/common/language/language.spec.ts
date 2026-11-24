import { parseAcceptLanguage, pickTranslation } from './language.js';

// Pins the language fallback the API promises (API_CONTRACT.md §1.7).
describe('parseAcceptLanguage', () => {
  it('takes the first supported language, defaulting to English', () => {
    expect(parseAcceptLanguage('ar-SA,ar;q=0.9,en;q=0.8')).toBe('ar');
    expect(parseAcceptLanguage('fr-FR,en;q=0.8')).toBe('en');
    expect(parseAcceptLanguage(undefined)).toBe('en');
  });
});

describe('pickTranslation', () => {
  const en = { language: 'en' as const, title: 'School maintenance' };
  const ar = { language: 'ar' as const, title: 'صيانة مدرسة' };

  it('returns the requested language when it exists', () => {
    expect(pickTranslation([en, ar], 'ar')).toEqual({
      content: ar,
      requestedLanguage: 'ar',
      isFallback: false,
      availableLanguages: ['ar', 'en'],
    });
  });

  it('falls back to the other language and says so', () => {
    expect(pickTranslation([ar], 'en')).toMatchObject({
      content: ar,
      requestedLanguage: 'en',
      isFallback: true,
    });
  });
});
