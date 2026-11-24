import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ApiException, ErrorCode } from '../errors/api-exception.js';
import { PRIVATE_NO_STORE } from '../http/cache-control.js';

// Codes for errors that Nest or a library throws, rather than our code.
const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'FILE_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'FILE_TYPE_NOT_ALLOWED',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

// Shapes every error into the contract's envelope:
// { error: { code, message, fields, details, requestId } }.
// See API_CONTRACT.md §1.5 and ENGINEERING_STANDARDS.md §6.3.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let fields: ApiException['fields'];
    let details: ApiException['details'];

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      fields = exception.fields;
      details = exception.details;
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = 'RATE_LIMITED';
      message = 'Too many requests';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_CODES[status] ?? 'INTERNAL_ERROR';
      message = exception.message;
    } else {
      // Never leak internals: log the stack, return a generic message.
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    // An error is never cached, even on a public endpoint (API_CONTRACT.md §1.2).
    response.setHeader('Cache-Control', PRIVATE_NO_STORE);
    response.status(status).json({
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
        details: details ?? {},
        requestId: request.requestId,
      },
    });
  }
}
