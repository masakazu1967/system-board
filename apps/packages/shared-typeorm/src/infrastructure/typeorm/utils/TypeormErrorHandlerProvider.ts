import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmErrorHandler } from './TypeOrmErrorHandler';
import { PostgresErrorHandler } from './PostgresErrorHandler';
import { MySqlErrorHandler } from './MySqlErrorHandler';
import { SqliteErrorHandler } from './SqliteErrorHandler';

/**
 * TypeORM Error Handler Provider Token
 */
export const TYPEORM_ERROR_HANDLER = Symbol('TYPEORM_ERROR_HANDLER');

/**
 * TypeORM Error Handler Provider Factory
 * 環境変数からDBMS種別を判定して適切なエラーハンドラーを提供
 */
export const typeOrmErrorHandlerProvider: Provider = {
  provide: TYPEORM_ERROR_HANDLER,
  useFactory: (configService: ConfigService): TypeOrmErrorHandler => {
    // 環境変数 DATABASE_TYPE または TYPEORM_TYPE から DBMS 種別を取得
    const dbType =
      configService.get<string>('DATABASE_TYPE') ||
      configService.get<string>('TYPEORM_TYPE') ||
      'postgres'; // デフォルトは PostgreSQL

    switch (dbType.toLowerCase()) {
      case 'postgres':
      case 'postgresql':
        return new PostgresErrorHandler();

      case 'mysql':
      case 'mariadb':
        return new MySqlErrorHandler();

      case 'sqlite':
      case 'better-sqlite3':
        return new SqliteErrorHandler();

      default:
        // デフォルトは PostgreSQL
        return new PostgresErrorHandler();
    }
  },
  inject: [ConfigService],
};

/**
 * TypeORM Error Handler Module用のProviderリスト
 */
export const typeOrmErrorHandlerProviders: Provider[] = [
  typeOrmErrorHandlerProvider,
  PostgresErrorHandler,
  MySqlErrorHandler,
  SqliteErrorHandler,
];
