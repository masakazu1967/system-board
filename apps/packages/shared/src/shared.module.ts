import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from './infrastructure/kafka/kafka.module';
import { KurrentKafkaSubscriber } from './infrastructure/eventstore/KurrentKafkaSubscriber';
import { PostgreSQLProcessedEventService } from './infrastructure/postgres/PostgreSQLProcessedEventService';
import { IdempotentEventHandler } from './application/base/IdempotentEventHandler';

/**
 * Shared Module
 * 共有パッケージのメインモジュール
 * イベントソーシング + CQRS インフラストラクチャを提供
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    KafkaModule,
  ],
  providers: [
    // Event Infrastructure
    KurrentKafkaSubscriber,
    PostgreSQLProcessedEventService,
    IdempotentEventHandler,
  ],
  exports: [
    KafkaModule,
    KurrentKafkaSubscriber,
    PostgreSQLProcessedEventService,
    IdempotentEventHandler,
  ],
})
export class SharedModule {}
