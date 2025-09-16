# Phase 4: Aggregates & Bounded Context Discovery 成果物

**Phase目標**: 関連するイベント・コマンド・データをグループ化し、Aggregate境界とBounded Context境界を確定する。オニオンアーキテクチャでの実装設計に落とし込む

**実施日**: 2025年9月17日 07:00-07-30
**所要時間**: 4時間
**主担当**: Software Architecture Advisor（アーキテクチャ統合）
**支援**: Database Architect Consultant（データ設計）
**参加エージェント**: Requirements Analyst (ファシリテーター), Backend System Architect, UX Design Optimizer, DevOps Pipeline Optimizer, Cybersecurity Advisor

---

## 1. Core Aggregates 設計結果

### 1.1 System Management Context Aggregates

#### System Aggregate (Aggregate Root)

**責任範囲**: システム構成・パッケージ・ホスト管理

```typescript
class System {
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
  public registerSystem(): SystemRegistered;
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

**不変条件**:

- アクティブシステムは必ず1つ以上のパッケージを持つ
- システム名の一意性保証
- 廃止システムはパッケージ更新不可
- セキュリティ分類変更時の関連データ整合性

**発行ドメインイベント**:

- `SystemRegistered`
- `SystemConfigurationUpdated`
- `SystemDecommissioned`
- `PackageInstalled`
- `HostResourcesScaled`

#### Package Entity

```typescript
class Package {
  private packageId: PackageId;
  private name: PackageName;
  private version: Version;
  private installDate: Date;
  private eolDate?: Date;
  private vulnerabilityRefs: VulnerabilityRef[];
  private dependencies: PackageRef[];

  public updateVersion(newVersion: Version): PackageUpdated;
  public addVulnerabilityReference(vulnRef: VulnerabilityRef): void;
  public checkEOLStatus(currentDate: Date): boolean;
}
```

### 1.2 Vulnerability Management Context Aggregates

#### Vulnerability Aggregate (Aggregate Root)

**責任範囲**: 脆弱性・リスク評価・影響分析管理

```typescript
class Vulnerability {
  // Identity
  private vulnerabilityId: CVE_ID;
  private cvss: CVSSScore;
  private severity: VulnerabilitySeverity;
  private status: VulnerabilityStatus;

  // Affected Scope
  private affectedPackages: PackageRef[];
  private affectedSystems: SystemRef[];

  // Assessment
  private riskAssessments: RiskAssessment[];
  private mitigationPlans: MitigationPlan[];

  // Lifecycle
  private detectionDate: Date;
  private lastUpdated: Date;
  private resolvedDate?: Date;

  // Domain Methods
  public detectVulnerability(cveData: CVEData): VulnerabilityDetected;
  public assessRisk(assessment: RiskAssessmentInput): RiskAssessmentCompleted;
  public createMitigationPlan(plan: MitigationPlanInput): MitigationPlanCreated;
  public applySecurityPatch(patch: SecurityPatch): SecurityPatchApplied;
  public resolveVulnerability(): VulnerabilityResolved;

  // Invariants
  private validateCVSSRange(): void; // 0.0-10.0
  private enforceHighSeverityTaskCreation(): void; // CVSS≥9.0
  private preventReopeningResolvedVulnerability(): void;
}
```

**不変条件**:

- CVSSスコアは0.0-10.0の範囲内
- CVSS≥9.0は必ずUrgentタスクが生成される
- 解決済み脆弱性は再オープンされない
- 影響パッケージの存在確認

**発行ドメインイベント**:

- `VulnerabilityDetected`
- `CVSSScoreAssigned`
- `RiskAssessmentCompleted`
- `MitigationPlanCreated`
- `SecurityPatchApplied`
- `VulnerabilityResolved`

#### RiskAssessment Entity

```typescript
class RiskAssessment {
  private assessmentId: AssessmentId;
  private vulnerabilityRef: VulnerabilityRef;
  private affectedSystems: SystemRef[];
  private riskLevel: RiskLevel;
  private businessImpact: BusinessImpact;
  private mitigationPlan: string;
  private assessedBy: UserId;
  private assessedDate: Date;
  private approvedBy?: UserId;
  private approvalDate?: Date;

  public updateRiskLevel(newLevel: RiskLevel): RiskLevelUpdated;
  public approveMitigation(approver: UserId): MitigationApproved;
}
```

### 1.3 Task Management Context Aggregates

#### Task Aggregate (Aggregate Root)

**責任範囲**: タスク実行・ワークフロー・エスカレーション管理

```typescript
class Task {
  // Identity
  private taskId: TaskId;
  private type: TaskType;
  private priority: TaskPriority;
  private status: TaskStatus;

  // Context References
  private systemRef?: SystemId;
  private vulnerabilityRef?: CVE_ID;
  private relationshipRef?: DependencyId;

