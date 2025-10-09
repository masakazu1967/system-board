import { EventPersistenceService } from '../infrastructure/eventstore/EventPersistenceService';

export abstract class EventStoreMessageBrokerController {
  constructor(
    protected readonly eventPersistenceService: EventPersistenceService,
  ) {}
}
