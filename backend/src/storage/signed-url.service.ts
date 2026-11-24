import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Downloads last 5 minutes (ADR 0006).
const TTL_SECONDS = 5 * 60;

export interface SignedDownload {
  url: string;
  expiresAt: string;
}

// Short-lived signed download URLs, issued only after the access check and
// served by the API (ADR 0006, API_CONTRACT.md §1.8). The signature covers the
// storage key, the download name, and the expiry.
@Injectable()
export class SignedUrlService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('FILE_URL_SECRET');
  }

  private signature(key: string, name: string, expires: number): string {
    return createHmac('sha256', this.secret)
      .update(`${key}\n${name}\n${expires}`)
      .digest('base64url');
  }

  sign(key: string, name: string, now = Date.now()): SignedDownload {
    const expires = Math.floor(now / 1000) + TTL_SECONDS;
    const query = new URLSearchParams({
      name,
      expires: String(expires),
      signature: this.signature(key, name, expires),
    });
    return {
      url: `/api/v1/files/${key}?${query.toString()}`,
      expiresAt: new Date(expires * 1000).toISOString(),
    };
  }

  isValid(key: string, name: string, expires: string, signature: string, now = Date.now()) {
    const expiresAt = Number(expires);
    if (!Number.isInteger(expiresAt) || expiresAt * 1000 < now) return false;
    const expected = Buffer.from(this.signature(key, name, expiresAt));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
