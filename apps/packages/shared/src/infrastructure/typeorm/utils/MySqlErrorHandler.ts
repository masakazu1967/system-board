import { Injectable } from '@nestjs/common';
import { BaseTypeOrmErrorHandler } from './BaseTypeOrmErrorHandler';

/**
 * MySQL Error Handler
 * MySQL固有のエラー処理実装
 */
@Injectable()
export class MySqlErrorHandler extends BaseTypeOrmErrorHandler {
  /**
   * MySQL UNIQUE制約違反エラーコード: ER_DUP_ENTRY
   */
  isUniqueConstraintError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.code === 'ER_DUP_ENTRY';
  }

  /**
   * MySQL FOREIGN KEY制約違反エラーコード: ER_NO_REFERENCED_ROW_2, ER_ROW_IS_REFERENCED_2
   */
  isForeignKeyConstraintError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return (
      driverError?.code === 'ER_NO_REFERENCED_ROW_2' ||
      driverError?.code === 'ER_ROW_IS_REFERENCED_2'
    );
  }

  /**
   * MySQL NOT NULL制約違反エラーコード: ER_BAD_NULL_ERROR
   */
  isNotNullConstraintError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.code === 'ER_BAD_NULL_ERROR';
  }

  /**
   * MySQL CHECK制約違反エラーコード: ER_CHECK_CONSTRAINT_VIOLATED
   */
  isCheckConstraintError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.code === 'ER_CHECK_CONSTRAINT_VIOLATED';
  }

  /**
   * MySQL デッドロックエラーコード: ER_LOCK_DEADLOCK
   */
  isDeadlockError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.code === 'ER_LOCK_DEADLOCK';
  }

  /**
   * MySQL タイムアウトエラーコード: ER_LOCK_WAIT_TIMEOUT
   */
  isTimeoutError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.code === 'ER_LOCK_WAIT_TIMEOUT';
  }
}
