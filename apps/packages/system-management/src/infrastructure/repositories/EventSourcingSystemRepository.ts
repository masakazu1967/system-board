import { Injectable, Logger, Inject } from '@nestjs/common';
import { SystemRepository } from '../../domain/repositories/SystemRepository';
import { System } from '../../domain/aggregates/System';
import { SystemId } from '../../domain/value-objects/SystemId';
import { EVENT_STORE } from '@system-board/shared';
import type { EventStore } from '@system-board/shared';
import type { DomainEvent } from '@system-board/shared';

/**
 * Event Sourcing System Repository
 * Kurrent DB を使用したイベントソーシングリポジトリ
 */
@Injectable()
export class EventSourcingSystemRepository implements SystemRepository {
  private readonly logger = new Logger(EventSourcingSystemRepository.name);

  constructor(
    @Inject(EVENT_STORE)
    private readonly eventStore: EventStore,
  ) {}

  async save(system: System): Promise<void> {
    const streamName = system.getId().toStreamName();
    const events = system.getUncommittedEvents();

    await this.eventStore.appendToStream(
      streamName,
      events.map((event) => ({
        id: event.eventId,
        type: event.eventType,
        data: event.getData() as Record<string, unknown>,
        metadata: {
          correlationId: event.correlationId,
          causationId: event.causationId,
          occurredOn: event.occurredOn.toISOString(),
        },
      })),
      {
        expectedRevision: system.getVersion() - events.length - 1,
      },
    );

    system.markEventsAsCommitted();

    this.logger.debug('System saved to event store', {
      systemId: system.getIdValue(),
      streamName,
      eventCount: events.length,
    });
  }

  async findById(systemId: SystemId): Promise<System | null> {
    const streamName = systemId.toStreamName();

    const recordedEvents = await this.eventStore.readStream(streamName);

    if (!recordedEvents || recordedEvents.length === 0) {
      return null;
    }

    // RecordedEventをDomainEventに変換してから集約を再構築
    // TODO: EventSerializerRegistryを使用してデシリアライズする実装が必要
    const domainEvents = recordedEvents as unknown as DomainEvent[];

    const system = System.reconstruct(systemId, domainEvents);

    this.logger.debug('System loaded from event store', {
      systemId: systemId.getValue(),
      streamName,
    });
    return system;
  }

  async findByName(name: string): Promise<System | null> {
    // TODO: Read Model（PostgreSQL）から検索
    // Event Sourcing では、検索クエリはRead Modelを使用
    this.logger.debug('System search by name', { name });
    return Promise.resolve(null); // モック実装
  }
}
