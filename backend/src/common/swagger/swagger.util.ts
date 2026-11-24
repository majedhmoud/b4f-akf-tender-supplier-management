import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject, OperationObject, ResponseObject } from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../../auth/auth.settings.js';

// The runtime Swagger and documentation tests share one definition. Error
// shapes reflect ApiExceptionFilter and API_CONTRACT.md §1.5; no runtime behavior changes.
export function createApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('AKF Tender and Supplier Management API')
    .setDescription(
      'See docs/05_ARCHITECTURE/API_CONTRACT.md for the accepted contract. ' +
        'Web writes need X-CSRF-Token from GET /auth/csrf. Mobile auth uses explicit JSON credentials. ' +
        'Session cookies are HttpOnly. Invisible records and unauthorized staff roles return 404. ' +
        'Errors use { error: { code, message, fields?, details, requestId } }; clients translate codes, not messages. ' +
        'Errors are private, no-store. Check status before revision, then validate fields.',
    )
    .setVersion('0.1.0')
    .addCookieAuth(ACCESS_COOKIE)
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controller, method) =>
      `${controller.replace(/Controller$/, '')}_${method}`,
  });
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.ApiErrorEnvelope = {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message', 'details', 'requestId'],
        properties: {
          code: { type: 'string', example: 'VALIDATION_FAILED' },
          message: { type: 'string', example: 'Invalid request' },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              required: ['field', 'code'],
              properties: { field: { type: 'string' }, code: { type: 'string' } },
            },
          },
          details: { type: 'object', additionalProperties: true },
          requestId: { type: 'string' },
        },
      },
    },
  };
  for (const [path, entry] of Object.entries(document.paths)) {
    for (const [method, value] of Object.entries(entry ?? {})) {
      if (!['get', 'post', 'patch', 'put', 'delete'].includes(method)) continue;
      const operation = value as OperationObject;
      const write = method !== 'get';
      const mobileAuth = path.includes('/mobile/auth/');
      const staff =
        path.includes('/employee/') ||
        path.includes('/manage/') ||
        path.includes('/signup-') ||
        path.includes('/supplier-applications');
      const session = (operation.security?.length ?? 0) > 0;
      const add = (status: number, description: string) => {
        const previous = operation.responses[String(status)];
        operation.responses[String(status)] = {
          ...(previous && !('$ref' in previous) ? previous : {}),
          description:
            previous && !('$ref' in previous) ? previous.description || description : description,
          headers: {
            'Cache-Control': { schema: { type: 'string', example: 'private, no-store' } },
          },
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ApiErrorEnvelope' } },
          },
        };
      };
      add(500, 'INTERNAL_ERROR; no internal details are returned.');
      if (operation.requestBody || operation.parameters?.length)
        add(400, 'VALIDATION_FAILED; fields identify invalid input.');
      if (session || path.endsWith('/auth/sign-in') || path.endsWith('/auth/refresh'))
        add(
          401,
          path.endsWith('/auth/sign-in')
            ? 'INVALID_CREDENTIALS.'
            : 'UNAUTHENTICATED, SESSION_EXPIRED, or SESSION_REVOKED.',
        );
      if (mobileAuth && path.endsWith('/auth/sign-in'))
        add(403, 'ACCOUNT_PENDING_SETUP or ACCOUNT_DISABLED.');
      if (write && !mobileAuth)
        add(403, 'CSRF_TOKEN_INVALID; fetch a token bound to the current session and retry once.');
      if (staff || path.includes('{tenderId}'))
        add(
          404,
          'NOT_FOUND; invisible records and unauthorized staff roles use the same response.',
        );
      if (path.endsWith('/auth/sign-in')) {
        add(429, 'RATE_LIMITED; wait Retry-After seconds before trying again.');
        (operation.responses['429'] as ResponseObject).headers!['Retry-After'] = {
          schema: { type: 'integer' },
          description: 'Seconds until another attempt is allowed.',
        };
      }
      if (
        (path.endsWith('/documents') || path.endsWith('/supplier-applications')) &&
        method === 'post'
      ) {
        add(413, 'FILE_TOO_LARGE.');
        add(415, 'FILE_TYPE_NOT_ALLOWED; file content is checked.');
      }
      // Preserve the action-specific conflict descriptions already on controllers.
      if (operation.responses['409']) add(409, 'TENDER_STATUS_CHANGED or VERSION_CONFLICT.');
      if (operation.responses['422'])
        add(
          422,
          'IDEMPOTENCY_KEY_REUSED; create a new key only for a deliberately changed action.',
        );
    }
  }
  return document;
}
