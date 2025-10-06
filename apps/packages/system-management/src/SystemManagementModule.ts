import { Module, OnModuleInit } from '@nestjs/common';
import { EventSerializerRegistry } from '@system-board/shared';
import { SystemRegistered } from './domain';
import { SystemRegisteredSerializer } from './infrastructure/events/SystemRegisteredSerializer';

@Module({})
export class SystemManagementModule implements OnModuleInit {
  onModuleInit() {
    EventSerializerRegistry.register(
      SystemRegistered.EVENT_NAME,
      new SystemRegisteredSerializer(),
    );
  }
}
