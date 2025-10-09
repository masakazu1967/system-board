import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
  ],
  providers: [IdempotentEventHandler],
  exports: [IdempotentEventHandler],
})
export class SharedModule {}
