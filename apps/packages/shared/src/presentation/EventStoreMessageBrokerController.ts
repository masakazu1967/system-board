// shared/infrastructure/event-store/controllers/event-store-message-broker.controller.ts
import { Controller, Injectable, Logger } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  KafkaContext,
} from '@nestjs/microservices';
import { DomainEvent } from '../domain/base/DomainEvent';
import { EventPersistenceService } from '../infrastructure/eventstore/EventPersistenceService';

// Kafkaトピック定数
export const KAFKA_TOPICS = {
  SYSTEM_EVENTS: 'system-events',
  VULNERABILITY_EVENTS: 'vulnerability-events',
  TASK_EVENTS: 'task-events',
  SECURITY_EVENTS: 'security-events',
  DOMAIN_EVENTS: 'domain-events',
} as const;

@Controller()
@Injectable()
export class EventStoreMessageBrokerController {
  private readonly logger = new Logger(EventStoreMessageBrokerController.name);

  constructor(
    private readonly eventPersistenceService: EventPersistenceService,
  ) {}

  /**
   * システムイベントの受信
   */
  @MessagePattern(KAFKA_TOPICS.SYSTEM_EVENTS)
  async handleSystemEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<{ success: boolean; eventId: string }> {
    return await this.handleKafkaMessage(payload, context);
  }

  /**
   * 脆弱性イベントの受信
   */
  @MessagePattern(KAFKA_TOPICS.VULNERABILITY_EVENTS)
  async handleVulnerabilityEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<{ success: boolean; eventId: string }> {
    return await this.handleKafkaMessage(payload, context);
  }

  /**
   * タスクイベントの受信
   */
  @MessagePattern(KAFKA_TOPICS.TASK_EVENTS)
  async handleTaskEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<{ success: boolean; eventId: string }> {
    return await this.handleKafkaMessage(payload, context);
  }

  /**
   * セキュリティイベントの受信
   */
  @MessagePattern(KAFKA_TOPICS.SECURITY_EVENTS)
  async handleSecurityEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<{ success: boolean; eventId: string }> {
    return await this.handleKafkaMessage(payload, context);
  }

  /**
   * ドメインイベント（汎用）の受信
   */
  @MessagePattern(KAFKA_TOPICS.DOMAIN_EVENTS)
  async handleDomainEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<{ success: boolean; eventId: string }> {
    return await this.handleKafkaMessage(payload, context);
  }

  /**
   * メッセージ処理の共通ロジック
   */
  private async handleKafkaMessage(
    payload: DomainEvent,
    context: KafkaContext,
  ): Promise<{ success: boolean; eventId: string }> {
    const originalMessage = context.getMessage();
    const topic = context.getTopic();
    const partition = context.getPartition();

    try {
      const eventType =
        originalMessage.headers?.['event-type']?.toString() ||
        payload.eventType;

      // EventPersistenceServiceで永続化
      await this.eventPersistenceService.persistDomainEvent(payload);

      this.logger.debug('Event persisted from Kafka message', {
        eventType,
        eventId: payload.eventId,
        topic,
        partition,
      });

      // 成功応答（ACK）
      return { success: true, eventId: payload.eventId };
    } catch (error) {
      this.logger.error('Failed to persist event from Kafka', {
        topic,
        partition,
        error: error instanceof Error ? error.message : String(error),
      });

      // エラー時は例外をスロー → NACK → 再処理
      throw error;
    }
  }
}
