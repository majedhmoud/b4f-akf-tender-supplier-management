import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CsrfService } from '../auth/csrf.service.js';
import { RequireRole } from '../auth/require-role.guard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { PublicCache } from '../common/http/cache-control.js';
import { MAX_UPLOAD_BYTES, type UploadedFileInput } from '../storage/upload-rules.js';
import { DownloadLink } from '../tenders/dto/managed-tender.dto.js';
import {
  AdminSignupRequestView,
  ApplicationPage,
  LegalApplicationView,
  PendingSignupQueryDto,
  RaisedSignupQueryDto,
  SignupAcceptResult,
  SignupReviewDto,
  SignupReviewResult,
  SubmittedApplication,
  SupplierApplicationForm,
} from './dto/supplier-application.dto.js';
import { GuestApplicationGuard } from './guest-application.guard.js';
import { SupplierSignUpService } from './supplier-sign-up.service.js';

@ApiTags('Reference')
@Controller('reference/forms')
export class SignupFormController {
  constructor(private readonly signup: SupplierSignUpService) {}
  @Public()
  @PublicCache()
  @Get('supplier-application')
  @ApiOkResponse({ type: SupplierApplicationForm })
  form(): SupplierApplicationForm {
    return this.signup.form();
  }
}
@ApiTags('Sign-up')
@Controller('supplier-applications')
export class SupplierApplicationsController {
  constructor(
    private readonly signup: SupplierSignUpService,
    private readonly csrf: CsrfService,
  ) {}
  @Public()
  // A public file upload: 5 applications a minute per IP by default
  // (ENGINEERING_STANDARDS.md §2.4). Tests raise it with APPLICATION_RATE_LIMIT.
  @Throttle({
    default: { limit: () => Number(process.env.APPLICATION_RATE_LIMIT ?? 5), ttl: 60_000 },
  })
  @UseGuards(GuestApplicationGuard, ThrottlerGuard)
  @ApiTooManyRequestsResponse({ description: 'RATE_LIMITED, with Retry-After' })
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'files[registration_certificate]', maxCount: 1 },
        { name: 'files[tax_certificate]', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_UPLOAD_BYTES, files: 2, fields: 10 } },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID per action; reuse on retries from the same browser.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'application',
        'files[registration_certificate]',
        'languages[registration_certificate]',
        'files[tax_certificate]',
        'languages[tax_certificate]',
      ],
      properties: {
        application: {
          type: 'string',
          example:
            '{"legalName":"Al-Noor Engineering","registrationNumber":"CR-88231","contactEmail":"info@alnoor.example","preferredLanguage":"ar"}',
        },
        'files[registration_certificate]': { type: 'string', format: 'binary' },
        'languages[registration_certificate]': { type: 'string', example: 'ar' },
        'files[tax_certificate]': { type: 'string', format: 'binary' },
        'languages[tax_certificate]': { type: 'string', example: 'ar' },
      },
    },
  })
  @ApiCreatedResponse({ type: SubmittedApplication })
  @ApiConflictResponse({ description: 'REGISTRATION_NUMBER_EXISTS or IDEMPOTENCY_IN_PROGRESS' })
  @ApiUnprocessableEntityResponse({ description: 'IDEMPOTENCY_KEY_REUSED' })
  async submit(
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: Record<string, UploadedFileInput[]> | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SubmittedApplication> {
    const result = await this.signup.submit(
      body ?? {},
      files ?? {},
      this.csrf.guestScope(req),
      key,
      req.requestId,
    );
    if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
    return result.body;
  }
}
@ApiTags('Sign-up')
@ApiCookieAuth()
@RequireRole('legal_committee')
@Controller('supplier-applications')
export class LegalApplicationsController {
  constructor(private readonly signup: SupplierSignUpService) {}
  @Get(':applicationId')
  @ApiOkResponse({ type: LegalApplicationView })
  detail(@Param('applicationId', ParseUUIDPipe) id: string): Promise<LegalApplicationView> {
    return this.signup.legalDetail(id);
  }
  @Get(':applicationId/documents/:docId/download')
  @ApiOkResponse({ type: DownloadLink })
  download(
    @Param('applicationId', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.signup.download(id, docId);
  }
  @Post(':applicationId/review')
  @ApiBody({ type: SignupReviewDto })
  @ApiCreatedResponse({ type: SignupReviewResult })
  @ApiConflictResponse({ description: 'ALREADY_SUBMITTED, with the saved decision in details' })
  review(
    @Param('applicationId', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<SignupReviewResult> {
    return this.signup.review(id, user.id, body, req.requestId);
  }
}
@ApiTags('Sign-up')
@ApiCookieAuth()
@RequireRole('legal_committee')
@Controller('signup-reviews')
export class SignupReviewsController {
  constructor(private readonly signup: SupplierSignUpService) {}
  @Get()
  @ApiOkResponse({ type: ApplicationPage })
  list(@Query() query: PendingSignupQueryDto): Promise<ApplicationPage> {
    return this.signup.pending(query);
  }
}
@ApiTags('Sign-up')
@ApiCookieAuth()
@RequireRole('admin')
@Controller('signup-requests')
export class SignupRequestsController {
  constructor(private readonly signup: SupplierSignUpService) {}
  @Get()
  @ApiOkResponse({ type: ApplicationPage })
  list(@Query() query: RaisedSignupQueryDto): Promise<ApplicationPage> {
    return this.signup.raised(query);
  }
  @Get(':applicationId')
  @ApiOkResponse({ type: AdminSignupRequestView })
  detail(@Param('applicationId', ParseUUIDPipe) id: string): Promise<AdminSignupRequestView> {
    return this.signup.adminDetail(id);
  }
  // U7: creates the supplier and its pending account, and emails the setup link.
  @Post(':applicationId/accept')
  @HttpCode(200)
  @ApiOkResponse({ type: SignupAcceptResult })
  @ApiConflictResponse({
    description:
      'ALREADY_ACCEPTED (details.supplierId), EMAIL_ALREADY_REGISTERED, or REGISTRATION_NUMBER_EXISTS',
  })
  accept(
    @Param('applicationId', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<SignupAcceptResult> {
    return this.signup.accept(id, user.id, req.requestId);
  }
}
