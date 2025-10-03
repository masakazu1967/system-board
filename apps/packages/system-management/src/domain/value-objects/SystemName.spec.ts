import { SystemName } from './SystemName';

describe('SystemName', () => {
  describe('create', () => {
    it('should create a valid system name', () => {
      // Act
      const systemName = SystemName.create('Valid System Name');

      // Assert
      expect(systemName).toBeDefined();
      expect(systemName.getValue()).toBe('Valid System Name');
    });

    it('should throw error for empty name', () => {
      // Act & Assert
      expect(() => SystemName.create('')).toThrow();
    });

    it('should trim and validate whitespace-padded names', () => {
      // Act
      const systemName = SystemName.create('  Test System  ');

      // Assert
      expect(systemName.getValue()).toBe('Test System');
    });

    it('should throw error for name exceeding max length', () => {
      // Arrange
      const longName = 'a'.repeat(256);

      // Act & Assert
      expect(() => SystemName.create(longName)).toThrow();
    });

    it('should accept name with special characters', () => {
      // Act
      const systemName = SystemName.create('System-01_Test');

      // Assert
      expect(systemName.getValue()).toBe('System-01_Test');
    });

    it('should accept name with numbers', () => {
      // Act
      const systemName = SystemName.create('System 123');

      // Assert
      expect(systemName.getValue()).toBe('System 123');
    });
  });

  describe('equals', () => {
    it('should return true for equal system names', () => {
      // Arrange
      const name1 = SystemName.create('Test System');
      const name2 = SystemName.create('Test System');

      // Act & Assert
      expect(name1.equals(name2)).toBe(true);
    });

    it('should return false for different system names', () => {
      // Arrange
      const name1 = SystemName.create('System A');
      const name2 = SystemName.create('System B');

      // Act & Assert
      expect(name1.equals(name2)).toBe(false);
    });

    it('should be case-sensitive', () => {
      // Arrange
      const name1 = SystemName.create('Test System');
      const name2 = SystemName.create('test system');

      // Act & Assert
      expect(name1.equals(name2)).toBe(false);
    });
  });
});
