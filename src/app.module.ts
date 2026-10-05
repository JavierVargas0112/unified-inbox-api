import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationsModule } from './conversations/conversations.module';
import { buildDataSourceOptions } from './database/typeorm.config';
import { HealthController } from './health/health.controller';
import { IngestionModule } from './ingestion/ingestion.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useFactory: () => buildDataSourceOptions() }),
    IngestionModule,
    ConversationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
