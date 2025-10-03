import { EventHandler } from './EventHandler';

/**
 * Event Subscriber Interface
 * イベントサブスクライバーのインターフェイス
 */
export interface EventSubscriber {
  /**
   * イベントタイプに対してハンドラーを登録
   */
  subscribe(eventType: string, handler: EventHandler): void;
}
