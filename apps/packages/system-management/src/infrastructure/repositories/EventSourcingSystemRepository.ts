import { Inject, Injectable, Logger } from '@nestjs/common';
import { SystemRepository } from '../../domain/repositories/SystemRepository';
import { System } from '../../domain/aggregates/System';
import { SystemId } from '../../domain/value-objects/SystemId';
import type { KurrentDBClient } from '@system-board/shared';

/**
 * Event Sourcing System Repository
 * Kurrent DB を使用したイベントソーシングリポジトリ
 */
@Injectable()
export class EventSourcingSystemRepository implements SystemRepository {
  private readonly logger = new Logger(EventSourcingSystemRepository.name);

  constructor(
    @Inject('KurrentDBClient')
    private readonly kurrentClient: KurrentDBClient,
  ) {}

  async save(system: System): Promise<void> {
    const streamName = system.getId().toStreamName();
    const events = system.getUncommittedEvents();

    await this.kurrentClient.appendToStream(streamName, events, {
      expectedRevision: system.getVersion() - events.length - 1,
    });

    system.markEventsAsCommitted();

    this.logger.debug('System saved to event store', {
      systemId: system.getIdValue(),
      streamName,
      eventCount: events.length,
    });
  }

  async findById(systemId: SystemId): Promise<System | null> {
    const streamName = systemId.toStreamName();

    const domainEvents = await this.kurrentClient.readStream(streamName);

    if (!domainEvents || domainEvents.length === 0) {
      return null;
    }

    // イベントから集約を再構築
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
