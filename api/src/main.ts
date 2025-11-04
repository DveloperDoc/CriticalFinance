import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validación global DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // elimina campos no definidos en DTO
      forbidNonWhitelisted: true, // lanza error si hay extra
      transform: true,            // convierte tipos (string→number, etc.)
    }),
  );

  // CORS general (mejor controlado por ConfigModule en prod)
  app.enableCors({
    origin: ['http://localhost:19006', 'http://localhost:8081', '*'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();