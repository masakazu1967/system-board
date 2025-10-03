import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { DomainEvent } from '../../domain/base/DomainEvent';
import { EventPublisher } from '../../application/interfaces/EventPublisher';
import { KAFKA_TOPICS, ALL_KAFKA_TOPICS } from './kafka-topics.constants';

/**
 * Kafka Event Publisher
 * Kafkaへイベントを配信（ダブルコミット回避: Kafka First）
 * NestJS ClientKafka を使用
 */
@Injectable()
export class KafkaEventPublisher implements EventPublisher, OnModuleInit {
  private readonly logger = new Logger(KafkaEventPublisher.name);

  constructor(
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    // レスポンストピックの購読設定
    const topics = [...ALL_KAFKA_TOPICS, 'urgent-events', 'domain-events'];

    topics.forEach((topic) => {
      this.kafkaClient.subscribeToResponseOf(topic);
    });

    await this.kafkaClient.connect();
    this.logger.log('Kafka client connected successfully');
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    const publishPromises = events.map((event) => this.publish(event));
    await Promise.all(publishPromises);
  }

  async publish(event: DomainEvent): Promise<void> {
    const topic = this.determineTopicByEventType(event.eventType);

    const payload = {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      aggregateVersion: event.aggregateVersion,
      occurredOn: event.occurredOn.toISOString(),
      correlationId: event.correlationId,
      causationId: event.causationId,
      data: event.getData(),
    };

    // NestJS ClientKafka の emit() を使用（Fire-and-Forget）
    // Kafka配信成功を待ってからCommand Handler完了
    await lastValueFrom(
      this.kafkaClient.emit(topic, {
        key: event.aggregateId,
        value: payload,
        headers: {
          'content-type': 'application/json',
          'event-type': event.eventType,
          'correlation-id': event.correlationId,
        },
      }),
    );

    this.logger.debug('Event published to Kafka (Kafka First pattern)', {
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      topic,
    });
  }

  /**
   * イベントタイプごとのトピック振り分け
   */
  private determineTopicByEventType(eventType: string): string {
    const topicMap: Record<string, string> = {
      // System Management Context
      SystemRegistered: KAFKA_TOPICS.SYSTEM_EVENTS,
      SystemConfigurationUpdated: KAFKA_TOPICS.SYSTEM_EVENTS,
      SystemDecommissioned: KAFKA_TOPICS.SYSTEM_EVENTS,
      SystemSecurityAlert: KAFKA_TOPICS.SECURITY_EVENTS,

      // Vulnerability Management Context
      VulnerabilityDetected: KAFKA_TOPICS.VULNERABILITY_EVENTS,
      VulnerabilityScanCompleted: KAFKA_TOPICS.VULNERABILITY_EVENTS,
      VulnerabilityResolved: KAFKA_TOPICS.VULNERABILITY_EVENTS,
      VulnerabilityScanInitiated: KAFKA_TOPICS.VULNERABILITY_EVENTS,

      // Task Management Context
      TaskCreated: KAFKA_TOPICS.TASK_EVENTS,
      TaskCompleted: KAFKA_TOPICS.TASK_EVENTS,
      HighPriorityTaskCreated: 'urgent-events',
    };

    return topicMap[eventType] || 'domain-events';
  }
}
