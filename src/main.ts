import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: '*', credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      validationError: { target: false },
    }),
  );
  const config = new DocumentBuilder()
    .setTitle('TrustyDust Backend API')
    .setDescription(
      'Full API surface for auth, social, trust, tier, ZK, jobs, and blockchain flows',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'backend-jwt',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  app.useStaticAssets(join(__dirname, '..', 'public'));
  SwaggerModule.setup('/api/docs', app, document, {
    customSiteTitle: 'TrustyDust API Docs',
    swaggerOptions: { persistAuthorization: true },
    customfavIcon: 'https://unpkg.com/swagger-ui-dist@5.10.5/favicon-32x32.png',
    customJs: [
      'https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js',
      'https://unpkg.com/swagger-ui-dist/swagger-ui-standalone-preset.js',
    ],
    customCssUrl: 'https://unpkg.com/swagger-ui-dist/swagger-ui.css',
  });

  console.log(`running on port http://localhost:${process.env.PORT}`);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
