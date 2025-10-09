import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { IdempotentEventHandler } from './IdempotentEventHandler';
import { ProcessedEventService } from '../interfaces/ProcessedEventService';
import { DomainEvent } from '../../domain/base/DomainEvent';

// テスト用のDomainEvent実装
class TestEvent extends DomainEvent {
  constructor(
    public readonly testData: string,
    aggregateId: string = 'test-aggregate-id',
    correlationId: string = 'test-correlation-id',
  ) {
    super(
      'TestEvent',
      aggregateId,
      'TestAggregate',
      1,
      correlationId,
      'test-causation-id',
    );
  }

  getData(): unknown {
    return { testData: this.testData };
  }
}

describe('IdempotentEventHandler', () => {
  let idempotentHandler: IdempotentEventHandler;
  let processedEventService: MockProxy<ProcessedEventService>;

  beforeEach(async () => {
    processedEventService = mock<ProcessedEventService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: IdempotentEventHandler,
          useFactory: () => new IdempotentEventHandler(processedEventService),
        },
      ],
    }).compile();

    idempotentHandler = module.get<IdempotentEventHandler>(
      IdempotentEventHandler,
    );
  });

  describe('handleWithIdempotency', () => {
    it('should process new event and mark as processed', async () => {
      // Arrange
      const event = new TestEvent('test-data');
      const handler = jest.fn().mockResolvedValue(undefined);
      processedEventService.isProcessed.mockResolvedValue(false);
      processedEventService.markAsProcessed.mockResolvedValue(undefined);

      // Act
      await idempotentHandler.handleWithIdempotency(event, handler);

      // Assert
      expect(processedEventService.isProcessed).toHaveBeenCalledWith(
        event.eventId,
      );
      expect(handler).toHaveBeenCalledWith(event);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(processedEventService.markAsProcessed).toHaveBeenCalledWith(
        event.eventId,
        event.eventType,
        expect.any(Date),
      );
    });

    it('should skip already processed event', async () => {
      // Arrange
      const event = new TestEvent('already-processed');
      const handler = jest.fn().mockResolvedValue(undefined);
      processedEventService.isProcessed.mockResolvedValue(true);

      // Act
      await idempotentHandler.handleWithIdempotency(event, handler);

      // Assert
      expect(processedEventService.isProcessed).toHaveBeenCalledWith(
        event.eventId,
      );
      expect(handler).not.toHaveBeenCalled();
      expect(processedEventService.markAsProcessed).not.toHaveBeenCalled();
    });

    it('should not mark as processed if handler fails', async () => {
      // Arrange
      const event = new TestEvent('failing-event');
      const error = new Error('Handler processing failed');
      const handler = jest.fn().mockRejectedValue(error);
      processedEventService.isProcessed.mockResolvedValue(false);

      // Act & Assert
      await expect(
        idempotentHandler.handleWithIdempotency(event, handler),
      ).rejects.toThrow('Handler processing failed');

      expect(processedEventService.isProcessed).toHaveBeenCalledWith(
        event.eventId,
      );
      expect(handler).toHaveBeenCalledWith(event);
      expect(processedEventService.markAsProcessed).not.toHaveBeenCalled();
    });

    it('should propagate handler errors', async () => {
      // Arrange
      const event = new TestEvent('error-event');
      const customError = new Error('Custom handler error');
      const handler = jest.fn().mockRejectedValue(customError);
      processedEventService.isProcessed.mockResolvedValue(false);

      // Act & Assert
      await expect(
        idempotentHandler.handleWithIdempotency(event, handler),
      ).rejects.toThrow(customError);
    });

    it('should handle multiple events sequentially', async () => {
      // Arrange
      const event1 = new TestEvent('event-1');
      const event2 = new TestEvent('event-2');
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      processedEventService.isProcessed.mockResolvedValue(false);
      processedEventService.markAsProcessed.mockResolvedValue(undefined);

      // Act
      await idempotentHandler.handleWithIdempotency(event1, handler1);
      await idempotentHandler.handleWithIdempotency(event2, handler2);

      // Assert
      expect(processedEventService.isProcessed).toHaveBeenCalledTimes(2);
      expect(handler1).toHaveBeenCalledWith(event1);
      expect(handler2).toHaveBeenCalledWith(event2);
      expect(processedEventService.markAsProcessed).toHaveBeenCalledTimes(2);
    });

    it('should process event even if previous one was already processed', async () => {
      // Arrange
      const processedEvent = new TestEvent('already-processed');
      const newEvent = new TestEvent('new-event');
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      processedEventService.isProcessed
        .mockResolvedValueOnce(true) // First event is processed
        .mockResolvedValueOnce(false); // Second event is new
      processedEventService.markAsProcessed.mockResolvedValue(undefined);

      // Act
      await idempotentHandler.handleWithIdempotency(processedEvent, handler1);
      await idempotentHandler.handleWithIdempotency(newEvent, handler2);

      // Assert
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith(newEvent);
      expect(processedEventService.markAsProcessed).toHaveBeenCalledTimes(1);
      expect(processedEventService.markAsProcessed).toHaveBeenCalledWith(
        newEvent.eventId,
        newEvent.eventType,
        expect.any(Date),
      );
    });

    it('should pass correct event metadata to markAsProcessed', async () => {
      // Arrange
      const event = new TestEvent(
        'metadata-test',
        'custom-aggregate-id',
        'custom-correlation-id',
      );
      const handler = jest.fn().mockResolvedValue(undefined);
      processedEventService.isProcessed.mockResolvedValue(false);
      processedEventService.markAsProcessed.mockResolvedValue(undefined);

      const beforeProcessing = new Date();

      // Act
      await idempotentHandler.handleWithIdempotency(event, handler);

      const afterProcessing = new Date();

      // Assert
      const markAsProcessedCall =
        processedEventService.markAsProcessed.mock.calls[0];
      expect(markAsProcessedCall[0]).toBe(event.eventId);
      expect(markAsProcessedCall[1]).toBe('TestEvent');
      expect(markAsProcessedCall[2]).toBeInstanceOf(Date);
      expect(markAsProcessedCall[2].getTime()).toBeGreaterThanOrEqual(
        beforeProcessing.getTime(),
      );
      expect(markAsProcessedCall[2].getTime()).toBeLessThanOrEqual(
        afterProcessing.getTime(),
      );
    });

    it('should handle async handler correctly', async () => {
      // Arrange
      const event = new TestEvent('async-event');
      let handlerExecuted = false;
      const asyncHandler = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        handlerExecuted = true;
      });

      processedEventService.isProcessed.mockResolvedValue(false);
      processedEventService.markAsProcessed.mockResolvedValue(undefined);

      // Act
      await idempotentHandler.handleWithIdempotency(event, asyncHandler);

      // Assert
      expect(handlerExecuted).toBe(true);
      expect(asyncHandler).toHaveBeenCalledWith(event);
      expect(processedEventService.markAsProcessed).toHaveBeenCalled();
    });

    it('should not interfere with handler return value', async () => {
      // Arrange
      const event = new TestEvent('return-value-test');
      const handler = jest.fn().mockResolvedValue(undefined);

      processedEventService.isProcessed.mockResolvedValue(false);
      processedEventService.markAsProcessed.mockResolvedValue(undefined);

      // Act
      const result = await idempotentHandler.handleWithIdempotency(
        event,
        handler,
      );

      // Assert
      expect(result).toBeUndefined();
    });

    it('should handle non-Error exceptions from handler', async () => {
      // Arrange
      const event = new TestEvent('non-error-exception');
      const handler = jest.fn().mockRejectedValue('String error');
      processedEventService.isProcessed.mockResolvedValue(false);

      // Act & Assert
      await expect(
        idempotentHandler.handleWithIdempotency(event, handler),
      ).rejects.toBe('String error');
      expect(processedEventService.markAsProcessed).not.toHaveBeenCalled();
    });
  });
});
