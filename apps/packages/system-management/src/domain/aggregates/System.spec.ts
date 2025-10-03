import { System } from './System';
import { SystemName } from '../value-objects/SystemName';
import { SystemType, SystemTypeHelper } from '../value-objects/SystemType';
import { HostConfiguration } from '../value-objects/HostConfiguration';
import { SystemPackages } from '../value-objects/SystemPackages';
import { Package } from '../value-objects/Package';
import {
  SecurityClassification,
  SecurityClassificationHelper,
} from '../value-objects/SecurityClassification';
import { CriticalityLevel } from '../value-objects/CriticalityLevel';
import { SystemRegistered } from '../events/SystemRegistered';

describe('System Aggregate', () => {
  describe('register', () => {
    it('should create a new system and emit SystemRegistered event', () => {
      // Arrange
      const name = SystemName.create('Test System');
      const type = SystemTypeHelper.fromString('web-server');
      const host = HostConfiguration.create({
        cpu: 4,
        memory: 16,
        storage: 500,
        encryptionEnabled: true,
      });
      const packages = SystemPackages.fromArray([
        Package.create({
          name: 'nginx',
          version: '1.20.0',
          dependencies: [],
          vulnerabilities: [],
        }),
      ]);
      const securityClassification =
        SecurityClassificationHelper.fromString('confidential');
      const criticality = CriticalityLevel.create(4);
      const correlationId = 'test-correlation-id';

      // Act
      const system = System.register(
        name,
        type,
        host,
        packages,
        securityClassification,
        criticality,
        correlationId,
      );

      // Assert
      expect(system).toBeDefined();
      expect(system.getId()).toBeDefined();
      expect(system.getName().getValue()).toBe('Test System');

      const uncommittedEvents = system.getUncommittedEvents();
      expect(uncommittedEvents).toHaveLength(1);
      expect(uncommittedEvents[0]).toBeInstanceOf(SystemRegistered);

      const event = uncommittedEvents[0] as SystemRegistered;
      expect(event.eventType).toBe('SystemRegistered');
      expect(event.name.getValue()).toBe('Test System');
      expect(event.correlationId).toBe(correlationId);
    });

    it('should apply SystemRegistered event and set system state', () => {
      // Arrange
      const name = SystemName.create('Test System');
      const type = SystemTypeHelper.fromString('database');
      const host = HostConfiguration.create({
        cpu: 8,
        memory: 32,
        storage: 1000,
        encryptionEnabled: true,
      });
      const packages = SystemPackages.fromArray([]);
      const securityClassification =
        SecurityClassificationHelper.fromString('internal');
      const criticality = CriticalityLevel.create(5);

      // Act
      const system = System.register(
        name,
        type,
        host,
        packages,
        securityClassification,
        criticality,
        'correlation-id',
      );

      // Assert
      expect(system.isActive()).toBe(true);
      expect(system.getType()).toBe(SystemType.DATABASE);
      expect(system.getCriticality().getValue()).toBe(5);
      expect(system.hasNoPackages()).toBe(true);
      expect(system.hasEncryptionEnabled()).toBe(true);
    });
  });

  describe('reconstruct', () => {
    it('should reconstruct system from event history', () => {
      // Arrange
      const name = SystemName.create('Reconstructed System');
      const type = SystemTypeHelper.fromString('web-server');
      const host = HostConfiguration.create({
        cpu: 2,
        memory: 8,
        storage: 250,
        encryptionEnabled: false,
      });
      const packages = SystemPackages.fromArray([
        Package.create({
          name: 'dotnet',
          version: '6.0.0',
          dependencies: [],
          vulnerabilities: [],
        }),
      ]);
      const securityClassification =
        SecurityClassificationHelper.fromString('public');
      const criticality = CriticalityLevel.create(2);

      // Create original system to get the event
      const originalSystem = System.register(
        name,
        type,
        host,
        packages,
        securityClassification,
        criticality,
        'correlation-id',
      );

      const events = originalSystem.getUncommittedEvents();
      const systemId = originalSystem.getId();

      // Act
      const reconstructedSystem = System.reconstruct(systemId, events);

      // Assert
      expect(reconstructedSystem.getId().getValue()).toBe(
        systemId.getValue(),
      );
      expect(reconstructedSystem.getName().getValue()).toBe(
        'Reconstructed System',
      );
      expect(reconstructedSystem.getType()).toBe(SystemType.WEB_SERVER);
      expect(reconstructedSystem.getCriticality().getValue()).toBe(2);
      expect(reconstructedSystem.hasEncryptionEnabled()).toBe(false);
      expect(reconstructedSystem.getPackages().size()).toBe(1);
    });

    it('should have no uncommitted events after reconstruction', () => {
      // Arrange
      const name = SystemName.create('Test System');
      const type = SystemTypeHelper.fromString('web-server');
      const host = HostConfiguration.create({
        cpu: 4,
        memory: 16,
        storage: 500,
        encryptionEnabled: true,
      });
      const packages = SystemPackages.fromArray([]);
      const securityClassification =
        SecurityClassificationHelper.fromString('internal');
      const criticality = CriticalityLevel.create(3);

      const originalSystem = System.register(
        name,
        type,
        host,
        packages,
        securityClassification,
        criticality,
        'correlation-id',
      );

      const events = originalSystem.getUncommittedEvents();
      const systemId = originalSystem.getId();

      // Act
      const reconstructedSystem = System.reconstruct(systemId, events);

      // Assert
      expect(reconstructedSystem.getUncommittedEvents()).toHaveLength(0);
    });
  });

  describe('business rules', () => {
    it('should correctly identify high criticality systems', () => {
      // Arrange
      const system = System.register(
        SystemName.create('High Criticality System'),
        SystemTypeHelper.fromString('database'),
        HostConfiguration.create({
          cpu: 16,
          memory: 64,
          storage: 2000,
          encryptionEnabled: true,
        }),
        SystemPackages.fromArray([]),
        SecurityClassificationHelper.fromString('confidential'),
        CriticalityLevel.create(5),
        'correlation-id',
      );

      // Assert
      expect(system.getCriticality().getValue()).toBeGreaterThanOrEqual(4);
    });

    it('should check if system has security compliant packages', () => {
      // Arrange
      const compliantPackage = Package.create({
        name: 'secure-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      const system = System.register(
        SystemName.create('Secure System'),
        SystemTypeHelper.fromString('web-server'),
        HostConfiguration.create({
          cpu: 4,
          memory: 16,
          storage: 500,
          encryptionEnabled: true,
        }),
        SystemPackages.fromArray([compliantPackage]),
        SecurityClassificationHelper.fromString('confidential'),
        CriticalityLevel.create(4),
        'correlation-id',
      );

      // Assert
      expect(system.hasSecurityCompliantPackages()).toBe(true);
    });
  });
});
