import { SystemStatus, SystemStatusHelper } from './SystemStatus';

describe('SystemStatusHelper', () => {
  describe('fromString', () => {
    it('should convert "active" to ACTIVE', () => {
      const status = SystemStatusHelper.fromString('active');
      expect(status).toBe(SystemStatus.ACTIVE);
    });

    it('should convert "inactive" to INACTIVE', () => {
      const status = SystemStatusHelper.fromString('inactive');
      expect(status).toBe(SystemStatus.INACTIVE);
    });

    it('should convert "maintenance" to MAINTENANCE', () => {
      const status = SystemStatusHelper.fromString('maintenance');
      expect(status).toBe(SystemStatus.MAINTENANCE);
    });

    it('should convert "decommissioned" to DECOMMISSIONED', () => {
      const status = SystemStatusHelper.fromString('decommissioned');
      expect(status).toBe(SystemStatus.DECOMMISSIONED);
    });

    it('should handle uppercase strings', () => {
      const status = SystemStatusHelper.fromString('ACTIVE');
      expect(status).toBe(SystemStatus.ACTIVE);
    });

    it('should handle mixed case strings', () => {
      const status = SystemStatusHelper.fromString('AcTiVe');
      expect(status).toBe(SystemStatus.ACTIVE);
    });

    it('should throw error for invalid status', () => {
      expect(() => SystemStatusHelper.fromString('invalid')).toThrow(
        'Invalid SystemStatus: invalid',
      );
    });

    it('should throw error for empty string', () => {
      expect(() => SystemStatusHelper.fromString('')).toThrow(
        'Invalid SystemStatus:',
      );
    });
  });

  describe('isValid', () => {
    it('should return true for valid status "active"', () => {
      expect(SystemStatusHelper.isValid('active')).toBe(true);
    });

    it('should return true for valid status "inactive"', () => {
      expect(SystemStatusHelper.isValid('inactive')).toBe(true);
    });

    it('should return true for valid status "maintenance"', () => {
      expect(SystemStatusHelper.isValid('maintenance')).toBe(true);
    });

    it('should return true for valid status "decommissioned"', () => {
      expect(SystemStatusHelper.isValid('decommissioned')).toBe(true);
    });

    it('should return true for uppercase strings', () => {
      expect(SystemStatusHelper.isValid('ACTIVE')).toBe(true);
    });

    it('should return false for invalid status', () => {
      expect(SystemStatusHelper.isValid('invalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(SystemStatusHelper.isValid('')).toBe(false);
    });
  });

  describe('isActive', () => {
    it('should return true for ACTIVE status', () => {
      expect(SystemStatusHelper.isActive(SystemStatus.ACTIVE)).toBe(true);
    });

    it('should return false for INACTIVE status', () => {
      expect(SystemStatusHelper.isActive(SystemStatus.INACTIVE)).toBe(false);
    });

    it('should return false for MAINTENANCE status', () => {
      expect(SystemStatusHelper.isActive(SystemStatus.MAINTENANCE)).toBe(false);
    });

    it('should return false for DECOMMISSIONED status', () => {
      expect(SystemStatusHelper.isActive(SystemStatus.DECOMMISSIONED)).toBe(
        false,
      );
    });
  });

  describe('isDecommissioned', () => {
    it('should return true for DECOMMISSIONED status', () => {
      expect(
        SystemStatusHelper.isDecommissioned(SystemStatus.DECOMMISSIONED),
      ).toBe(true);
    });

    it('should return false for ACTIVE status', () => {
      expect(SystemStatusHelper.isDecommissioned(SystemStatus.ACTIVE)).toBe(
        false,
      );
    });

    it('should return false for INACTIVE status', () => {
      expect(SystemStatusHelper.isDecommissioned(SystemStatus.INACTIVE)).toBe(
        false,
      );
    });

    it('should return false for MAINTENANCE status', () => {
      expect(
        SystemStatusHelper.isDecommissioned(SystemStatus.MAINTENANCE),
      ).toBe(false);
    });
  });
});
