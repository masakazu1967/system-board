import { Injectable, Logger } from '@nestjs/common';
import { SystemRepository } from '../../domain/repositories/SystemRepository';
import { System } from '../../domain/aggregates/System';
import { SystemId } from '../../domain/value-objects/SystemId';

/**
 * Event Sourcing System Repository
 * Kurrent DB を使用したイベントソーシングリポジトリ
 */
@Injectable()
export class EventSourcingSystemRepository implements SystemRepository {
  private readonly logger = new Logger(EventSourcingSystemRepository.name);

  constructor(
    // TODO: KurrentDBClient をDI
    // private readonly kurrentClient: KurrentDBClient,
  ) {}

  async save(system: System): Promise<void> {
    const streamName = system.getId().toStreamName();
    const events = system.getUncommittedEvents();

    // TODO: Kurrent DB への永続化実装
    /*
    await this.kurrentClient.appendToStream(
      streamName,
      events.map(event => ({
        eventId: event.eventId,
        eventType: event.eventType,
        data: event.getData(),
        metadata: {
          correlationId: event.correlationId,
          causationId: event.causationId,
          occurredOn: event.occurredOn,
        },
      })),
      {
        expectedRevision: system.getVersion() - events.length - 1,
      }
    );
    */

    system.markEventsAsCommitted();

    this.logger.debug('System saved to event store', {
      systemId: system.getIdValue(),
      streamName,
      eventCount: events.length,
    });
  }

  async findById(systemId: SystemId): Promise<System | null> {
    const streamName = systemId.toStreamName();

    // TODO: Kurrent DB からイベントを読み取り
    /*
    const events = await this.kurrentClient.readStream(streamName);

    if (!events || events.length === 0) {
      return null;
    }

    // イベントから集約を再構築
    const system = new System(systemId);
    system.loadFromHistory(events);
    return system;
    */

    this.logger.debug('System loaded from event store', {
      systemId: systemId.getValue(),
      streamName,
    });

    return null; // モック実装
  }

  async findByName(name: string): Promise<System | null> {
    // TODO: Read Model（PostgreSQL）から検索
    // Event Sourcing では、検索クエリはRead Modelを使用
    this.logger.debug('System search by name', { name });
    return null; // モック実装
  }
}
