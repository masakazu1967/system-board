import { Controller, Injectable, Logger, Inject } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  KafkaContext,
} from '@nestjs/microservices';
import { DomainEvent } from '../../domain/base/DomainEvent';
import type { KurrentDBClient } from './KurrentDBClient';
import { KAFKA_TOPICS } from '../kafka/kafka-topics.constants';
import { KURRENT_DB_CLIENT } from './kurrent-client.provider';

/**
 * Kurrent Kafka Subscriber
 * Kafkaメッセージを受信してKurrent DBに永続化
 * ダブルコミット回避: Kafka → Kurrent DB の非同期永続化
 * NestJS @MessagePattern デコレータ使用（Request-Response）
 */
@Controller()
@Injectable()
export class KurrentKafkaSubscriber {
  private readonly logger = new Logger(KurrentKafkaSubscriber.name);

  constructor(
    @Inject(KURRENT_DB_CLIENT)
    private readonly kurrentClient: KurrentDBClient,
  ) {}

  /**
   * システムイベントの受信（NestJS @MessagePattern デコレータ使用）
   * ACK/NACKによる明示的なオフセットコミット制御
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
   * 緊急イベントの受信
   */
  @MessagePattern('urgent-events')
  async handleUrgentEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<{ success: boolean; eventId: string }> {
    return await this.handleKafkaMessage(payload, context);
  }

  /**
   * ドメインイベント（汎用）の受信
   */
  @MessagePattern('domain-events')
  async handleDomainEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<{ success: boolean; eventId: string }> {
    return await this.handleKafkaMessage(payload, context);
  }

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

      // Kurrent DBに永続化
      await this.persistToEventStore(payload, eventType);

      this.logger.debug('Event persisted to Kurrent DB from Kafka', {
        eventType,
        eventId: payload.eventId,
        topic,
        partition,
      });

      // 成功応答（ACK） → Kafkaオフセットコミット
      return { success: true, eventId: payload.eventId };
    } catch (error) {
      this.logger.error('Failed to persist event to Kurrent DB', {
        topic,
        partition,
        error: error instanceof Error ? error.message : String(error),
      });

      // エラー時は例外をスロー → NACK → 再処理
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

    await this.kurrentClient.appendToStream(streamName, [eventData], {
      expectedRevision: eventData.aggregateVersion,
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