  // Assignment
  private assigneeRef?: UserId;
  private assignedDate?: Date;
  private dueDate: Date;

  // Progress
  private createdDate: Date;
  private startedDate?: Date;
  private completedDate?: Date;
  private escalationHistory: EscalationRecord[];

  // Approval
  private requiresApproval: boolean;
  private approvalHistory: ApprovalRecord[];

  // Domain Methods
  public createTask(input: TaskCreationInput): TaskCreated;
  public assignTask(assignee: UserId): TaskAssigned;
  public startWork(): TaskStarted;
  public completeTask(result: TaskResult): TaskCompleted;
  public escalateTask(reason: EscalationReason): TaskEscalated;
  public requestApproval(approver: UserId): ApprovalRequested;

  // Invariants
  private validateStatusTransitions(): void;
  private preventCompletedTaskModification(): void;
  private enforceCriticalTaskPriority(): void; // CVSS≥9.0
}
```

**不変条件**:

- 有効なステータス遷移のみ許可
- 完了タスクは編集不可
- CVSS≥9.0は緊急優先度必須
- 承認必要タスクの承認完了確認

**発行ドメインイベント**:

- `TaskCreated`
- `TaskAssigned`
- `TaskStarted`
- `TaskCompleted`
- `TaskEscalated`
- `ApprovalRequested`
- `ApprovalCompleted`

#### Workflow Aggregate (Aggregate Root)

```typescript
class Workflow {
  private workflowId: WorkflowId;
  private name: WorkflowName;
  private tasks: TaskRef[];
  private rules: WorkflowRule[];
  private status: WorkflowStatus;
  private triggerConditions: TriggerCondition[];
  private orchestrationLogic: OrchestrationLogic;

  public startWorkflow(trigger: WorkflowTrigger): WorkflowStarted;
  public handleTaskCompletion(taskId: TaskId): WorkflowProgressUpdated;
  public completeWorkflow(): WorkflowCompleted;

  private validateWorkflowRules(): void;
  private checkCompletionCriteria(): boolean;
}
```

### 1.4 Relationship Management Context Aggregates

#### SystemDependency Aggregate (Aggregate Root)

**責任範囲**: 依存関係・影響分析管理

```typescript
class SystemDependency {
  // Identity
  private dependencyId: DependencyId;
  private sourceSystemRef: SystemId;
  private targetSystemRef: SystemId;

  // Relationship Properties
  private dependencyType: DependencyType;
  private strength: DependencyStrength;
  private direction: DependencyDirection;

  // Analysis
  private impactAnalyses: ImpactAnalysis[];

  // Lifecycle
  private createdDate: Date;
  private lastVerified: Date;
  private status: DependencyStatus;

  // Domain Methods
  public mapDependency(mapping: DependencyMapping): DependencyMapped;
  public analyzeImpact(change: SystemChange): ImpactAnalysisCompleted;
  public updateDependency(update: DependencyUpdate): DependencyUpdated;
  public verifyDependency(): DependencyVerified;

  // Invariants
  private preventCircularDependencies(): void;
  private validateDependencyStrength(): void;
}
```

**不変条件**:

- 循環依存関係の防止
- 依存関係強度の妥当性検証
- システム存在確認

**発行ドメインイベント**:

- `DependencyMapped`
- `ImpactAnalysisCompleted`
- `DependencyUpdated`
- `CircularDependencyDetected`

---

## 2. Bounded Context 境界確定

### 2.1 Context Map & Relationships

#### Context間関係性

**System Management Context (Upstream) ↔ Vulnerability Management Context (Downstream)**:

- **関係性**: Customer/Supplier
- **データ流れ**: システム情報・パッケージ情報 → 脆弱性評価
- **連携**: SystemRegistered → TriggerVulnerabilityScan

**Vulnerability Management Context (Upstream) ↔ Task Management Context (Downstream)**:

- **関係性**: Customer/Supplier
- **データ流れ**: 脆弱性情報・リスク評価 → タスク生成
- **連携**: VulnerabilityDetected → CreateUrgentTask (CVSS≥9.0)

**Task Management Context ↔ System Management Context (Feedback)**:

- **関係性**: Published Language
- **データ流れ**: タスク完了結果 → システム状態更新
- **連携**: TaskCompleted → SystemStatusUpdated

**System Management Context ↔ Relationship Management Context**:

- **関係性**: Shared Kernel
- **共有概念**: SystemId, システム参照
- **連携**: SystemRegistered → AnalyzeDependencies

#### Shared Kernel 定義

```typescript
// Shared Kernel - 全Context共通
interface SharedKernel {
  // Common Identifiers
  SystemId: ValueObject;
  CVE_ID: ValueObject;
  UserId: ValueObject;

