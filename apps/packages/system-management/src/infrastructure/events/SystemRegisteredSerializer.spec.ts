// system-context/infrastructure/event-serializers/system-registered.serializer.spec.ts
import { SystemRegisteredSerializer } from './SystemRegisteredSerializer';
import { SystemRegisteredData } from '../../domain/events/SystemRegisteredData';
import { CriticalityLevel } from '../../domain/value-objects/CriticalityLevel';

describe('SystemRegisteredSerializer', () => {
  let serializer: SystemRegisteredSerializer;

  beforeEach(() => {
    serializer = new SystemRegisteredSerializer();
  });

  it('should serialize SystemRegistered data correctly', () => {
    const data: SystemRegisteredData = {
      systemId: 'sys-123',
      name: 'Production API Server',
      type: 'API_SERVER',
      host: {
        cpu: 8,
        memory: 32,
        storage: 500,
        encryptionEnabled: true,
      },
      criticality: CriticalityLevel.create(4),
      packages: [
        {
          name: 'express',
          version: '4.18.2',
          dependencies: ['body-parser'],
          vulnerabilities: [],
        },
      ],
      securityClassification: 'CONFIDENTIAL',
    };

    const serialized = serializer.serialize(data);

    expect(serialized.systemId).toBe('sys-123');
    expect(serialized.name).toBe('Production API Server');
    expect(serialized.host.encryptionEnabled).toBe(true);
    expect(serialized.packages).toHaveLength(1);
  });

  it('should deserialize SystemRegistered data correctly', () => {
    const serialized = {
      systemId: 'sys-123',
      name: 'Production API Server',
      type: 'API_SERVER',
      host: {
        cpu: '8 cores',
        memory: '32GB',
        storage: '500GB SSD',
        encryptionEnabled: true,
      },
      criticality: 'HIGH',
      packages: [
        {
          name: 'express',
          version: '4.18.2',
          dependencies: ['body-parser'],
          vulnerabilities: [],
        },
      ],
      securityClassification: 'CONFIDENTIAL',
    };

    const deserialized = serializer.deserialize(serialized);

    expect(deserialized.systemId).toBe('sys-123');
    expect(deserialized.packages[0].name).toBe('express');
  });
});
