import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmProcessedEventService } from './infrastructure/typeorm/TypeOrmProcessedEventService';

/**
 * Shared TypeOrm Module
 * 共有 TypeOrm パッケージのメインモジュール
 * イベントソーシング + CQRS インフラストラクチャを提供
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [TypeOrmProcessedEventService],
  exports: [TypeOrmProcessedEventService],
})
export class SharedTypeOrmModule {}
