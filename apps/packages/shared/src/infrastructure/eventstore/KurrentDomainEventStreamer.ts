import { DomainEventStreamer } from '../../domain/base/DomainEventStreamer';
import { DomainEvent } from '../../domain/base/DomainEvent';
import { EventStoreDBClient, FORWARDS, START } from '@eventstore/db-client';

export class KurrentDomainEventStreamer implements DomainEventStreamer {
  constructor(private readonly eventStoreDBClient: EventStoreDBClient) {}

  async appendToStream(
    streamName: string,
    events: DomainEvent[],
  ): Promise<void> {
    // DomainEventToJsonTypeHelperを使用してEventDataに変換
    const eventDataArray = DomainEventToJsonTypeHelper.toEventDataArray(events);

    await this.eventStoreDBClient.appendToStream(streamName, eventDataArray);
  }

  async readStream(streamName: string): Promise<DomainEvent[]> {
    const events = this.eventStoreDBClient.readStream(streamName, {
      direction: FORWARDS,
      fromRevision: START,
    });

    const domainEvents: DomainEvent[] = [];
    for await (const resolvedEvent of events) {
      if (!resolvedEvent.event) continue;
    }
    return domainEvents;
  }
}
