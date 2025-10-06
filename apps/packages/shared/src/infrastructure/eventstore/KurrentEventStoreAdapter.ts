// shared/infrastructure/event-store/adapters/kurrent-event-store.adapter.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  EventStoreDBClient,
  EventType,
  jsonEvent,
  ResolvedEvent,
} from '@eventstore/db-client';
import {
  EventStore,
  AppendToStreamEvent,
  AppendOptions,
  AppendResult,
  RecordedEvent,
  ReadStreamOptions,
} from './EventStore';

import { KURRENT_WRITE_CLIENT, KURRENT_READ_CLIENT } from './KurrentModule';

@Injectable()
export class KurrentEventStoreAdapter implements EventStore {
  private readonly logger = new Logger(KurrentEventStoreAdapter.name);

  constructor(
    @Inject(KURRENT_WRITE_CLIENT)
    private readonly writeClient: EventStoreDBClient,
    @Inject(KURRENT_READ_CLIENT)
    private readonly readClient: EventStoreDBClient,
  ) {}

  async appendToStream(
    streamName: string,
    events: AppendToStreamEvent[],
    options?: AppendOptions,
  ): Promise<AppendResult> {
    try {
      const kurrentEvents = events.map((e) =>
        jsonEvent({
          id: e.id,
          type: e.type,
          data: e.data,
          metadata: e.metadata || {},
        }),
      );

      const result = await this.writeClient.appendToStream(
        streamName,
        kurrentEvents,
        {
          expectedRevision: this.convertExpectedRevision(
            options?.expectedRevision,
          ),
        },
      );

      return {
        nextExpectedRevision: Number(result.nextExpectedRevision),
        position: result.position
          ? {
              commit: result.position.commit,
              prepare: result.position.prepare,
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to append to stream', {
        streamName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async readStream(
    streamName: string,
    options?: ReadStreamOptions,
  ): Promise<RecordedEvent[]> {
    try {
      const events = this.readClient.readStream(streamName, {
        direction: options?.direction || 'forwards',
        fromRevision: this.convertFromRevision(options?.fromRevision),
        maxCount: options?.maxCount,
      });

      const recordedEvents: RecordedEvent[] = [];
      for await (const resolvedEvent of events) {
        recordedEvents.push(this.toRecordedEvent(resolvedEvent));
      }

      return recordedEvents;
    } catch (error) {
      if (this.isStreamNotFound(error)) {
        return [];
      }
      this.logger.error('Failed to read stream', {
        streamName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async readCategoryStream(
    category: string,
    options?: ReadStreamOptions,
  ): Promise<RecordedEvent[]> {
    const categoryStreamName = `$ce-${category}`;
    return this.readStream(categoryStreamName, options);
  }

  async streamExists(streamName: string): Promise<boolean> {
    try {
      const events = this.readClient.readStream(streamName, {
        direction: 'forwards',
        fromRevision: 'start',
        maxCount: 1,
      });

      for await (const _ of events) {
        return true;
      }
      return false;
    } catch (error) {
      if (this.isStreamNotFound(error)) {
        return false;
      }
      throw error;
    }
  }

  // ヘルパーメソッド

  private toRecordedEvent(
    resolvedEvent: ResolvedEvent<EventType>,
  ): RecordedEvent {
    if (!resolvedEvent.event) {
      throw new Error('ResolvedEvent does not contain an event');
    }

    const { id, type, streamId, revision, data, metadata, created, position } =
      resolvedEvent.event;
    return {
      id,
      type,
      streamName: streamId,
      revision: Number(revision),
      data: data as Record<string, any>,
      metadata: (metadata as Record<string, any>) || {},
      created,
      position,
    };
  }

  private convertExpectedRevision(
    revision?: number | 'any' | 'no_stream' | 'stream_exists',
  ): 'any' | 'no_stream' | 'stream_exists' | bigint {
    if (revision === undefined || revision === 'any') {
      return 'any';
    }
    if (revision === 'no_stream') {
      return 'no_stream';
    }
    if (revision === 'stream_exists') {
      return 'stream_exists';
    }
    return BigInt(revision);
  }

  private convertFromRevision(
    revision?: number | 'start' | 'end',
  ): 'start' | 'end' | bigint {
    if (revision === undefined || revision === 'start') {
      return 'start';
    }
    if (revision === 'end') {
      return 'end';
    }
    return BigInt(revision);
  }

  private isStreamNotFound(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }
    const err = error as { code?: string; type?: string };
    return err.code === 'STREAM_NOT_FOUND' || err.type === 'stream-not-found';
  }
}
