/**
 * Processed Event Repository Interface
 * 処理済みイベント管理のインターフェイス
 * 冪等性保証のため
 */
export interface ProcessedEventRepository {
  /**
   * イベントが処理済みかチェック
   */
  isProcessed(eventId: string): Promise<boolean>;

  /**
   * イベントを処理済みとしてマーク
   */
  markAsProcessed(
    eventId: string,
    eventType: string,
    processedAt: Date,
  ): Promise<void>;
}
