import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { ClientKafka } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { KafkaEventPublisher } from './KafkaEventPublisher';
import { DomainEvent } from '../../domain/base/DomainEvent';

// テスト用のDomainEvent実装
class TestEvent extends DomainEvent {
  constructor(
    eventType: string,
    public readonly testData: string,
    aggregateId: string = 'test-aggregate-id',
    correlationId: string = 'test-correlation-id',
    aggregateVersion: number = 1,
  ) {
    super(
      eventType,
      aggregateId,
      'TestAggregate',
      aggregateVersion,
      correlationId,
      'test-causation-id',
    );
  }

  getData(): unknown {
    return { testData: this.testData };
  }
}

describe('KafkaEventPublisher', () => {
  let publisher: KafkaEventPublisher;
  let kafkaClient: MockProxy<ClientKafka>;

  beforeEach(async () => {
    kafkaClient = mock<ClientKafka>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaEventPublisher,
        {
          provide: 'KAFKA_CLIENT',
          useValue: kafkaClient,
        },
      ],
    }).compile();

    publisher = module.get<KafkaEventPublisher>(KafkaEventPublisher);
  });

  describe('onModuleInit', () => {
    it('should subscribe to all topics and connect to Kafka', async () => {
      // Arrange
      kafkaClient.subscribeToResponseOf.mockReturnValue(undefined);
      kafkaClient.connect.mockResolvedValue(undefined as any);

      // Act
      await publisher.onModuleInit();

      // Assert
      expect(kafkaClient.subscribeToResponseOf).toHaveBeenCalledWith(
        'system-events',
      );
      expect(kafkaClient.subscribeToResponseOf).toHaveBeenCalledWith(
        'vulnerability-events',
      );
      expect(kafkaClient.subscribeToResponseOf).toHaveBeenCalledWith(
        'task-events',
      );
      expect(kafkaClient.subscribeToResponseOf).toHaveBeenCalledWith(
        'security-events',
      );
      expect(kafkaClient.subscribeToResponseOf).toHaveBeenCalledWith(
        'urgent-events',
      );
      expect(kafkaClient.subscribeToResponseOf).toHaveBeenCalledWith(
        'domain-events',
      );
      expect(kafkaClient.connect).toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    beforeEach(() => {
      kafkaClient.emit.mockReturnValue(of(undefined));
    });

    it('should publish SystemRegistered event to system-events topic', async () => {
      // Arrange
      const event = new TestEvent('SystemRegistered', 'test-data');

      // Act
      await publisher.publish(event);

      // Assert
      expect(kafkaClient.emit).toHaveBeenCalledWith('system-events', {
        key: event.aggregateId,
        value: {
          eventId: event.eventId,
          eventType: 'SystemRegistered',
          aggregateId: event.aggregateId,
          aggregateType: 'TestAggregate',
          aggregateVersion: 1,
          occurredOn: event.occurredOn.toISOString(),
          correlationId: event.correlationId,
          causationId: event.causationId,
          data: { testData: 'test-data' },
        },
        headers: {
          'content-type': 'application/json',
          'event-type': 'SystemRegistered',
          'correlation-id': event.correlationId,
        },
      });
    });

    it('should publish VulnerabilityDetected event to vulnerability-events topic', async () => {
      // Arrange
      const event = new TestEvent('VulnerabilityDetected', 'vuln-data');

      // Act
      await publisher.publish(event);

      // Assert
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'vulnerability-events',
        expect.objectContaining({
          key: event.aggregateId,
          value: expect.objectContaining({
            eventType: 'VulnerabilityDetected',
          }),
        }),
      );
    });

    it('should publish TaskCreated event to task-events topic', async () => {
      // Arrange
      const event = new TestEvent('TaskCreated', 'task-data');

      // Act
      await publisher.publish(event);

      // Assert
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'task-events',
        expect.objectContaining({
          key: event.aggregateId,
          value: expect.objectContaining({
            eventType: 'TaskCreated',
          }),
        }),
      );
    });

    it('should publish SystemSecurityAlert event to security-events topic', async () => {
      // Arrange
      const event = new TestEvent('SystemSecurityAlert', 'security-data');

      // Act
      await publisher.publish(event);

      // Assert
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'security-events',
        expect.objectContaining({
          key: event.aggregateId,
          value: expect.objectContaining({
            eventType: 'SystemSecurityAlert',
          }),
        }),
      );
    });

    it('should publish HighPriorityTaskCreated event to urgent-events topic', async () => {
      // Arrange
      const event = new TestEvent('HighPriorityTaskCreated', 'urgent-data');

      // Act
      await publisher.publish(event);

      // Assert
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'urgent-events',
        expect.objectContaining({
          key: event.aggregateId,
          value: expect.objectContaining({
            eventType: 'HighPriorityTaskCreated',
          }),
        }),
      );
    });

    it('should publish unknown event to domain-events topic', async () => {
      // Arrange
      const event = new TestEvent('UnknownEventType', 'unknown-data');

      // Act
      await publisher.publish(event);

      // Assert
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'domain-events',
        expect.objectContaining({
          key: event.aggregateId,
          value: expect.objectContaining({
            eventType: 'UnknownEventType',
          }),
        }),
      );
    });

    it('should use aggregateId as message key', async () => {
      // Arrange
      const event = new TestEvent(
        'SystemRegistered',
        'test',
        'custom-aggregate-id',
      );

      // Act
      await publisher.publish(event);

      // Assert
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          key: 'custom-aggregate-id',
        }),
      );
    });

    it('should include all event metadata in payload', async () => {
      // Arrange
      const event = new TestEvent(
        'SystemRegistered',
        'metadata-test',
        'agg-123',
        'corr-456',
        5,
      );

      // Act
      await publisher.publish(event);

      // Assert
      const emitCall = kafkaClient.emit.mock.calls[0];
      const payload = (emitCall[1] as any).value;

      expect(payload).toEqual({
        eventId: event.eventId,
        eventType: 'SystemRegistered',
        aggregateId: 'agg-123',
        aggregateType: 'TestAggregate',
        aggregateVersion: 5,
        occurredOn: event.occurredOn.toISOString(),
        correlationId: 'corr-456',
        causationId: 'test-causation-id',
        data: { testData: 'metadata-test' },
      });
    });

    it('should include correct headers', async () => {
      // Arrange
      const event = new TestEvent(
        'SystemRegistered',
        'test',
        'agg-1',
        'corr-1',
      );

      // Act
      await publisher.publish(event);

      // Assert
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'content-type': 'application/json',
            'event-type': 'SystemRegistered',
            'correlation-id': 'corr-1',
          },
        }),
      );
    });

    it('should serialize occurredOn to ISO string', async () => {
      // Arrange
      const event = new TestEvent('SystemRegistered', 'test');
      const expectedISO = event.occurredOn.toISOString();

      // Act
      await publisher.publish(event);

      // Assert
      const payload = (kafkaClient.emit.mock.calls[0][1] as any).value;
      expect(payload.occurredOn).toBe(expectedISO);
      expect(typeof payload.occurredOn).toBe('string');
    });
  });

  describe('publishAll', () => {
    beforeEach(() => {
      kafkaClient.emit.mockReturnValue(of(undefined));
    });

    it('should publish multiple events', async () => {
      // Arrange
      const event1 = new TestEvent('SystemRegistered', 'event-1', 'agg-1');
      const event2 = new TestEvent('TaskCreated', 'event-2', 'agg-2');
      const event3 = new TestEvent('VulnerabilityDetected', 'event-3', 'agg-3');

      // Act
      await publisher.publishAll([event1, event2, event3]);

      // Assert
      expect(kafkaClient.emit).toHaveBeenCalledTimes(3);
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'system-events',
        expect.any(Object),
      );
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'task-events',
        expect.any(Object),
      );
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'vulnerability-events',
        expect.any(Object),
      );
    });

    it('should publish empty array without errors', async () => {
      // Act
      await publisher.publishAll([]);

      // Assert
      expect(kafkaClient.emit).not.toHaveBeenCalled();
    });

    it('should publish single event', async () => {
      // Arrange
      const event = new TestEvent('SystemRegistered', 'single-event');

      // Act
      await publisher.publishAll([event]);

      // Assert
      expect(kafkaClient.emit).toHaveBeenCalledTimes(1);
    });

    it('should handle all events in parallel', async () => {
      // Arrange
      const events = Array.from(
        { length: 10 },
        (_, i) => new TestEvent('SystemRegistered', `event-${i}`, `agg-${i}`),
      );

      // Act
      await publisher.publishAll(events);

      // Assert
      expect(kafkaClient.emit).toHaveBeenCalledTimes(10);
    });
  });

  describe('topic mapping', () => {
    beforeEach(() => {
      kafkaClient.emit.mockReturnValue(of(undefined));
    });

    it('should map SystemConfigurationUpdated to system-events', async () => {
      const event = new TestEvent('SystemConfigurationUpdated', 'test');
      await publisher.publish(event);
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'system-events',
        expect.any(Object),
      );
    });

    it('should map SystemDecommissioned to system-events', async () => {
      const event = new TestEvent('SystemDecommissioned', 'test');
      await publisher.publish(event);
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'system-events',
        expect.any(Object),
      );
    });

    it('should map VulnerabilityScanCompleted to vulnerability-events', async () => {
      const event = new TestEvent('VulnerabilityScanCompleted', 'test');
      await publisher.publish(event);
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'vulnerability-events',
        expect.any(Object),
      );
    });

    it('should map VulnerabilityResolved to vulnerability-events', async () => {
      const event = new TestEvent('VulnerabilityResolved', 'test');
      await publisher.publish(event);
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'vulnerability-events',
        expect.any(Object),
      );
    });

    it('should map VulnerabilityScanInitiated to vulnerability-events', async () => {
      const event = new TestEvent('VulnerabilityScanInitiated', 'test');
      await publisher.publish(event);
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'vulnerability-events',
        expect.any(Object),
      );
    });

    it('should map TaskCompleted to task-events', async () => {
      const event = new TestEvent('TaskCompleted', 'test');
      await publisher.publish(event);
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'task-events',
        expect.any(Object),
      );
    });
  });

  describe('error handling', () => {
    it('should propagate Kafka emit errors', async () => {
      // Arrange
      const event = new TestEvent('SystemRegistered', 'error-event');
      const error = new Error('Kafka broker unavailable');
      kafkaClient.emit.mockReturnValue(throwError(() => error));

      // Act & Assert
      await expect(publisher.publish(event)).rejects.toThrow(
        'Kafka broker unavailable',
      );
    });
  });
});
