import { Controller, Injectable, Logger, Inject } from '@nestjs/common';
import {
  EventPattern,
  Payload,
  Ctx,
  KafkaContext,
} from '@nestjs/microservices';
import { EventSubscriber } from '../../application/interfaces/EventSubscriber';
import { EventHandler } from '../../application/interfaces/EventHandler';
import { DomainEvent } from '../../domain/base/DomainEvent';
import type { KurrentDBClient } from './KurrentDBClient';
import { KAFKA_TOPICS } from '../kafka/kafka-topics.constants';

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
  private readonly eventHandlers: Map<string, EventHandler> = new Map();

  constructor(
    @Inject('KurrentDBClient')
    private readonly kurrentClient: KurrentDBClient,
  ) {}

  subscribe(eventType: string, handler: EventHandler): void {
    this.eventHandlers.set(eventType, handler);
    this.logger.debug(`Event handler registered for ${eventType}`);
  }

  /**
   * システムイベントの受信（NestJS @EventPattern デコレータ使用）
   */
  @EventPattern(KAFKA_TOPICS.SYSTEM_EVENTS)
  async handleSystemEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    await this.handleKafkaMessage(payload, context);
  }

  /**
   * 脆弱性イベントの受信
   */
  @EventPattern(KAFKA_TOPICS.VULNERABILITY_EVENTS)
  async handleVulnerabilityEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    await this.handleKafkaMessage(payload, context);
  }

  /**
   * タスクイベントの受信
   */
  @EventPattern(KAFKA_TOPICS.TASK_EVENTS)
  async handleTaskEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    await this.handleKafkaMessage(payload, context);
  }

  /**
   * セキュリティイベントの受信
   */
  @EventPattern(KAFKA_TOPICS.SECURITY_EVENTS)
  async handleSecurityEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    await this.handleKafkaMessage(payload, context);
  }

  /**
   * 緊急イベントの受信
   */
  @EventPattern('urgent-events')
  async handleUrgentEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    await this.handleKafkaMessage(payload, context);
  }

  /**
   * ドメインイベント（汎用）の受信
   */
  @EventPattern('domain-events')
  async handleDomainEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    await this.handleKafkaMessage(payload, context);
  }

  private async handleKafkaMessage(
    payload: DomainEvent,
    context: KafkaContext,
  ): Promise<void> {
    const originalMessage = context.getMessage();
    const topic = context.getTopic();
    const partition = context.getPartition();

    try {
      const eventType =
        originalMessage.headers?.['event-type']?.toString() ||
        payload.eventType;

      // Kurrent DBに永続化
      await this.persistToEventStore(payload, eventType);

      this.logger.debug('Event persisted to Kurrent DB from Kafka', {
        eventType,
        eventId: payload.eventId,
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
    eventData: DomainEvent,
    eventType: string,
  ): Promise<void> {
    const streamName = this.getStreamName(
      eventData.aggregateType,
      eventData.aggregateId,
    );

    const eventToStore = {
      eventId: eventData.eventId,
      eventType: eventType,
      data: eventData.getData(),
      metadata: {
        correlationId: eventData.correlationId,
        causationId: eventData.causationId,
        occurredOn: eventData.occurredOn,
      },
    };

    await this.kurrentClient.appendToStream(streamName, [eventToStore], {
      expectedRevision: 'any',
    });

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
