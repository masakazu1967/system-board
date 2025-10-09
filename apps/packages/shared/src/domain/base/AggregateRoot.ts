import { DomainEvent } from './DomainEvent';
import { Entity, EntityId } from './Entity';

/**
 * Aggregate ID Base Class
 * 集約IDの基底クラス
 */
export abstract class AggregateId extends EntityId {
  constructor(value: string) {
    super(value);
  }
}

/**
 * Aggregate Root Base Class
 * 集約ルートの基底クラス
 * Event Sourcing パターンの実装
 */
export abstract class AggregateRoot<T extends AggregateId> extends Entity<T> {
  private _version: number = 0;
  private _uncommittedEvents: DomainEvent[] = [];

  constructor(aggregateId: T) {
    super(aggregateId);
  }

  /**
   * 集約のバージョンを取得
   */
  public getVersion(): number {
    return this._version;
  }

  /**
   * 未コミットのイベントを取得
   */
  public getUncommittedEvents(): DomainEvent[] {
    return [...this._uncommittedEvents];
  }

  /**
   * イベントをコミット済みとしてマーク
   */
  public markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }

  /**
   * イベント履歴から集約を再構築
   * Event Sourcing: イベントリプレイ
   */
  public loadFromHistory(events: DomainEvent[]): void {
    events.forEach((event) => {
      this.applyEvent(event, false);
    });
  }

  /**
   * イベントを適用
   * @param event ドメインイベント
   * @param isNew 新規イベントかどうか（未コミットリストに追加するか）
   */
  protected applyEvent(event: DomainEvent, isNew: boolean = true): void {
    // 具象クラスのイベントハンドラーを呼び出し
    this.applyDomainEvent(event);

    // バージョンをインクリメント
    this.incrementVersion();

    // 新規イベントの場合、未コミットリストに追加
    if (isNew) {
      this._uncommittedEvents.push(event);
    }
  }

  /**
   * イベントを追加（外部から呼び出し可能）
   */
  protected addEvent(event: DomainEvent): void {
    this.applyEvent(event, true);
  }

  /**
   * バージョンをインクリメント
   */
  protected incrementVersion(): void {
    this._version++;
  }

  /**
   * ドメインイベントを適用する具象メソッド
   * 各集約で実装
   */
  protected abstract applyDomainEvent(event: DomainEvent): void;
}
