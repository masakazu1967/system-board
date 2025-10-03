import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { KurrentKafkaSubscriber } from './KurrentKafkaSubscriber';
import { KurrentDBClient } from './KurrentDBClient';
import { DomainEvent } from '../../domain/base/DomainEvent';
import { KafkaContext } from '@nestjs/microservices';

// テスト用のDomainEvent実装
class TestEvent extends DomainEvent {
  constructor(
    public readonly testData: string,
    aggregateId: string = 'test-aggregate-id',
    correlationId: string = 'test-correlation-id',
    aggregateVersion: number = 1,
  ) {
    super(
      'TestEvent',
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

describe('KurrentKafkaSubscriber', () => {
  let subscriber: KurrentKafkaSubscriber;
  let kurrentClient: MockProxy<KurrentDBClient>;

  beforeEach(async () => {
    kurrentClient = mock<KurrentDBClient>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KurrentKafkaSubscriber],
      providers: [
        {
          provide: 'KurrentDBClient',
          useValue: kurrentClient,
        },
      ],
    }).compile();

    subscriber = module.get<KurrentKafkaSubscriber>(KurrentKafkaSubscriber);
  });

  const createMockKafkaContext = (
    topic: string = 'test-topic',
    partition: number = 0,
    headers?: Record<string, string>,
  ): MockProxy<KafkaContext> => {
    const context = mock<KafkaContext>();
    context.getTopic.mockReturnValue(topic);
    context.getPartition.mockReturnValue(partition);

    const message: any = {
      key: Buffer.from('test-key'),
      value: Buffer.from('test-value'),
      timestamp: '0',
      size: 0,
      attributes: 0,
      offset: '0',
    };

    if (headers) {
      message.headers = Object.entries(headers).reduce(
        (acc, [key, value]) => {
          acc[key] = Buffer.from(value);
          return acc;
        },
        {} as Record<string, Buffer>,
      );
    }

    context.getMessage.mockReturnValue(message);
    return context;
  };

  describe('handleSystemEvents', () => {
    it('should persist system event to Kurrent DB and return success', async () => {
      // Arrange
      const event = new TestEvent('system-event-data');
      const context = createMockKafkaContext('system-events', 0);
      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      const result = await subscriber.handleSystemEvents(event, context);

      // Assert
      expect(result).toEqual({ success: true, eventId: event.eventId });
      expect(kurrentClient.appendToStream).toHaveBeenCalledWith(
        'TestAggregate-test-aggregate-id',
        [event],
        { expectedRevision: 1 },
      );
    });

    it('should use event-type from headers if available', async () => {
      // Arrange
      const event = new TestEvent('header-event');
      const context = createMockKafkaContext('system-events', 0, {
        'event-type': 'CustomEventType',
      });
      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      const result = await subscriber.handleSystemEvents(event, context);

      // Assert
      expect(result.success).toBe(true);
      expect(kurrentClient.appendToStream).toHaveBeenCalled();
    });

    it('should throw error if persistence fails', async () => {
      // Arrange
      const event = new TestEvent('failing-event');
      const context = createMockKafkaContext('system-events', 0);
      const error = new Error('Kurrent DB connection failed');
      kurrentClient.appendToStream.mockRejectedValue(error);

      // Act & Assert
      await expect(
        subscriber.handleSystemEvents(event, context),
      ).rejects.toThrow('Kurrent DB connection failed');
    });
  });

  describe('handleVulnerabilityEvents', () => {
    it('should persist vulnerability event to Kurrent DB', async () => {
      // Arrange
      const event = new TestEvent('vulnerability-data', 'vuln-001');
      const context = createMockKafkaContext('vulnerability-events', 1);
      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      const result = await subscriber.handleVulnerabilityEvents(event, context);

      // Assert
      expect(result).toEqual({ success: true, eventId: event.eventId });
      expect(kurrentClient.appendToStream).toHaveBeenCalledWith(
        'TestAggregate-vuln-001',
        [event],
        { expectedRevision: 1 },
      );
    });
  });

  describe('handleTaskEvents', () => {
    it('should persist task event to Kurrent DB', async () => {
      // Arrange
      const event = new TestEvent('task-data', 'task-123');
      const context = createMockKafkaContext('task-events', 2);
      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      const result = await subscriber.handleTaskEvents(event, context);

      // Assert
      expect(result).toEqual({ success: true, eventId: event.eventId });
      expect(kurrentClient.appendToStream).toHaveBeenCalledWith(
        'TestAggregate-task-123',
        [event],
        { expectedRevision: 1 },
      );
    });
  });

  describe('handleSecurityEvents', () => {
    it('should persist security event to Kurrent DB', async () => {
      // Arrange
      const event = new TestEvent('security-alert', 'security-001');
      const context = createMockKafkaContext('security-events', 0);
      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      const result = await subscriber.handleSecurityEvents(event, context);

      // Assert
      expect(result).toEqual({ success: true, eventId: event.eventId });
      expect(kurrentClient.appendToStream).toHaveBeenCalledWith(
        'TestAggregate-security-001',
        [event],
        { expectedRevision: 1 },
      );
    });
  });

  describe('handleUrgentEvents', () => {
    it('should persist urgent event to Kurrent DB', async () => {
      // Arrange
      const event = new TestEvent('urgent-data', 'urgent-001');
      const context = createMockKafkaContext('urgent-events', 0);
      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      const result = await subscriber.handleUrgentEvents(event, context);

      // Assert
      expect(result).toEqual({ success: true, eventId: event.eventId });
      expect(kurrentClient.appendToStream).toHaveBeenCalledWith(
        'TestAggregate-urgent-001',
        [event],
        { expectedRevision: 1 },
      );
    });
  });

  describe('handleDomainEvents', () => {
    it('should persist domain event to Kurrent DB', async () => {
      // Arrange
      const event = new TestEvent('domain-data', 'domain-001');
      const context = createMockKafkaContext('domain-events', 0);
      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      const result = await subscriber.handleDomainEvents(event, context);

      // Assert
      expect(result).toEqual({ success: true, eventId: event.eventId });
      expect(kurrentClient.appendToStream).toHaveBeenCalledWith(
        'TestAggregate-domain-001',
        [event],
        { expectedRevision: 1 },
      );
    });
  });

  describe('stream name generation', () => {
    it('should generate correct stream name format', async () => {
      // Arrange
      const event = new TestEvent('test', 'custom-id', 'corr-id', 5);
      const context = createMockKafkaContext('system-events');
      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      await subscriber.handleSystemEvents(event, context);

      // Assert
      expect(kurrentClient.appendToStream).toHaveBeenCalledWith(
        'TestAggregate-custom-id',
        [event],
        { expectedRevision: 5 },
      );
    });
  });

  describe('aggregate version handling', () => {
    it('should pass correct aggregate version to Kurrent DB', async () => {
      // Arrange
      const event = new TestEvent('versioned-event', 'agg-001', 'corr-id', 10);
      const context = createMockKafkaContext('system-events');
      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      await subscriber.handleSystemEvents(event, context);

      // Assert
      expect(kurrentClient.appendToStream).toHaveBeenCalledWith(
        expect.any(String),
        [event],
        { expectedRevision: 10 },
      );
    });
  });

  describe('error handling', () => {
    it('should propagate non-Error exceptions', async () => {
      // Arrange
      const event = new TestEvent('error-event');
      const context = createMockKafkaContext('system-events');
      kurrentClient.appendToStream.mockRejectedValue('String error');

      // Act & Assert
      await expect(subscriber.handleSystemEvents(event, context)).rejects.toBe(
        'String error',
      );
    });

    it('should handle Error instances correctly', async () => {
      // Arrange
      const event = new TestEvent('error-event');
      const context = createMockKafkaContext('system-events');
      const error = new Error('Database error');
      kurrentClient.appendToStream.mockRejectedValue(error);

      // Act & Assert
      await expect(
        subscriber.handleSystemEvents(event, context),
      ).rejects.toThrow(error);
    });
  });

  describe('kafka context metadata', () => {
    it('should handle different partition numbers', async () => {
      // Arrange
      const event = new TestEvent('partition-test');
      const context = createMockKafkaContext('system-events', 5);
      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      const result = await subscriber.handleSystemEvents(event, context);

      // Assert
      expect(result.success).toBe(true);
      expect(context.getPartition).toHaveBeenCalled();
    });

    it('should handle different topic names', async () => {
      // Arrange
      const event = new TestEvent('topic-test');
      const context = createMockKafkaContext('custom-topic', 0);
      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      const result = await subscriber.handleSystemEvents(event, context);

      // Assert
      expect(result.success).toBe(true);
      expect(context.getTopic).toHaveBeenCalled();
    });
  });

  describe('multiple event handling', () => {
    it('should handle multiple events sequentially', async () => {
      // Arrange
      const event1 = new TestEvent('event-1', 'agg-1');
      const event2 = new TestEvent('event-2', 'agg-2');
      const context1 = createMockKafkaContext('system-events', 0);
      const context2 = createMockKafkaContext('system-events', 1);
      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      const result1 = await subscriber.handleSystemEvents(event1, context1);
      const result2 = await subscriber.handleSystemEvents(event2, context2);

      // Assert
      expect(result1).toEqual({ success: true, eventId: event1.eventId });
      expect(result2).toEqual({ success: true, eventId: event2.eventId });
      expect(kurrentClient.appendToStream).toHaveBeenCalledTimes(2);
      expect(kurrentClient.appendToStream).toHaveBeenNthCalledWith(
        1,
        'TestAggregate-agg-1',
        [event1],
        { expectedRevision: 1 },
      );
      expect(kurrentClient.appendToStream).toHaveBeenNthCalledWith(
        2,
        'TestAggregate-agg-2',
        [event2],
        { expectedRevision: 1 },
      );
    });
  });

  describe('event metadata preservation', () => {
    it('should preserve all event metadata when persisting', async () => {
      // Arrange
      const event = new TestEvent(
        'metadata-test',
        'aggregate-123',
        'correlation-456',
        7,
      );
      const context = createMockKafkaContext('system-events');
      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      await subscriber.handleSystemEvents(event, context);

      // Assert
      const persistedEvent = kurrentClient.appendToStream.mock.calls[0][1][0];
      expect(persistedEvent.eventId).toBe(event.eventId);
      expect(persistedEvent.eventType).toBe('TestEvent');
      expect(persistedEvent.aggregateId).toBe('aggregate-123');
      expect(persistedEvent.aggregateType).toBe('TestAggregate');
      expect(persistedEvent.aggregateVersion).toBe(7);
      expect(persistedEvent.correlationId).toBe('correlation-456');
      expect(persistedEvent.causationId).toBe('test-causation-id');
    });
  });
});