  // Common Events Interface
  DomainEvent: Interface;

  // Common Repository Interface
  Repository<T>: Interface;

  // Common Value Objects
  Timestamp: ValueObject;
  Version: ValueObject;
}
```

#### Anti-Corruption Layer 設計

**External API Integration**:

```typescript
// GitHub API ACL
class GitHubAPIAntiCorruptionLayer {
  public async fetchRepositoryData(repoUrl: string): Promise<SystemConfiguration> {
    const githubData = await this.githubClient.getRepository(repoUrl);

    return this.transformToSystemDomain({
      name: githubData.name,
      packages: this.extractPackagesFromDependencies(githubData.dependencies),
      securityAdvisories: this.mapSecurityAdvisories(githubData.advisories)
    });
  }

  private transformToSystemDomain(data: GitHubRepositoryData): SystemConfiguration;
  private extractPackagesFromDependencies(deps: GitHubDependency[]): Package[];
  private mapSecurityAdvisories(advisories: GitHubAdvisory[]): VulnerabilityRef[];
}

// NVD API ACL
class NVDAPIAntiCorruptionLayer {
  public async fetchCVEData(cveId: string): Promise<VulnerabilityData> {
    const nvdData = await this.nvdClient.getCVE(cveId);

    return this.transformToVulnerabilityDomain({
      cveId: nvdData.cve.CVE_data_meta.ID,
      cvssScore: this.extractCVSSScore(nvdData.impact),
      affectedProducts: this.mapAffectedProducts(nvdData.configurations),
      publishedDate: nvdData.publishedDate
    });
  }

  private transformToVulnerabilityDomain(data: NVDCVEData): VulnerabilityData;
  private extractCVSSScore(impact: NVDImpact): CVSSScore;
  private mapAffectedProducts(configs: NVDConfiguration[]): PackageRef[];
}

// EndOfLife.date API ACL
class EOLAPIAntiCorruptionLayer {
  public async fetchEOLData(productName: string): Promise<LifecycleData> {
    const eolData = await this.eolClient.getProduct(productName);

    return this.transformToLifecycleDomain({
      productName: eolData.product,
      versions: this.mapVersionLifecycles(eolData.releases),
      currentSupport: this.determineCurrentSupportStatus(eolData)
    });
  }

  private transformToLifecycleDomain(data: EOLProductData): LifecycleData;
  private mapVersionLifecycles(releases: EOLRelease[]): VersionLifecycle[];
  private determineCurrentSupportStatus(data: EOLProductData): SupportStatus;
}
```

### 2.2 NestJS Module構造設計

#### モジュラーモノリス実装構造

```text
/src
  /contexts
    /system-management/
      /domain/
        - system.aggregate.ts
        - package.entity.ts
        - host-configuration.value-object.ts
        - system-name.value-object.ts
        - security-classification.value-object.ts
      /application/
        - system.service.ts
        - register-system.handler.ts
        - update-system-configuration.handler.ts
        - system.queries.ts
        - system.dto.ts
      /infrastructure/
        - system.repository.ts
        - github-api.client.ts
        - system.controller.ts
      - system.module.ts

    /vulnerability-management/
      /domain/
        - vulnerability.aggregate.ts
        - risk-assessment.entity.ts
        - cvss-score.value-object.ts
        - vulnerability-severity.value-object.ts
      /application/
        - vulnerability.service.ts
        - detect-vulnerability.handler.ts
        - assess-risk.handler.ts
        - vulnerability.queries.ts
      /infrastructure/
        - vulnerability.repository.ts
        - nvd-api.client.ts
        - vulnerability.controller.ts
      - vulnerability.module.ts

    /task-management/
      /domain/
        - task.aggregate.ts
        - workflow.aggregate.ts
        - task-status.value-object.ts
        - task-priority.value-object.ts
      /application/
        - task.service.ts
        - create-task.handler.ts
        - assign-task.handler.ts
        - task.queries.ts
        - workflow.orchestrator.ts
      /infrastructure/
        - task.repository.ts
        - notification.service.ts
        - task.controller.ts
      - task.module.ts

    /relationship-management/
      /domain/
        - system-dependency.aggregate.ts
        - impact-analysis.entity.ts
        - dependency-type.value-object.ts
      /application/
        - relationship.service.ts
        - map-dependency.handler.ts
        - analyze-impact.handler.ts
        - relationship.queries.ts
      /infrastructure/
        - relationship.repository.ts
        - relationship.controller.ts
      - relationship.module.ts

  /shared/
    /domain/
      - shared-kernel.ts
      - domain-event.interface.ts
      - aggregate-root.abstract.ts
      - entity.abstract.ts
      - value-object.abstract.ts
    /application/
      - event-bus.ts
      - command.interface.ts
      - query.interface.ts
      - saga.abstract.ts
    /infrastructure/
      - repository.interface.ts
      - event-store.client.ts
      - postgresql.client.ts
      - redis.client.ts

  /app.module.ts
