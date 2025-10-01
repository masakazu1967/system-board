import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent } from '../../domain/base/DomainEvent';
import { EventPublisher } from '../../application/interfaces/EventPublisher';

/**
 * Kafka Event Publisher
 * Kafkaへイベントを配信（ダブルコミット回避: Kafka First）
 */
@Injectable()
export class KafkaEventPublisher implements EventPublisher {
  private readonly logger = new Logger(KafkaEventPublisher.name);

  constructor(
    // TODO: KafkaService をDI（現時点ではモック）
    // private readonly kafkaService: KafkaService,
  ) {}

  async publishAll(events: DomainEvent[]): Promise<void> {
    const publishPromises = events.map((event) => this.publish(event));
    await Promise.all(publishPromises);
  }

  async publish(event: DomainEvent): Promise<void> {
    const topic = this.determineTopicByEventType(event.eventType);

    const message = {
      key: event.aggregateId,
      value: JSON.stringify({
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        aggregateVersion: event.aggregateVersion,
        occurredOn: event.occurredOn.toISOString(),
        correlationId: event.correlationId,
        causationId: event.causationId,
        data: event.getData(),
      }),
      headers: {
        'content-type': 'application/json',
        'event-type': event.eventType,
        'correlation-id': event.correlationId,
      },
    };

    // TODO: Kafkaへの配信実装
    // await this.kafkaService.send({ topic, messages: [message] });

    this.logger.debug('Event published to Kafka (Kafka First pattern)', {
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      topic,
      message,
    });
  }

  /**
   * イベントタイプごとのトピック振り分け
   */
  private determineTopicByEventType(eventType: string): string {
    const topicMap: Record<string, string> = {
      // System Management Context
      SystemRegistered: 'system-events',
      SystemConfigurationUpdated: 'system-events',
      SystemDecommissioned: 'system-events',
      SystemSecurityAlert: 'security-events',

      // Vulnerability Management Context
      VulnerabilityDetected: 'vulnerability-events',
      VulnerabilityScanCompleted: 'vulnerability-events',
      VulnerabilityResolved: 'vulnerability-events',
      VulnerabilityScanInitiated: 'vulnerability-events',

      // Task Management Context
      TaskCreated: 'task-events',
      TaskCompleted: 'task-events',
      HighPriorityTaskCreated: 'urgent-events',
    };

    return topicMap[eventType] || 'domain-events';
  }
}
