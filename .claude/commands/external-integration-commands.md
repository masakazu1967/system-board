---
allowed-tools:
description: 外部システム連携コマンド設計 - Anti-Corruption Layer パターン実装
---

# 外部システム連携コマンド設計

## 概要

System Boardにおける外部システム連携のコマンド設計を、Anti-Corruption Layer パターンとCQRS + Event Sourcingアーキテクチャに基づいて定義します。

## 外部システム連携仕様

### 対象外部システム

1. **GitHub API**: Repository API, Security Advisory API, Webhook
2. **NVD API**: CVE Feed, CVSS Data, Vulnerability Database
3. **EndOfLife.date API**: Product Lifecycle, Support Timeline

### アーキテクチャ制約

- **パターン**: Anti-Corruption Layer + Circuit Breaker
- **データ戦略**: CQRS での外部イベント処理
- **通信方式**: Event-driven architecture での結果整合性
- **境界制御**: Integration Gateway による外部システム依存の影響最小化

---

## 1. Webhook系コマンド（外部からのプッシュ通知）

### 1.1 GitHub Webhook Commands

#### GitHubWebhookReceived

```typescript
interface GitHubWebhookReceivedCommand {
  webhookId: string;
  eventType: 'push' | 'security_advisory' | 'dependency_graph' | 'repository';
  repository: {
    fullName: string;
    private: boolean;
    defaultBranch: string;
  };
  payload: Record<string, any>;
  signature: string;
  deliveryId: string;
  receivedAt: Date;
}
```

**トリガーイベント**:

- `GitHubWebhookEventProcessed`
- `GitHubSecurityAdvisoryReceived`
- `GitHubDependencyUpdateDetected`

#### ProcessGitHubSecurityAdvisory

```typescript
interface ProcessGitHubSecurityAdvisoryCommand {
  advisoryId: string;
  securityAdvisory: {
    ghsaId: string;
    cveId?: string;
    severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    summary: string;
    affectedPackages: Array<{
      ecosystem: string;
      name: string;
      vulnerableVersionRange: string;
      patchedVersions: string[];
    }>;
  };
  correlationId: string;
}
```

**生成イベント**:

- `GitHubSecurityAdvisoryProcessed`
- `VulnerabilityDetectionTriggered`

### 1.2 NVD Update Webhook Commands

#### NVDCVEUpdateReceived

```typescript
interface NVDCVEUpdateReceivedCommand {
  updateId: string;
  cveId: string;
  lastModified: Date;
  updateType: 'NEW' | 'MODIFIED' | 'REJECTED';
  source: 'NVD_WEBHOOK' | 'NVD_FEED';
  correlationId: string;
}
```

**生成イベント**:

- `NVDCVEUpdateProcessed`
- `VulnerabilityDataRefreshTriggered`

---

## 2. Pull系コマンド（定期的な外部データ取得）

### 2.1 GitHub API Pull Commands

#### SynchronizeGitHubRepositoryData

```typescript
interface SynchronizeGitHubRepositoryDataCommand {
  repositoryId: string;
  repositoryFullName: string;
  synchronizationType: 'FULL' | 'INCREMENTAL' | 'DEPENDENCY_ONLY';
  lastSyncTimestamp?: Date;
  rateLimitingStrategy: {
    maxRequestsPerHour: number;
    currentRequestCount: number;
    resetTime: Date;
  };
  correlationId: string;
}
```

**生成イベント**:

- `GitHubRepositoryDataSynchronized`
- `GitHubDependencyInfoSynchronized`
- `GitHubAPIRateLimitApproached`

#### FetchGitHubDependencyGraph

```typescript
interface FetchGitHubDependencyGraphCommand {
  repositoryId: string;
  manifestPath: string;
  ecosystem: 'npm' | 'maven' | 'pip' | 'nuget' | 'composer' | 'go' | 'rubygems';
  includeVulnerabilities: boolean;
  cacheStrategy: {
    useCache: boolean;
    maxCacheAge: number; // minutes
  };
  correlationId: string;
}
```

**生成イベント**:

- `GitHubDependencyGraphFetched`
- `PackageDependencyMappingUpdated`

### 2.2 NVD API Pull Commands

#### SynchronizeNVDCVEDatabase

