import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  EventStoreDBClient,
  jsonEvent,
  JSONEventType,
  StreamNotFoundError,
} from '@eventstore/db-client';
import { DomainEvent } from '../../domain/base/DomainEvent';
import { KurrentDBClient, KurrentAppendOptions } from './KurrentDBClient';

/**
 * EventStoreDB Kurrent Client
 * EventStoreDB (Kurrent) への接続を管理する具象クラス
 */
@Injectable()
export class EventStoreDBKurrentClient
  implements KurrentDBClient, OnModuleDestroy
{
  private readonly logger = new Logger(EventStoreDBKurrentClient.name);
  private client: EventStoreDBClient;

  constructor(connectionString: string) {
    this.client = EventStoreDBClient.connectionString(connectionString);
    this.logger.log(`EventStoreDB client initialized: ${connectionString}`);
  }

  /**
   * ストリームにイベントを追加
   */
  async appendToStream(
    streamName: string,
    events: DomainEvent[],
    options?: KurrentAppendOptions,
  ): Promise<void> {
    try {
      const eventStoreEvents = events.map((event) =>
        this.toEventStoreEvent(event),
      ) as any[];

      const appendOptions =
        options?.expectedRevision !== undefined
          ? { expectedRevision: BigInt(options.expectedRevision) }
          : undefined;

      await this.client.appendToStream(
        streamName,
        eventStoreEvents,
        appendOptions,
      );

      this.logger.debug(
        `Appended ${events.length} event(s) to stream: ${streamName}`,
        {
          eventTypes: events.map((e) => e.eventType),
          expectedRevision: options?.expectedRevision,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to append events to stream: ${streamName}`,
        error,
      );
      throw error;
    }
  }

  /**
   * ストリームからイベントを読み込み
   */
  async readStream(streamName: string): Promise<DomainEvent[]> {
    try {
      const events: DomainEvent[] = [];

      const eventStream = this.client.readStream(streamName, {
        direction: 'forwards',
        fromRevision: 'start',
      });

      for await (const resolvedEvent of eventStream) {
        if (resolvedEvent.event) {
          const domainEvent = this.toDomainEvent(resolvedEvent.event);
          if (domainEvent) {
            events.push(domainEvent);
          }
        }
      }

      this.logger.debug(
        `Read ${events.length} event(s) from stream: ${streamName}`,
      );
      return events;
    } catch (error) {
      if (error instanceof StreamNotFoundError) {
        this.logger.debug(`Stream not found: ${streamName}`);
        return [];
      }
      this.logger.error(`Failed to read stream: ${streamName}`, error);
      throw error;
    }
  }

  /**
   * DomainEventをEventStoreDBのイベント形式に変換
   */
  private toEventStoreEvent(event: DomainEvent): JSONEventType {
    return jsonEvent({
      type: event.eventType,
      data: {
        eventId: event.eventId,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        aggregateVersion: event.aggregateVersion,
        occurredOn: event.occurredOn.toISOString(),
        payload: event.getData(),
      },
      metadata: {
        correlationId: event.correlationId,
        causationId: event.causationId || null,
      },
    });
  }

  /**
   * EventStoreDBのイベントをDomainEventのPlain Objectに変換
   * Note: DomainEventは抽象クラスなので、再構築時は各コンテキストでファクトリーを使用する
   */
  private toDomainEvent(event: any): DomainEvent | null {
    try {
      const data = event.data as {
        eventId: string;
        aggregateId: string;
        aggregateType: string;
        aggregateVersion: number;
        occurredOn: string;
        payload: any;
      };

      const metadata = event.metadata as {
        correlationId: string | null;
        causationId: string | null;
      };

      // Plain Objectとして返す（後でファクトリーで再構築）
      return {
        eventId: data.eventId,
        eventType: event.type,
        aggregateId: data.aggregateId,
        aggregateType: data.aggregateType,
        aggregateVersion: data.aggregateVersion,
        occurredOn: new Date(data.occurredOn),
        correlationId: metadata?.correlationId || '',
        causationId: metadata?.causationId || undefined,
        getData: () => data.payload,
      } as DomainEvent;
    } catch (error) {
      this.logger.error(`Failed to convert event to DomainEvent`, {
        eventType: event.type,
        error,
      });
      return null;
    }
  }

  /**
   * モジュール破棄時にクライアントを閉じる
   */
  async onModuleDestroy(): Promise<void> {
    await this.client.dispose();
    this.logger.log('EventStoreDB client disposed');
  }
}
