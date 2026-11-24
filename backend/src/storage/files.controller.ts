import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { notFound } from '../auth/access.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import { FileStorage } from './file-storage.js';
import { SignedUrlService } from './signed-url.service.js';

// Serves a file through a signed URL that a download endpoint issued after its
// access check. Public because the signature is the permission; an invalid or
// expired URL answers 404 (ADR 0006). Not listed in Swagger: clients never
// build these URLs themselves.
@ApiExcludeController()
@Public()
@Controller('files')
export class FilesController {
  constructor(
    private readonly storage: FileStorage,
    private readonly signedUrls: SignedUrlService,
  ) {}

  @Get(':key')
  download(
    @Param('key') key: string,
    @Query('name') name: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const valid =
      this.storage.isValidKey(key) &&
      typeof name === 'string' &&
      this.signedUrls.isValid(key, name, String(expires), String(signature));
    if (!valid) throw notFound();

    // Signed URLs are never cached (API_CONTRACT.md §1.2).
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(this.storage.read(key), {
      type: 'application/octet-stream',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    });
  }
}
