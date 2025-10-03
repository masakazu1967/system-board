import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KurrentDBClient } from './KurrentDBClient';
import { EventStoreDBKurrentClient } from './EventStoreDBKurrentClient';

/**
 * Kurrent DB Client Provider Token
 */
export const KURRENT_DB_CLIENT = Symbol('KURRENT_DB_CLIENT');

/**
 * Kurrent DB Client Provider Factory
 * 環境変数から接続文字列を取得してEventStoreDBクライアントを生成
 */
export const kurrentDbClientProvider: Provider = {
  provide: KURRENT_DB_CLIENT,
  useFactory: (configService: ConfigService): KurrentDBClient => {
    const connectionString =
      configService.get<string>('EVENTSTORE_CONNECTION_STRING') ||
      configService.get<string>('KURRENT_CONNECTION_STRING') ||
      'esdb://localhost:2113?tls=false'; // デフォルト: ローカル開発環境

    return new EventStoreDBKurrentClient(connectionString);
  },
  inject: [ConfigService],
};

/**
 * Kurrent DB Module用のProviderリスト
 */
export const kurrentDbProviders: Provider[] = [kurrentDbClientProvider];