```

#### Module間通信パターン

```typescript
// Event Bus Implementation
@Injectable()
export class DomainEventBus {
  constructor(
    private readonly eventBus: EventBus,
    private readonly eventStore: EventStoreClient
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    // Persist to Event Store
    await this.eventStore.saveEvent(event);

    // Publish for immediate processing
    await this.eventBus.publish(event);
  }

  subscribe<T extends DomainEvent>(
    eventType: new (...args: any[]) => T,
    handler: (event: T) => Promise<void>
  ): void {
    this.eventBus.subscribe(eventType, handler);
  }
}

// Cross-Context Event Handler Example
@EventsHandler(VulnerabilityDetected)
export class VulnerabilityDetectedHandler {
  constructor(
    private readonly taskService: TaskService,
    private readonly policyEngine: PolicyEngine
  ) {}

  async handle(event: VulnerabilityDetected): Promise<void> {
    // Check if urgent task creation is required
    if (event.cvssScore >= 9.0) {
      const createTaskCommand = new CreateUrgentTaskCommand({
        vulnerabilityId: event.vulnerabilityId,
        systemIds: event.affectedSystems,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        priority: TaskPriority.CRITICAL
      });

      await this.taskService.createTask(createTaskCommand);
    }
  }
}
```

---

## 3. Data Consistency Strategy

### 3.1 強整合性境界 (Strong Consistency)

#### ACID Transactions Required

**Aggregate内の強整合性**:

```typescript
// System Aggregate内でのトランザクション境界
class SystemRepository {
  async save(system: System): Promise<void> {
    return this.database.transaction(async (trx) => {
      // System基本情報
      await trx('systems').insert(system.getSystemData());

      // パッケージ情報（同時更新必須）
      await trx('packages').insert(system.getPackages());

      // ホスト設定（同時更新必須）
      await trx('host_configurations').insert(system.getHostConfiguration());

      // ドメインイベント保存
      await trx('domain_events').insert(system.getUncommittedEvents());
    });
  }
}
```

**強整合性が必要なデータ**:

- System Aggregate: システム情報+パッケージ+ホスト設定
- Vulnerability Aggregate: 脆弱性情報+リスク評価+影響システム
- Task Aggregate: タスク状態+割当+進捗履歴

### 3.2 結果整合性境界 (Eventual Consistency)

#### Cross-Context Event Integration

```typescript
// Saga Orchestration for Cross-Context Consistency
@Injectable()
export class VulnerabilityResponseSaga {
  constructor(
    private readonly systemService: SystemService,
    private readonly vulnerabilityService: VulnerabilityService,
    private readonly taskService: TaskService,
    private readonly notificationService: NotificationService
  ) {}

  @SagaOrchestrationHandler(VulnerabilityDetected)
  async handleVulnerabilityDetected(event: VulnerabilityDetected): Promise<void> {
    const saga = new SagaTransaction('vulnerability-response', event.vulnerabilityId);

    try {
      // Step 1: Risk Assessment
      const riskAssessment = await this.vulnerabilityService.assessRisk(
        event.vulnerabilityId
      );
      saga.addCompensation(() =>
        this.vulnerabilityService.revertRiskAssessment(riskAssessment.id)
      );

      // Step 2: Create Task (if high severity)
      if (riskAssessment.requiresUrgentResponse()) {
        const task = await this.taskService.createUrgentTask({
          vulnerabilityId: event.vulnerabilityId,
          systemIds: event.affectedSystems,
          dueDate: riskAssessment.calculateDueDate()
        });
        saga.addCompensation(() =>
          this.taskService.cancelTask(task.id)
        );

        // Step 3: Send Notifications
        await this.notificationService.sendUrgentAlert({
          recipients: this.getSecurityTeam(),
          vulnerability: event.vulnerabilityId,
          task: task.id
        });
        saga.addCompensation(() =>
          this.notificationService.sendCancellationAlert(task.id)
        );
      }

      await saga.complete();

    } catch (error) {
      await saga.compensate();
      throw error;
    }
  }
}
```

**結果整合性で十分なデータ**:

- Context間のイベント連携（数秒～数分の遅延許容）
- 外部API同期データ（数時間の遅延許容）
- レポーティング用データ（日次更新で十分）

### 3.3 整合性チェック・修復機能

```typescript
@Injectable()
export class DataConsistencyService {
  // 定期整合性チェック（日次実行）
  @Cron('0 2 * * *') // 毎日02:00実行
  async performConsistencyCheck(): Promise<void> {
    const inconsistencies = await this.detectInconsistencies();

    for (const inconsistency of inconsistencies) {
      if (inconsistency.isAutoRepairable()) {
        await this.autoRepair(inconsistency);
        await this.logRepair(inconsistency);
      } else {
        await this.escalateToOperator(inconsistency);
      }
    }
  }

