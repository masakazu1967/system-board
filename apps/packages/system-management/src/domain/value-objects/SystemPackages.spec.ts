import { SystemPackages } from './SystemPackages';
import { Package } from './Package';

describe('SystemPackages', () => {
  const createTestPackage = (
    name: string,
    hasCritical: boolean = false,
  ): Package => {
    return Package.create({
      name,
      version: '1.0.0',
      dependencies: [],
      vulnerabilities: hasCritical
        ? [{ cveId: 'CVE-2024-0001', severity: 'CRITICAL', cvssScore: 9.5 }]
        : [],
    });
  };

  describe('empty', () => {
    it('should create an empty collection', () => {
      const packages = SystemPackages.empty();

      expect(packages.isEmpty()).toBe(true);
      expect(packages.count()).toBe(0);
      expect(packages.getAll()).toHaveLength(0);
    });
  });

  describe('fromArray', () => {
    it('should create collection from package array', () => {
      const pkg1 = createTestPackage('package-1');
      const pkg2 = createTestPackage('package-2');

      const packages = SystemPackages.fromArray([pkg1, pkg2]);

      expect(packages.count()).toBe(2);
      expect(packages.isEmpty()).toBe(false);
    });

    it('should create empty collection from empty array', () => {
      const packages = SystemPackages.fromArray([]);

      expect(packages.isEmpty()).toBe(true);
      expect(packages.count()).toBe(0);
    });

    it('should throw error for duplicate package names', () => {
      const pkg1 = createTestPackage('same-package');
      const pkg2 = createTestPackage('same-package');

      expect(() => SystemPackages.fromArray([pkg1, pkg2])).toThrow(
        'Duplicate package names are not allowed',
      );
    });

    it('should throw error for packages with critical vulnerabilities', () => {
      const pkg = createTestPackage('vulnerable-package', true);

      expect(() => SystemPackages.fromArray([pkg])).toThrow(
        'Packages with critical vulnerabilities cannot be added',
      );
    });
  });

  describe('add', () => {
    it('should add package to collection', () => {
      const packages = SystemPackages.empty();
      const pkg = createTestPackage('new-package');

      const updated = packages.add(pkg);

      expect(updated.count()).toBe(1);
      expect(updated.contains(pkg)).toBe(true);
    });

    it('should throw error when adding duplicate package', () => {
      const pkg = createTestPackage('duplicate-package');
      const packages = SystemPackages.fromArray([pkg]);

      expect(() => packages.add(pkg)).toThrow(
        'Package duplicate-package already exists',
      );
    });

    it('should throw error when adding package with critical vulnerabilities', () => {
      const packages = SystemPackages.empty();
      const pkg = createTestPackage('critical-package', true);

      expect(() => packages.add(pkg)).toThrow(
        'Package critical-package has critical vulnerabilities and cannot be added',
      );
    });

    it('should return new instance (immutability)', () => {
      const original = SystemPackages.empty();
      const pkg = createTestPackage('test-package');

      const updated = original.add(pkg);

      expect(original.count()).toBe(0);
      expect(updated.count()).toBe(1);
      expect(original).not.toBe(updated);
    });
  });

  describe('remove', () => {
    it('should remove package from collection', () => {
      const pkg1 = createTestPackage('package-1');
      const pkg2 = createTestPackage('package-2');
      const packages = SystemPackages.fromArray([pkg1, pkg2]);

      const updated = packages.remove('package-1');

      expect(updated.count()).toBe(1);
      expect(updated.contains(pkg1)).toBe(false);
      expect(updated.getByName('package-2')).not.toBeNull();
    });

    it('should throw error when removing non-existent package', () => {
      const packages = SystemPackages.empty();

      expect(() => packages.remove('non-existent')).toThrow(
        'Package non-existent not found',
      );
    });

    it('should return new instance (immutability)', () => {
      const pkg = createTestPackage('test-package');
      const original = SystemPackages.fromArray([pkg]);

      const updated = original.remove('test-package');

      expect(original.count()).toBe(1);
      expect(updated.count()).toBe(0);
      expect(original).not.toBe(updated);
    });
  });

  describe('update', () => {
    it('should update existing package', () => {
      const pkg = createTestPackage('update-package');
      const packages = SystemPackages.fromArray([pkg]);

      const updatedPkg = Package.create({
        name: 'update-package',
        version: '2.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      const updated = packages.update(updatedPkg);

      expect(updated.count()).toBe(1);
      expect(updated.getByName('update-package')).toBeDefined();
    });

    it('should throw error when updating non-existent package', () => {
      const packages = SystemPackages.empty();
      const pkg = createTestPackage('non-existent');

      expect(() => packages.update(pkg)).toThrow(
        'Package non-existent not found',
      );
    });

    it('should return new instance (immutability)', () => {
      const pkg = createTestPackage('test-package');
      const original = SystemPackages.fromArray([pkg]);

      const updatedPkg = Package.create({
        name: 'test-package',
        version: '2.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      const updated = original.update(updatedPkg);

      expect(original).not.toBe(updated);
    });
  });

  describe('contains', () => {
    it('should return true for existing package', () => {
      const pkg = createTestPackage('existing-package');
      const packages = SystemPackages.fromArray([pkg]);

      expect(packages.contains(pkg)).toBe(true);
    });

    it('should return false for non-existing package', () => {
      const packages = SystemPackages.empty();
      const pkg = createTestPackage('non-existing');

      expect(packages.contains(pkg)).toBe(false);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty collection', () => {
      const packages = SystemPackages.empty();

      expect(packages.isEmpty()).toBe(true);
    });

    it('should return false for non-empty collection', () => {
      const pkg = createTestPackage('test-package');
      const packages = SystemPackages.fromArray([pkg]);

      expect(packages.isEmpty()).toBe(false);
    });
  });

  describe('count', () => {
    it('should return 0 for empty collection', () => {
      const packages = SystemPackages.empty();

      expect(packages.count()).toBe(0);
    });

    it('should return correct count for non-empty collection', () => {
      const pkg1 = createTestPackage('package-1');
      const pkg2 = createTestPackage('package-2');
      const pkg3 = createTestPackage('package-3');
      const packages = SystemPackages.fromArray([pkg1, pkg2, pkg3]);

      expect(packages.count()).toBe(3);
    });
  });

  describe('getAll', () => {
    it('should return empty array for empty collection', () => {
      const packages = SystemPackages.empty();

      expect(packages.getAll()).toEqual([]);
    });

    it('should return all packages', () => {
      const pkg1 = createTestPackage('package-1');
      const pkg2 = createTestPackage('package-2');
      const packages = SystemPackages.fromArray([pkg1, pkg2]);

      const allPackages = packages.getAll();

      expect(allPackages).toHaveLength(2);
      expect(allPackages).toContain(pkg1);
      expect(allPackages).toContain(pkg2);
    });

    it('should return copy of packages array (immutability)', () => {
      const pkg = createTestPackage('test-package');
      const packages = SystemPackages.fromArray([pkg]);

      const array1 = packages.getAll();
      const array2 = packages.getAll();

      expect(array1).not.toBe(array2);
    });
  });

  describe('getByName', () => {
    it('should return package by name', () => {
      const pkg = createTestPackage('find-me');
      const packages = SystemPackages.fromArray([pkg]);

      const found = packages.getByName('find-me');

      expect(found).toBe(pkg);
    });

    it('should return null for non-existent package', () => {
      const packages = SystemPackages.empty();

      const found = packages.getByName('non-existent');

      expect(found).toBeNull();
    });
  });

  describe('hasVulnerabilities', () => {
    it('should return true if any package has vulnerabilities', () => {
      const vulnerablePkg = Package.create({
        name: 'vulnerable',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [
          { cveId: 'CVE-2024-0001', severity: 'HIGH', cvssScore: 8.0 },
        ],
      });
      const packages = SystemPackages.fromArray([vulnerablePkg]);

      expect(packages.hasVulnerabilities()).toBe(true);
    });

    it('should return false if no packages have vulnerabilities', () => {
      const pkg = createTestPackage('clean-package');
      const packages = SystemPackages.fromArray([pkg]);

      expect(packages.hasVulnerabilities()).toBe(false);
    });

    it('should return false for empty collection', () => {
      const packages = SystemPackages.empty();

      expect(packages.hasVulnerabilities()).toBe(false);
    });
  });

  describe('getVulnerablePackages', () => {
    it('should return packages with vulnerabilities', () => {
      const vulnerablePkg = Package.create({
        name: 'vulnerable',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [
          { cveId: 'CVE-2024-0001', severity: 'HIGH', cvssScore: 8.0 },
        ],
      });
      const cleanPkg = createTestPackage('clean');
      const packages = SystemPackages.fromArray([vulnerablePkg, cleanPkg]);

      const vulnerable = packages.getVulnerablePackages();

      expect(vulnerable).toHaveLength(1);
      expect(vulnerable[0]).toBe(vulnerablePkg);
    });

    it('should return empty array if no vulnerable packages', () => {
      const pkg = createTestPackage('clean-package');
      const packages = SystemPackages.fromArray([pkg]);

      const vulnerable = packages.getVulnerablePackages();

      expect(vulnerable).toEqual([]);
    });
  });

  describe('areAllSecurityCompliant', () => {
    it('should return true if all packages have no critical vulnerabilities', () => {
      const pkg1 = createTestPackage('package-1');
      const pkg2 = createTestPackage('package-2');
      const packages = SystemPackages.fromArray([pkg1, pkg2]);

      expect(packages.areAllSecurityCompliant()).toBe(true);
    });

    it('should return true for empty collection', () => {
      const packages = SystemPackages.empty();

      expect(packages.areAllSecurityCompliant()).toBe(true);
    });

    it('should return true for packages with non-critical vulnerabilities', () => {
      const pkg = Package.create({
        name: 'low-vuln',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [
          { cveId: 'CVE-2024-0001', severity: 'LOW', cvssScore: 3.0 },
        ],
      });
      const packages = SystemPackages.fromArray([pkg]);

      expect(packages.areAllSecurityCompliant()).toBe(true);
    });
  });

  describe('equals', () => {
    it('should return true for collections with same packages', () => {
      const pkg1 = createTestPackage('package-1');
      const pkg2 = createTestPackage('package-2');

      const packages1 = SystemPackages.fromArray([pkg1, pkg2]);
      const packages2 = SystemPackages.fromArray([pkg1, pkg2]);

      expect(packages1.equals(packages2)).toBe(true);
    });

    it('should return true for empty collections', () => {
      const packages1 = SystemPackages.empty();
      const packages2 = SystemPackages.empty();

      expect(packages1.equals(packages2)).toBe(true);
    });

    it('should return false for collections with different packages', () => {
      const pkg1 = createTestPackage('package-1');
      const pkg2 = createTestPackage('package-2');

      const packages1 = SystemPackages.fromArray([pkg1]);
      const packages2 = SystemPackages.fromArray([pkg2]);

      expect(packages1.equals(packages2)).toBe(false);
    });

    it('should return false for collections with different counts', () => {
      const pkg = createTestPackage('package-1');

      const packages1 = SystemPackages.fromArray([pkg]);
      const packages2 = SystemPackages.empty();

      expect(packages1.equals(packages2)).toBe(false);
    });
  });
});
