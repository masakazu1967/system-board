import {
  DynamicModule,
  Module,
  Provider,
  OnModuleDestroy,
  Global,
} from '@nestjs/common';
import { EventStoreDBClient } from '@eventstore/db-client';

/**
 * Kurrent Module Options Interface
 */
export interface KurrentModuleOptions {
  connectionString: string;
}

/**
 * Kurrent Module Async Options Interface
 */
export interface KurrentModuleAsyncOptions {
  imports?: any[];
  useFactory?: (
    ...args: any[]
  ) => Promise<KurrentModuleOptions> | KurrentModuleOptions;
  inject?: any[];
}

/**
 * EventStoreDB Client Service
 * ライフサイクル管理を提供
 */
class EventStoreDBClientService implements OnModuleDestroy {
  constructor(private readonly client: EventStoreDBClient) {}

  getClient(): EventStoreDBClient {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.dispose();
  }
}

/**
 * Kurrent Module
 * EventStoreDBClientを構築・提供するNestJSモジュール
 * TypeOrmModuleと同様のAPIを提供
 *
 * @example
 * ```typescript
 * // Sync registration
 * KurrentModule.forRoot({
 *   connectionString: 'esdb://localhost:2113?tls=false'
 * })
 *
 * // Async registration with ConfigService
 * KurrentModule.forRootAsync({
 *   imports: [ConfigModule],
 *   useFactory: (configService: ConfigService) => ({
 *     connectionString: configService.get('EVENTSTORE_CONNECTION_STRING')
 *   }),
 *   inject: [ConfigService]
 * })
 *
 * // Usage in repository
 * @Injectable()
 * export class MyRepository {
 *   constructor(private readonly client: EventStoreDBClient) {}
 * }
 * ```
 */
@Global()
@Module({})
export class KurrentModule {
  /**
   * 同期的にモジュールを登録
   */
  static forRoot(options: KurrentModuleOptions): DynamicModule {
    const serviceProvider: Provider = {
      provide: EventStoreDBClientService,
      useFactory: () => {
        const client = EventStoreDBClient.connectionString(
          options.connectionString,
        );
        return new EventStoreDBClientService(client);
      },
    };

    const clientProvider: Provider = {
      provide: EventStoreDBClient,
      useFactory: (service: EventStoreDBClientService) => service.getClient(),
      inject: [EventStoreDBClientService],
    };

    return {
      module: KurrentModule,
      providers: [serviceProvider, clientProvider],
      exports: [clientProvider],
    };
  }

  /**
   * 非同期的にモジュールを登録
   * ConfigServiceなどの他のプロバイダーに依存する場合に使用
   */
  static forRootAsync(options: KurrentModuleAsyncOptions): DynamicModule {
    const serviceProvider: Provider = {
      provide: EventStoreDBClientService,
      useFactory: async (...args: any[]) => {
        const moduleOptions = await options.useFactory?.(...args);
        if (!moduleOptions) {
          throw new Error('KurrentModule options are required');
        }

        const client = EventStoreDBClient.connectionString(
          moduleOptions.connectionString,
        );
        return new EventStoreDBClientService(client);
      },
      inject: options.inject || [],
    };

    const clientProvider: Provider = {
      provide: EventStoreDBClient,
      useFactory: (service: EventStoreDBClientService) => service.getClient(),
      inject: [EventStoreDBClientService],
    };

    return {
      module: KurrentModule,
      imports: options.imports || [],
      providers: [serviceProvider, clientProvider],
      exports: [clientProvider],
    };
  }
}
