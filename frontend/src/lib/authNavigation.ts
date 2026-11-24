import type { Role } from '@/lib/api/generated/model/role';

// Exact route boundaries prevent a neighboring path from inheriting staff access.
export function staffRoleForPath(path: string): Role | null {
  if (/^\/employee(\/|$)/.test(path)) return 'employee';
  if (/^\/manage(\/|$)/.test(path)) return 'procurement_officer';
  if (/^\/signup-reviews(\/|$)/.test(path)) return 'legal_committee';
  if (/^\/(signup-requests|admin)(\/|$)/.test(path)) return 'admin';
  if (/^\/my-bids(\/|$)/.test(path)) return 'supplier';
  return null;
}

export function isPrivatePath(path: string): boolean {
  return !!staffRoleForPath(path) || /^\/(profile|my-assignments)(\/|$)/.test(path);
}

// Restrict returnTo to app-relative URLs, then apply the new session's locale.
// See API_CONTRACT.md §1.1 and ENGINEERING_STANDARDS.md §2.3.
export function signInDestination(returnTo: string | null, roles: Role[]): string {
  const fallback = roles.includes('procurement_officer')
    ? '/manage/tenders'
    : roles.includes('employee')
      ? '/employee/tenders'
      : roles.includes('admin')
        ? '/signup-requests'
        : roles.includes('legal_committee')
          ? '/signup-reviews'
          : roles.includes('supplier')
            ? '/profile'
            : roles.length === 0
              ? '/my-assignments'
              : '/tenders';
  if (!returnTo || !returnTo.startsWith('/') || /[\\\s\u0000-\u001f]/.test(returnTo))
    return fallback;
  try {
    const target = new URL(returnTo, 'https://app.invalid');
    if (target.origin !== 'https://app.invalid') return fallback;
    const pathname = target.pathname.replace(/^\/(en|ar)(?=\/|$)/, '') || '/';
    const decoded = decodeURIComponent(pathname);
    if (/[\\\u0000-\u001f]/.test(decoded) || decoded.startsWith('//')) return fallback;
    if (/^\/(sign-in|account-setup)(\/|$)/.test(decoded)) return fallback;
    const requiredRole = staffRoleForPath(decoded);
    if (requiredRole && !roles.includes(requiredRole)) return fallback;
    return pathname + target.search + target.hash;
  } catch {
    return fallback;
  }
}
