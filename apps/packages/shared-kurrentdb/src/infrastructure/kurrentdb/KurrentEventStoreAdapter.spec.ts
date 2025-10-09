import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { EventStoreDBClient } from '@eventstore/db-client';
import { KurrentEventStoreAdapter } from './KurrentEventStoreAdapter';
import { KURRENT_WRITE_CLIENT, KURRENT_READ_CLIENT } from './KurrentModule';
import {
  AppendToStreamEvent,
  AppendOptions,
  AppendResult,
  RecordedEvent,
  ReadStreamOptions,
} from './EventStore';

describe('KurrentEventStoreAdapter', () => {
  let adapter: KurrentEventStoreAdapter;
  let writeClient: MockProxy<EventStoreDBClient>;
  let readClient: MockProxy<EventStoreDBClient>;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    writeClient = mock<EventStoreDBClient>();
    readClient = mock<EventStoreDBClient>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KurrentEventStoreAdapter,
        {
          provide: KURRENT_WRITE_CLIENT,
          useValue: writeClient,
        },
        {
          provide: KURRENT_READ_CLIENT,
          useValue: readClient,
        },
      ],
    }).compile();

    adapter = module.get<KurrentEventStoreAdapter>(KurrentEventStoreAdapter);

    // Logger.errorのスパイを設定
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('appendToStream', () => {
    const streamName = 'test-stream';
    const events: AppendToStreamEvent[] = [
      {
        id: 'event-1',
        type: 'TestEventType',
        data: { foo: 'bar' },
        metadata: { user: 'test-user' },
      },
      {
        id: 'event-2',
        type: 'AnotherEventType',
        data: { baz: 'qux' },
      },
    ];

    it('should append events to stream successfully', async () => {
      // Arrange
      const mockResult = {
        nextExpectedRevision: BigInt(2),
        position: {
          commit: BigInt(100),
          prepare: BigInt(100),
        },
      };
      writeClient.appendToStream.mockResolvedValue(mockResult as any);

      // Act
      const result = await adapter.appendToStream(streamName, events);

      // Assert
      expect(writeClient.appendToStream).toHaveBeenCalledWith(
        streamName,
        [
          {
            contentType: 'application/json',
            id: 'event-1',
            type: 'TestEventType',
            data: { foo: 'bar' },
            metadata: { user: 'test-user' },
          },
          {
            contentType: 'application/json',
            id: 'event-2',
            type: 'AnotherEventType',
            data: { baz: 'qux' },
            metadata: {},
          },
        ],
        { expectedRevision: 'any' },
      );
      expect(result).toEqual({
        nextExpectedRevision: 2,
        position: {
          commit: BigInt(100),
          prepare: BigInt(100),
        },
      });
    });

    it('should use expectedRevision when provided as number', async () => {
      // Arrange
      const mockResult = {
        nextExpectedRevision: BigInt(5),
        position: undefined,
      };
      writeClient.appendToStream.mockResolvedValue(mockResult as any);
      const options: AppendOptions = { expectedRevision: 4 };

      // Act
      await adapter.appendToStream(streamName, events, options);

      // Assert
      expect(writeClient.appendToStream).toHaveBeenCalledWith(
        streamName,
        expect.any(Array),
        { expectedRevision: BigInt(4) },
      );
    });

    it('should use expectedRevision when provided as "no_stream"', async () => {
      // Arrange
      const mockResult = {
        nextExpectedRevision: BigInt(0),
        position: undefined,
      };
      writeClient.appendToStream.mockResolvedValue(mockResult as any);
      const options: AppendOptions = { expectedRevision: 'no_stream' };

      // Act
      await adapter.appendToStream(streamName, events, options);

      // Assert
      expect(writeClient.appendToStream).toHaveBeenCalledWith(
        streamName,
        expect.any(Array),
        { expectedRevision: 'no_stream' },
      );
    });

    it('should use expectedRevision when provided as "stream_exists"', async () => {
      // Arrange
      const mockResult = {
        nextExpectedRevision: BigInt(10),
        position: undefined,
      };
      writeClient.appendToStream.mockResolvedValue(mockResult as any);
      const options: AppendOptions = { expectedRevision: 'stream_exists' };

      // Act
      await adapter.appendToStream(streamName, events, options);

      // Assert
      expect(writeClient.appendToStream).toHaveBeenCalledWith(
        streamName,
        expect.any(Array),
        { expectedRevision: 'stream_exists' },
      );
    });

    it('should handle append errors and log them', async () => {
      // Arrange
      const error = new Error('Append failed');
      writeClient.appendToStream.mockRejectedValue(error);

      // Act & Assert
      await expect(adapter.appendToStream(streamName, events)).rejects.toThrow(
        'Append failed',
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to append to stream',
        {
          streamName,
          error: 'Append failed',
        },
      );
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      const error = 'String error';
      writeClient.appendToStream.mockRejectedValue(error);

      // Act & Assert
      await expect(adapter.appendToStream(streamName, events)).rejects.toBe(
        'String error',
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to append to stream',
        {
          streamName,
          error: 'String error',
        },
      );
    });
  });

  describe('readStream', () => {
    const streamName = 'test-stream';

    it('should read events from stream successfully', async () => {
      // Arrange
      const mockResolvedEvents = [
        {
          event: {
            id: 'event-1',
            type: 'TestEventType',
            streamId: streamName,
            revision: BigInt(0),
            data: { foo: 'bar' },
            metadata: { user: 'test-user' },
            created: new Date('2025-01-01'),
            position: { commit: BigInt(10), prepare: BigInt(10) },
          },
        },
        {
          event: {
            id: 'event-2',
            type: 'AnotherEventType',
            streamId: streamName,
            revision: BigInt(1),
            data: { baz: 'qux' },
            metadata: {},
            created: new Date('2025-01-02'),
            position: { commit: BigInt(20), prepare: BigInt(20) },
          },
        },
      ];

      async function* mockAsyncIterator() {
        for (const event of mockResolvedEvents) {
          yield event;
        }
      }

      readClient.readStream.mockReturnValue(mockAsyncIterator() as any);

      // Act
      const result = await adapter.readStream(streamName);

      // Assert
      expect(readClient.readStream).toHaveBeenCalledWith(streamName, {
        direction: 'forwards',
        fromRevision: 'start',
        maxCount: undefined,
      });
      expect(result).toEqual([
        {
          id: 'event-1',
          type: 'TestEventType',
          streamName: streamName,
          revision: 0,
          data: { foo: 'bar' },
          metadata: { user: 'test-user' },
          created: new Date('2025-01-01'),
          position: { commit: BigInt(10), prepare: BigInt(10) },
        },
        {
          id: 'event-2',
          type: 'AnotherEventType',
          streamName: streamName,
          revision: 1,
          data: { baz: 'qux' },
          metadata: {},
          created: new Date('2025-01-02'),
          position: { commit: BigInt(20), prepare: BigInt(20) },
        },
      ]);
    });

    it('should read events with backwards direction', async () => {
      // Arrange
      async function* mockAsyncIterator() {
        return;
      }

      readClient.readStream.mockReturnValue(mockAsyncIterator() as any);
      const options: ReadStreamOptions = { direction: 'backwards' };

      // Act
      await adapter.readStream(streamName, options);

      // Assert
      expect(readClient.readStream).toHaveBeenCalledWith(streamName, {
        direction: 'backwards',
        fromRevision: 'start',
        maxCount: undefined,
      });
    });

    it('should read events with fromRevision as number', async () => {
      // Arrange
      async function* mockAsyncIterator() {
        return;
      }

      readClient.readStream.mockReturnValue(mockAsyncIterator() as any);
      const options: ReadStreamOptions = { fromRevision: 5 };

      // Act
      await adapter.readStream(streamName, options);

      // Assert
      expect(readClient.readStream).toHaveBeenCalledWith(streamName, {
        direction: 'forwards',
        fromRevision: BigInt(5),
        maxCount: undefined,
      });
    });

    it('should read events with fromRevision as "end"', async () => {
      // Arrange
      async function* mockAsyncIterator() {
        return;
      }

      readClient.readStream.mockReturnValue(mockAsyncIterator() as any);
      const options: ReadStreamOptions = { fromRevision: 'end' };

      // Act
      await adapter.readStream(streamName, options);

      // Assert
      expect(readClient.readStream).toHaveBeenCalledWith(streamName, {
        direction: 'forwards',
        fromRevision: 'end',
        maxCount: undefined,
      });
    });

    it('should read events with maxCount', async () => {
      // Arrange
      async function* mockAsyncIterator() {
        return;
      }

      readClient.readStream.mockReturnValue(mockAsyncIterator() as any);
      const options: ReadStreamOptions = { maxCount: 10 };

      // Act
      await adapter.readStream(streamName, options);

      // Assert
      expect(readClient.readStream).toHaveBeenCalledWith(streamName, {
        direction: 'forwards',
        fromRevision: 'start',
        maxCount: 10,
      });
    });

    it('should return empty array when stream is not found', async () => {
      // Arrange
      const error = { code: 'STREAM_NOT_FOUND' };
      readClient.readStream.mockImplementation(() => {
        throw error;
      });

      // Act
      const result = await adapter.readStream(streamName);

      // Assert
      expect(result).toEqual([]);
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('should return empty array when stream type is not found', async () => {
      // Arrange
      const error = { type: 'stream-not-found' };
      readClient.readStream.mockImplementation(() => {
        throw error;
      });

      // Act
      const result = await adapter.readStream(streamName);

      // Assert
      expect(result).toEqual([]);
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle read errors and log them', async () => {
      // Arrange
      const error = new Error('Read failed');
      readClient.readStream.mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      await expect(adapter.readStream(streamName)).rejects.toThrow(
        'Read failed',
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith('Failed to read stream', {
        streamName,
        error: 'Read failed',
      });
    });

    it('should throw error when resolved event does not contain event', async () => {
      // Arrange
      const mockResolvedEvents = [
        {
          event: null, // event is null
        },
      ];

      async function* mockAsyncIterator() {
        for (const event of mockResolvedEvents) {
          yield event;
        }
      }

      readClient.readStream.mockReturnValue(mockAsyncIterator() as any);

      // Act & Assert
      await expect(adapter.readStream(streamName)).rejects.toThrow(
        'ResolvedEvent does not contain an event',
      );
    });
  });

  describe('readCategoryStream', () => {
    it('should read category stream successfully', async () => {
      // Arrange
      const category = 'TestAggregate';
      const expectedStreamName = '$ce-TestAggregate';
      const mockResolvedEvents = [
        {
          event: {
            id: 'event-1',
            type: 'TestEventType',
            streamId: 'TestAggregate-123',
            revision: BigInt(0),
            data: { foo: 'bar' },
            metadata: {},
            created: new Date('2025-01-01'),
            position: { commit: BigInt(10), prepare: BigInt(10) },
          },
        },
      ];

      async function* mockAsyncIterator() {
        for (const event of mockResolvedEvents) {
          yield event;
        }
      }

      readClient.readStream.mockReturnValue(mockAsyncIterator() as any);

      // Act
      const result = await adapter.readCategoryStream(category);

      // Assert
      expect(readClient.readStream).toHaveBeenCalledWith(expectedStreamName, {
        direction: 'forwards',
        fromRevision: 'start',
        maxCount: undefined,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('event-1');
    });

    it('should pass options to readStream', async () => {
      // Arrange
      const category = 'TestAggregate';
      const expectedStreamName = '$ce-TestAggregate';

      async function* mockAsyncIterator() {
        return;
      }

      readClient.readStream.mockReturnValue(mockAsyncIterator() as any);
      const options: ReadStreamOptions = {
        direction: 'backwards',
        fromRevision: 10,
        maxCount: 5,
      };

      // Act
      await adapter.readCategoryStream(category, options);

      // Assert
      expect(readClient.readStream).toHaveBeenCalledWith(expectedStreamName, {
        direction: 'backwards',
        fromRevision: BigInt(10),
        maxCount: 5,
      });
    });
  });

  describe('streamExists', () => {
    const streamName = 'test-stream';

    it('should return true when stream exists', async () => {
      // Arrange
      const mockResolvedEvents = [
        {
          event: {
            id: 'event-1',
            type: 'TestEventType',
            streamId: streamName,
            revision: BigInt(0),
            data: { foo: 'bar' },
            metadata: {},
            created: new Date('2025-01-01'),
            position: { commit: BigInt(10), prepare: BigInt(10) },
          },
        },
      ];

      async function* mockAsyncIterator() {
        for (const event of mockResolvedEvents) {
          yield event;
        }
      }

      readClient.readStream.mockReturnValue(mockAsyncIterator() as any);

      // Act
      const result = await adapter.streamExists(streamName);

      // Assert
      expect(result).toBe(true);
      expect(readClient.readStream).toHaveBeenCalledWith(streamName, {
        direction: 'forwards',
        fromRevision: 'start',
        maxCount: 1,
      });
    });

    it('should return false when stream is empty', async () => {
      // Arrange
      async function* mockAsyncIterator() {
        return; // Empty iterator
      }

      readClient.readStream.mockReturnValue(mockAsyncIterator() as any);

      // Act
      const result = await adapter.streamExists(streamName);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when stream is not found (code)', async () => {
      // Arrange
      const error = { code: 'STREAM_NOT_FOUND' };
      readClient.readStream.mockImplementation(() => {
        throw error;
      });

      // Act
      const result = await adapter.streamExists(streamName);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when stream is not found (type)', async () => {
      // Arrange
      const error = { type: 'stream-not-found' };
      readClient.readStream.mockImplementation(() => {
        throw error;
      });

      // Act
      const result = await adapter.streamExists(streamName);

      // Assert
      expect(result).toBe(false);
    });

    it('should throw error for other errors', async () => {
      // Arrange
      const error = new Error('Connection failed');
      readClient.readStream.mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      await expect(adapter.streamExists(streamName)).rejects.toThrow(
        'Connection failed',
      );
    });
  });

  describe('Helper methods - edge cases', () => {
    it('should handle metadata as undefined', async () => {
      // Arrange
      const streamName = 'test-stream';
      const mockResolvedEvents = [
        {
          event: {
            id: 'event-1',
            type: 'TestEventType',
            streamId: streamName,
            revision: BigInt(0),
            data: { foo: 'bar' },
            metadata: undefined, // undefined metadata
            created: new Date('2025-01-01'),
            position: { commit: BigInt(10), prepare: BigInt(10) },
          },
        },
      ];

      async function* mockAsyncIterator() {
        for (const event of mockResolvedEvents) {
          yield event;
        }
      }

      readClient.readStream.mockReturnValue(mockAsyncIterator() as any);

      // Act
      const result = await adapter.readStream(streamName);

      // Assert
      expect(result[0].metadata).toEqual({});
    });
  });
});
