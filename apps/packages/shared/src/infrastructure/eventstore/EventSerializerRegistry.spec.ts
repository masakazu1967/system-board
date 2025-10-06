import { EventSerializerRegistry } from './EventSerializerRegistry';
import { EventSerializer } from './EventSerializer';

describe('EventSerializerRegistry', () => {
  // テスト用のシリアライザー
  const mockSerializer: EventSerializer = {
    serialize: jest.fn((data: any) => ({ serialized: true, ...data })),
    deserialize: jest.fn((data: any) => ({ deserialized: true, ...data })),
  };

  const simpleSerializer: EventSerializer = {
    serialize: (data: any) => data,
    deserialize: (data: any) => data,
  };

  beforeEach(() => {
    // 各テスト前にレジストリをクリア
    const registeredTypes = EventSerializerRegistry.getRegisteredEventTypes();
    registeredTypes.forEach((type) => {
      // @ts-expect-error - accessing private property for testing
      EventSerializerRegistry.serializers.delete(type);
    });

    // strict modeをデフォルト(true)に戻す
    EventSerializerRegistry.setStrictMode(true);

    // モックをリセット
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a serializer for an event type', () => {
      // Act
      EventSerializerRegistry.register('TestEvent', mockSerializer);

      // Assert
      expect(EventSerializerRegistry.isRegistered('TestEvent')).toBe(true);
      expect(EventSerializerRegistry.getSerializer('TestEvent')).toBe(
        mockSerializer,
      );
    });

    it('should register multiple serializers for different event types', () => {
      // Arrange
      const serializer1 = { ...mockSerializer };
      const serializer2 = { ...simpleSerializer };

      // Act
      EventSerializerRegistry.register('Event1', serializer1);
      EventSerializerRegistry.register('Event2', serializer2);

      // Assert
      expect(EventSerializerRegistry.isRegistered('Event1')).toBe(true);
      expect(EventSerializerRegistry.isRegistered('Event2')).toBe(true);
      expect(EventSerializerRegistry.getSerializer('Event1')).toBe(serializer1);
      expect(EventSerializerRegistry.getSerializer('Event2')).toBe(serializer2);
    });

    it('should overwrite existing serializer when registering same event type', () => {
      // Arrange
      const oldSerializer = { ...mockSerializer };
      const newSerializer = { ...simpleSerializer };

      // Act
      EventSerializerRegistry.register('TestEvent', oldSerializer);
      EventSerializerRegistry.register('TestEvent', newSerializer);

      // Assert
      expect(EventSerializerRegistry.getSerializer('TestEvent')).toBe(
        newSerializer,
      );
      expect(EventSerializerRegistry.getSerializer('TestEvent')).not.toBe(
        oldSerializer,
      );
    });

    it('should handle event types with special characters', () => {
      // Act
      EventSerializerRegistry.register('Event:With:Colons', mockSerializer);
      EventSerializerRegistry.register('Event.With.Dots', mockSerializer);
      EventSerializerRegistry.register('Event-With-Dashes', mockSerializer);

      // Assert
      expect(EventSerializerRegistry.isRegistered('Event:With:Colons')).toBe(
        true,
      );
      expect(EventSerializerRegistry.isRegistered('Event.With.Dots')).toBe(
        true,
      );
      expect(EventSerializerRegistry.isRegistered('Event-With-Dashes')).toBe(
        true,
      );
    });
  });

  describe('getSerializer', () => {
    it('should return registered serializer', () => {
      // Arrange
      EventSerializerRegistry.register('TestEvent', mockSerializer);

      // Act
      const result = EventSerializerRegistry.getSerializer('TestEvent');

      // Assert
      expect(result).toBe(mockSerializer);
    });

    it('should return undefined for unregistered event type', () => {
      // Act
      const result = EventSerializerRegistry.getSerializer('UnregisteredEvent');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return correct serializer for multiple registered types', () => {
      // Arrange
      const serializer1 = { ...mockSerializer };
      const serializer2 = { ...simpleSerializer };
      EventSerializerRegistry.register('Event1', serializer1);
      EventSerializerRegistry.register('Event2', serializer2);

      // Act & Assert
      expect(EventSerializerRegistry.getSerializer('Event1')).toBe(serializer1);
      expect(EventSerializerRegistry.getSerializer('Event2')).toBe(serializer2);
    });
  });

  describe('serializeEventData', () => {
    it('should serialize data using registered serializer', () => {
      // Arrange
      EventSerializerRegistry.register('TestEvent', mockSerializer);
      const testData = { field1: 'value1', field2: 42 };

      // Act
      const result = EventSerializerRegistry.serializeEventData(
        'TestEvent',
        testData,
      );

      // Assert
      expect(mockSerializer.serialize).toHaveBeenCalledWith(testData);
      expect(result).toEqual({
        serialized: true,
        field1: 'value1',
        field2: 42,
      });
    });

    it('should throw error in strict mode when serializer is not registered', () => {
      // Arrange
      EventSerializerRegistry.setStrictMode(true);

      // Act & Assert
      expect(() => {
        EventSerializerRegistry.serializeEventData('UnregisteredEvent', {
          data: 'test',
        });
      }).toThrow('No serializer registered for event type: UnregisteredEvent');
    });

    it('should use default serialization in non-strict mode when serializer is not registered', () => {
      // Arrange
      EventSerializerRegistry.setStrictMode(false);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const testData = { field: 'value' };

      // Act
      const result = EventSerializerRegistry.serializeEventData(
        'UnregisteredEvent',
        testData,
      );

      // Assert
      expect(warnSpy).toHaveBeenCalledWith(
        'Using default serialization for UnregisteredEvent',
      );
      expect(result).toEqual(testData);

      warnSpy.mockRestore();
    });

    it('should handle complex nested data structures', () => {
      // Arrange
      const complexSerializer: EventSerializer = {
        serialize: (data: any) => ({
          serialized: true,
          nested: { ...data.nested },
          array: [...data.array],
        }),
        deserialize: (data: any) => data,
      };
      EventSerializerRegistry.register('ComplexEvent', complexSerializer);

      const complexData = {
        nested: { level1: { level2: 'value' } },
        array: [1, 2, 3],
      };

      // Act
      const result = EventSerializerRegistry.serializeEventData(
        'ComplexEvent',
        complexData,
      );

      // Assert
      expect(result).toEqual({
        serialized: true,
        nested: { level1: { level2: 'value' } },
        array: [1, 2, 3],
      });
    });

    it('should handle null and undefined values', () => {
      // Arrange
      EventSerializerRegistry.register('TestEvent', simpleSerializer);

      // Act & Assert
      expect(
        EventSerializerRegistry.serializeEventData('TestEvent', null),
      ).toBeNull();
      expect(
        EventSerializerRegistry.serializeEventData('TestEvent', undefined),
      ).toBeUndefined();
    });

    it('should handle empty objects', () => {
      // Arrange
      EventSerializerRegistry.register('TestEvent', simpleSerializer);

      // Act
      const result = EventSerializerRegistry.serializeEventData(
        'TestEvent',
        {},
      );

      // Assert
      expect(result).toEqual({});
    });
  });

  describe('deserializeEventData', () => {
    it('should deserialize data using registered serializer', () => {
      // Arrange
      EventSerializerRegistry.register('TestEvent', mockSerializer);
      const testData = { field1: 'value1', field2: 42 };

      // Act
      const result = EventSerializerRegistry.deserializeEventData(
        'TestEvent',
        testData,
      );

      // Assert
      expect(mockSerializer.deserialize).toHaveBeenCalledWith(testData);
      expect(result).toEqual({
        deserialized: true,
        field1: 'value1',
        field2: 42,
      });
    });

    it('should return raw data when serializer is not registered', () => {
      // Arrange
      const testData = { field: 'value' };

      // Act
      const result = EventSerializerRegistry.deserializeEventData(
        'UnregisteredEvent',
        testData,
      );

      // Assert
      expect(result).toEqual(testData);
    });

    it('should handle complex nested data structures', () => {
      // Arrange
      const complexSerializer: EventSerializer = {
        serialize: (data: any) => data,
        deserialize: (data: any) => ({
          deserialized: true,
          original: data,
        }),
      };
      EventSerializerRegistry.register('ComplexEvent', complexSerializer);

      const complexData = {
        nested: { level1: { level2: 'value' } },
        array: [1, 2, 3],
      };

      // Act
      const result = EventSerializerRegistry.deserializeEventData(
        'ComplexEvent',
        complexData,
      );

      // Assert
      expect(result).toEqual({
        deserialized: true,
        original: complexData,
      });
    });

    it('should handle empty objects', () => {
      // Arrange
      EventSerializerRegistry.register('TestEvent', simpleSerializer);

      // Act
      const result = EventSerializerRegistry.deserializeEventData(
        'TestEvent',
        {},
      );

      // Assert
      expect(result).toEqual({});
    });

    it('should not throw error for unregistered event type (always returns data)', () => {
      // Arrange
      const testData = { field: 'value' };

      // Act & Assert
      expect(() => {
        EventSerializerRegistry.deserializeEventData(
          'UnregisteredEvent',
          testData,
        );
      }).not.toThrow();
    });
  });

  describe('setStrictMode', () => {
    it('should enable strict mode', () => {
      // Act
      EventSerializerRegistry.setStrictMode(true);

      // Assert
      expect(() => {
        EventSerializerRegistry.serializeEventData('UnregisteredEvent', {});
      }).toThrow();
    });

    it('should disable strict mode', () => {
      // Arrange
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Act
      EventSerializerRegistry.setStrictMode(false);

      // Assert
      expect(() => {
        EventSerializerRegistry.serializeEventData('UnregisteredEvent', {
          data: 'test',
        });
      }).not.toThrow();

      warnSpy.mockRestore();
    });

    it('should allow toggling strict mode multiple times', () => {
      // Arrange
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Act & Assert - Enable
      EventSerializerRegistry.setStrictMode(true);
      expect(() => {
        EventSerializerRegistry.serializeEventData('UnregisteredEvent', {});
      }).toThrow();

      // Act & Assert - Disable
      EventSerializerRegistry.setStrictMode(false);
      expect(() => {
        EventSerializerRegistry.serializeEventData('UnregisteredEvent', {});
      }).not.toThrow();

      // Act & Assert - Re-enable
      EventSerializerRegistry.setStrictMode(true);
      expect(() => {
        EventSerializerRegistry.serializeEventData('UnregisteredEvent', {});
      }).toThrow();

      warnSpy.mockRestore();
    });
  });

  describe('getRegisteredEventTypes', () => {
    it('should return empty array when no serializers are registered', () => {
      // Act
      const result = EventSerializerRegistry.getRegisteredEventTypes();

      // Assert
      expect(result).toEqual([]);
    });

    it('should return all registered event types', () => {
      // Arrange
      EventSerializerRegistry.register('Event1', mockSerializer);
      EventSerializerRegistry.register('Event2', simpleSerializer);
      EventSerializerRegistry.register('Event3', mockSerializer);

      // Act
      const result = EventSerializerRegistry.getRegisteredEventTypes();

      // Assert
      expect(result).toHaveLength(3);
      expect(result).toContain('Event1');
      expect(result).toContain('Event2');
      expect(result).toContain('Event3');
    });

    it('should return array that can be safely modified without affecting registry', () => {
      // Arrange
      EventSerializerRegistry.register('TestEvent', mockSerializer);

      // Act
      const result = EventSerializerRegistry.getRegisteredEventTypes();
      result.push('NewEvent');

      // Assert
      expect(EventSerializerRegistry.getRegisteredEventTypes()).toEqual([
        'TestEvent',
      ]);
      expect(EventSerializerRegistry.isRegistered('NewEvent')).toBe(false);
    });

    it('should reflect updates when new serializers are registered', () => {
      // Arrange
      EventSerializerRegistry.register('Event1', mockSerializer);
      const firstResult = EventSerializerRegistry.getRegisteredEventTypes();

      // Act
      EventSerializerRegistry.register('Event2', mockSerializer);
      const secondResult = EventSerializerRegistry.getRegisteredEventTypes();

      // Assert
      expect(firstResult).toHaveLength(1);
      expect(secondResult).toHaveLength(2);
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered event type', () => {
      // Arrange
      EventSerializerRegistry.register('TestEvent', mockSerializer);

      // Act & Assert
      expect(EventSerializerRegistry.isRegistered('TestEvent')).toBe(true);
    });

    it('should return false for unregistered event type', () => {
      // Act & Assert
      expect(EventSerializerRegistry.isRegistered('UnregisteredEvent')).toBe(
        false,
      );
    });

    it('should return false after clearing all serializers', () => {
      // Arrange
      EventSerializerRegistry.register('TestEvent', mockSerializer);
      expect(EventSerializerRegistry.isRegistered('TestEvent')).toBe(true);

      // Act - Clear registry
      const registeredTypes = EventSerializerRegistry.getRegisteredEventTypes();
      registeredTypes.forEach((type) => {
        // @ts-expect-error - accessing private property for testing
        EventSerializerRegistry.serializers.delete(type);
      });

      // Assert
      expect(EventSerializerRegistry.isRegistered('TestEvent')).toBe(false);
    });

    it('should handle case-sensitive event type names', () => {
      // Arrange
      EventSerializerRegistry.register('TestEvent', mockSerializer);

      // Act & Assert
      expect(EventSerializerRegistry.isRegistered('TestEvent')).toBe(true);
      expect(EventSerializerRegistry.isRegistered('testevent')).toBe(false);
      expect(EventSerializerRegistry.isRegistered('TESTEVENT')).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete serialization/deserialization cycle', () => {
      // Arrange
      const roundTripSerializer: EventSerializer = {
        serialize: (data: any) => ({
          ...data,
          serializedAt: '2025-10-06T00:00:00Z',
        }),
        deserialize: (data: any) => {
          const { serializedAt, ...rest } = data;
          return rest;
        },
      };

      EventSerializerRegistry.register('RoundTripEvent', roundTripSerializer);
      const originalData = { field1: 'value1', field2: 42 };

      // Act
      const serialized = EventSerializerRegistry.serializeEventData(
        'RoundTripEvent',
        originalData,
      );
      const deserialized = EventSerializerRegistry.deserializeEventData(
        'RoundTripEvent',
        serialized,
      );

      // Assert
      expect(serialized).toHaveProperty('serializedAt');
      expect(deserialized).toEqual(originalData);
    });

    it('should support multiple event types in a realistic scenario', () => {
      // Arrange
      const systemEventSerializer: EventSerializer = {
        serialize: (data: any) => ({ type: 'system', ...data }),
        deserialize: (data: any) => {
          const { type, ...rest } = data;
          return rest;
        },
      };

      const taskEventSerializer: EventSerializer = {
        serialize: (data: any) => ({ type: 'task', ...data }),
        deserialize: (data: any) => {
          const { type, ...rest } = data;
          return rest;
        },
      };

      EventSerializerRegistry.register(
        'SystemRegistered',
        systemEventSerializer,
      );
      EventSerializerRegistry.register('TaskCreated', taskEventSerializer);

      // Act
      const systemData = EventSerializerRegistry.serializeEventData(
        'SystemRegistered',
        { systemId: 'sys-001', name: 'Test System' },
      );
      const taskData = EventSerializerRegistry.serializeEventData(
        'TaskCreated',
        { taskId: 'task-001', title: 'Test Task' },
      );

      // Assert
      expect(systemData).toEqual({
        type: 'system',
        systemId: 'sys-001',
        name: 'Test System',
      });
      expect(taskData).toEqual({
        type: 'task',
        taskId: 'task-001',
        title: 'Test Task',
      });
      expect(EventSerializerRegistry.getRegisteredEventTypes()).toHaveLength(2);
    });

    it('should handle registry state across multiple operations', () => {
      // Arrange & Act
      expect(EventSerializerRegistry.getRegisteredEventTypes()).toHaveLength(0);

      EventSerializerRegistry.register('Event1', mockSerializer);
      expect(EventSerializerRegistry.getRegisteredEventTypes()).toHaveLength(1);
      expect(EventSerializerRegistry.isRegistered('Event1')).toBe(true);

      EventSerializerRegistry.register('Event2', simpleSerializer);
      expect(EventSerializerRegistry.getRegisteredEventTypes()).toHaveLength(2);

      const serialized = EventSerializerRegistry.serializeEventData('Event1', {
        test: 'data',
      });
      expect(serialized).toBeDefined();

      // Assert final state
      expect(EventSerializerRegistry.getRegisteredEventTypes()).toEqual([
        'Event1',
        'Event2',
      ]);
    });
  });
});
