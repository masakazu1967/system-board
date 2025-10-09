import { Module } from '@nestjs/common';
import { KafkaModule } from './infrastructure/kafka/KafkaModule';

/**
 * Shared Kafka Module
 * 共有 Kafka パッケージのメインモジュール
 * イベントソーシング + CQRS インフラストラクチャを提供
 */
@Module({
  imports: [KafkaModule],
  exports: [KafkaModule],
})
export class SharedKafkaModule {}
