import { describe, expect, it } from 'vitest';
import { signInDestination, staffRoleForPath } from './authNavigation';
describe('S2 role routing', () => {
  it('lands legal reviewers and admins in their own queues', () => {
    expect(signInDestination(null, ['legal_committee'])).toBe('/signup-reviews');
    expect(signInDestination(null, ['admin'])).toBe('/signup-requests');
  });
  it('rejects cross-role return destinations including localized paths', () => {
    expect(signInDestination('/ar/signup-requests/a-1', ['legal_committee'])).toBe(
      '/signup-reviews',
    );
    expect(signInDestination('/signup-reviews/a-1', ['admin'])).toBe('/signup-requests');
    expect(signInDestination('/en/signup-reviews/a-1?page=2', ['legal_committee'])).toBe(
      '/signup-reviews/a-1?page=2',
    );
  });
  it('uses path boundaries rather than trusting similarly named routes', () => {
    expect(staffRoleForPath('/signup-reviews/a-1')).toBe('legal_committee');
    expect(staffRoleForPath('/signup-requests/a-1')).toBe('admin');
    expect(staffRoleForPath('/signup-reviews-other')).toBeNull();
    expect(staffRoleForPath('/admin/suppliers')).toBe('admin');
  });
});
