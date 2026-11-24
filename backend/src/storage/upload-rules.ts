import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/errors/api-exception.js';

// Allowed uploads: PDF, DOCX, XLSX, PNG, and JPG, at most 20 MB each
// (API_CONTRACT.md §1.8). The content is checked too, not only the name and
// declared type (ENGINEERING_STANDARDS.md §2.5).
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

interface FileType {
  extensions: string[];
  mimeTypes: string[];
  // The first bytes every file of this type starts with.
  signature: number[];
}

const ZIP = [0x50, 0x4b, 0x03, 0x04]; // DOCX and XLSX are ZIP containers.

const FILE_TYPES: FileType[] = [
  { extensions: ['pdf'], mimeTypes: ['application/pdf'], signature: [0x25, 0x50, 0x44, 0x46] },
  {
    extensions: ['docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    signature: ZIP,
  },
  {
    extensions: ['xlsx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    signature: ZIP,
  },
  {
    extensions: ['png'],
    mimeTypes: ['image/png'],
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { extensions: ['jpg', 'jpeg'], mimeTypes: ['image/jpeg'], signature: [0xff, 0xd8, 0xff] },
];

export interface UploadedFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Returns the normalized MIME type, or throws FILE_TYPE_NOT_ALLOWED or
// FILE_TOO_LARGE.
export function checkUpload(file: UploadedFileInput): string {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, 'FILE_TOO_LARGE', 'File too large');
  }
  const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';
  const type = FILE_TYPES.find(
    (t) =>
      t.extensions.includes(extension) &&
      t.mimeTypes.includes(file.mimetype) &&
      t.signature.every((byte, i) => file.buffer[i] === byte),
  );
  if (!type || file.size === 0) {
    throw new ApiException(
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      'FILE_TYPE_NOT_ALLOWED',
      'File type not allowed',
    );
  }
  return type.mimeTypes[0];
}

// Keeps only a safe display name: no path, no control characters.
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned.slice(0, 200) || 'file';
}
