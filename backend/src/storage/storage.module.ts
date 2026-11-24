import { Module } from '@nestjs/common';
import { FileStorage } from './file-storage.js';
import { FilesController } from './files.controller.js';
import { SignedUrlService } from './signed-url.service.js';

// File storage is a shared service, not a domain module (ERD, Extension).
@Module({
  controllers: [FilesController],
  providers: [FileStorage, SignedUrlService],
  exports: [FileStorage, SignedUrlService],
})
export class StorageModule {}
