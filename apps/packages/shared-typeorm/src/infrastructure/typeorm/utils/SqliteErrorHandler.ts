import { Injectable } from '@nestjs/common';
import { BaseTypeOrmErrorHandler } from './BaseTypeOrmErrorHandler';

/**
 * SQLite Error Handler
 * SQLite/better-sqlite3固有のエラー処理実装
 */
@Injectable()
export class SqliteErrorHandler extends BaseTypeOrmErrorHandler {
  /**
   * SQLite UNIQUE制約違反エラー: メッセージに"UNIQUE constraint failed"を含む
   */
  isUniqueConstraintError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.message?.includes('UNIQUE constraint failed') ?? false;
  }

  /**
   * SQLite FOREIGN KEY制約違反エラー: メッセージに"FOREIGN KEY constraint failed"を含む
   */
  isForeignKeyConstraintError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return (
      driverError?.message?.includes('FOREIGN KEY constraint failed') ?? false
    );
  }

  /**
   * SQLite NOT NULL制約違反エラー: メッセージに"NOT NULL constraint failed"を含む
   */
  isNotNullConstraintError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return (
      driverError?.message?.includes('NOT NULL constraint failed') ?? false
    );
  }

  /**
   * SQLite CHECK制約違反エラー: メッセージに"CHECK constraint failed"を含む
   */
  isCheckConstraintError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.message?.includes('CHECK constraint failed') ?? false;
  }

  /**
   * SQLite デッドロック/ロックエラー: メッセージに"database is locked"を含む
   */
  isDeadlockError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.message?.includes('database is locked') ?? false;
  }

  /**
   * SQLite タイムアウトエラー: SQLiteは明示的なタイムアウトエラーコードがない
   */
  isTimeoutError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    // SQLiteではタイムアウトはロックエラーとして扱われることが多い
    return driverError?.message?.includes('database is locked') ?? false;
  }
}
