import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from './infrastructure/kafka/KafkaModule';
import { KurrentKafkaSubscriber } from './infrastructure/eventstore/KurrentKafkaSubscriber';
import { TypeOrmProcessedEventService } from './infrastructure/typeorm/TypeOrmProcessedEventService';
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
    TypeOrmProcessedEventService,
    IdempotentEventHandler,
  ],
  exports: [
    KafkaModule,
    KurrentKafkaSubscriber,
    TypeOrmProcessedEventService,
    IdempotentEventHandler,
  ],
})
export class SharedModule {}