```typescript
interface SynchronizeNVDCVEDatabaseCommand {
  synchronizationId: string;
  startDate: Date;
  endDate: Date;
  modifiedSince?: Date;
  batchSize: number;
  apiKeyRotationStrategy: {
    currentKeyIndex: number;
    keyExpirationTime: Date;
  };
  correlationId: string;
}
```

**生成イベント**:

- `NVDCVEDatabaseSynchronized`
- `CVEInformationReceived`
- `VulnerabilityDatabaseUpdated`

#### FetchCVEDetails

```typescript
interface FetchCVEDetailsCommand {
  cveId: string;
  includeReferences: boolean;
  includeCPEMatches: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'EXPONENTIAL' | 'LINEAR';
    initialDelay: number;
  };
  correlationId: string;
}
```

**生成イベント**:

- `CVEDetailsFetched`
- `CVSSScoreUpdated`
- `VulnerabilityImpactAssessed`

### 2.3 EndOfLife.date API Pull Commands

#### SynchronizeEOLDatabase

```typescript
interface SynchronizeEOLDatabaseCommand {
  synchronizationId: string;
  products: string[]; // e.g., ['ubuntu', 'nodejs', 'java', 'docker']
  includeExtendedSupport: boolean;
  cacheRefreshStrategy: {
    forceRefresh: boolean;
    maxStaleness: number; // hours
  };
  correlationId: string;
}
```

**生成イベント**:

- `EOLDatabaseSynchronized`
- `EOLDateUpdated`
- `LifecycleStatusChanged`

#### CheckProductEOLStatus

```typescript
interface CheckProductEOLStatusCommand {
  productId: string;
  productName: string;
  productVersion: string;
  checkType: 'IMMEDIATE' | 'SCHEDULED' | 'ON_DEMAND';
  alertThresholds: {
    warningDays: number; // e.g., 90 days before EOL
    criticalDays: number; // e.g., 30 days before EOL
  };
  correlationId: string;
}
```

**生成イベント**:

- `ProductEOLStatusChecked`
- `EOLWarningIssued`
- `EOLCriticalAlertTriggered`

---

## 3. Fallback系コマンド（外部API障害対応）

### 3.1 Circuit Breaker Commands

#### ActivateCircuitBreaker

```typescript
interface ActivateCircuitBreakerCommand {
  circuitBreakerId: string;
  externalService: 'GITHUB_API' | 'NVD_API' | 'EOL_API';
  failureThreshold: number;
  consecutiveFailures: number;
  lastFailureTime: Date;
  estimatedRecoveryTime: Date;
  fallbackStrategy: 'CACHE' | 'MANUAL' | 'DEGRADED_SERVICE';
  correlationId: string;
}
```

**生成イベント**:

- `CircuitBreakerActivated`
- `FallbackModeActivated`
- `ExternalServiceDegraded`

#### TriggerFallbackDataSource

```typescript
interface TriggerFallbackDataSourceCommand {
  fallbackId: string;
  primaryService: 'GITHUB_API' | 'NVD_API' | 'EOL_API';
  fallbackType: 'CACHED_DATA' | 'ALTERNATIVE_API' | 'MANUAL_INPUT';
  dataRequirements: {
    requiredFields: string[];
    maxDataAge: number; // hours
    acceptableQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  correlationId: string;
}
```

**生成イベント**:

- `FallbackDataSourceTriggered`
- `CachedDataActivated`
- `ManualDataEntryRequired`

### 3.2 Error Recovery Commands

#### RecoverFromExternalAPIFailure

```typescript
interface RecoverFromExternalAPIFailureCommand {
  recoveryId: string;
  failedService: 'GITHUB_API' | 'NVD_API' | 'EOL_API';
  failureType: 'TIMEOUT' | 'RATE_LIMIT' | 'AUTHENTICATION' | 'SERVICE_UNAVAILABLE';
  missedOperations: Array<{
    operationType: string;
    originalCommand: Record<string, any>;
    failureTime: Date;
  }>;
  recoveryStrategy: {
    retryImmediately: boolean;
    batchRecovery: boolean;
    prioritizeOperations: boolean;
  };
  correlationId: string;
}
```

**生成イベント**:

- `ExternalAPIRecoveryInitiated`
- `MissedOperationsQueued`
- `DataSynchronizationRestored`

#### CompensateFailedIntegration

