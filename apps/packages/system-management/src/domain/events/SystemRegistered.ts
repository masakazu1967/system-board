import { DomainEvent } from 'shared';
import { SystemId } from '../value-objects/SystemId';
import { SystemName } from '../value-objects/SystemName';
import { SystemPackages } from '../value-objects/SystemPackages';
import { SecurityClassification } from '../value-objects/SecurityClassification';

/**
 * SystemRegistered Domain Event
 * システム登録イベント
 */
export class SystemRegistered extends DomainEvent {
  static readonly EVENT_NAME = 'SystemRegistered';
  static readonly AGGREGATE_NAME = 'System';

  constructor(
    public readonly systemId: SystemId,
    public readonly name: SystemName,
    public readonly packages: SystemPackages,
    public readonly securityClassification: SecurityClassification,
    aggregateVersion: number,
    correlationId: string,
  ) {
    super(
      SystemRegistered.EVENT_NAME,
      systemId.getValue(),
      SystemRegistered.AGGREGATE_NAME,
      aggregateVersion,
      correlationId,
    );
  }

  getData() {
    return {
      systemId: this.systemId.getValue(),
      name: this.name.getValue(),
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
