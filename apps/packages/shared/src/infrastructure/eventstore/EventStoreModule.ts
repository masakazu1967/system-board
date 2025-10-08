// shared/infrastructure/event-store/event-store.module.ts
import { Module, Global, DynamicModule } from '@nestjs/common';
import { KurrentModule } from './KurrentModule';
import { KurrentEventStoreAdapter } from './KurrentEventStoreAdapter';
import {
  EventPersistenceService,
  EVENT_STORE,
} from './EventPersistenceService';

@Global()
@Module({})
export class EventStoreModule {
  static forRoot(): DynamicModule {
    return {
      module: EventStoreModule,
      imports: [KurrentModule.forRoot()],
      providers: [
        {
          provide: EVENT_STORE,
          useClass: KurrentEventStoreAdapter,
        },
        EventPersistenceService,
      ],
      exports: [EVENT_STORE, EventPersistenceService],
    };
  }
}
