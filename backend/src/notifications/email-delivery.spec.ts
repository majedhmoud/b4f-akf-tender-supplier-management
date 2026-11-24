import { classify } from './email-delivery.js';

// What a send error proves about delivery (ERD, Emails).
describe('classify', () => {
  it('treats SMTP refusals as confirmed: permanent ones fail, the rest retry', () => {
    expect(classify({ responseCode: 550, permanent: true })).toBe('failed');
    expect(classify({ responseCode: 421, permanent: false })).toBe('retry');
    expect(classify({ responseCode: 503, permanent: false })).toBe('retry');
  });

  it('retries when no connection opened or the message never left', () => {
    expect(classify({ code: 'ESOCKET', originalCode: 'ECONNREFUSED' })).toBe('retry');
    expect(classify({ code: 'EDNS', originalCode: 'ENOTFOUND' })).toBe('retry');
    expect(classify({ code: 'ETIMEDOUT', timeoutType: 'CONNECT_TIMEOUT' })).toBe('retry');
    expect(classify({ code: 'EAUTH' })).toBe('retry');
  });

  it('calls a dropped or silent connection mid-send uncertain', () => {
    expect(classify({ code: 'ECONNECTION' })).toBe('uncertain');
    expect(classify({ code: 'ETIMEDOUT', timeoutType: 'SOCKET_TIMEOUT' })).toBe('uncertain');
    expect(classify({ code: 'ESOCKET', originalCode: 'ECONNRESET' })).toBe('uncertain');
    expect(classify(new Error('unknown'))).toBe('uncertain');
  });
});