```typescript
interface CompensateFailedIntegrationCommand {
  compensationId: string;
  failedIntegration: {
    service: 'GITHUB_API' | 'NVD_API' | 'EOL_API';
    operation: string;
    expectedResult: Record<string, any>;
  };
  compensationStrategy: 'MANUAL_OVERRIDE' | 'DEFAULT_VALUES' | 'SKIP_OPERATION';
  businessImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  correlationId: string;
}
```

**生成イベント**:

- `IntegrationFailureCompensated`
- `ManualInterventionRequired`
- `BusinessProcessContinued`

---

## 4. Integration Gateway コマンド（外部システム境界制御）

### 4.1 API Gateway Commands

#### ConfigureAPIEndpoint

```typescript
interface ConfigureAPIEndpointCommand {
  endpointId: string;
  externalService: 'GITHUB_API' | 'NVD_API' | 'EOL_API';
  configuration: {
    baseUrl: string;
    authentication: {
      type: 'API_KEY' | 'OAUTH' | 'BEARER_TOKEN';
      credentials: Record<string, string>;
      refreshStrategy?: 'AUTOMATIC' | 'MANUAL';
    };
    rateLimiting: {
      requestsPerMinute: number;
      burstLimit: number;
      backoffStrategy: 'EXPONENTIAL' | 'LINEAR';
    };
    timeout: {
      connectionTimeout: number;
      readTimeout: number;
      retryTimeout: number;
    };
  };
  correlationId: string;
}
```

**生成イベント**:

- `APIEndpointConfigured`
- `RateLimitingActivated`
- `AuthenticationConfigured`

#### ValidateAPIConfiguration

```typescript
interface ValidateAPIConfigurationCommand {
  validationId: string;
  endpoints: Array<{
    service: 'GITHUB_API' | 'NVD_API' | 'EOL_API';
    testRequests: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      path: string;
      expectedStatus: number;
    }>;
  }>;
  validationLevel: 'BASIC' | 'COMPREHENSIVE' | 'STRESS_TEST';
  correlationId: string;
}
```

**生成イベント**:

- `APIConfigurationValidated`
- `APIHealthCheckCompleted`
- `ConfigurationErrorDetected`

### 4.2 Data Translation Commands

#### TranslateExternalData

```typescript
interface TranslateExternalDataCommand {
  translationId: string;
  sourceSystem: 'GITHUB_API' | 'NVD_API' | 'EOL_API';
  sourceData: Record<string, any>;
  targetSchema: {
    domainContext: 'SYSTEM' | 'VULNERABILITY' | 'TASK' | 'RELATIONSHIP';
    mappingRules: Array<{
      sourcePath: string;
      targetPath: string;
      transformation?: 'DATE_FORMAT' | 'ENUM_MAPPING' | 'VALUE_CALCULATION';
    }>;
  };
  validationRules: Array<{
    field: string;
    rule: 'REQUIRED' | 'FORMAT' | 'RANGE' | 'ENUM';
    parameters?: Record<string, any>;
  }>;
  correlationId: string;
}
```

**生成イベント**:

- `ExternalDataTranslated`
- `DataValidationCompleted`
- `TranslationErrorDetected`

#### NormalizeVulnerabilityData

```typescript
interface NormalizeVulnerabilityDataCommand {
  normalizationId: string;
  vulnerabilityData: {
    source: 'GITHUB_ADVISORY' | 'NVD_CVE' | 'MANUAL_INPUT';
    rawData: Record<string, any>;
  };
  normalizationRules: {
    severityMapping: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>;
    cvssVersionPreference: '2.0' | '3.0' | '3.1' | '4.0';
    packageEcosystemMapping: Record<string, string>;
  };
  correlationId: string;
}
```

**生成イベント**:

- `VulnerabilityDataNormalized`
- `CVSSScoreStandardized`
- `PackageIdentifierMapped`

### 4.3 Security & Compliance Commands

#### ApplyDataSanitization

```typescript
interface ApplyDataSanitizationCommand {
  sanitizationId: string;
  externalData: Record<string, any>;
  sanitizationRules: {
    removeFields: string[]; // PII, internal URLs, etc.
    maskFields: Array<{
      field: string;
      maskingStrategy: 'PARTIAL' | 'HASH' | 'ENCRYPT';
    }>;
    validateFields: Array<{
      field: string;
      allowedPatterns: string[];
      blockedPatterns: string[];
    }>;
  };
  complianceRequirements: {
    gdpr: boolean;
    iso27001: boolean;
    manufacturingCompliance: boolean;
  };
  correlationId: string;
}
```

