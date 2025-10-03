import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { RegisterSystemCommandHandler } from './RegisterSystemCommandHandler';
import { RegisterSystemCommand } from '../commands/RegisterSystemCommand';
import { EventPublisher } from '@system-board/shared';
import { SystemRegistered } from '../../domain/events/SystemRegistered';
import { Package } from '../../domain/value-objects/Package';

describe('RegisterSystemCommandHandler', () => {
  let handler: RegisterSystemCommandHandler;
  let eventPublisher: MockProxy<EventPublisher>;

  beforeEach(async () => {
    eventPublisher = mock<EventPublisher>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterSystemCommandHandler,
        {
          provide: 'EventPublisher',
          useValue: eventPublisher,
        },
      ],
    }).compile();

    handler = module.get<RegisterSystemCommandHandler>(
      RegisterSystemCommandHandler,
    );
  });

  describe('handle', () => {
    it('should register a system and publish SystemRegistered event', async () => {
      // Arrange
      const testPackage = Package.create({
        name: 'test-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      const command = new RegisterSystemCommand(
        'Test System',
        'web-server',
        {
          hostId: 'host-001',
          ipAddress: '192.168.1.100',
          hostname: 'web-server-01',
          osType: 'Linux',
          osVersion: 'Ubuntu 22.04',
          encryptionEnabled: true,
        },
        [testPackage],
        'confidential',
        4,
        'correlation-123',
      );

      // Act
      const systemId = await handler.handle(command);

      // Assert
      expect(systemId).toBeDefined();
      expect(systemId.getValue()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      expect(eventPublisher.publishAll).toHaveBeenCalledTimes(1);
      const publishedEvents = eventPublisher.publishAll.mock.calls[0][0];
      expect(publishedEvents).toHaveLength(1);
      expect(publishedEvents[0]).toBeInstanceOf(SystemRegistered);

      const event = publishedEvents[0] as SystemRegistered;
      expect(event.name.getValue()).toBe('Test System');
      expect(event.correlationId).toBe('correlation-123');
    });

    it('should handle system with multiple packages', async () => {
      // Arrange
      const packages = [
        Package.create({
          name: 'package-1',
          version: '1.0.0',
          dependencies: [],
          vulnerabilities: [],
        }),
        Package.create({
          name: 'package-2',
          version: '2.0.0',
          dependencies: [],
          vulnerabilities: [],
        }),
      ];

      const command = new RegisterSystemCommand(
        'Multi Package System',
        'application',
        {
          hostId: 'host-002',
          ipAddress: '192.168.1.101',
          hostname: 'app-server-01',
          osType: 'Windows',
          osVersion: 'Windows Server 2022',
          encryptionEnabled: false,
        },
        packages,
        'internal',
        3,
        'correlation-456',
      );

      // Act
      const systemId = await handler.handle(command);

      // Assert
      expect(systemId).toBeDefined();
      expect(eventPublisher.publishAll).toHaveBeenCalledTimes(1);

      const publishedEvents = eventPublisher.publishAll.mock.calls[0][0];
      const event = publishedEvents[0] as SystemRegistered;
      expect(event.packages.getPackages()).toHaveLength(2);
    });

    it('should handle high criticality systems', async () => {
      // Arrange
      const testPackage = Package.create({
        name: 'critical-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      const command = new RegisterSystemCommand(
        'Critical System',
        'database',
        {
          hostId: 'host-003',
          ipAddress: '192.168.1.102',
          hostname: 'db-server-01',
          osType: 'Linux',
          osVersion: 'RHEL 8',
          encryptionEnabled: true,
        },
        [testPackage],
        'confidential',
        5, // Highest criticality
        'correlation-789',
      );

      // Act
      const systemId = await handler.handle(command);

      // Assert
      expect(systemId).toBeDefined();
      const publishedEvents = eventPublisher.publishAll.mock.calls[0][0];
      const event = publishedEvents[0] as SystemRegistered;
      expect(event.criticality.getValue()).toBe(5);
    });

    it('should create unique system IDs for each registration', async () => {
      // Arrange
      const testPackage = Package.create({
        name: 'test-package',
        version: '1.0.0',
        dependencies: [],
        vulnerabilities: [],
      });

      const command1 = new RegisterSystemCommand(
        'System 1',
        'web-server',
        {
          hostId: 'host-001',
          ipAddress: '192.168.1.100',
          hostname: 'web-01',
          osType: 'Linux',
          osVersion: 'Ubuntu 22.04',
          encryptionEnabled: true,
        },
        [testPackage],
        'internal',
        3,
        'correlation-1',
      );

      const command2 = new RegisterSystemCommand(
        'System 2',
        'web-server',
        {
          hostId: 'host-002',
          ipAddress: '192.168.1.101',
          hostname: 'web-02',
          osType: 'Linux',
          osVersion: 'Ubuntu 22.04',
          encryptionEnabled: true,
        },
        [testPackage],
        'internal',
        3,
        'correlation-2',
      );

      // Act
      const systemId1 = await handler.handle(command1);
      const systemId2 = await handler.handle(command2);

      // Assert
      expect(systemId1.getValue()).not.toBe(systemId2.getValue());
    });
  });
});
