// shared/infrastructure/event-store/controllers/event-store-message-broker.controller.ts
import { Controller, Injectable, Logger } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  KafkaContext,
  RmqContext,
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
    @Ctx() context: KafkaContext | RmqContext,
  ): Promise<{ success: boolean; eventId: string }> {
    return await this.handleMessage(payload, context);
  }

  /**
   * 脆弱性イベントの受信
   */
  @MessagePattern(KAFKA_TOPICS.VULNERABILITY_EVENTS)
  async handleVulnerabilityEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext | RmqContext,
  ): Promise<{ success: boolean; eventId: string }> {
    return await this.handleMessage(payload, context);
  }

  /**
   * タスクイベントの受信
   */
  @MessagePattern(KAFKA_TOPICS.TASK_EVENTS)
  async handleTaskEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext | RmqContext,
  ): Promise<{ success: boolean; eventId: string }> {
    return await this.handleMessage(payload, context);
  }

  /**
   * セキュリティイベントの受信
   */
  @MessagePattern(KAFKA_TOPICS.SECURITY_EVENTS)
  async handleSecurityEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext | RmqContext,
  ): Promise<{ success: boolean; eventId: string }> {
    return await this.handleMessage(payload, context);
  }

  /**
   * ドメインイベント（汎用）の受信
   */
  @MessagePattern(KAFKA_TOPICS.DOMAIN_EVENTS)
  async handleDomainEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext | RmqContext,
  ): Promise<{ success: boolean; eventId: string }> {
    return await this.handleMessage(payload, context);
  }

  /**
   * メッセージ処理の共通ロジック
   * KafkaとRabbitMQの両方に対応
   */
  private async handleMessage(
    payload: DomainEvent,
    context: KafkaContext | RmqContext,
  ): Promise<{ success: boolean; eventId: string }> {
    const originalMessage = context.getMessage() as {
      headers?: Record<string, string | Buffer>;
    };
    const isKafka = this.isKafkaContext(context);

    // メッセージブローカーに応じたメタデータ取得
    const messageMetadata = isKafka
      ? this.extractKafkaMetadata(context)
      : this.extractRabbitMQMetadata(context);

    try {
      const eventTypeHeader = originalMessage.headers?.['event-type'];
      const eventType =
        (typeof eventTypeHeader === 'string'
          ? eventTypeHeader
          : eventTypeHeader?.toString()) || payload.eventType;

      // EventPersistenceServiceで永続化
      await this.eventPersistenceService.persistDomainEvent(payload);

      this.logger.debug('Event persisted from message', {
        eventType: eventType,
        eventId: payload.eventId,
        broker: isKafka ? 'Kafka' : 'RabbitMQ',
        ...messageMetadata,
      });

      // 成功応答（ACK）
      return { success: true, eventId: payload.eventId };
    } catch (error) {
      this.logger.error('Failed to persist event from message broker', {
        broker: isKafka ? 'Kafka' : 'RabbitMQ',
        ...messageMetadata,
        error: error instanceof Error ? error.message : String(error),
      });

      // エラー時は例外をスロー → NACK → 再処理
      throw error;
    }
  }

  /**
   * コンテキストがKafkaContextかどうかを判定
   */
  private isKafkaContext(
    context: KafkaContext | RmqContext,
  ): context is KafkaContext {
    return 'getTopic' in context && 'getPartition' in context;
  }

  /**
   * Kafkaメタデータの抽出
   */
  private extractKafkaMetadata(context: KafkaContext): {
    topic: string;
    partition: number;
  } {
    return {
      topic: context.getTopic(),
      partition: context.getPartition(),
    };
  }

  /**
   * RabbitMQメタデータの抽出
   */
  private extractRabbitMQMetadata(context: RmqContext): {
    queue: string;
    exchange?: string;
    routingKey?: string;
  } {
    const originalMsg = context.getMessage() as {
      fields?: { exchange?: string; routingKey?: string };
    };

    return {
      queue: context.getPattern(),
      exchange: originalMsg.fields?.exchange,
      routingKey: originalMsg.fields?.routingKey,
    };
  }
}
