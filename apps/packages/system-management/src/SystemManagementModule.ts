import { Module, OnModuleInit } from '@nestjs/common';
import { EventSerializerRegistry } from '@system-board/shared';
import { SystemRegistered } from './domain';
import { SystemRegisteredSerializer } from './infrastructure/events/SystemRegisteredSerializer';
import { SystemManagementEventStoreKfkaController } from './presentation/SystemManagementEventStoreKafkaController';
import { SharedKafkaModule } from '@system-board/shared-kafka';
import { EventStoreModule } from '@system-board/shared-kurrentdb';
import { SharedTypeOrmModule } from '@system-board/shared-typeorm';
@Module({
  imports: [SharedKafkaModule, EventStoreModule, SharedTypeOrmModule],
  controllers: [SystemManagementEventStoreKfkaController],
})
export class SystemManagementModule implements OnModuleInit {
  onModuleInit() {
    EventSerializerRegistry.register(
      SystemRegistered.EVENT_NAME,
      new SystemRegisteredSerializer(),
    );

    console.log(
      `[SystemModule] Registered serializer for: ${SystemRegistered.EVENT_NAME}`,
    );
  }
}