  private async detectInconsistencies(): Promise<DataInconsistency[]> {
    return [
      ...await this.checkSystemPackageConsistency(),
      ...await this.checkVulnerabilityReferenceConsistency(),
      ...await this.checkTaskSystemReferenceConsistency()
    ];
  }

  private async autoRepair(inconsistency: DataInconsistency): Promise<void> {
    switch (inconsistency.type) {
      case 'system_package_mismatch':
        await this.repairSystemPackageMismatch(inconsistency);
        break;
      case 'vulnerability_reference_invalid':
        await this.repairVulnerabilityReference(inconsistency);
        break;
      case 'task_system_reference_missing':
        await this.repairTaskSystemReference(inconsistency);
        break;
    }
  }
}
```

---

## 4. Integration Pattern Design

### 4.1 Event Integration Architecture

#### Event Bus Configuration

```typescript
@Module({
  imports: [
    CqrsModule,
    EventStoreModule.forRoot({
      connectionString: process.env.EVENTSTORE_CONNECTION_STRING,
      settings: {
        defaultUserCredentials: {
          username: 'admin',
          password: process.env.EVENTSTORE_PASSWORD
        }
      }
    })
  ],
  providers: [
    DomainEventBus,
    EventStoreProjectionService,
    // Event Handlers
    SystemRegisteredHandler,
    VulnerabilityDetectedHandler,
    TaskCreatedHandler,
    DependencyMappedHandler
  ],
  exports: [DomainEventBus]
})
export class EventIntegrationModule {}
```

#### Event Serialization & Versioning

```typescript
@Injectable()
export class EventSerializer {
  private readonly eventTypeMap = new Map<string, new (...args: any[]) => DomainEvent>();

  serialize(event: DomainEvent): string {
    return JSON.stringify({
      eventType: event.constructor.name,
      eventVersion: event.version,
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      timestamp: event.timestamp,
      data: event.getData()
    });
  }

  deserialize(eventData: string): DomainEvent {
    const parsed = JSON.parse(eventData);
    const EventClass = this.eventTypeMap.get(parsed.eventType);

    if (!EventClass) {
      throw new Error(`Unknown event type: ${parsed.eventType}`);
    }

    return new EventClass(parsed.data, {
      eventId: parsed.eventId,
      aggregateId: parsed.aggregateId,
      timestamp: parsed.timestamp,
      version: parsed.eventVersion
    });
  }
}
```

### 4.2 Circuit Breaker & Fallback Strategy

```typescript
@Injectable()
export class ExternalAPIGateway {
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();

  constructor() {
    // GitHub API Circuit Breaker
    this.circuitBreakers.set('github', new CircuitBreaker({
      timeout: 5000,
      errorThresholdPercentage: 50,
      requestVolumeThreshold: 10,
      sleepWindowInMilliseconds: 300000 // 5 minutes
    }));

    // NVD API Circuit Breaker
    this.circuitBreakers.set('nvd', new CircuitBreaker({
      timeout: 10000,
      errorThresholdPercentage: 30,
      requestVolumeThreshold: 5,
      sleepWindowInMilliseconds: 600000 // 10 minutes
    }));
  }

  async callGitHubAPI<T>(operation: () => Promise<T>): Promise<T> {
    const circuitBreaker = this.circuitBreakers.get('github')!;

    try {
      return await circuitBreaker.execute(operation);
    } catch (error) {
      if (circuitBreaker.isOpen()) {
        // フォールバック: キャッシュデータ使用
        return this.getCachedGitHubData<T>();
      }
      throw error;
    }
  }

  async callNVDAPI<T>(operation: () => Promise<T>): Promise<T> {
    const circuitBreaker = this.circuitBreakers.get('nvd')!;

    try {
      return await circuitBreaker.execute(operation);
    } catch (error) {
      if (circuitBreaker.isOpen()) {
        // フォールバック: 代替データソース
        return this.getAlternativeVulnerabilityData<T>();
      }
      throw error;
    }
  }

  private async getCachedGitHubData<T>(): Promise<T> {
    // キャッシュからデータ取得（最大12時間前）
    const cachedData = await this.cacheService.get('github_data');
    if (cachedData && cachedData.timestamp > Date.now() - 12 * 60 * 60 * 1000) {
      return cachedData.data;
    }
    throw new Error('No recent cached data available');
  }

