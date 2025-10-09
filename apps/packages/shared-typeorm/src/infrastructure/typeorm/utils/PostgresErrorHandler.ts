import { Injectable } from '@nestjs/common';
import { BaseTypeOrmErrorHandler } from './BaseTypeOrmErrorHandler';

/**
 * PostgreSQL Error Handler
 * PostgreSQL固有のエラー処理実装
 */
@Injectable()
export class PostgresErrorHandler extends BaseTypeOrmErrorHandler {
  /**
   * PostgreSQL UNIQUE制約違反エラーコード: 23505
   */
  isUniqueConstraintError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.code === '23505';
  }

  /**
   * PostgreSQL FOREIGN KEY制約違反エラーコード: 23503
   */
  isForeignKeyConstraintError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.code === '23503';
  }

  /**
   * PostgreSQL NOT NULL制約違反エラーコード: 23502
   */
  isNotNullConstraintError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.code === '23502';
  }

  /**
   * PostgreSQL CHECK制約違反エラーコード: 23514
   */
  isCheckConstraintError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.code === '23514';
  }

  /**
   * PostgreSQL デッドロックエラーコード: 40P01
   */
  isDeadlockError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.code === '40P01';
  }

  /**
   * PostgreSQL タイムアウトエラーコード: 57014 (query_canceled), 57P01 (statement_timeout)
   */
  isTimeoutError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.code === '57014' || driverError?.code === '57P01';
  }
}
