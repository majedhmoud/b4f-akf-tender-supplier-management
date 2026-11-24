import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Redirects only: sends `/` to `/en` or `/ar`. Never an access check.
// See ENGINEERING_STANDARDS.md §12.
export default createMiddleware(routing);

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