  private async getAlternativeVulnerabilityData<T>(): Promise<T> {
    // 代替データソース（MITRE、CERT等）からデータ取得
    const alternatives = ['mitre', 'cert', 'vendor_advisories'];

    for (const source of alternatives) {
      try {
        return await this.alternativeDataSources[source].getData<T>();
      } catch (error) {
        continue; // 次の代替ソースを試行
      }
    }

    throw new Error('All alternative data sources failed');
  }
}
```

---

## 5. 最終統合PlantUML

```plantuml
@startuml SystemBoardCompleteArchitecture
!theme plain
title "System Board Complete Domain Architecture"

package "System Management Context" as SMC #LightBlue {
  class "System" as SysAgg <<Aggregate Root>> {
    - SystemId: string
    - Name: string
    - Type: SystemType
    - Status: SystemStatus
    - Host: HostConfiguration
    - Packages: Package[]
    - SecurityClassification: SecurityClassification
    --
    + RegisterSystem(): SystemRegistered
    + UpdateConfiguration(): SystemConfigurationUpdated
    + InstallPackage(): PackageInstalled
    + ScaleHostResources(): HostResourcesScaled
    + Decommission(): SystemDecommissioned
    --
    Invariants:
    - Active system must have ≥1 package
    - System name must be unique
    - Security classification consistency
  }

  class "Package" as Pkg <<Entity>> {
    - PackageId: string
    - Name: string
    - Version: string
    - EOLDate: Date
    - VulnerabilityRefs: VulnerabilityRef[]
    - Dependencies: PackageRef[]
  }

  SysAgg *-- Pkg
}

package "Vulnerability Management Context" as VMC #LightGreen {
  class "Vulnerability" as VulnAgg <<Aggregate Root>> {
    - VulnerabilityId: CVE_ID
    - CVSS: number
    - Severity: VulnerabilitySeverity
    - Status: VulnerabilityStatus
    - AffectedPackages: PackageRef[]
    - RiskAssessments: RiskAssessment[]
    --
    + DetectVulnerability(): VulnerabilityDetected
    + AssessRisk(): RiskAssessmentCompleted
    + CreateMitigation(): MitigationPlanCreated
    + ApplySecurityPatch(): SecurityPatchApplied
    + ResolveVulnerability(): VulnerabilityResolved
    --
    Invariants:
    - CVSS score must be 0.0-10.0
    - CVSS ≥9.0 must create urgent task
    - Resolved vulnerabilities cannot reopen
  }

  class "RiskAssessment" as RiskAss <<Entity>> {
    - AssessmentId: string
    - VulnerabilityRef: VulnerabilityRef
    - AffectedSystems: SystemRef[]
    - RiskLevel: RiskLevel
    - BusinessImpact: BusinessImpact
    - MitigationPlan: string
    - AssessedBy: UserId
    - ApprovedBy: UserId
  }

  VulnAgg *-- RiskAss
}

package "Task Management Context" as TMC #LightYellow {
  class "Task" as TaskAgg <<Aggregate Root>> {
    - TaskId: string
    - Type: TaskType
    - Priority: TaskPriority
    - Status: TaskStatus
    - SystemRef: SystemId
    - VulnerabilityRef: CVE_ID
    - AssigneeRef: UserId
    - DueDate: Date
    - EscalationHistory: EscalationRecord[]
    --
    + CreateTask(): TaskCreated
    + AssignTask(): TaskAssigned
    + StartWork(): TaskStarted
    + CompleteTask(): TaskCompleted
    + EscalateTask(): TaskEscalated
    --
    Invariants:
    - Valid status transitions only
    - Completed tasks are immutable
    - CVSS≥9.0 creates urgent priority
  }

  class "Workflow" as WorkflowAgg <<Aggregate Root>> {
    - WorkflowId: string
    - Name: WorkflowName
    - Tasks: TaskRef[]
    - Rules: WorkflowRule[]
    - Status: WorkflowStatus
    - OrchestrationLogic: OrchestrationLogic
    --
    + StartWorkflow(): WorkflowStarted
    + HandleTaskCompletion(): WorkflowProgressUpdated
    + CompleteWorkflow(): WorkflowCompleted
  }

  TaskAgg --> WorkflowAgg : orchestrated by
}

package "Relationship Management Context" as RMC #LightPink {
  class "SystemDependency" as DepAgg <<Aggregate Root>> {
    - DependencyId: string
    - SourceSystemRef: SystemId
    - TargetSystemRef: SystemId
    - DependencyType: DependencyType
    - Strength: DependencyStrength
    - ImpactAnalyses: ImpactAnalysis[]
    --
    + MapDependency(): DependencyMapped
    + AnalyzeImpact(): ImpactAnalysisCompleted
    + UpdateDependency(): DependencyUpdated
    --
    Invariants:
    - No circular dependencies
    - Valid dependency strength
  }
}

