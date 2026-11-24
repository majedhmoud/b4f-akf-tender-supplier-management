import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { createApiDocument } from './common/swagger/swagger.util.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  configureApp(app);

  SwaggerModule.setup('api/docs', app, () => createApiDocument(app), {
    jsonDocumentUrl: 'api/docs-json',
  });

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  logger.log(`API on http://localhost:${port}/api/v1, Swagger at /api/docs`);
}

await bootstrap();
