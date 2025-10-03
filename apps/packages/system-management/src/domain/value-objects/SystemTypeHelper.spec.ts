import { SystemType, SystemTypeHelper } from './SystemType';

describe('SystemTypeHelper', () => {
  describe('fromString', () => {
    it('should convert "web" to WEB', () => {
      const type = SystemTypeHelper.fromString('web');
      expect(type).toBe(SystemType.WEB);
    });

    it('should convert "api" to API', () => {
      const type = SystemTypeHelper.fromString('api');
      expect(type).toBe(SystemType.API);
    });

    it('should convert "database" to DATABASE', () => {
      const type = SystemTypeHelper.fromString('database');
      expect(type).toBe(SystemType.DATABASE);
    });

    it('should convert "batch" to BATCH', () => {
      const type = SystemTypeHelper.fromString('batch');
      expect(type).toBe(SystemType.BATCH);
    });

    it('should convert "middleware" to MIDDLEWARE', () => {
      const type = SystemTypeHelper.fromString('middleware');
      expect(type).toBe(SystemType.MIDDLEWARE);
    });

    it('should convert "monitoring" to MONITORING', () => {
      const type = SystemTypeHelper.fromString('monitoring');
      expect(type).toBe(SystemType.MONITORING);
    });

    it('should handle uppercase strings', () => {
      const type = SystemTypeHelper.fromString('WEB');
      expect(type).toBe(SystemType.WEB);
    });

    it('should handle mixed case strings', () => {
      const type = SystemTypeHelper.fromString('DaTaBaSe');
      expect(type).toBe(SystemType.DATABASE);
    });

    it('should throw error for invalid type', () => {
      expect(() => SystemTypeHelper.fromString('invalid')).toThrow(
        'Invalid SystemType: invalid',
      );
    });

    it('should throw error for empty string', () => {
      expect(() => SystemTypeHelper.fromString('')).toThrow(
        'Invalid SystemType:',
      );
    });

    it('should throw error for legacy "web-server" format', () => {
      expect(() => SystemTypeHelper.fromString('web-server')).toThrow(
        'Invalid SystemType: web-server',
      );
    });

    it('should throw error for legacy "application" format', () => {
      expect(() => SystemTypeHelper.fromString('application')).toThrow(
        'Invalid SystemType: application',
      );
    });
  });

  describe('isValid', () => {
    it('should return true for valid type "web"', () => {
      expect(SystemTypeHelper.isValid('web')).toBe(true);
    });

    it('should return true for valid type "api"', () => {
      expect(SystemTypeHelper.isValid('api')).toBe(true);
    });

    it('should return true for valid type "database"', () => {
      expect(SystemTypeHelper.isValid('database')).toBe(true);
    });

    it('should return true for valid type "batch"', () => {
      expect(SystemTypeHelper.isValid('batch')).toBe(true);
    });

    it('should return true for valid type "middleware"', () => {
      expect(SystemTypeHelper.isValid('middleware')).toBe(true);
    });

    it('should return true for valid type "monitoring"', () => {
      expect(SystemTypeHelper.isValid('monitoring')).toBe(true);
    });

    it('should return true for uppercase strings', () => {
      expect(SystemTypeHelper.isValid('WEB')).toBe(true);
    });

    it('should return false for invalid type', () => {
      expect(SystemTypeHelper.isValid('invalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(SystemTypeHelper.isValid('')).toBe(false);
    });

    it('should return false for legacy "web-server" format', () => {
      expect(SystemTypeHelper.isValid('web-server')).toBe(false);
    });

    it('should return false for legacy "application" format', () => {
      expect(SystemTypeHelper.isValid('application')).toBe(false);
    });
  });

  describe('all valid types', () => {
    it('should handle all enum values', () => {
      const types = Object.values(SystemType);

      types.forEach((type) => {
        expect(SystemTypeHelper.isValid(type)).toBe(true);
        expect(SystemTypeHelper.fromString(type.toLowerCase())).toBe(type);
      });
    });
  });
});