' Context relationships via Domain Events
SMC -[#blue,dashed]-> VMC : SystemRegistered →\nVulnerabilityScan
VMC -[#green,dashed]-> TMC : VulnerabilityDetected →\nTaskCreation
TMC -[#orange,dashed]-> SMC : TaskCompleted →\nSystemUpdate
SMC -[#red,dashed]-> RMC : SystemUpdate →\nDependencyAnalysis

' External integration points
cloud "External APIs" as ExtAPI #Gray {
  [GitHub API]
  [NVD API]
  [EndOfLife API]
}

rectangle "Anti-Corruption Layers" as ACL #Orange {
  [GitHub ACL]
  [NVD ACL]
  [EOL ACL]
}

ExtAPI --> ACL
ACL --> SMC : system data
ACL --> VMC : vulnerability data

' Shared kernel
package "Shared Kernel" as SK #Pink {
  class "SystemId" as SysId <<Value Object>>
  class "CVE_ID" as CveId <<Value Object>>
  class "UserId" as UId <<Value Object>>
  interface "DomainEvent" as DEvent
  interface "Repository" as Repo <<Infrastructure>>
  abstract "AggregateRoot" as AggRoot
}

' All contexts use shared kernel
SMC --> SK
VMC --> SK
TMC --> SK
RMC --> SK

' Implementation layers (Onion Architecture)
rectangle "Application Services" as AppServices #LightGray {
  [System Service]
  [Vulnerability Service]
  [Task Service]
  [Relationship Service]
  [Command Handlers]
  [Query Handlers]
  [Saga Orchestrators]
}

rectangle "Infrastructure" as Infra #LightGray {
  database "EventStore DB" as ES {
    [Event Streams]
    [Snapshots]
  }

  database "PostgreSQL" as PG {
    [Read Models]
    [Projections]
  }

  database "Redis" as RD {
    [Cache]
    [Sessions]
  }

  [Message Bus]
  [External APIs]
  [Circuit Breakers]
}

AppServices --> SK : uses domain
Infra --> AppServices : supports

' Data consistency levels
rectangle "Strong Consistency (ACID)" as SC #Red {
  note right: Within Aggregate boundaries\nSystem + Packages + Host\nVulnerability + Risk Assessment\nTask + Status + Assignment
}

rectangle "Eventual Consistency" as EC #Blue {
  note right: Cross-Context events\nExternal API sync\nRead Model projections
}

SC --> AppServices : transactional
EC --> AppServices : event-driven

note right of SMC
  System Management Context
  - Authoritative system data
  - Package management
  - Configuration control
  - Integration with external APIs
end note

note right of VMC
  Vulnerability Management Context
  - Risk assessment engine
  - CVE data processing
  - Mitigation planning
  - Core business logic
end note

note right of TMC
  Task Management Context
  - Workflow orchestration
  - Task assignment & tracking
  - Escalation management
  - Process automation
end note

note right of RMC
  Relationship Management Context
  - Dependency mapping
  - Impact analysis
  - System relationships
  - Change propagation
end note

