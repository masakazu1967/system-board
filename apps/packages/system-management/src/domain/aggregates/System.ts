import { AggregateRoot, DomainEvent } from 'shared';
import { SystemId } from '../value-objects/SystemId';
import { SystemName } from '../value-objects/SystemName';
import { SystemType } from '../value-objects/SystemType';
import {
  SystemStatus,
  SystemStatusHelper,
} from '../value-objects/SystemStatus';
import { HostConfiguration } from '../value-objects/HostConfiguration';
import { SystemPackages } from '../value-objects/SystemPackages';
import { SecurityClassification } from '../value-objects/SecurityClassification';
import { CriticalityLevel } from '../value-objects/CriticalityLevel';
import { SystemRegistered } from '../events/SystemRegistered';

/**
 * System Aggregate Root
 * システム集約ルート
 */
export class System extends AggregateRoot<SystemId> {
  static readonly AGGREGATE_NAME = 'System';

  private _name!: SystemName;
  private _type!: SystemType;
  private _status!: SystemStatus;
  private _host!: HostConfiguration;
  private _packages!: SystemPackages;
  private _securityClassification!: SecurityClassification;
  private _criticality!: CriticalityLevel;
  private _createdDate!: Date;
  private _lastModified!: Date;
  private _decommissionDate?: Date;

  private constructor(systemId: SystemId) {
    super(systemId);
  }

  /**
   * システム新規登録（ファクトリーメソッド）
   */
  public static register(
    name: SystemName,
    type: SystemType,
    host: HostConfiguration,
    packages: SystemPackages,
    securityClassification: SecurityClassification,
    criticality: CriticalityLevel,
    correlationId: string,
  ): System {
    const systemId = SystemId.generate();
    const system = new System(systemId);

    // SystemRegisteredイベントを発行
    const event = new SystemRegistered(
      systemId,
      name,
      type,
      host,
      criticality,
      packages,
      securityClassification,
      1, // initial version
      correlationId,
    );

    system.addEvent(event);
    return system;
  }

  /**
   * ドメインイベントを適用
   */
  protected applyDomainEvent(event: DomainEvent): void {
    if (event instanceof SystemRegistered) {
      this.applySystemRegistered(event);
    }
    // 他のイベントハンドラーもここに追加
  }

  /**
   * SystemRegistered イベント適用
   */
  private applySystemRegistered(event: SystemRegistered): void {
    this._name = event.name;
    this._type = event.type;
    this._host = event.host;
    this._criticality = event.criticality;
    this._packages = event.packages;
    this._securityClassification = event.securityClassification;
    this._status = SystemStatus.ACTIVE;
    this._createdDate = event.occurredOn;
    this._lastModified = event.occurredOn;
  }

  /**
   * システムID取得
   */
  public getIdValue(): string {
    return this.getId().getValue();
  }

  /**
   * システム名取得
   */
  public getName(): SystemName {
    return this._name;
  }

  /**
   * アクティブ状態判定
   */
  public isActive(): boolean {
    return SystemStatusHelper.isActive(this._status);
  }

  /**
   * パッケージ無し判定
   */
  public hasNoPackages(): boolean {
    return this._packages.isEmpty();
  }

  /**
   * 暗号化有効判定
   */
  public hasEncryptionEnabled(): boolean {
    return this._host.isEncryptionEnabled();
  }

  /**
   * セキュリティ準拠パッケージ判定
   */
  public hasSecurityCompliantPackages(): boolean {
    return this._packages.areAllSecurityCompliant();
  }

  // Getters
  public getType(): SystemType {
    return this._type;
  }

  public getStatus(): SystemStatus {
    return this._status;
  }

  public getHost(): HostConfiguration {
    return this._host;
  }

  public getPackages(): SystemPackages {
    return this._packages;
  }

  public getSecurityClassification(): SecurityClassification {
    return this._securityClassification;
  }

  public getCriticality(): CriticalityLevel {
    return this._criticality;
  }

  public getCreatedDate(): Date {
    return this._createdDate;
  }

  public getLastModified(): Date {
    return this._lastModified;
  }

  public getDecommissionDate(): Date | undefined {
    return this._decommissionDate;
  }
}
