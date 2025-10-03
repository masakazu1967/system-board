import { Package } from './Package';

describe('Package', () => {
  describe('create', () => {
    it('should create a valid package', () => {
      // Act
      const pkg = Package.create({
        name: 'test-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      // Assert
      expect(pkg).toBeDefined();
      expect(pkg.getName()).toBe('test-package');
      expect(pkg.getVersion()).toBe('1.0.0');
      expect(pkg.getDependencies()).toHaveLength(0);
      expect(pkg.getVulnerabilities()).toHaveLength(0);
    });

    it('should create package with dependencies', () => {
      // Act
      const pkg = Package.create({
        name: 'package-with-deps',
        version: '2.0.0',
        dependencies: ['dep1@1.0.0', 'dep2@2.0.0'],
        vulnerabilities: [],
      });

      // Assert
      expect(pkg.getDependencies()).toHaveLength(2);
      expect(pkg.getDependencies()).toContain('dep1@1.0.0');
      expect(pkg.getDependencies()).toContain('dep2@2.0.0');
    });

    it('should create package with vulnerabilities', () => {
      // Act
      const pkg = Package.create({
        name: 'vulnerable-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: ['CVE-2024-0001', 'CVE-2024-0002'],
      });

      // Assert
      expect(pkg.getVulnerabilities()).toHaveLength(2);
      expect(pkg.getVulnerabilities()).toContain('CVE-2024-0001');
      expect(pkg.getVulnerabilities()).toContain('CVE-2024-0002');
    });

    it('should throw error for empty package name', () => {
      // Act & Assert
      expect(() =>
        Package.create({
          name: '',
          version: '1.0.0',
          dependencies: [],
          vulnerabilities: [],
        }),
      ).toThrow();
    });

    it('should throw error for empty version', () => {
      // Act & Assert
      expect(() =>
        Package.create({
          name: 'test-package',
          version: '',
          dependencies: [],
          vulnerabilities: [],
        }),
      ).toThrow();
    });
  });

  describe('hasVulnerabilities', () => {
    it('should return true when package has vulnerabilities', () => {
      // Arrange
      const pkg = Package.create({
        name: 'vulnerable-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: ['CVE-2024-0001'],
      });

      // Act & Assert
      expect(pkg.hasVulnerabilities()).toBe(true);
    });

    it('should return false when package has no vulnerabilities', () => {
      // Arrange
      const pkg = Package.create({
        name: 'safe-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      // Act & Assert
      expect(pkg.hasVulnerabilities()).toBe(false);
    });
  });

  describe('isSecurityCompliant', () => {
    it('should return true for packages without vulnerabilities', () => {
      // Arrange
      const pkg = Package.create({
        name: 'compliant-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      // Act & Assert
      expect(pkg.isSecurityCompliant()).toBe(true);
    });

    it('should return false for packages with vulnerabilities', () => {
      // Arrange
      const pkg = Package.create({
        name: 'non-compliant-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: ['CVE-2024-0001'],
      });

      // Act & Assert
      expect(pkg.isSecurityCompliant()).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for packages with same name and version', () => {
      // Arrange
      const pkg1 = Package.create({
        name: 'test-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });
      const pkg2 = Package.create({
        name: 'test-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      // Act & Assert
      expect(pkg1.equals(pkg2)).toBe(true);
    });

    it('should return false for packages with different names', () => {
      // Arrange
      const pkg1 = Package.create({
        name: 'package-a',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });
      const pkg2 = Package.create({
        name: 'package-b',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      // Act & Assert
      expect(pkg1.equals(pkg2)).toBe(false);
    });

    it('should return false for packages with different versions', () => {
      // Arrange
      const pkg1 = Package.create({
        name: 'test-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });
      const pkg2 = Package.create({
        name: 'test-package',
        version: '2.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      // Act & Assert
      expect(pkg1.equals(pkg2)).toBe(false);
    });
  });
});
