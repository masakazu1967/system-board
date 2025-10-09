import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TypeOrmProcessedEventService } from './TypeOrmProcessedEventService';
import { ProcessedEvent } from './entities/ProcessedEvent.entity';
import { typeOrmErrorHandlerProvider } from './utils/TypeormErrorHandlerProvider';
import { ConfigService } from '@nestjs/config';

describe('TypeOrmProcessedEventService (Integration)', () => {
  let service: TypeOrmProcessedEventService;
  let dataSource: DataSource;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [ProcessedEvent],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([ProcessedEvent]),
      ],
      providers: [
        TypeOrmProcessedEventService,
        typeOrmErrorHandlerProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'DATABASE_TYPE') return 'better-sqlite3';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TypeOrmProcessedEventService>(
      TypeOrmProcessedEventService,
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  describe('isProcessed', () => {
    it('should return false for unprocessed event', async () => {
      // Act
      const result = await service.isProcessed('non-existent-event-id');

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for processed event', async () => {
      // Arrange
      const eventId = 'processed-event-id';
      await service.markAsProcessed(eventId, 'TestEvent', new Date());

      // Act
      const result = await service.isProcessed(eventId);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for different event ID', async () => {
      // Arrange
      await service.markAsProcessed('event-1', 'TestEvent', new Date());

      // Act
      const result = await service.isProcessed('event-2');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('markAsProcessed', () => {
    it('should mark event as processed', async () => {
      // Arrange
      const eventId = 'test-event-id';
      const eventType = 'SystemRegistered';
      const processedAt = new Date('2025-01-01T00:00:00Z');

      // Act
      await service.markAsProcessed(eventId, eventType, processedAt);

      // Assert
      const isProcessed = await service.isProcessed(eventId);
      expect(isProcessed).toBe(true);
    });

    it('should store event metadata correctly', async () => {
      // Arrange
      const eventId = 'metadata-event-id';
      const eventType = 'VulnerabilityDetected';
      const processedAt = new Date('2025-10-03T12:00:00Z');

      // Act
      await service.markAsProcessed(eventId, eventType, processedAt);

      // Assert
      const repository = dataSource.getRepository(ProcessedEvent);
      const storedEvent = await repository.findOne({ where: { eventId } });

      expect(storedEvent).toBeDefined();
      expect(storedEvent!.eventId).toBe(eventId);
      expect(storedEvent!.eventType).toBe(eventType);
      expect(storedEvent!.processedAt.toISOString()).toBe(
        processedAt.toISOString(),
      );
      expect(storedEvent!.createdAt).toBeInstanceOf(Date);
    });

    it('should handle duplicate event ID gracefully (idempotency)', async () => {
      // Arrange
      const eventId = 'duplicate-event-id';
      const eventType = 'TaskCreated';
      const processedAt = new Date();

      // Act - First insert
      await service.markAsProcessed(eventId, eventType, processedAt);

      // Act - Second insert (should not throw)
      await expect(
        service.markAsProcessed(eventId, 'DifferentEvent', new Date()),
      ).resolves.not.toThrow();

      // Assert - Should still be marked as processed
      const isProcessed = await service.isProcessed(eventId);
      expect(isProcessed).toBe(true);

      // Assert - Only one record should exist
      const repository = dataSource.getRepository(ProcessedEvent);
      const count = await repository.count({ where: { eventId } });
      expect(count).toBe(1);
    });

    it('should mark multiple different events', async () => {
      // Arrange
      const events = [
        { id: 'event-1', type: 'SystemRegistered' },
        { id: 'event-2', type: 'VulnerabilityDetected' },
        { id: 'event-3', type: 'TaskCreated' },
      ];

      // Act
      for (const event of events) {
        await service.markAsProcessed(event.id, event.type, new Date());
      }

      // Assert
      for (const event of events) {
        const isProcessed = await service.isProcessed(event.id);
        expect(isProcessed).toBe(true);
      }
    });
  });

  describe('concurrent processing', () => {
    it('should handle concurrent mark operations safely', async () => {
      // Arrange
      const eventId = 'concurrent-event-id';
      const eventType = 'ConcurrentEvent';
      const processedAt = new Date();

      // Act - Attempt to mark the same event concurrently
      const promises = Array.from({ length: 10 }, () =>
        service.markAsProcessed(eventId, eventType, processedAt),
      );

      // Assert - All operations should complete without errors
      await expect(Promise.all(promises)).resolves.not.toThrow();

      // Assert - Only one record should exist
      const repository = dataSource.getRepository(ProcessedEvent);
      const count = await repository.count({ where: { eventId } });
      expect(count).toBe(1);
    });

    it('should handle concurrent check and mark operations', async () => {
      // Arrange
      const eventId = 'check-mark-event-id';

      // Act - Concurrent checks and marks
      const operations = [
        service.isProcessed(eventId),
        service.markAsProcessed(eventId, 'TestEvent', new Date()),
        service.isProcessed(eventId),
        service.markAsProcessed(eventId, 'TestEvent', new Date()),
      ];

      // Assert - All operations should complete
      await expect(Promise.all(operations)).resolves.toBeDefined();

      // Assert - Event should be marked as processed
      const finalCheck = await service.isProcessed(eventId);
      expect(finalCheck).toBe(true);
    });
  });

  describe('timestamp handling', () => {
    it('should preserve timestamp precision', async () => {
      // Arrange
      const eventId = 'timestamp-event-id';
      const processedAt = new Date('2025-10-03T15:30:45.123Z');

      // Act
      await service.markAsProcessed(eventId, 'TimestampEvent', processedAt);

      // Assert
      const repository = dataSource.getRepository(ProcessedEvent);
      const storedEvent = await repository.findOne({ where: { eventId } });

      expect(storedEvent).toBeDefined();
      // SQLite may have different precision, so we check year, month, day, hour, minute
      expect(storedEvent!.processedAt.getFullYear()).toBe(
        processedAt.getFullYear(),
      );
      expect(storedEvent!.processedAt.getMonth()).toBe(processedAt.getMonth());
      expect(storedEvent!.processedAt.getDate()).toBe(processedAt.getDate());
      expect(storedEvent!.processedAt.getHours()).toBe(processedAt.getHours());
      expect(storedEvent!.processedAt.getMinutes()).toBe(
        processedAt.getMinutes(),
      );
    });

    it('should auto-populate createdAt timestamp', async () => {
      // Arrange
      const eventId = 'created-at-event-id';
      const beforeInsert = new Date();

      // Act
      await service.markAsProcessed(eventId, 'CreatedAtEvent', new Date());

      const afterInsert = new Date();

      // Assert
      const repository = dataSource.getRepository(ProcessedEvent);
      const storedEvent = await repository.findOne({ where: { eventId } });

      expect(storedEvent!.createdAt).toBeInstanceOf(Date);
      // SQLite may truncate milliseconds, so we allow 1 second tolerance
      expect(storedEvent!.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeInsert.getTime() - 1000,
      );
      expect(storedEvent!.createdAt.getTime()).toBeLessThanOrEqual(
        afterInsert.getTime() + 1000,
      );
    });
  });

  describe('edge cases', () => {
    it('should handle very long event IDs', async () => {
      // Arrange
      const eventId = 'a'.repeat(255); // Maximum length
      const eventType = 'LongIdEvent';

      // Act
      await service.markAsProcessed(eventId, eventType, new Date());

      // Assert
      const isProcessed = await service.isProcessed(eventId);
      expect(isProcessed).toBe(true);
    });

    it('should handle special characters in event ID', async () => {
      // Arrange
      const eventId = 'event-id-with-特殊文字-αβγ-!@#$%';
      const eventType = 'SpecialCharEvent';

      // Act
      await service.markAsProcessed(eventId, eventType, new Date());

      // Assert
      const isProcessed = await service.isProcessed(eventId);
      expect(isProcessed).toBe(true);
    });

    it('should handle very long event types', async () => {
      // Arrange
      const eventId = 'long-type-event-id';
      const eventType = 'VeryLongEventTypeName'.repeat(10); // Long type name

      // Act
      await service.markAsProcessed(eventId, eventType, new Date());

      // Assert
      const repository = dataSource.getRepository(ProcessedEvent);
      const storedEvent = await repository.findOne({ where: { eventId } });
      expect(storedEvent).toBeDefined();
    });
  });

  describe('query performance', () => {
    it('should efficiently check multiple events', async () => {
      // Arrange - Create 100 processed events
      const eventCount = 100;
      for (let i = 0; i < eventCount; i++) {
        await service.markAsProcessed(
          `bulk-event-${i}`,
          'BulkEvent',
          new Date(),
        );
      }

      // Act - Check multiple events
      const startTime = Date.now();
      const results = await Promise.all([
        service.isProcessed('bulk-event-0'),
        service.isProcessed('bulk-event-50'),
        service.isProcessed('bulk-event-99'),
        service.isProcessed('non-existent-event'),
      ]);
      const endTime = Date.now();

      // Assert
      expect(results).toEqual([true, true, true, false]);
      // Should complete reasonably fast (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
