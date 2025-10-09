// shared/infrastructure/event-store/kurrent.module.ts
import { Module, Global, DynamicModule } from '@nestjs/common';
import { loadKurrentConfig } from './KurrentConfig';
import { KurrentDBClient } from '@kurrent/kurrentdb-client';

export const KURRENT_WRITE_CLIENT = 'KURRENT_WRITE_CLIENT';
export const KURRENT_READ_CLIENT = 'KURRENT_READ_CLIENT';

@Global()
@Module({})
export class KurrentModule {
  static forRoot(): DynamicModule {
    return {
      module: KurrentModule,
      providers: [
        {
          provide: KURRENT_WRITE_CLIENT,
          useFactory: () => {
            const config = loadKurrentConfig();

            if (config.nodes) {
              // クラスタ構成
              return KurrentDBClient.connectionString(
                `kurrentdb://${config.nodes.map((n: { host: string; port: number }) => `${n.host}:${n.port}`).join(',')}` +
                  `?tls=false&nodePreference=leader`,
              );
            } else {
              // 単一ノード構成
              return KurrentDBClient.connectionString(config.connectionString!);
            }
          },
        },
        {
          provide: KURRENT_READ_CLIENT,
          useFactory: () => {
            const config = loadKurrentConfig();
            const readReplicas = process.env.KURRENT_READ_REPLICAS_URL;

            if (readReplicas) {
              // 本番：読み取り専用レプリカへ接続
              return KurrentDBClient.connectionString(
                `${readReplicas}?nodePreference=follower`,
              );
            } else if (config.nodes) {
              // クラスタだが読み取り専用レプリカなし
              return KurrentDBClient.connectionString(
                `kurrentdb://${config.nodes.map((n: { host: string; port: number }) => `${n.host}:${n.port}`).join(',')}` +
                  `?tls=false&nodePreference=follower`,
              );
            } else {
              // 開発：書き込みクライアントと同じ
              return KurrentDBClient.connectionString(config.connectionString!);
            }
          },
        },
      ],
      exports: [KURRENT_WRITE_CLIENT, KURRENT_READ_CLIENT],
    };
  }
}
