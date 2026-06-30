import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // All endpoints live under /api so nginx can reverse-proxy a single prefix.
  app.setGlobalPrefix('api');

  // Parse cookies so the AuthGuard can read the httpOnly session cookie.
  app.use(cookieParser());

  // Reject unknown properties and coerce DTO types globally; the backend is the
  // authoritative validator (client-side validation alone is insufficient).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.BACKEND_PORT ?? 3000);
  await app.listen(port);
}
void bootstrap();
