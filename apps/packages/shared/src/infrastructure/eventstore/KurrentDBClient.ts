/**
 * Kurrent Event
 * EventStoreに格納するイベントの型
 */
export interface KurrentEvent {
  eventId: string;
  eventType: string;
  data: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Append Options
 * ストリーム追加時のオプション
 */
export interface KurrentAppendOptions {
  expectedRevision?: string;
}

/**
 * Kurrent DB Client Interface
 * Event Sourcing用のイベントストアクライアント
 */
export interface KurrentDBClient {
  appendToStream(
    streamName: string,
    events: KurrentEvent[],
    options?: KurrentAppendOptions,
  ): Promise<void>;
}
