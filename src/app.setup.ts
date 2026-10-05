import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Shared by main.ts and the e2e tests, so both run the exact same pipeline. */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    // Providers add fields over time: unknown fields are stripped, not rejected.
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const config = new DocumentBuilder()
    .setTitle('Unified Inbox API')
    .setDescription('One inbox for guest messages coming from email, SMS and WhatsApp.')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
