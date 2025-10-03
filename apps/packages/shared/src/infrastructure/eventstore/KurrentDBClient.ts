import { DomainEvent } from '../../domain/base/DomainEvent';

/**
 * Append Options
 * ストリーム追加時のオプション
 */
export interface KurrentAppendOptions {
  expectedRevision?: number;
}

/**
 * Kurrent DB Client Interface
 * Event Sourcing用のイベントストアクライアント
 */
export interface KurrentDBClient {
  appendToStream(
    streamName: string,
    events: DomainEvent[],
    options?: KurrentAppendOptions,
  ): Promise<void>;

  readStream(streamName: string): Promise<DomainEvent[]>;
}
