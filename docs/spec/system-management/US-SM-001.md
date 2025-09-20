# US-SM-001: システム新規登録 - System集約設計仕様書

**担当**: ソフトウェアアーキテクト
**作成日**: 2025-09-20
**Issue**: #120
**見積**: 30分

## 1. System集約の設計

### 1.1 集約ルート (System Aggregate)

**責任範囲**: システム構成・パッケージ・ホスト管理

```typescript
class System extends AggregateRoot {
  // Identity
  private systemId: SystemId;
  private name: SystemName;
  private type: SystemType;
  private status: SystemStatus;

  // Configuration
  private host: HostConfiguration;
  private packages: Package[];
  private securityClassification: SecurityClassification;
  private criticality: CriticalityLevel;

  // Lifecycle
  private createdDate: Date;
  private lastModified: Date;
  private decommissionDate?: Date;

  // Domain Methods
  public registerSystem(command: RegisterSystemCommand): SystemRegistered;
  public updateConfiguration(config: SystemConfiguration): SystemConfigurationUpdated;
  public installPackage(package: Package): PackageInstalled;
  public scaleHostResources(resources: HostResources): HostResourcesScaled;
  public decommission(): SystemDecommissioned;

  // Invariants
  private validateActiveSystemHasPackages(): void;
  private validateSystemNameUniqueness(): void;
  private validateSecurityClassificationConsistency(): void;
}
```

### 1.2 不変条件 (Business Invariants)

- **アクティブシステム要件**: アクティブシステムは必ず1つ以上のパッケージを持つ
- **システム名一意性**: システム名はシステム全体で一意でなければならない
- **廃止システム制約**: 廃止されたシステムはパッケージ更新不可
- **セキュリティ分類整合性**: セキュリティ分類変更時の関連データ整合性保証

### 1.3 発行ドメインイベント

- `SystemRegistered`: システム新規登録完了
- `SystemConfigurationUpdated`: システム構成更新完了
- `SystemDecommissioned`: システム廃止完了
- `PackageInstalled`: パッケージインストール完了
- `HostResourcesScaled`: ホストリソース拡張完了

## 2. RegisterSystemコマンドの仕様

### 2.1 コマンド定義

```typescript
export class RegisterSystemCommand {
  readonly name: string;
  readonly type: SystemType;
  readonly hostConfiguration: HostConfigurationDto;
  readonly securityClassification: SecurityClassification;
  readonly criticality: CriticalityLevel;
  readonly initialPackages: PackageDto[];

  constructor(data: RegisterSystemCommandData) {
    this.validateCommand(data);
    // ... initialization
  }

  private validateCommand(data: RegisterSystemCommandData): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new InvalidSystemNameError('System name is required');
    }

    if (!data.type || !Object.values(SystemType).includes(data.type)) {
      throw new InvalidSystemTypeError('Valid system type is required');
    }

    if (!data.hostConfiguration) {
      throw new InvalidHostConfigurationError('Host configuration is required');
    }
  }
}
```

### 2.2 コマンドハンドラー

```typescript
@CommandHandler(RegisterSystemCommand)
export class RegisterSystemHandler {
  constructor(
    private readonly systemRepository: SystemRepository,
    private readonly systemUniquenessService: SystemUniquenessService,
    private readonly eventBus: DomainEventBus
  ) {}

  async execute(command: RegisterSystemCommand): Promise<void> {
    // 1. ドメインモデル生成
    const system = System.register(command);

    // 2. 一意性制約チェック
    await this.systemUniquenessService.ensureUniqueness(system.name);

    // 3. 集約永続化
    await this.systemRepository.save(system);

    // 4. ドメインイベント発行
    await this.eventBus.publishAll(system.getUncommittedEvents());
  }
}
```

### 2.3 バリデーションルール

- **必須項目**: システム名、システム種別、ホスト構成
- **システム名制約**: 1-255文字、英数字とハイフンのみ
- **システム種別**: WEB, API, DATABASE, BATCH, OTHER から選択
- **ホスト構成**: CPU、メモリ、ストレージの仕様必須
- **セキュリティ分類**: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED から選択

## 3. SystemRegisteredイベントの仕様

### 3.1 イベント定義

