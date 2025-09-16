describe('Logging Package Integration', () => {
  it('should import types module without errors', () => {
    expect(() => {
      require('./types');
    }).not.toThrow();
  });

  it('should validate type exports', () => {
    const types = require('./types');
    expect(types.ServiceType).toBeDefined();
    expect(types.Environment).toBeDefined();
  });

  it('should create DataMasker instance', () => {
    const { DataMasker } = require('./data-masker');
    expect(() => new DataMasker()).not.toThrow();
  });

  it('should create ErrorIdGenerator instance', () => {
    const { ErrorIdGenerator } = require('./error-id-generator');
    expect(() => new ErrorIdGenerator()).not.toThrow();
  });
});