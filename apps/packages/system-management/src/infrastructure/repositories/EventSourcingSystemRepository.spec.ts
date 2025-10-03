import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { EventSourcingSystemRepository } from './EventSourcingSystemRepository';
import { System } from '../../domain/aggregates/System';
import { SystemId } from '../../domain/value-objects/SystemId';
import { SystemName } from '../../domain/value-objects/SystemName';
import { SystemTypeHelper } from '../../domain/value-objects/SystemType';
import { HostConfiguration } from '../../domain/value-objects/HostConfiguration';
import { SystemPackages } from '../../domain/value-objects/SystemPackages';
import { Package } from '../../domain/value-objects/Package';
import { SecurityClassificationHelper } from '../../domain/value-objects/SecurityClassification';
import { CriticalityLevel } from '../../domain/value-objects/CriticalityLevel';
import { KurrentDBClient } from '@system-board/shared';
import { SystemRegistered } from '../../domain/events/SystemRegistered';

describe('EventSourcingSystemRepository', () => {
  let repository: EventSourcingSystemRepository;
  let kurrentClient: MockProxy<KurrentDBClient>;

  beforeEach(async () => {
    kurrentClient = mock<KurrentDBClient>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSourcingSystemRepository,
        {
          provide: 'KurrentDBClient',
          useValue: kurrentClient,
        },
      ],
    }).compile();

    repository = module.get<EventSourcingSystemRepository>(
      EventSourcingSystemRepository,
    );
  });

  describe('save', () => {
    it('should append events to stream in KurrentDB', async () => {
      // Arrange
      const system = System.register(
        SystemName.create('Test System'),
        SystemTypeHelper.fromString('web'),
        HostConfiguration.create({
          cpu: 4,
          memory: 16,
          storage: 500,
          encryptionEnabled: true,
        }),
        SystemPackages.fromArray([
          Package.create({
            name: 'nginx',
            version: '1.20.0',
            dependencies: [],
            vulnerabilities: [],
          }),
        ]),
        SecurityClassificationHelper.fromString('confidential'),
        CriticalityLevel.create(4),
        'correlation-123',
      );

      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      await repository.save(system);

      // Assert
      expect(kurrentClient.appendToStream).toHaveBeenCalledTimes(1);

      const [streamName, events, options] =
        kurrentClient.appendToStream.mock.calls[0];

      expect(streamName).toBe(`System-${system.getIdValue()}`);
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(SystemRegistered);
      expect(options?.expectedRevision).toBe(-1); // First event
    });

    it('should mark events as committed after successful save', async () => {
      // Arrange
      const system = System.register(
        SystemName.create('Test System'),
        SystemTypeHelper.fromString('database'),
        HostConfiguration.create({
          cpu: 8,
          memory: 32,
          storage: 1000,
          encryptionEnabled: true,
        }),
        SystemPackages.fromArray([]),
        SecurityClassificationHelper.fromString('internal'),
        CriticalityLevel.create(5),
        'correlation-456',
      );

      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      await repository.save(system);

      // Assert
      expect(system.getUncommittedEvents()).toHaveLength(0);
    });

    it('should use correct stream name format', async () => {
      // Arrange
      const system = System.register(
        SystemName.create('Stream Name Test'),
        SystemTypeHelper.fromString('web'),
        HostConfiguration.create({
          cpu: 2,
          memory: 8,
          storage: 250,
          encryptionEnabled: false,
        }),
        SystemPackages.fromArray([]),
        SecurityClassificationHelper.fromString('public'),
        CriticalityLevel.create(2),
        'correlation-789',
      );

      kurrentClient.appendToStream.mockResolvedValue(undefined);

      // Act
      await repository.save(system);

      // Assert
      const [streamName] = kurrentClient.appendToStream.mock.calls[0];
      expect(streamName).toMatch(/^System-[0-9a-f-]{36}$/);
    });
  });

  describe('findById', () => {
    it('should reconstruct system from event stream', async () => {
      // Arrange
      const systemId = SystemId.generate();
      const name = SystemName.create('Reconstructed System');
      const type = SystemTypeHelper.fromString('middleware');
      const host = HostConfiguration.create({
        cpu: 4,
        memory: 16,
        storage: 500,
        encryptionEnabled: true,
      });
      const packages = SystemPackages.fromArray([]);
      const securityClassification =
        SecurityClassificationHelper.fromString('confidential');
      const criticality = CriticalityLevel.create(4);

      const event = new SystemRegistered(
        systemId,
        name,
        type,
        host,
        criticality,
        packages,
        securityClassification,
        1,
        'correlation-id',
      );

      kurrentClient.readStream.mockResolvedValue([event]);

      // Act
      const system = await repository.findById(systemId);

      // Assert
      expect(system).not.toBeNull();
      expect(system!.getId().getValue()).toBe(systemId.getValue());
      expect(system!.getName().getValue()).toBe('Reconstructed System');
      expect(kurrentClient.readStream).toHaveBeenCalledWith(
        `System-${systemId.getValue()}`,
      );
    });

    it('should return null when stream does not exist', async () => {
      // Arrange
      const systemId = SystemId.generate();
      kurrentClient.readStream.mockResolvedValue([]);

      // Act
      const system = await repository.findById(systemId);

      // Assert
      expect(system).toBeNull();
    });

    it('should return null when stream is null', async () => {
      // Arrange
      const systemId = SystemId.generate();
      kurrentClient.readStream.mockResolvedValue(null as any);

      // Act
      const system = await repository.findById(systemId);

      // Assert
      expect(system).toBeNull();
    });

    it('should reconstruct system with all properties from events', async () => {
      // Arrange
      const systemId = SystemId.generate();
      const testPackage = Package.create({
        name: 'test-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      const event = new SystemRegistered(
        systemId,
        SystemName.create('Full Property System'),
        SystemTypeHelper.fromString('web'),
        HostConfiguration.create({
          cpu: 16,
          memory: 64,
          storage: 2000,
          encryptionEnabled: true,
        }),
        CriticalityLevel.create(5),
        SystemPackages.fromArray([testPackage]),
        SecurityClassificationHelper.fromString('confidential'),
        1,
        'correlation-id',
      );

      kurrentClient.readStream.mockResolvedValue([event]);

      // Act
      const system = await repository.findById(systemId);

      // Assert
      expect(system).not.toBeNull();
      expect(system!.getName().getValue()).toBe('Full Property System');
      expect(system!.getCriticality().getValue()).toBe(5);
      expect(system!.hasEncryptionEnabled()).toBe(true);
      expect(system!.getPackages().count()).toBe(1);
      expect(system!.isActive()).toBe(true);
    });
  });

  describe('findByName', () => {
    it('should return null for mock implementation', async () => {
      // Act
      const system = await repository.findByName('Test System');

      // Assert
      expect(system).toBeNull();
    });
  });
});
