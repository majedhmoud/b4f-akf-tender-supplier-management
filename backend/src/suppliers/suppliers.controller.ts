import {
  Body,
  UploadedFile,
  UseInterceptors,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { MAX_UPLOAD_BYTES, type UploadedFileInput } from '../storage/upload-rules.js';
import { DownloadLink } from '../tenders/dto/managed-tender.dto.js';
import { RequireRole } from '../auth/require-role.guard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import {
  SupplierPage,
  SupplierProfile,
  SupplierProfileUpdateDto,
  SupplierQueryDto,
  SupplierStatusResult,
} from './dto/supplier.dto.js';
import { SuppliersService } from './suppliers.service.js';

// P1–P2: the signed-in supplier's own profile.
@ApiTags('Suppliers')
@ApiCookieAuth()
@RequireRole('supplier')
@Controller('me/supplier-profile')
export class SupplierProfileController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @ApiOkResponse({ type: SupplierProfile })
  get(@CurrentUser() user: AuthenticatedUser): Promise<SupplierProfile> {
    return this.suppliers.ownProfile(user.id);
  }

  @Put()
  @ApiBody({ type: SupplierProfileUpdateDto })
  @ApiOkResponse({ type: SupplierProfile, description: 'Or 400 FIELD_NOT_EDITABLE' })
  @ApiConflictResponse({ description: 'REGISTRATION_NUMBER_EXISTS' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<SupplierProfile> {
    return this.suppliers.updateOwnProfile(user.id, body, req.requestId);
  }

  // P3: replaces a sign-up certificate; the reviewed original stays on the application.
  @Post('documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['kind', 'language', 'file'],
      properties: {
        kind: { type: 'string', enum: ['registration_certificate', 'tax_certificate'] },
        language: { type: 'string', example: 'ar' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: SupplierProfile })
  replaceDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @UploadedFile() file: UploadedFileInput | undefined,
    @Req() req: Request,
  ): Promise<SupplierProfile> {
    return this.suppliers.replaceCertificate(user.id, body, file, req.requestId);
  }

  // P3d: a signed link to one of the files the profile lists.
  @Get('documents/:docId/download')
  @ApiOkResponse({ type: DownloadLink })
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('docId', ParseUUIDPipe) docId: string,
  ): Promise<DownloadLink> {
    return this.suppliers.download(user.id, docId);
  }
}

// P4–P5: the admin's supplier directory, and suspend or reactivate.
@ApiTags('Suppliers')
@ApiCookieAuth()
@RequireRole('admin')
@Controller('admin/suppliers')
export class AdminSuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @ApiOkResponse({ type: SupplierPage })
  list(@Query() query: SupplierQueryDto): Promise<SupplierPage> {
    return this.suppliers.list(query);
  }

  @Post(':supplierId/suspend')
  @HttpCode(200)
  @ApiOkResponse({ type: SupplierStatusResult })
  suspend(
    @Param('supplierId', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<SupplierStatusResult> {
    return this.suppliers.setStatus(id, 'suspended', user.id, req.requestId);
  }

  @Post(':supplierId/reactivate')
  @HttpCode(200)
  @ApiOkResponse({ type: SupplierStatusResult })
  reactivate(
    @Param('supplierId', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<SupplierStatusResult> {
    return this.suppliers.setStatus(id, 'active', user.id, req.requestId);
  }
}
