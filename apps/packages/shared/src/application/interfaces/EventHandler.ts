import { DomainEvent } from '../../domain/base/DomainEvent';

/**
 * Event Handler Interface
 * ドメインイベントハンドラーのインターフェイス
 */
export interface EventHandler<T extends DomainEvent = DomainEvent> {
  /**
   * イベントを処理
   */
  handle(event: T): Promise<void>;
}
