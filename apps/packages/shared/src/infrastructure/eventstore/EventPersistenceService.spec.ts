import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import {
  EventPersistenceService,
  EVENT_STORE,
} from './EventPersistenceService';
import { EventStore, AppendResult } from './EventStore';
import { DomainEvent } from '../../domain/base/DomainEvent';
import { EventSerializerRegistry } from './EventSerializerRegistry';

// テスト用のDomainEvent実装
class TestEvent extends DomainEvent {
  constructor(
    eventType: string,
    public readonly testData: string,
    aggregateId: string = 'test-aggregate-id',
    aggregateType: string = 'TestAggregate',
    aggregateVersion: number = 1,
    correlationId: string = 'test-correlation-id',
    causationId?: string,
  ) {
    super(
      eventType,
      aggregateId,
      aggregateType,
      aggregateVersion,
      correlationId,
      causationId,
    );
  }

  getData(): unknown {
    return { testData: this.testData };
  }
}

describe('EventPersistenceService', () => {
  let service: EventPersistenceService;
  let eventStore: MockProxy<EventStore>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    eventStore = mock<EventStore>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventPersistenceService,
        {
          provide: EVENT_STORE,
          useValue: eventStore,
        },
      ],
    }).compile();

    service = module.get<EventPersistenceService>(EventPersistenceService);

    // Logger.debugのスパイを設定
    loggerSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // EventSerializerRegistryをリセット
    EventSerializerRegistry.setStrictMode(true);
  });

  describe('persistDomainEvent', () => {
    const mockAppendResult: AppendResult = {
      nextExpectedRevision: 1,
      position: {
        commit: BigInt(100),
        prepare: BigInt(100),
      },
    };

    beforeEach(() => {
      eventStore.appendToStream.mockResolvedValue(mockAppendResult);
      // デフォルトのシリアライザーを登録
      EventSerializerRegistry.register('TestEvent', {
        serialize: (data: unknown): Record<string, any> =>
          data as Record<string, any>,
        deserialize: (data: Record<string, any>): unknown => data,
      });
    });

    it('should persist domain event to event store successfully', async () => {
      // Arrange
      const event = new TestEvent(
        'TestEvent',
        'test-data',
        'agg-123',
        'TestAggregate',
        1,
      );

      // Act
      await service.persistDomainEvent(event);

      // Assert
      expect(eventStore.appendToStream).toHaveBeenCalledTimes(1);
      expect(eventStore.appendToStream).toHaveBeenCalledWith(
        'TestAggregate-agg-123',
        [
          {
            id: event.eventId,
            type: 'TestEvent',
            data: { testData: 'test-data' },
            metadata: {
              correlationId: event.correlationId,
              causationId: event.causationId,
              occurredOn: event.occurredOn.toISOString(),
              aggregateVersion: 1,
            },
          },
        ],
        {
          expectedRevision: 0,
        },
      );
    });

    it('should generate correct stream name from aggregateType and aggregateId', async () => {
      // Arrange
      const event = new TestEvent(
        'TestEvent',
        'test-data',
        'system-456',
        'System',
        1,
      );

      // Act
      await service.persistDomainEvent(event);

      // Assert
      expect(eventStore.appendToStream).toHaveBeenCalledWith(
        'System-system-456',
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('should serialize event data using EventSerializerRegistry', async () => {
      // Arrange
      const customSerializer = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        serialize: jest.fn((data: any) => ({ serialized: true, ...data })),
        deserialize: jest.fn(),
      };
      EventSerializerRegistry.register('CustomEvent', customSerializer);

      const event = new TestEvent(
        'CustomEvent',
        'custom-data',
        'agg-789',
        'Custom',
        2,
      );

      // Act
      await service.persistDomainEvent(event);

      // Assert
      expect(customSerializer.serialize).toHaveBeenCalledWith({
        testData: 'custom-data',
      });
      expect(eventStore.appendToStream).toHaveBeenCalledWith(
        expect.any(String),
        [
          expect.objectContaining({
            data: { serialized: true, testData: 'custom-data' },
          }),
        ],
        expect.any(Object),
      );
    });

    it('should include all metadata fields', async () => {
      // Arrange
      const event = new TestEvent(
        'TestEvent',
        'metadata-test',
        'agg-001',
        'TestAggregate',
        3,
        'corr-123',
        'cause-456',
      );

      // Act
      await service.persistDomainEvent(event);

      // Assert
      expect(eventStore.appendToStream).toHaveBeenCalledWith(
        expect.any(String),
        [
          expect.objectContaining({
            metadata: {
              correlationId: 'corr-123',
              causationId: 'cause-456',
              occurredOn: event.occurredOn.toISOString(),
              aggregateVersion: 3,
            },
          }),
        ],
        expect.any(Object),
      );
    });

    it('should handle undefined causationId in metadata', async () => {
      // Arrange
      const event = new TestEvent(
        'TestEvent',
        'no-causation',
        'agg-002',
        'TestAggregate',
        1,
        'corr-789',
        undefined,
      );

      // Act
      await service.persistDomainEvent(event);

      // Assert
      expect(eventStore.appendToStream).toHaveBeenCalledWith(
        expect.any(String),
        [
          expect.objectContaining({
            metadata: expect.objectContaining({
              causationId: undefined,
            }),
          }),
        ],
        expect.any(Object),
      );
    });

    it('should calculate expectedRevision as aggregateVersion - 1', async () => {
      // Arrange
      const event = new TestEvent(
        'TestEvent',
        'version-test',
        'agg-003',
        'TestAggregate',
        5,
      );

      // Act
      await service.persistDomainEvent(event);

      // Assert
      expect(eventStore.appendToStream).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        {
          expectedRevision: 4,
        },
      );
    });

    it('should use expectedRevision 0 for first event (version 1)', async () => {
      // Arrange
      const event = new TestEvent(
        'TestEvent',
        'first-event',
        'agg-004',
        'TestAggregate',
        1,
      );

      // Act
      await service.persistDomainEvent(event);

      // Assert
      expect(eventStore.appendToStream).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        {
          expectedRevision: 0,
        },
      );
    });

    it('should serialize occurredOn to ISO string format', async () => {
      // Arrange
      const event = new TestEvent('TestEvent', 'date-test');
      const expectedISO = event.occurredOn.toISOString();

      // Act
      await service.persistDomainEvent(event);

      // Assert
      const callArgs = eventStore.appendToStream.mock.calls[0];
      const metadata = (callArgs[1] as any)[0].metadata;
      expect(metadata.occurredOn).toBe(expectedISO);
      expect(typeof metadata.occurredOn).toBe('string');
    });

    it('should log debug message after successful persistence', async () => {
      // Arrange
      const event = new TestEvent(
        'TestEvent',
        'log-test',
        'agg-005',
        'TestAggregate',
        2,
      );

      // Act
      await service.persistDomainEvent(event);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith('Event persisted to event store', {
        eventType: 'TestEvent',
        eventId: event.eventId,
        streamName: 'TestAggregate-agg-005',
        aggregateVersion: 2,
      });
    });

    it('should preserve event ID from domain event', async () => {
      // Arrange
      const event = new TestEvent('TestEvent', 'id-test');

      // Act
      await service.persistDomainEvent(event);

      // Assert
      expect(eventStore.appendToStream).toHaveBeenCalledWith(
        expect.any(String),
        [
          expect.objectContaining({
            id: event.eventId,
          }),
        ],
        expect.any(Object),
      );
    });

    it('should use event type from domain event', async () => {
      // Arrange
      EventSerializerRegistry.register('CustomEventType', {
        serialize: (data: any) => data,
        deserialize: (data: any) => data,
      });
      const event = new TestEvent('CustomEventType', 'type-test');

      // Act
      await service.persistDomainEvent(event);

      // Assert
      expect(eventStore.appendToStream).toHaveBeenCalledWith(
        expect.any(String),
        [
          expect.objectContaining({
            type: 'CustomEventType',
          }),
        ],
        expect.any(Object),
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      EventSerializerRegistry.register('TestEvent', {
        serialize: (data: any) => data,
        deserialize: (data: any) => data,
      });
    });

    it('should propagate EventStore errors', async () => {
      // Arrange
      const event = new TestEvent('TestEvent', 'error-test');
      const error = new Error('EventStore connection failed');
      eventStore.appendToStream.mockRejectedValue(error);

      // Act & Assert
      await expect(service.persistDomainEvent(event)).rejects.toThrow(
        'EventStore connection failed',
      );
    });

    it('should propagate concurrency errors from EventStore', async () => {
      // Arrange
      const event = new TestEvent(
        'TestEvent',
        'concurrency-test',
        'agg-006',
        'TestAggregate',
        5,
      );
      const concurrencyError = new Error('Wrong expected version');
      eventStore.appendToStream.mockRejectedValue(concurrencyError);

      // Act & Assert
      await expect(service.persistDomainEvent(event)).rejects.toThrow(
        'Wrong expected version',
      );
    });

    it('should throw error when serializer is not registered in strict mode', async () => {
      // Arrange
      EventSerializerRegistry.setStrictMode(true);
      const event = new TestEvent('UnregisteredEvent', 'no-serializer');

      // Act & Assert
      await expect(service.persistDomainEvent(event)).rejects.toThrow(
        'No serializer registered for event type: UnregisteredEvent',
      );
    });
  });

  describe('stream name generation', () => {
    beforeEach(() => {
      eventStore.appendToStream.mockResolvedValue({
        nextExpectedRevision: 1,
      });
      EventSerializerRegistry.register('TestEvent', {
        serialize: (data: any) => data,
        deserialize: (data: any) => data,
      });
    });

    it('should create stream name with format: aggregateType-aggregateId', async () => {
      // Arrange
      const testCases = [
        { type: 'System', id: 'sys-001', expected: 'System-sys-001' },
        { type: 'Task', id: 'task-123', expected: 'Task-task-123' },
        {
          type: 'Vulnerability',
          id: 'vuln-456',
          expected: 'Vulnerability-vuln-456',
        },
      ];

      for (const testCase of testCases) {
        // Act
        const event = new TestEvent(
          'TestEvent',
          'data',
          testCase.id,
          testCase.type,
          1,
        );
        await service.persistDomainEvent(event);

        // Assert
        expect(eventStore.appendToStream).toHaveBeenCalledWith(
          testCase.expected,
          expect.any(Array),
          expect.any(Object),
        );
      }
    });

    it('should handle special characters in aggregate IDs', async () => {
      // Arrange
      const event = new TestEvent(
        'TestEvent',
        'special-chars',
        'agg-with-special_chars.123',
        'TestAggregate',
        1,
      );

      // Act
      await service.persistDomainEvent(event);

      // Assert
      expect(eventStore.appendToStream).toHaveBeenCalledWith(
        'TestAggregate-agg-with-special_chars.123',
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('should handle UUID format aggregate IDs', async () => {
      // Arrange
      const uuidAggregateId = '550e8400-e29b-41d4-a716-446655440000';
      const event = new TestEvent(
        'TestEvent',
        'uuid-test',
        uuidAggregateId,
        'TestAggregate',
        1,
      );

      // Act
      await service.persistDomainEvent(event);

      // Assert
      expect(eventStore.appendToStream).toHaveBeenCalledWith(
        `TestAggregate-${uuidAggregateId}`,
        expect.any(Array),
        expect.any(Object),
      );
    });
  });
});
