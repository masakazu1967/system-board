import { HostConfiguration } from './HostConfiguration';

describe('HostConfiguration', () => {
  describe('create', () => {
    it('should create valid host configuration', () => {
      const host = HostConfiguration.create({
        cpu: 4,
        memory: 16,
        storage: 500,
        encryptionEnabled: true,
      });

      expect(host).toBeDefined();
      expect(host.getCpu()).toBe(4);
      expect(host.getMemory()).toBe(16);
      expect(host.getStorage()).toBe(500);
      expect(host.isEncryptionEnabled()).toBe(true);
    });

    it('should create with minimum valid values', () => {
      const host = HostConfiguration.create({
        cpu: 1,
        memory: 1,
        storage: 1,
        encryptionEnabled: false,
      });

      expect(host.getCpu()).toBe(1);
      expect(host.getMemory()).toBe(1);
      expect(host.getStorage()).toBe(1);
      expect(host.isEncryptionEnabled()).toBe(false);
    });

    it('should create with maximum valid values', () => {
      const host = HostConfiguration.create({
        cpu: 256,
        memory: 2048,
        storage: 100000,
        encryptionEnabled: true,
      });

      expect(host.getCpu()).toBe(256);
      expect(host.getMemory()).toBe(2048);
      expect(host.getStorage()).toBe(100000);
    });
  });

  describe('validation', () => {
    it('should throw error for CPU cores less than minimum', () => {
      expect(() =>
        HostConfiguration.create({
          cpu: 0,
          memory: 16,
          storage: 500,
          encryptionEnabled: true,
        }),
      ).toThrow('CPU cores must be at least 1');
    });

    it('should throw error for CPU cores exceeding maximum', () => {
      expect(() =>
        HostConfiguration.create({
          cpu: 257,
          memory: 16,
          storage: 500,
          encryptionEnabled: true,
        }),
      ).toThrow('CPU cores must not exceed 256');
    });

    it('should throw error for non-integer CPU cores', () => {
      expect(() =>
        HostConfiguration.create({
          cpu: 4.5,
          memory: 16,
          storage: 500,
          encryptionEnabled: true,
        }),
      ).toThrow('CPU cores must be an integer');
    });

    it('should throw error for memory less than minimum', () => {
      expect(() =>
        HostConfiguration.create({
          cpu: 4,
          memory: 0,
          storage: 500,
          encryptionEnabled: true,
        }),
      ).toThrow('Memory must be at least 1GB');
    });

    it('should throw error for memory exceeding maximum', () => {
      expect(() =>
        HostConfiguration.create({
          cpu: 4,
          memory: 2049,
          storage: 500,
          encryptionEnabled: true,
        }),
      ).toThrow('Memory must not exceed 2048GB');
    });

    it('should throw error for non-integer memory', () => {
      expect(() =>
        HostConfiguration.create({
          cpu: 4,
          memory: 16.5,
          storage: 500,
          encryptionEnabled: true,
        }),
      ).toThrow('Memory must be an integer (GB)');
    });

    it('should throw error for storage less than minimum', () => {
      expect(() =>
        HostConfiguration.create({
          cpu: 4,
          memory: 16,
          storage: 0,
          encryptionEnabled: true,
        }),
      ).toThrow('Storage must be at least 1GB');
    });

    it('should throw error for storage exceeding maximum', () => {
      expect(() =>
        HostConfiguration.create({
          cpu: 4,
          memory: 16,
          storage: 100001,
          encryptionEnabled: true,
        }),
      ).toThrow('Storage must not exceed 100000GB');
    });

    it('should throw error for non-integer storage', () => {
      expect(() =>
        HostConfiguration.create({
          cpu: 4,
          memory: 16,
          storage: 500.5,
          encryptionEnabled: true,
        }),
      ).toThrow('Storage must be an integer (GB)');
    });
  });

  describe('isValid', () => {
    it('should return true for valid configuration', () => {
      const isValid = HostConfiguration.isValid({
        cpu: 4,
        memory: 16,
        storage: 500,
        encryptionEnabled: true,
      });
      expect(isValid).toBe(true);
    });

    it('should return false for invalid CPU', () => {
      const isValid = HostConfiguration.isValid({
        cpu: 0,
        memory: 16,
        storage: 500,
        encryptionEnabled: true,
      });
      expect(isValid).toBe(false);
    });

    it('should return false for invalid memory', () => {
      const isValid = HostConfiguration.isValid({
        cpu: 4,
        memory: 0,
        storage: 500,
        encryptionEnabled: true,
      });
      expect(isValid).toBe(false);
    });

    it('should return false for invalid storage', () => {
      const isValid = HostConfiguration.isValid({
        cpu: 4,
        memory: 16,
        storage: 0,
        encryptionEnabled: true,
      });
      expect(isValid).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for identical configurations', () => {
      const host1 = HostConfiguration.create({
        cpu: 4,
        memory: 16,
        storage: 500,
        encryptionEnabled: true,
      });
      const host2 = HostConfiguration.create({
        cpu: 4,
        memory: 16,
        storage: 500,
        encryptionEnabled: true,
      });

      expect(host1.equals(host2)).toBe(true);
    });

    it('should return false for different CPU', () => {
      const host1 = HostConfiguration.create({
        cpu: 4,
        memory: 16,
        storage: 500,
        encryptionEnabled: true,
      });
      const host2 = HostConfiguration.create({
        cpu: 8,
        memory: 16,
        storage: 500,
        encryptionEnabled: true,
      });

      expect(host1.equals(host2)).toBe(false);
    });

    it('should return false for different encryption setting', () => {
      const host1 = HostConfiguration.create({
        cpu: 4,
        memory: 16,
        storage: 500,
        encryptionEnabled: true,
      });
      const host2 = HostConfiguration.create({
        cpu: 4,
        memory: 16,
        storage: 500,
        encryptionEnabled: false,
      });

      expect(host1.equals(host2)).toBe(false);
    });
  });
});
