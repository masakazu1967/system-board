import {
  SecurityClassification,
  SecurityClassificationHelper,
} from './SecurityClassification';

describe('SecurityClassificationHelper', () => {
  describe('fromString', () => {
    it('should convert "public" to PUBLIC', () => {
      const classification = SecurityClassificationHelper.fromString('public');
      expect(classification).toBe(SecurityClassification.PUBLIC);
    });

    it('should convert "internal" to INTERNAL', () => {
      const classification =
        SecurityClassificationHelper.fromString('internal');
      expect(classification).toBe(SecurityClassification.INTERNAL);
    });

    it('should convert "confidential" to CONFIDENTIAL', () => {
      const classification =
        SecurityClassificationHelper.fromString('confidential');
      expect(classification).toBe(SecurityClassification.CONFIDENTIAL);
    });

    it('should convert "restricted" to RESTRICTED', () => {
      const classification =
        SecurityClassificationHelper.fromString('restricted');
      expect(classification).toBe(SecurityClassification.RESTRICTED);
    });

    it('should handle uppercase strings', () => {
      const classification =
        SecurityClassificationHelper.fromString('CONFIDENTIAL');
      expect(classification).toBe(SecurityClassification.CONFIDENTIAL);
    });

    it('should handle mixed case strings', () => {
      const classification =
        SecurityClassificationHelper.fromString('CoNfIdEnTiAl');
      expect(classification).toBe(SecurityClassification.CONFIDENTIAL);
    });

    it('should throw error for invalid classification', () => {
      expect(() => SecurityClassificationHelper.fromString('invalid')).toThrow(
        'Invalid SecurityClassification: invalid',
      );
    });

    it('should throw error for empty string', () => {
      expect(() => SecurityClassificationHelper.fromString('')).toThrow(
        'Invalid SecurityClassification:',
      );
    });
  });

  describe('isValid', () => {
    it('should return true for valid classification "public"', () => {
      expect(SecurityClassificationHelper.isValid('public')).toBe(true);
    });

    it('should return true for valid classification "internal"', () => {
      expect(SecurityClassificationHelper.isValid('internal')).toBe(true);
    });

    it('should return true for valid classification "confidential"', () => {
      expect(SecurityClassificationHelper.isValid('confidential')).toBe(true);
    });

    it('should return true for valid classification "restricted"', () => {
      expect(SecurityClassificationHelper.isValid('restricted')).toBe(true);
    });

    it('should return true for uppercase strings', () => {
      expect(SecurityClassificationHelper.isValid('PUBLIC')).toBe(true);
    });

    it('should return false for invalid classification', () => {
      expect(SecurityClassificationHelper.isValid('invalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(SecurityClassificationHelper.isValid('')).toBe(false);
    });
  });

  describe('getLevel', () => {
    it('should return 1 for PUBLIC', () => {
      const level = SecurityClassificationHelper.getLevel(
        SecurityClassification.PUBLIC,
      );
      expect(level).toBe(1);
    });

    it('should return 2 for INTERNAL', () => {
      const level = SecurityClassificationHelper.getLevel(
        SecurityClassification.INTERNAL,
      );
      expect(level).toBe(2);
    });

    it('should return 3 for CONFIDENTIAL', () => {
      const level = SecurityClassificationHelper.getLevel(
        SecurityClassification.CONFIDENTIAL,
      );
      expect(level).toBe(3);
    });

    it('should return 4 for RESTRICTED', () => {
      const level = SecurityClassificationHelper.getLevel(
        SecurityClassification.RESTRICTED,
      );
      expect(level).toBe(4);
    });

    it('should have increasing levels from PUBLIC to RESTRICTED', () => {
      const publicLevel = SecurityClassificationHelper.getLevel(
        SecurityClassification.PUBLIC,
      );
      const internalLevel = SecurityClassificationHelper.getLevel(
        SecurityClassification.INTERNAL,
      );
      const confidentialLevel = SecurityClassificationHelper.getLevel(
        SecurityClassification.CONFIDENTIAL,
      );
      const restrictedLevel = SecurityClassificationHelper.getLevel(
        SecurityClassification.RESTRICTED,
      );

      expect(publicLevel).toBeLessThan(internalLevel);
      expect(internalLevel).toBeLessThan(confidentialLevel);
      expect(confidentialLevel).toBeLessThan(restrictedLevel);
    });
  });

  describe('isHighSecurity', () => {
    it('should return false for PUBLIC', () => {
      const isHigh = SecurityClassificationHelper.isHighSecurity(
        SecurityClassification.PUBLIC,
      );
      expect(isHigh).toBe(false);
    });

    it('should return false for INTERNAL', () => {
      const isHigh = SecurityClassificationHelper.isHighSecurity(
        SecurityClassification.INTERNAL,
      );
      expect(isHigh).toBe(false);
    });

    it('should return true for CONFIDENTIAL', () => {
      const isHigh = SecurityClassificationHelper.isHighSecurity(
        SecurityClassification.CONFIDENTIAL,
      );
      expect(isHigh).toBe(true);
    });

    it('should return true for RESTRICTED', () => {
      const isHigh = SecurityClassificationHelper.isHighSecurity(
        SecurityClassification.RESTRICTED,
      );
      expect(isHigh).toBe(true);
    });
  });
});
