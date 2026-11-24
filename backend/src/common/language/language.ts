import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Language } from '../../generated/prisma/client.js';

// The interface language the web app asks for through Accept-Language,
// English unless Arabic comes first (API_CONTRACT.md §1.7).
export function parseAcceptLanguage(header: string | undefined): Language {
  for (const part of (header ?? '').split(',')) {
    const tag = part.trim().slice(0, 2).toLowerCase();
    if (tag === 'ar' || tag === 'en') return tag;
  }
  return 'en';
}

export const RequestedLanguage = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Language =>
    parseAcceptLanguage(ctx.switchToHttp().getRequest<Request>().headers['accept-language']),
);

export interface Translated<T> {
  content: T & { language: Language };
  requestedLanguage: Language;
  isFallback: boolean;
  availableLanguages: Language[];
}

// Picks the requested language, or the other one when it is missing. A tender
// always has at least one translation (ERD, Language).
export function pickTranslation<T extends { language: Language }>(
  translations: T[],
  requested: Language,
): Translated<T> {
  if (translations.length === 0) throw new Error('A translated record has no translations');
  const exact = translations.find((t) => t.language === requested);
  const content = exact ?? translations[0];
  return {
    content,
    requestedLanguage: requested,
    isFallback: !exact,
    availableLanguages: translations.map((t) => t.language).sort(),
  };
}
