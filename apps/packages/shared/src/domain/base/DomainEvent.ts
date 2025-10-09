import { randomUUID } from 'crypto';

/**
 * Domain Event Base Class
 * すべてのドメインイベントの基底クラス
 * Event Sourcing + CQRS アーキテクチャの中核
 */
export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly eventType: string;
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly aggregateVersion: number;
  public readonly occurredOn: Date;
  public readonly correlationId: string;
  public readonly causationId?: string;

  constructor(
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    aggregateVersion: number,
    correlationId: string,
    causationId?: string,
  ) {
    this.eventId = randomUUID();
    this.eventType = eventType;
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
    this.aggregateVersion = aggregateVersion;
    this.occurredOn = new Date();
    this.correlationId = correlationId;
    this.causationId = causationId;
  }

  /**
   * イベントデータを取得
   * 各具象イベントクラスで実装
   */
  abstract getData(): unknown;
}
