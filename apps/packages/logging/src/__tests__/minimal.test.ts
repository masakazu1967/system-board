describe('Logging Package Integration', () => {
  it('should import all modules without errors', () => {
    expect(() => {
      require('../types');
      require('../data-masker');
      require('../error-id-generator');
      require('../structured-logger');
    }).not.toThrow();
  });

  it('should create basic instances', () => {
    const { DataMasker } = require('../data-masker');
    const { ErrorIdGenerator } = require('../error-id-generator');

    expect(() => new DataMasker()).not.toThrow();
    expect(() => new ErrorIdGenerator()).not.toThrow();
  });

  it('should validate type exports', () => {
    const types = require('../types');
    expect(types.ServiceType).toBeDefined();
    expect(types.Environment).toBeDefined();
  });
});