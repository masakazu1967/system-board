import { DomainEvent } from '../../domain/base/DomainEvent';

/**
 * Event Publisher Interface
 * イベントパブリッシャーのインターフェイス
 * Kafkaへのイベント配信を抽象化
 */
export interface EventPublisher {
  /**
   * 単一イベントを発行
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * 複数イベントを発行
   */
  publishAll(events: DomainEvent[]): Promise<void>;
}