```typescript
export class SystemRegistered extends DomainEvent {
  readonly systemId: SystemId;
  readonly name: string;
  readonly type: SystemType;
  readonly hostConfiguration: HostConfiguration;
  readonly securityClassification: SecurityClassification;
  readonly criticality: CriticalityLevel;
  readonly initialPackages: Package[];
  readonly registeredAt: Date;

  constructor(data: SystemRegisteredEventData) {
    super('SystemRegistered', '1.0');
    this.systemId = data.systemId;
    this.name = data.name;
    this.type = data.type;
    this.hostConfiguration = data.hostConfiguration;
    this.securityClassification = data.securityClassification;
    this.criticality = data.criticality;
    this.initialPackages = data.initialPackages;
    this.registeredAt = data.registeredAt;
  }

  getData(): SystemRegisteredEventData {
    return {
      systemId: this.systemId,
      name: this.name,
      type: this.type,
      hostConfiguration: this.hostConfiguration,
      securityClassification: this.securityClassification,
      criticality: this.criticality,
      initialPackages: this.initialPackages,
      registeredAt: this.registeredAt
    };
  }
}
```

### 3.2 イベントサブスクライバー

**脆弱性管理コンテキスト**:
- システム登録時に脆弱性スキャンを自動開始
- パッケージ情報から既知の脆弱性を検索

**関係管理コンテキスト**:
- 新規システムの依存関係分析を開始
- 既存システムとの依存関係マッピング

**Read Model更新**:
- PostgreSQLのシステム読み取りモデルを非同期更新
- 検索インデックスの更新

### 3.3 イベントバージョニング

- **Version 1.0**: 初期仕様 (現在)
- **将来の拡張**: ライセンス情報、コンプライアンス要件、運用メタデータ

## 4. ドメインサービスの責務定義

### 4.1 SystemUniquenessService

```typescript
@Injectable()
export class SystemUniquenessService {
  constructor(
    private readonly systemRepository: SystemRepository,
    private readonly transactionManager: TransactionManager
  ) {}

  async ensureUniqueness(systemName: SystemName): Promise<void> {
    await this.transactionManager.execute(async (tx) => {
      const existingSystem = await this.systemRepository.findByName(systemName, tx);

      if (existingSystem) {
        throw new SystemNameAlreadyExistsError(systemName.value);
      }

      // 同時登録防止のための予約レコード作成
      await this.createNameReservation(systemName, tx);
    });
  }

  private async createNameReservation(systemName: SystemName, tx: Transaction): Promise<void> {
    try {
      await tx('system_name_reservations').insert({
        name: systemName.value,
        reserved_at: new Date(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000) // 5分で期限切れ
      });
    } catch (error) {
      if (error.code === '23505') { // UNIQUE制約違反
        throw new SystemNameReservationConflictError(systemName.value);
      }
      throw error;
    }
  }
}
```

### 4.2 SystemStateTransitionService

```typescript
@Injectable()
export class SystemStateTransitionService {
  private readonly validTransitions = new Map<SystemStatus, SystemStatus[]>([
    [SystemStatus.PLANNING, [SystemStatus.ACTIVE, SystemStatus.CANCELLED]],
    [SystemStatus.ACTIVE, [SystemStatus.MAINTENANCE, SystemStatus.DECOMMISSIONED]],
    [SystemStatus.MAINTENANCE, [SystemStatus.ACTIVE, SystemStatus.DECOMMISSIONED]],
    [SystemStatus.DECOMMISSIONED, []], // 終端状態
    [SystemStatus.CANCELLED, []] // 終端状態
  ]);

  validateTransition(currentStatus: SystemStatus, newStatus: SystemStatus): void {
    const allowedTransitions = this.validTransitions.get(currentStatus) || [];

    if (!allowedTransitions.includes(newStatus)) {
      throw new InvalidStatusTransitionError(
        `Cannot transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  canModifySystem(status: SystemStatus): boolean {
    return status === SystemStatus.PLANNING ||
           status === SystemStatus.ACTIVE ||
           status === SystemStatus.MAINTENANCE;
  }
}
```

### 4.3 SystemValidationService

```typescript
@Injectable()
export class SystemValidationService {
  validateSystemConfiguration(system: System): ValidationResult {
    const errors: ValidationError[] = [];

    // アクティブシステムのパッケージ要件チェック
    if (system.status === SystemStatus.ACTIVE && system.packages.length === 0) {
      errors.push(new ValidationError(
        'ACTIVE_SYSTEM_WITHOUT_PACKAGES',
        'Active system must have at least one package'
      ));
    }

    // セキュリティ分類の整合性チェック
    if (!this.isSecurityClassificationConsistent(system)) {
      errors.push(new ValidationError(
        'INCONSISTENT_SECURITY_CLASSIFICATION',
        'Security classification is inconsistent with system configuration'
      ));
    }

    // クリティカルレベルの妥当性チェック
    if (!this.isCriticalityLevelValid(system)) {
      errors.push(new ValidationError(
        'INVALID_CRITICALITY_LEVEL',
        'Criticality level does not match system type and configuration'
      ));
    }

    return new ValidationResult(errors);
  }

