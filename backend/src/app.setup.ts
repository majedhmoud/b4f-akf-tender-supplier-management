import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { validationExceptionFactory } from './common/errors/validation-exception.factory.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { requestIdMiddleware } from './common/http/request-id.middleware.js';

// Everything the app needs at runtime, shared by main.ts and the API tests so
// they test the same app.
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  // Every endpoint lives under /api/v1. See ENGINEERING_STANDARDS.md §7.
  app.setGlobalPrefix('api/v1');

  app.use(requestIdMiddleware);
  app.use(cookieParser());

  // Only the web app's exact origin may call the API with cookies.
  // See API_CONTRACT.md §1.1.
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN', 'http://localhost:3000'),
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key', 'Accept-Language'],
    exposedHeaders: ['X-Request-Id', 'Retry-After', 'Idempotent-Replayed'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
}
