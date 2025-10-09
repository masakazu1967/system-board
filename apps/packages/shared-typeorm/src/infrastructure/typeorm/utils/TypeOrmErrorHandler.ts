/**
 * TypeORM Error Handler Interface
 * DBMS固有のエラー処理を抽象化するインターフェース
 */
export interface TypeOrmErrorHandler {
  /**
   * UNIQUE制約違反エラーかどうかを判定
   */
  isUniqueConstraintError(error: unknown): boolean;

  /**
   * 外部キー制約違反エラーかどうかを判定
   */
  isForeignKeyConstraintError(error: unknown): boolean;

  /**
   * NOT NULL制約違反エラーかどうかを判定
   */
  isNotNullConstraintError(error: unknown): boolean;

  /**
   * CHECK制約違反エラーかどうかを判定
   */
  isCheckConstraintError(error: unknown): boolean;

  /**
   * デッドロックエラーかどうかを判定
   */
  isDeadlockError(error: unknown): boolean;

  /**
   * タイムアウトエラーかどうかを判定
   */
  isTimeoutError(error: unknown): boolean;

  /**
   * UNIQUE制約エラーを安全に処理（冪等性保証）
   */
  handleUniqueConstraintError(
    error: unknown,
    identifier: string,
    suppressError?: boolean,
  ): void;

  /**
   * エラー情報を整形してログ出力
   */
  logError(error: unknown, context: string): void;
}
