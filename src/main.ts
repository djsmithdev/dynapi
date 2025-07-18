import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 4000;
  
  // Security configurations - disable CORS-related headers to let SecurityMiddleware handle CORS
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    crossOriginOpenerPolicy: false,  // Disable to allow SecurityMiddleware to handle CORS
    crossOriginResourcePolicy: false,  // Disable to allow SecurityMiddleware to handle CORS
  }));

  // Enable CORS with specific origins
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:4001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    disableErrorMessages: process.env.NODE_ENV === 'production',
  }));

  // Trust proxy if behind reverse proxy (Express specific)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);
  
  await app.listen(port);
  Logger.log(`🚀 DynAPI running securely on: http://localhost:${port}`);
  Logger.log(`🔒 All API endpoints require authentication: http://localhost:${port}/api`);
  Logger.log(`📊 Secure database access available at: http://localhost:${port}/api/tables`);
}

bootstrap(); 