import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventSubscriber } from '../../application/interfaces/EventSubscriber';
import { EventHandler } from '../../application/interfaces/EventHandler';

/**
 * Kurrent Kafka Subscriber
 * Kafkaメッセージを受信してKurrent DBに永続化
 * ダブルコミット回避: Kafka → Kurrent DB の非同期永続化
 */
@Injectable()
export class KurrentKafkaSubscriber implements EventSubscriber, OnModuleInit {
  private readonly logger = new Logger(KurrentKafkaSubscriber.name);
  private eventHandlers: Map<string, EventHandler> = new Map();

  constructor(
    // TODO: KurrentDBClient をDI
    // private readonly kurrentClient: KurrentDBClient,
    // TODO: KafkaService をDI
    // private readonly kafkaService: KafkaService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Kafkaからイベントを受信してKurrent DBに保存
    await this.subscribeToKafkaEvents();
  }

  subscribe(eventType: string, handler: EventHandler): void {
    this.eventHandlers.set(eventType, handler);
    this.logger.debug(`Event handler registered for ${eventType}`);
  }

  private async subscribeToKafkaEvents(): Promise<void> {
    // TODO: Kafka サブスクリプション実装
    /*
    await this.kafkaService.subscribe({
      topics: ['system-events', 'vulnerability-events', 'task-events'],
      groupId: 'eventstore-persistence-group',
    });

    this.kafkaService.run({
      eachMessage: async ({ topic, partition, message }) => {
        await this.handleKafkaMessage(topic, message);
      },
    });
    */

    this.logger.debug('Subscribed to Kafka events for Kurrent DB persistence');
  }

  private async handleKafkaMessage(topic: string, message: any): Promise<void> {
    try {
      const eventData = JSON.parse(message.value.toString());
      const eventType = message.headers['event-type'].toString();

      // Kurrent DBに永続化
      await this.persistToEventStore(eventData, eventType);

      this.logger.debug('Event persisted to Kurrent DB from Kafka', {
        eventType,
        eventId: eventData.eventId,
        topic,
      });
    } catch (error) {
      this.logger.error('Failed to persist event to Kurrent DB', {
        topic,
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
