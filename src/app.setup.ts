import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { resolve } from 'node:path';
import { UPLOADS_URL_PREFIX } from './common/constants/uploads.constants.js';

export function configureApp(app: NestExpressApplication): void {
  const configService = app.get(ConfigService);

  app.enableCors();
  // Article HTML from the editor can exceed Express's 100kb default.
  app.useBodyParser('json', { limit: '2mb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useStaticAssets(resolve(configService.getOrThrow<string>('UPLOAD_DIR')), {
    prefix: `${UPLOADS_URL_PREFIX}/`,
    index: false,
    dotfiles: 'deny',
    maxAge: '30d',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });
}

export function setupSwagger(app: NestExpressApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Epoch API')
    .setDescription('Epoch backend REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup(
    'docs',
    app,
    () => SwaggerModule.createDocument(app, config),
    {
      swaggerOptions: { persistAuthorization: true },
    },
  );
}
