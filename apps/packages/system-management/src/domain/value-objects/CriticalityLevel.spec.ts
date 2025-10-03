import { CriticalityLevel } from './CriticalityLevel';

describe('CriticalityLevel', () => {
  describe('create', () => {
    it('should create criticality level 1 (lowest)', () => {
      // Act
      const criticality = CriticalityLevel.create(1);

      // Assert
      expect(criticality.getValue()).toBe(1);
    });

    it('should create criticality level 5 (highest)', () => {
      // Act
      const criticality = CriticalityLevel.create(5);

      // Assert
      expect(criticality.getValue()).toBe(5);
    });

    it('should create criticality level 3 (medium)', () => {
      // Act
      const criticality = CriticalityLevel.create(3);

      // Assert
      expect(criticality.getValue()).toBe(3);
    });

    it('should throw error for criticality level 0', () => {
      // Act & Assert
      expect(() => CriticalityLevel.create(0)).toThrow();
    });

    it('should throw error for criticality level 6', () => {
      // Act & Assert
      expect(() => CriticalityLevel.create(6)).toThrow();
    });

    it('should throw error for negative criticality level', () => {
      // Act & Assert
      expect(() => CriticalityLevel.create(-1)).toThrow();
    });

    it('should throw error for decimal criticality level', () => {
      // Act & Assert
      expect(() => CriticalityLevel.create(3.5)).toThrow();
    });
  });

  describe('isHigh', () => {
    it('should return true for criticality level 4', () => {
      // Arrange
      const criticality = CriticalityLevel.create(4);

      // Act & Assert
      expect(criticality.isHigh()).toBe(true);
    });

    it('should return true for criticality level 5', () => {
      // Arrange
      const criticality = CriticalityLevel.create(5);

      // Act & Assert
      expect(criticality.isHigh()).toBe(true);
    });

    it('should return false for criticality level 3', () => {
      // Arrange
      const criticality = CriticalityLevel.create(3);

      // Act & Assert
      expect(criticality.isHigh()).toBe(false);
    });

    it('should return false for criticality level 1', () => {
      // Arrange
      const criticality = CriticalityLevel.create(1);

      // Act & Assert
      expect(criticality.isHigh()).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for equal criticality levels', () => {
      // Arrange
      const level1 = CriticalityLevel.create(4);
      const level2 = CriticalityLevel.create(4);

      // Act & Assert
      expect(level1.equals(level2)).toBe(true);
    });

    it('should return false for different criticality levels', () => {
      // Arrange
      const level1 = CriticalityLevel.create(3);
      const level2 = CriticalityLevel.create(4);

      // Act & Assert
      expect(level1.equals(level2)).toBe(false);
    });
  });
});