@enduml
```

---

## 6. Phase 4完了条件チェック

### 6.1 品質ゲート確認

- ✅ **データの責任境界が明確である**
  - System Aggregate: システム構成・パッケージ・ホスト管理
  - Vulnerability Aggregate: 脆弱性・リスク評価・影響分析管理
  - Task Aggregate: ワークフロー・タスク実行・エスカレーション管理
  - SystemDependency Aggregate: 依存関係・影響分析管理

- ✅ **Context間の連携方法（イベント・API）が定義されている**
  - ドメインイベント経由の非同期連携設計完了
  - Saga Orchestration による複合処理設計完了
  - Anti-Corruption Layer による外部API統合設計完了

- ✅ **技術的実現可能性（NestJS + オニオンアーキテクチャ）が確認されている**
  - NestJS Module構造設計（Domain/Application/Infrastructure層分離）
  - Context別モジュール分離構造設計完了
  - 依存性注入パターン適用可能性確認済み

- ✅ **将来のマイクロサービス展開可能性が評価されている**
  - 独立データベース可能性確認済み（各Context独立可能）
  - API境界の明確性確認済み（REST/GraphQL/gRPC対応）
  - 運用分離メリット評価済み（個別スケール・デプロイ可能）

- ✅ **Event Sourcing実装で必要なAggregate設計が完了している**
  - Aggregate Root による外部アクセス制御設計
  - ドメインイベント発行責任の明確化
  - Event Stream設計（Aggregate単位）
  - スナップショット戦略検討済み

- ✅ **強整合性 vs 結果整合性の設計方針が明確化されている**
  - Aggregate内: 強整合性（ACID）
  - Context間: 結果整合性（Event Driven）
  - Saga Pattern実装（Orchestration採用）
  - 整合性チェック・修復機能設計済み

### 6.2 技術実装確認

- ✅ **NestJS + TypeScriptでの実装が技術的に可能**
  - Aggregate、Entity、Value Objectのクラス設計完了
  - Command/Query Handler、Repository実装パターン確立
  - Event Sourcing統合、依存性注入パターン適用可能

- ✅ **外部設定でのルール管理が技術的に可能**
  - Circuit Breaker、Retry、Fallback戦略設計完了
  - Anti-Corruption Layer実装パターン確立
  - 外部API障害時の代替データソース戦略設計済み

- ✅ **パフォーマンス影響が許容範囲内**
  - Event処理: 非同期・並行処理設計
  - データ一貫性: 必要最小限のACIDトランザクション
  - 外部API: Circuit Breaker + キャッシュ戦略

- ✅ **製造業セキュリティ要件への適合性確認**
  - データ分類・アクセス制御設計（Phase 2連携）
  - 監査ログ統合（全Aggregate操作記録）
  - 暗号化要件対応（保存時・通信時）

---

## 7. 実装フェーズ引き継ぎ事項

### 7.1 Software Architecture Advisor

- ✅ **NestJS Module構造の詳細実装設計**
  - Context別モジュール実装（4コンテキスト）
  - Domain/Application/Infrastructure層分離実装
  - Shared Kernelモジュール実装

- ✅ **オニオンアーキテクチャ Layer分離実装**
  - 依存関係の方向制御（内側→外側禁止）
  - Domain層の外部依存排除
  - Infrastructure層でのRepository実装

- ✅ **Domain Event Bus実装パターン**
  - NestJS CQRS統合
  - EventStore DB連携
  - 非同期Event Handler実装

### 7.2 Backend System Architect

- ✅ **Aggregate実装クラス設計**
  - TypeScriptクラス実装（4 Aggregate Root）
  - 不変条件検証ロジック実装
  - Domain Method実装

- ✅ **Command/Query Handler実装**
  - CQRS Command Handler実装
  - Query Handler実装（Read Model最適化）
  - バリデーション・エラーハンドリング

- ✅ **Repository Pattern実装（EventStore + PostgreSQL）**
  - Event Sourcing Repository実装
  - Read Model Repository実装
  - データ整合性保証実装

### 7.3 Database Architect Consultant

- ✅ **Event Store DB schema設計**
  - Aggregate別Event Stream設計
  - スナップショット保存戦略
  - Event版数管理・マイグレーション

- ✅ **PostgreSQL Read Model schema設計**
  - Context別スキーマ分離
  - Query最適化（インデックス、パーティション）
  - 非正規化許容設計

- ✅ **パフォーマンス最適化実装**
  - Event再生最適化
  - Read Model更新最適化
  - キャッシュ戦略（Redis）

### 7.4 DevOps Pipeline Optimizer

- ✅ **Context間連携・監視設計**
  - Event配信監視
  - Saga実行監視
  - 外部API連携監視

- ✅ **Circuit Breaker・Fallback実装**
  - 外部API障害対応
  - 代替データソース切替
  - 障害復旧自動化

---

## 8. 継続的改善・運用要件

### 8.1 Event Storming Model更新タイミング

**Sprint Review後の要件変更対応**:

- 新機能追加時のAggregate境界見直し
- ユーザーフィードバックに基づくContext境界調整
- 性能課題発見時のAggregate分割・統合検討

**技術制約変更時の設計見直し**:

- アーキテクチャ変更時のBounded Context境界見直し
- パフォーマンス課題発見時のAggregate再設計
- セキュリティ要件変更時のContext責任見直し

**運用開始後のフィードバック反映**:

- 運用負荷に基づく自動化範囲調整
- 障害パターンに基づく境界設計改善
- ステークホルダー要求変更への柔軟な対応

### 8.2 マイクロサービス移行戦略

**Phase 1: Modular Monolith（現状）**:

- 統合NestJSアプリケーション
- 共有データベース（スキーマ分離）
- 内部Event Bus

**Phase 2: Database Split**:

- Context別データベース分離
- Event-driven データ同期
- API境界明確化

**Phase 3: Service Extraction**:

- 独立サービス展開
- gRPC内部通信
- API Gateway統合

---

**Phase 4完了日**: 2025年9月17日
**主担当**: Software Architecture Advisor
**ファシリテーター**: Requirements Analyst
**参画エージェント**: Backend System Architect, Database Architect Consultant, UX Design Optimizer, DevOps Pipeline Optimizer, Cybersecurity Advisor
**次期更新**: 実装フェーズ開始時のフィードバック反映
**次期Action**: 実装フェーズ準備（NestJS詳細設計、Event Sourcing技術調査、Database設計）
