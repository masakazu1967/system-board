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
        vulnerabilities: [
          { cveId: 'CVE-2024-0001', severity: 'HIGH', cvssScore: 8.5 },
          { cveId: 'CVE-2024-0002', severity: 'MEDIUM', cvssScore: 6.0 },
        ],
      });

      // Assert
      expect(pkg.getVulnerabilities()).toHaveLength(2);
      expect(pkg.getVulnerabilities()[0].cveId).toBe('CVE-2024-0001');
      expect(pkg.getVulnerabilities()[1].cveId).toBe('CVE-2024-0002');
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

  describe('hasKnownVulnerabilities', () => {
    it('should return true when package has vulnerabilities', () => {
      // Arrange
      const pkg = Package.create({
        name: 'vulnerable-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [
          { cveId: 'CVE-2024-0001', severity: 'HIGH', cvssScore: 8.5 },
        ],
      });

      // Act & Assert
      expect(pkg.hasKnownVulnerabilities()).toBe(true);
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
      expect(pkg.hasKnownVulnerabilities()).toBe(false);
    });
  });

  describe('hasSecurityCompliance', () => {
    it('should return true for packages without critical vulnerabilities', () => {
      // Arrange
      const pkg = Package.create({
        name: 'compliant-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      // Act & Assert
      expect(pkg.hasSecurityCompliance()).toBe(true);
    });

    it('should return false for packages with critical vulnerabilities', () => {
      // Arrange
      const pkg = Package.create({
        name: 'non-compliant-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [
          { cveId: 'CVE-2024-0001', severity: 'CRITICAL', cvssScore: 9.5 },
        ],
      });

      // Act & Assert
      expect(pkg.hasSecurityCompliance()).toBe(false);
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
