/**
 * Kurrent DB Client Interface
 * Event Sourcing用のイベントストアクライアント
 */
export interface KurrentDBClient {
  appendToStream(
    streamName: string,
    events: Array<{
      eventId: string;
      eventType: string;
      data: unknown;
      metadata?: Record<string, unknown>;
    }>,
    options?: { expectedRevision?: string },
  ): Promise<void>;
}
