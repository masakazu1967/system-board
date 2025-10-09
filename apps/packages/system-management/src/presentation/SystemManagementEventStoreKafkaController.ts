import { Controller } from '@nestjs/common';
import {
  Ctx,
  KafkaContext,
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import {
  DomainEvent,
  EventPersistenceService,
  EventStoreKafkaController,
  KAFKA_TOPICS,
} from '@system-board/shared';

@Controller()
export class SystemManagementEventStoreKfkaController extends EventStoreKafkaController {
  constructor(eventPersistenceService: EventPersistenceService) {
    super(eventPersistenceService);
  }

  /**
   * システムイベントの受信
   */
  @MessagePattern(KAFKA_TOPICS.SYSTEM_EVENTS)
  async handleSystemEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<{ success: boolean; eventId: string }> {
    return await this.handleMessage(payload, context);
  }
}
