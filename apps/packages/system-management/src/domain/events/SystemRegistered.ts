import { DomainEvent } from 'shared';
import { SystemId } from '../value-objects/SystemId';
import { SystemName } from '../value-objects/SystemName';
import { SystemType } from '../value-objects/SystemType';
import { HostConfiguration } from '../value-objects/HostConfiguration';
import { CriticalityLevel } from '../value-objects/CriticalityLevel';
import { SystemPackages } from '../value-objects/SystemPackages';
import { SecurityClassification } from '../value-objects/SecurityClassification';
import { System } from '../aggregates/System';

/**
 * SystemRegistered Domain Event
 * システム登録イベント
 */
export class SystemRegistered extends DomainEvent {
  static readonly EVENT_NAME = 'SystemRegistered';

  constructor(
    public readonly systemId: SystemId,
    public readonly name: SystemName,
    public readonly type: SystemType,
    public readonly host: HostConfiguration,
    public readonly criticality: CriticalityLevel,
    public readonly packages: SystemPackages,
    public readonly securityClassification: SecurityClassification,
    aggregateVersion: number,
    correlationId: string,
  ) {
    super(
      SystemRegistered.EVENT_NAME,
      systemId.getValue(),
      System.AGGREGATE_NAME,
      aggregateVersion,
      correlationId,
    );
  }

  getData() {
    return {
      systemId: this.systemId.getValue(),
      name: this.name.getValue(),
      type: this.type,
      host: {
        cpu: this.host.getCpu(),
        memory: this.host.getMemory(),
        storage: this.host.getStorage(),
        encryptionEnabled: this.host.isEncryptionEnabled(),
      },
      criticality: this.criticality,
      packages: this.packages.getAll().map((p) => ({
        name: p.getName(),
        version: p.getVersion(),
        dependencies: p.getDependencies(),
        vulnerabilities: p.getVulnerabilities(),
      })),
      securityClassification: this.securityClassification,
    };
  }
}