  private isSecurityClassificationConsistent(system: System): boolean {
    // セキュリティ分類とホスト構成、パッケージ要件の整合性チェック
    const hasEncryptionRequirement = system.securityClassification === SecurityClassification.CONFIDENTIAL ||
                                    system.securityClassification === SecurityClassification.RESTRICTED;

    if (hasEncryptionRequirement) {
      return system.host.encryptionEnabled &&
             system.packages.every(pkg => pkg.hasSecurityCompliance);
    }

    return true;
  }

  private isCriticalityLevelValid(system: System): boolean {
    // システム種別とクリティカルレベルの整合性チェック
    if (system.type === SystemType.DATABASE && system.criticality === CriticalityLevel.LOW) {
      return false; // データベースシステムは最低でもMEDIUMクリティカル
    }

    return true;
  }
}
```

## 5. アプリケーションレイヤーのService設計

### 5.1 SystemApplicationService

```typescript
@Injectable()
export class SystemApplicationService {
  constructor(
    private readonly systemRepository: SystemRepository,
    private readonly systemUniquenessService: SystemUniquenessService,
    private readonly systemValidationService: SystemValidationService,
    private readonly eventBus: DomainEventBus
  ) {}

  async registerSystem(command: RegisterSystemCommand): Promise<SystemId> {
    // 1. 集約生成
    const system = System.register(command);

    // 2. ドメインレベルの検証
    const validationResult = this.systemValidationService.validateSystemConfiguration(system);
    if (!validationResult.isValid()) {
      throw new SystemValidationError(validationResult.errors);
    }

    // 3. 一意性制約チェック
    await this.systemUniquenessService.ensureUniqueness(system.name);

    // 4. 永続化
    await this.systemRepository.save(system);

    // 5. イベント発行
    await this.eventBus.publishAll(system.getUncommittedEvents());

    return system.id;
  }

  async getSystemById(systemId: SystemId): Promise<SystemDto> {
    const system = await this.systemRepository.getById(systemId);
    return SystemDto.fromDomain(system);
  }

  async updateSystemConfiguration(
    systemId: SystemId,
    configuration: SystemConfigurationDto
  ): Promise<void> {
    const system = await this.systemRepository.getById(systemId);

    system.updateConfiguration(configuration);

    const validationResult = this.systemValidationService.validateSystemConfiguration(system);
    if (!validationResult.isValid()) {
      throw new SystemValidationError(validationResult.errors);
    }

    await this.systemRepository.save(system);
    await this.eventBus.publishAll(system.getUncommittedEvents());
  }
}
```

### 5.2 SystemQueryService

```typescript
@Injectable()
export class SystemQueryService {
  constructor(
    private readonly systemReadModelRepository: SystemReadModelRepository
  ) {}

  async findSystemsByType(systemType: SystemType): Promise<SystemSummaryDto[]> {
    const systems = await this.systemReadModelRepository.findByType(systemType);
    return systems.map(SystemSummaryDto.fromReadModel);
  }

  async findSystemsWithVulnerabilities(): Promise<SystemVulnerabilityDto[]> {
    const systems = await this.systemReadModelRepository.findSystemsWithVulnerabilities();
    return systems.map(SystemVulnerabilityDto.fromReadModel);
  }

  async findExpiredSystems(): Promise<SystemSummaryDto[]> {
    const systems = await this.systemReadModelRepository.findExpiredSystems();
    return systems.map(SystemSummaryDto.fromReadModel);
  }

  async getSystemStatistics(): Promise<SystemStatisticsDto> {
    const stats = await this.systemReadModelRepository.getSystemStatistics();
    return SystemStatisticsDto.fromReadModel(stats);
  }
}
```

## 6. Repository設計

### 6.1 SystemRepository Interface

```typescript
export interface SystemRepository {
  save(system: System): Promise<void>;
  getById(systemId: SystemId): Promise<System>;
  findByName(systemName: SystemName, tx?: Transaction): Promise<System | null>;
  exists(systemId: SystemId): Promise<boolean>;
}
```

### 6.2 Event Sourcing Repository実装

```typescript
@Injectable()
export class KurrentSystemRepository implements SystemRepository {
  constructor(
    private readonly kurrent: KurrentClient,
    private readonly eventSerializer: EventSerializer
  ) {}

