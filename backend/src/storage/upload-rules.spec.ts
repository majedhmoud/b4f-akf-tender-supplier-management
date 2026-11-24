import { ApiException } from '../common/errors/api-exception.js';
import { checkUpload, MAX_UPLOAD_BYTES, safeFileName } from './upload-rules.js';

// Pins the upload rules: allowed types only, checked by name, declared type,
// and actual content; at most 20 MB (ENGINEERING_STANDARDS.md §2.5,
// API_CONTRACT.md §1.8).
const PDF = Buffer.from('%PDF-1.7\n…');

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof ApiException ? error.code : 'OTHER';
  }
  return undefined;
}

describe('checkUpload', () => {
  it('accepts a real PDF', () => {
    expect(
      checkUpload({
        originalname: 'ToR.pdf',
        mimetype: 'application/pdf',
        size: PDF.length,
        buffer: PDF,
      }),
    ).toBe('application/pdf');
  });

  it('refuses a file whose content does not match its name and type', () => {
    const script = Buffer.from('#!/bin/sh\nrm -rf /');
    expect(
      codeOf(() =>
        checkUpload({
          originalname: 'ToR.pdf',
          mimetype: 'application/pdf',
          size: script.length,
          buffer: script,
        }),
      ),
    ).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('refuses types that are not on the list', () => {
    expect(
      codeOf(() =>
        checkUpload({
          originalname: 'setup.exe',
          mimetype: 'application/octet-stream',
          size: PDF.length,
          buffer: PDF,
        }),
      ),
    ).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('refuses files over 20 MB', () => {
    expect(
      codeOf(() =>
        checkUpload({
          originalname: 'big.pdf',
          mimetype: 'application/pdf',
          size: MAX_UPLOAD_BYTES + 1,
          buffer: PDF,
        }),
      ),
    ).toBe('FILE_TOO_LARGE');
  });
});

describe('safeFileName', () => {
  it('drops paths and control characters', () => {
    expect(safeFileName('../../etc/pass\u0000wd.pdf')).toBe('passwd.pdf');
    expect(safeFileName('C:\\Users\\x\\ToR (ar).pdf')).toBe('ToR (ar).pdf');
  });
});