**生成イベント**:

- `DataSanitizationCompleted`
- `ComplianceValidationPassed`
- `SensitiveDataMasked`

#### AuditExternalIntegration

```typescript
interface AuditExternalIntegrationCommand {
  auditId: string;
  integration: {
    service: 'GITHUB_API' | 'NVD_API' | 'EOL_API';
    operation: string;
    timestamp: Date;
    dataVolume: number;
    duration: number;
  };
  auditScope: {
    dataAccess: boolean;
    authentication: boolean;
    rateLimit: boolean;
    errorHandling: boolean;
  };
  correlationId: string;
}
```

**生成イベント**:

- `IntegrationAuditCompleted`
- `AuditTrailGenerated`
- `ComplianceViolationDetected`

---

## 5. 実装アーキテクチャ

### 5.1 Anti-Corruption Layer 構造

```typescript
// Domain Layer (Pure)
interface ExternalIntegrationDomain {
  executeCommand(command: ExternalIntegrationCommand): DomainEvent[];
  validateBusinessRules(data: ExternalData): ValidationResult;
}

// Application Layer (NestJS)
@Injectable()
export class ExternalIntegrationCommandHandler {
  constructor(
    private readonly integrationGateway: IntegrationGateway,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly eventBus: EventBus
  ) {}

  async handle(command: ExternalIntegrationCommand): Promise<void> {
    // Circuit breaker check
    // Command validation
    // Domain execution
    // Event publishing
  }
}

// Infrastructure Layer
@Injectable()
export class IntegrationGateway {
  async callExternalAPI(service: ExternalService, request: APIRequest): Promise<APIResponse> {
    // Rate limiting
    // Authentication
    // Circuit breaker
    // Error handling
    // Response translation
  }
}
```

### 5.2 Event Sourcing Integration

```typescript
// 外部システム連携専用のイベントストリーム
interface IntegrationEventStream {
  streamId: `integration-${externalService}-${correlationId}`;
  events: IntegrationEvent[];
  metadata: {
    externalService: ExternalService;
    apiVersion: string;
    rateLimitStatus: RateLimitStatus;
    circuitBreakerState: CircuitBreakerState;
  };
}
```

### 5.3 Circuit Breaker Implementation

```typescript
interface CircuitBreakerConfiguration {
  service: ExternalService;
  failureThreshold: number;
  recoveryTimeout: number;
  fallbackStrategy: FallbackStrategy;
  healthCheckInterval: number;
}

enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, block requests
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}
```

---

## 6. セキュリティ実装仕様

### 6.1 データ保護

- **暗号化**: 外部API通信はTLS1.3必須
- **認証情報管理**: 環境変数 + HashiCorp Vault (production)
- **ログマスキング**: APIキー、トークン自動除外

### 6.2 監査・コンプライアンス

- **全API呼び出し記録**: リクエスト/レスポンス/実行時間
- **データリネージ**: 外部データの追跡可能性確保
- **エラー追跡**: 障害時の完全復旧可能性

### 6.3 レート制限・可用性

- **API制限準拠**: GitHub (5000/h), NVD (2000/30min), EOL (unlimited)
- **プライオリティキュー**: 緊急度別API呼び出し優先順位
- **フォールバック**: キャッシュ → 手動入力 → 機能停止

---

## 7. 実装優先順位

### Phase 1: 基本連携 (Week 1-2)

1. **GitHub Repository Sync**: システム登録時の依存関係取得
2. **NVD CVE Basic Fetch**: 脆弱性基本情報取得
3. **Basic Circuit Breaker**: 単純な障害検知・フォールバック

### Phase 2: 高度連携 (Week 3-4)

1. **GitHub Webhook**: リアルタイム更新通知
2. **NVD Incremental Sync**: 差分同期最適化
3. **EOL Status Monitoring**: 定期的なライフサイクル確認

### Phase 3: 運用最適化 (Week 5-6)

1. **Advanced Circuit Breaker**: 自動復旧・負荷分散
2. **Data Translation Pipeline**: 高度なデータ正規化
3. **Comprehensive Audit**: 完全なコンプライアンス対応

---

**設計責任者**: Software Architect
**実装予定期間**: 6週間 (Phase 1: MVP, Phase 2-3: Production Ready)
**レビュー必須事項**: セキュリティ、Performance、製造業コンプライアンス要件
