import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ensureStorageDirectories, seedAllDemoData } from './seed/seed-all-demo';

async function bootstrap() {
  // Ensure local storage directories are prepared
  await ensureStorageDirectories();

  const app = await NestFactory.create(AppModule, {
    cors: false,
  });

  // WebSocket support
  app.useWebSocketAdapter(new WsAdapter(app));

  // --------------------------------------------------
  // CORS
  // --------------------------------------------------
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

  const allowedOrigins = corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header (e.g. server-to-server or curl)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Allow localhost during development
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      if (isLocalhost || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  // --------------------------------------------------
  // Security / Compression
  // --------------------------------------------------
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  app.use(compression());

  // --------------------------------------------------
  // Validation
  // --------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // --------------------------------------------------
  // Global Exception Filter
  // --------------------------------------------------
  app.useGlobalFilters(new HttpExceptionFilter());

  // --------------------------------------------------
  // API Prefix (health check excluded)
  // --------------------------------------------------
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  // --------------------------------------------------
  // Swagger
  // --------------------------------------------------
  const config = new DocumentBuilder()
    .setTitle('MarineVision AI API')
    .setDescription(
      'SIH26057 - AI-Powered Automated Underwater Marine Debris and Anomaly ' +
        'Detection System using Side-Scan Sonar Imagery. Uses high-performance ' +
        'In-Memory Store architecture (no external database required) with local file storage ' +
        'and ONNX model inference.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // --------------------------------------------------
  // Demo / Historical Data Seeding
  // --------------------------------------------------
  const autoSeed = process.env.AUTO_SEED_DEMO !== 'false';
  if (autoSeed) {
    try {
      await seedAllDemoData(app);
    } catch (seedErr: any) {
      console.error('[Seed] Warning: Demo seeding encountered an issue:', seedErr.message);
    }
  }

  // --------------------------------------------------
  // Server Port & Host
  // --------------------------------------------------
  const port = Number(process.env.PORT) || 4000;
  await app.listen(port, '0.0.0.0');

  console.log(`=======================================================`);
  console.log(`MarineVision AI backend listening on port ${port}`);
  console.log(`Host: 0.0.0.0 (deployment-ready)`);
  console.log(`Database: IN_MEMORY_STORE (no external MongoDB/Redis required)`);
  console.log(`API base path: /api`);
  console.log(`Swagger docs: /api/docs`);
  console.log(`Health check: /health or /api/health`);
  console.log(`=======================================================`);
}

bootstrap();
