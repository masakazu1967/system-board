/**
 * イベントストアの抽象インターフェース
 */
export interface EventStore {
  appendToStream(
    streamName: string,
    events: AppendToStreamEvent[],
    options?: AppendOptions,
  ): Promise<AppendResult>;

  readStream(
    streamName: string,
    options?: ReadStreamOptions,
  ): Promise<RecordedEvent[]>;

  readCategoryStream(
    category: string,
    options?: ReadStreamOptions,
  ): Promise<RecordedEvent[]>;

  streamExists(streamName: string): Promise<boolean>;
}

export interface AppendToStreamEvent {
  id: string;
  type: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AppendOptions {
  expectedRevision?: number | 'any' | 'no_stream' | 'stream_exists';
}

export interface AppendResult {
  nextExpectedRevision: number;
  position?: {
    commit: bigint;
    prepare: bigint;
  };
}

export interface RecordedEvent {
  id: string;
  type: string;
  streamName: string;
  revision: number;
  data: Record<string, any>;
  metadata: Record<string, any>;
  created: Date;
  position?: {
    commit: bigint;
    prepare: bigint;
  };
}

export interface ReadStreamOptions {
  direction?: 'forwards' | 'backwards';
  fromRevision?: number | 'start' | 'end';
  maxCount?: number;
}
