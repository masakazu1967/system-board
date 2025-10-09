import { Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { TypeOrmErrorHandler } from './TypeOrmErrorHandler';

/**
 * Base TypeORM Error Handler
 * DBMS固有のエラー処理の基底クラス
 */
export abstract class BaseTypeOrmErrorHandler implements TypeOrmErrorHandler {
  protected readonly logger = new Logger(this.constructor.name);

  abstract isUniqueConstraintError(error: unknown): boolean;
  abstract isForeignKeyConstraintError(error: unknown): boolean;
  abstract isNotNullConstraintError(error: unknown): boolean;
  abstract isCheckConstraintError(error: unknown): boolean;
  abstract isDeadlockError(error: unknown): boolean;
  abstract isTimeoutError(error: unknown): boolean;

  /**
   * QueryFailedErrorからドライバーエラーを取得
   */
  protected getDriverError(
    error: unknown,
  ): { code?: string; message?: string } | null {
    if (!(error instanceof QueryFailedError)) {
      return null;
    }
    return error.driverError as { code?: string; message?: string };
  }

  /**
   * UNIQUE制約エラーを安全に処理（冪等性保証）
   */
  handleUniqueConstraintError(
    error: unknown,
    identifier: string,
    suppressError = true,
  ): void {
    if (this.isUniqueConstraintError(error)) {
      this.logger.debug(
        `UNIQUE constraint violation for ${identifier}, suppressing error (idempotency)`,
      );
      if (!suppressError) {
        throw error;
      }
      return;
    }
    throw error;
  }

  /**
   * エラー情報を整形してログ出力
   */
  logError(error: unknown, context: string): void {
    if (error instanceof QueryFailedError) {
      const driverError = this.getDriverError(error);
      this.logger.error(`[${context}] TypeORM Query Failed`, {
        query: error.query,
        parameters: error.parameters,
        driverCode: driverError?.code,
        driverMessage: driverError?.message,
      });
    } else if (error instanceof Error) {
      this.logger.error(`[${context}] Error: ${error.message}`, error.stack);
    } else {
      this.logger.error(`[${context}] Unknown error`, error);
    }
  }
}
