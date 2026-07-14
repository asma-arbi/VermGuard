import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS — explicitly allow x-role custom header from Angular frontend
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'x-role'],
  });

  // Validation pipe globale
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Configuration de Swagger
  const config = new DocumentBuilder()
    .setTitle('VermGuard API')
    .setDescription(
      "Documentation de l'API de VermGuard pour le suivi des tickets ouverts assignés aux analystes SOC et agents Support.",
    )
    .setVersion('1.0')
    .addTag('Users')
    .addTag('Jira')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`L'application est lancée sur : http://localhost:${port}`);
  console.log(`Documentation Swagger disponible sur : http://localhost:${port}/api`);
}
bootstrap();
