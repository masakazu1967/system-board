// shared/infrastructure/event-store/services/event-persistence.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { DomainEvent } from '../../domain/base/DomainEvent';
import type { EventStore } from './EventStore';
import { EventSerializerRegistry } from './EventSerializerRegistry';

export const EVENT_STORE = 'EVENT_STORE';

@Injectable()
export class EventPersistenceService {
  private readonly logger = new Logger(EventPersistenceService.name);

  constructor(
    @Inject(EVENT_STORE)
    private readonly eventStore: EventStore,
  ) {}

  /**
   * ドメインイベントをイベントストアに永続化
   */
  async persistDomainEvent(event: DomainEvent): Promise<void> {
    const streamName = this.getStreamName(event);

    // 1. EventSerializerRegistryからEventSerializerを取得し、
    //    DomainEventのgetDataメソッドで取得した値をシリアライズ
    const eventData = EventSerializerRegistry.serializeEventData(
      event.eventType,
      event.getData(),
    );

    // 2. シリアライズした値をEventStoreインターフェイスで保存
    await this.eventStore.appendToStream(
      streamName,
      [
        {
          id: event.eventId,
          type: event.eventType,
          data: eventData,
          metadata: {
            correlationId: event.correlationId,
            causationId: event.causationId,
            occurredOn: event.occurredOn.toISOString(),
            aggregateVersion: event.aggregateVersion,
          },
        },
      ],
      {
        expectedRevision: event.aggregateVersion - 1,
      },
    );

    this.logger.debug('Event persisted to event store', {
      eventType: event.eventType,
      eventId: event.eventId,
      streamName,
      aggregateVersion: event.aggregateVersion,
    });
  }

  private getStreamName(event: DomainEvent): string {
    return `${event.aggregateType}-${event.aggregateId}`;
  }
}
