import { Controller, Injectable, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { EventSubscriber } from '../../application/interfaces/EventSubscriber';
import { EventHandler } from '../../application/interfaces/EventHandler';

/**
 * Kurrent Kafka Subscriber
 * Kafkaメッセージを受信してKurrent DBに永続化
 * ダブルコミット回避: Kafka → Kurrent DB の非同期永続化
 * NestJS @EventPattern デコレータ使用
 */
@Controller()
@Injectable()
export class KurrentKafkaSubscriber implements EventSubscriber {
  private readonly logger = new Logger(KurrentKafkaSubscriber.name);
  private eventHandlers: Map<string, EventHandler> = new Map();

  constructor() {
    // TODO: KurrentDBClient をDI
    // private readonly kurrentClient: KurrentDBClient,
  }

  subscribe(eventType: string, handler: EventHandler): void {
    this.eventHandlers.set(eventType, handler);
    this.logger.debug(`Event handler registered for ${eventType}`);
  }

  /**
   * システムイベントの受信（NestJS @EventPattern デコレータ使用）
   */
  @EventPattern('system-events')
  async handleSystemEvents(
    @Payload() payload: any,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    await this.handleKafkaMessage(payload, context);
  }

  /**
   * 脆弱性イベントの受信
   */
  @EventPattern('vulnerability-events')
  async handleVulnerabilityEvents(
    @Payload() payload: any,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    await this.handleKafkaMessage(payload, context);
  }

  /**
   * タスクイベントの受信
   */
  @EventPattern('task-events')
  async handleTaskEvents(
    @Payload() payload: any,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    await this.handleKafkaMessage(payload, context);
  }

  /**
   * セキュリティイベントの受信
   */
  @EventPattern('security-events')
  async handleSecurityEvents(
    @Payload() payload: any,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    await this.handleKafkaMessage(payload, context);
  }

  /**
   * 緊急イベントの受信
   */
  @EventPattern('urgent-events')
  async handleUrgentEvents(
    @Payload() payload: any,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    await this.handleKafkaMessage(payload, context);
  }

  /**
   * ドメインイベント（汎用）の受信
   */
  @EventPattern('domain-events')
  async handleDomainEvents(
    @Payload() payload: any,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    await this.handleKafkaMessage(payload, context);
  }

  private async handleKafkaMessage(
    payload: any,
    context: KafkaContext,
  ): Promise<void> {
    const originalMessage = context.getMessage();
    const topic = context.getTopic();
    const partition = context.getPartition();

    try {
      const eventData = payload;
      const eventType =
        (originalMessage.headers &&
          originalMessage.headers['event-type']?.toString()) ||
        payload.eventType;

      // Kurrent DBに永続化
      await this.persistToEventStore(eventData, eventType);

      this.logger.debug('Event persisted to Kurrent DB from Kafka', {
        eventType,
        eventId: eventData.eventId,
        topic,
        partition,
      });
    } catch (error) {
      this.logger.error('Failed to persist event to Kurrent DB', {
        topic,
        partition,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async persistToEventStore(
    eventData: any,
    eventType: string,
  ): Promise<void> {
    const streamName = this.getStreamName(
      eventData.aggregateType,
      eventData.aggregateId,
    );

    const eventToStore = {
      eventId: eventData.eventId,
      eventType: eventType,
      data: eventData.data,
      metadata: {
        correlationId: eventData.correlationId,
        causationId: eventData.causationId,
        occurredOn: eventData.occurredOn,
      },
    };

    // TODO: Kurrent DB への永続化実装
    /*
    await this.kurrentClient.appendToStream(streamName, [eventToStore], {
      expectedRevision: 'any',
    });
    */

    this.logger.debug('Event stored in Kurrent DB', {
      streamName,
      eventType,
      eventId: eventData.eventId,
    });
  }

  private getStreamName(aggregateType: string, aggregateId: string): string {
    return `${aggregateType}-${aggregateId}`;
  }
}
