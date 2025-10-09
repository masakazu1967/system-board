// shared/infrastructure/event-store/event-store.module.ts
import { Module, Global, DynamicModule } from '@nestjs/common';
import { KurrentModule, KurrentEventStoreAdapter } from './infrastructure';
import { EventPersistenceService, EVENT_STORE } from '@system-board/shared';

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
