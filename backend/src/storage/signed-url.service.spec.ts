import { ConfigService } from '@nestjs/config';
import { SignedUrlService } from './signed-url.service.js';

// Pins the signed download URLs of ADR 0006: they expire after 5 minutes and
// break if the key, the name, or the expiry is changed.
describe('SignedUrlService', () => {
  const service = new SignedUrlService(
    new ConfigService({ FILE_URL_SECRET: 'test-secret-for-signed-urls' }),
  );
  const key = 'a'.repeat(32);
  const now = Date.parse('2026-11-23T09:00:00Z');

  function parse(url: string) {
    const query = new URL(url, 'http://api.test').searchParams;
    return {
      name: query.get('name') ?? '',
      expires: query.get('expires') ?? '',
      signature: query.get('signature') ?? '',
    };
  }

  it('issues a URL that is valid for 5 minutes', () => {
    const signed = service.sign(key, 'ToR.pdf', now);
    const { name, expires, signature } = parse(signed.url);

    expect(signed.url).toMatch(new RegExp(`^/api/v1/files/${key}\\?`));
    expect(signed.expiresAt).toBe('2026-11-23T09:05:00.000Z');
    expect(service.isValid(key, name, expires, signature, now + 4 * 60_000)).toBe(true);
    expect(service.isValid(key, name, expires, signature, now + 6 * 60_000)).toBe(false);
  });

  it('rejects a URL whose key, name, or expiry was changed', () => {
    const { name, expires, signature } = parse(service.sign(key, 'ToR.pdf', now).url);

    expect(service.isValid('b'.repeat(32), name, expires, signature, now)).toBe(false);
    expect(service.isValid(key, 'other.pdf', expires, signature, now)).toBe(false);
    expect(service.isValid(key, name, String(Number(expires) + 600), signature, now)).toBe(false);
  });
});