  async save(system: System): Promise<void> {
    const uncommittedEvents = system.getUncommittedEvents();
    const serializedEvents = uncommittedEvents.map(event =>
      this.eventSerializer.serialize(event)
    );

    await this.kurrent.appendToStream(
      `system-${system.id.value}`,
      system.expectedVersion,
      serializedEvents
    );

    system.markEventsAsCommitted();
  }

  async getById(systemId: SystemId): Promise<System> {
    const streamEvents = await this.kurrent.readStreamEvents(`system-${systemId.value}`);

    if (streamEvents.length === 0) {
      throw new SystemNotFoundError(systemId.value);
    }

    const domainEvents = streamEvents.map(event =>
      this.eventSerializer.deserialize(event.data)
    );

    return System.fromHistory(domainEvents);
  }

  async findByName(systemName: SystemName, tx?: Transaction): Promise<System | null> {
    // Kurrent Projectionを活用した効率的検索
    const systemStreams = await this.kurrent.queryStreams({
      streamCategory: 'system',
      whereEvent: 'SystemRegistered',
      whereData: { name: systemName.value }
    });

    if (systemStreams.length === 0) {
      return null;
    }

    // 最初に見つかったシステムの最新状態を復元
    const events = await this.kurrent.readStreamEvents(systemStreams[0]);
    const domainEvents = events.map(event =>
      this.eventSerializer.deserialize(event.data)
    );

    return System.fromHistory(domainEvents);
  }

  async exists(systemId: SystemId): Promise<boolean> {
    try {
      await this.getById(systemId);
      return true;
    } catch (error) {
      if (error instanceof SystemNotFoundError) {
        return false;
      }
      throw error;
    }
  }
}
```

## 7. エラーハンドリング

### 7.1 ドメイン例外

```typescript
export class SystemDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SystemDomainError';
  }
}

export class SystemNameAlreadyExistsError extends SystemDomainError {
  constructor(systemName: string) {
    super(`System with name '${systemName}' already exists`, 'SYSTEM_NAME_ALREADY_EXISTS');
  }
}

export class DecommissionedSystemError extends SystemDomainError {
  constructor(message: string) {
    super(message, 'DECOMMISSIONED_SYSTEM_ERROR');
  }
}

export class InvalidStatusTransitionError extends SystemDomainError {
  constructor(message: string) {
    super(message, 'INVALID_STATUS_TRANSITION');
  }
}

export class SystemValidationError extends SystemDomainError {
  constructor(public readonly validationErrors: ValidationError[]) {
    super('System validation failed', 'SYSTEM_VALIDATION_ERROR');
  }
}
```

### 7.2 アプリケーション例外

```typescript
export class SystemNotFoundError extends Error {
  constructor(systemId: string) {
    super(`System with ID '${systemId}' not found`);
    this.name = 'SystemNotFoundError';
  }
}

export class SystemNameReservationConflictError extends Error {
  constructor(systemName: string) {
    super(`System name '${systemName}' is currently reserved by another operation`);
    this.name = 'SystemNameReservationConflictError';
  }
}
```

## 8. 実装優先度

### Phase 1: 基本構造 (Sprint 1-2)
1. System集約基本実装
2. RegisterSystemコマンド・ハンドラー
3. SystemRegisteredイベント
4. 基本的なRepository実装

### Phase 2: ドメインサービス (Sprint 3-4)
1. SystemUniquenessService実装
2. SystemValidationService実装
3. エラーハンドリング強化
4. 単体テスト完備

### Phase 3: アプリケーション層 (Sprint 5-6)
1. SystemApplicationService実装
2. SystemQueryService実装
3. Read Model Projection実装
4. 統合テスト実装

## 9. 受け入れ条件確認

- ✅ **System集約の設計ドキュメント作成**: 完了 (セクション1)
- ✅ **RegisterSystemコマンドの仕様定義**: 完了 (セクション2)
- ✅ **SystemRegisteredイベントの仕様定義**: 完了 (セクション3)
- ✅ **ドメインサービスの責務定義**: 完了 (セクション4)

---

**文書管理**:
- **作成者**: ソフトウェアアーキテクト
- **レビュー要求**: バックエンドエンジニア、データベースアーキテクト
- **次期作業**: 実装フェーズ開始 (NestJS詳細実装)