import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from './infrastructure/kafka/KafkaModule';
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
    TypeOrmProcessedEventService,
    IdempotentEventHandler,
  ],
  exports: [KafkaModule, TypeOrmProcessedEventService, IdempotentEventHandler],
})
export class SharedModule {}
