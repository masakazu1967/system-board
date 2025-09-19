import { ServiceType, Environment } from './types';
import { DataMasker } from './data-masker';
import { ErrorIdGenerator } from './error-id-generator';

describe('Logging Package Integration', () => {
  it('should import types module without errors', () => {
    expect(ServiceType).toBeDefined();
    expect(Environment).toBeDefined();
  });

  it('should validate type exports', () => {
    expect(ServiceType.BACKEND).toBe('backend');
    expect(Environment.DEVELOPMENT).toBe('development');
  });

  it('should create DataMasker instance', () => {
    expect(() => new DataMasker()).not.toThrow();
  });

  it('should create ErrorIdGenerator instance', () => {
    expect(() => new ErrorIdGenerator()).not.toThrow();
  });
});
