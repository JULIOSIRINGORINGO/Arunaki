import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { AuthGuard } from './modules/security/auth.guard.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('Starting bootstrap...');
  try {
    logger.log('Creating NestFactory...');
    const app = await NestFactory.create(AppModule);
    logger.log('NestFactory created');
    
    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalGuards(new AuthGuard());

    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:5173', 'http://127.0.0.1:5173'];

    app.enableCors({
      origin: allowedOrigins,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });

    const port = process.env.PORT ?? 3000;
    await app.listen(port, '127.0.0.1');
    logger.log(`Application running on port ${port}`);
  } catch (error) {
    logger.error('Failed to bootstrap application:', error);
    process.exit(1);
  }
}
void bootstrap();
