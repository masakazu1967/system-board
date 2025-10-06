export interface AppendToStreamEvent {
  id: string;
  type: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AppendOptions {
  expectedRevision?: number | 'any' | 'no_stream' | 'stream_exists';
}

export interface EventStore {
  appendToStream(
    streamName: string,
    events: AppendToStreamEvent[],
    options?: AppendOptions,
  ): Promise<void>;

  readStream(streamName: string): Promise<RecordedEvent[]>;
}
