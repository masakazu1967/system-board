import { DomainEvent } from './DomainEvent';

export interface DomainEventStreamer {
  appendToStream(streamName: string, events: DomainEvent[]): Promise<void>;
  readStream(streamName: string): Promise<DomainEvent[]>;
}
