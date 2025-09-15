# Webhook系コマンド実装仕様書

## 概要

外部システムからのリアルタイム通知を処理するWebhook系コマンドの詳細実装仕様を定義します。Anti-Corruption LayerパターンとEvent Sourcingアーキテクチャに基づいた設計を行います。

## アーキテクチャ原則

### 1. 境界明確化

- **External Boundary**: Webhook受信エンドポイント
- **Anti-Corruption Layer**: 外部データの内部形式変換
- **Domain Boundary**: ドメインロジック実行
- **Integration Boundary**: Event Sourcing統合

### 2. 信頼性保証

- **At-Least-Once Delivery**: 重複処理対応
- **Idempotency**: 同一Webhook複数実行安全性
- **Eventual Consistency**: 非同期処理による結果整合性
- **Circuit Breaker**: 外部システム障害時の保護

---

## 1. GitHub Webhook Commands

### 1.1 GitHubWebhookReceived Command

#### Command Definition

```typescript
interface GitHubWebhookReceivedCommand {
  webhookId: string;               // 重複防止用UUID
  eventType: GitHubEventType;
  repository: GitHubRepository;
  payload: GitHubWebhookPayload;
  headers: WebhookHeaders;
  receivedAt: Date;
  correlationId: string;
}

enum GitHubEventType {
  PUSH = 'push',
  SECURITY_ADVISORY = 'security_advisory',
  DEPENDENCY_GRAPH = 'dependency_graph_diff',
  REPOSITORY = 'repository',
  RELEASE = 'release',
  PACKAGE = 'package'
}

interface GitHubRepository {
  id: number;
  fullName: string;         // "owner/repo"
  private: boolean;
  defaultBranch: string;
  language: string;
  topics: string[];
}

interface WebhookHeaders {
  signature: string;        // HMAC-SHA256
  deliveryId: string;       // GitHub UUID
  event: string;           // GitHub event type
  hookId: number;          // GitHub webhook configuration ID
}
```

#### Command Handler Implementation

```typescript
@CommandHandler(GitHubWebhookReceivedCommand)
export class GitHubWebhookReceivedCommandHandler
  implements ICommandHandler<GitHubWebhookReceivedCommand> {

  constructor(
    private readonly webhookValidator: GitHubWebhookValidator,
    private readonly integrationGateway: IntegrationGateway,
    private readonly eventBus: EventBus,
    private readonly logger: Logger
  ) {}

  async execute(command: GitHubWebhookReceivedCommand): Promise<void> {
    // 1. Webhook署名検証
    await this.webhookValidator.validateSignature(
      command.payload,
      command.headers.signature
    );

    // 2. 重複処理チェック (Idempotency)
    const isProcessed = await this.checkIfAlreadyProcessed(command.webhookId);
    if (isProcessed) {
      this.logger.warn(`Webhook already processed: ${command.webhookId}`);
      return;
    }

    // 3. イベントタイプ別処理分岐
    const domainEvents = await this.processWebhookByType(command);

    // 4. Domain Events発行
    for (const event of domainEvents) {
      await this.eventBus.publish(event);
    }

    // 5. 処理完了記録
    await this.markAsProcessed(command.webhookId);
  }

  private async processWebhookByType(
    command: GitHubWebhookReceivedCommand
  ): Promise<DomainEvent[]> {
    switch (command.eventType) {
      case GitHubEventType.SECURITY_ADVISORY:
        return await this.processSecurityAdvisory(command);

      case GitHubEventType.DEPENDENCY_GRAPH:
        return await this.processDependencyUpdate(command);

      case GitHubEventType.PUSH:
        return await this.processPushEvent(command);

      case GitHubEventType.RELEASE:
        return await this.processReleaseEvent(command);

      default:
        this.logger.info(`Unhandled webhook type: ${command.eventType}`);
        return [];
    }
  }
}
```

#### Security Advisory Processing

```typescript
private async processSecurityAdvisory(
  command: GitHubWebhookReceivedCommand
): Promise<DomainEvent[]> {
  const advisory = this.extractSecurityAdvisory(command.payload);

  // Anti-Corruption Layer: GitHub形式 → 内部形式変換
  const normalizedAdvisory = await this.normalizeSecurityAdvisory(advisory);

  // Business Logic: 影響システム特定
  const affectedSystems = await this.identifyAffectedSystems(normalizedAdvisory);

  const events: DomainEvent[] = [
    new GitHubSecurityAdvisoryReceivedEvent({
      advisoryId: normalizedAdvisory.id,
      severity: normalizedAdvisory.severity,
      affectedPackages: normalizedAdvisory.affectedPackages,
      receivedAt: command.receivedAt,
      correlationId: command.correlationId
    })
  ];

  // 高重要度の場合は即座に脆弱性検出トリガー
  if (normalizedAdvisory.severity === 'CRITICAL' || normalizedAdvisory.severity === 'HIGH') {
    events.push(new VulnerabilityDetectionTriggeredEvent({
      source: 'GITHUB_ADVISORY',
      priority: 'HIGH',
      affectedSystems: affectedSystems.map(s => s.id),
      correlationId: command.correlationId
    }));
  }

  return events;
}
```

### 1.2 ProcessGitHubSecurityAdvisory Command

#### 1.2.1 Command Definition

```typescript
interface ProcessGitHubSecurityAdvisoryCommand {
  advisoryId: string;
  securityAdvisory: NormalizedSecurityAdvisory;
  processingPriority: 'IMMEDIATE' | 'HIGH' | 'NORMAL' | 'LOW';
  correlationId: string;
}

interface NormalizedSecurityAdvisory {
  id: string;
  ghsaId: string;
  cveId?: string;
  severity: VulnerabilitySeverity;
  title: string;
  summary: string;
  description: string;
  publishedAt: Date;
  updatedAt: Date;
  affectedPackages: NormalizedAffectedPackage[];
  references: SecurityReference[];
  cvssScore?: CVSSScore;
}

interface NormalizedAffectedPackage {
  ecosystem: PackageEcosystem;
  packageName: string;
  vulnerableVersionRange: string;
  patchedVersions: string[];
  firstPatchedVersion?: string;
}

enum PackageEcosystem {
  NPM = 'npm',
  MAVEN = 'maven',
  PIP = 'pip',
  NUGET = 'nuget',
  COMPOSER = 'composer',
  GO = 'go',
  RUBYGEMS = 'rubygems',
  RUST = 'cargo'
}
```

#### 1.2.2 Command Handler Implementation

```typescript
@CommandHandler(ProcessGitHubSecurityAdvisoryCommand)
export class ProcessGitHubSecurityAdvisoryCommandHandler
  implements ICommandHandler<ProcessGitHubSecurityAdvisoryCommand> {

  constructor(
    private readonly vulnerabilityService: VulnerabilityDomainService,
    private readonly systemRepository: SystemRepository,
    private readonly packageRepository: PackageRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: ProcessGitHubSecurityAdvisoryCommand): Promise<void> {
    const { securityAdvisory, correlationId } = command;

    // 1. 既存脆弱性との重複チェック
    const existingVulnerability = await this.checkExistingVulnerability(
      securityAdvisory.cveId,
      securityAdvisory.ghsaId
    );

    if (existingVulnerability) {
      await this.updateExistingVulnerability(existingVulnerability, securityAdvisory);
      return;
    }

    // 2. 影響システム・パッケージの特定
    const impactAnalysis = await this.analyzeImpact(securityAdvisory);

    // 3. 脆弱性レコード作成
    const vulnerability = await this.vulnerabilityService.createFromAdvisory(
      securityAdvisory,
      impactAnalysis
    );

    // 4. Domain Events発行
    const events = this.generateVulnerabilityEvents(
      vulnerability,
      impactAnalysis,
      correlationId
    );

    for (const event of events) {
      await this.eventBus.publish(event);
    }
  }

  private async analyzeImpact(
    advisory: NormalizedSecurityAdvisory
  ): Promise<VulnerabilityImpactAnalysis> {
    const affectedSystems = new Set<SystemId>();
    const affectedPackages = new Map<PackageId, PackageVulnerabilityInfo>();

    for (const affectedPackage of advisory.affectedPackages) {
      // システム内の該当パッケージ検索
      const packages = await this.packageRepository.findByEcosystemAndName(
        affectedPackage.ecosystem,
        affectedPackage.packageName
      );

      for (const pkg of packages) {
        // バージョン範囲マッチング
        const isVulnerable = this.isVersionVulnerable(
          pkg.version,
          affectedPackage.vulnerableVersionRange
        );

        if (isVulnerable) {
          affectedSystems.add(pkg.systemId);
          affectedPackages.set(pkg.id, {
            packageId: pkg.id,
            currentVersion: pkg.version,
            vulnerableRange: affectedPackage.vulnerableVersionRange,
            patchedVersions: affectedPackage.patchedVersions,
            severity: advisory.severity
          });
        }
      }
    }

    return new VulnerabilityImpactAnalysis({
      affectedSystemCount: affectedSystems.size,
      affectedSystems: Array.from(affectedSystems),
      affectedPackages: Array.from(affectedPackages.values()),
      businessImpact: this.calculateBusinessImpact(affectedSystems.size, advisory.severity),
      urgencyLevel: this.calculateUrgencyLevel(advisory.severity, affectedSystems.size)
    });
  }
}
```

---

## 2. NVD Webhook Commands

### 2.1 NVDCVEUpdateReceived Command

#### 2.1.1 Command Definition

```typescript
interface NVDCVEUpdateReceivedCommand {
  updateId: string;
  cveId: string;
  lastModified: Date;
  updateType: NVDUpdateType;
  source: NVDSource;
  changeInfo: CVEChangeInfo;
  correlationId: string;
}

enum NVDUpdateType {
  NEW = 'NEW',           // 新規CVE
  MODIFIED = 'MODIFIED', // 既存CVE更新
  REJECTED = 'REJECTED', // CVE却下
  RESERVED = 'RESERVED'  // CVE予約
}

enum NVDSource {
  NVD_WEBHOOK = 'NVD_WEBHOOK',
  NVD_FEED = 'NVD_FEED',
  MANUAL_SYNC = 'MANUAL_SYNC'
}

interface CVEChangeInfo {
  changedFields: string[];        // ['cvssV3', 'references', 'description']
  previousValues?: Record<string, any>;
  currentValues: Record<string, any>;
  changeReason?: string;
}
```

#### 2.1.2 Command Handler Implementation

```typescript
@CommandHandler(NVDCVEUpdateReceivedCommand)
export class NVDCVEUpdateReceivedCommandHandler
  implements ICommandHandler<NVDCVEUpdateReceivedCommand> {

  constructor(
    private readonly nvdApiService: NVDAPIService,
    private readonly vulnerabilityRepository: VulnerabilityRepository,
    private readonly impactAnalyzer: VulnerabilityImpactAnalyzer,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: NVDCVEUpdateReceivedCommand): Promise<void> {
    // 1. CVE詳細情報取得
    const cveDetails = await this.nvdApiService.fetchCVEDetails(command.cveId);

    // 2. 更新タイプ別処理
    const events = await this.processUpdateByType(command, cveDetails);

    // 3. Impact Analysis (重要度変更の場合)
    if (this.isSeverityChanged(command.changeInfo)) {
      const impactEvents = await this.analyzeImpactChange(command.cveId, cveDetails);
      events.push(...impactEvents);
    }

    // 4. Events発行
    for (const event of events) {
      await this.eventBus.publish(event);
    }
  }

  private async processUpdateByType(
    command: NVDCVEUpdateReceivedCommand,
    cveDetails: CVEDetails
  ): Promise<DomainEvent[]> {
    switch (command.updateType) {
      case NVDUpdateType.NEW:
        return await this.processNewCVE(command, cveDetails);

      case NVDUpdateType.MODIFIED:
        return await this.processModifiedCVE(command, cveDetails);

      case NVDUpdateType.REJECTED:
        return await this.processRejectedCVE(command);

      default:
        return [];
    }
  }

  private async processNewCVE(
    command: NVDCVEUpdateReceivedCommand,
    cveDetails: CVEDetails
  ): Promise<DomainEvent[]> {
    // 新規CVEの処理
    const events: DomainEvent[] = [
      new NVDCVEReceivedEvent({
        cveId: command.cveId,
        cvssScore: cveDetails.cvssV3?.baseScore,
        severity: this.mapNVDSeverity(cveDetails.cvssV3?.baseSeverity),
        publishedDate: cveDetails.publishedDate,
        lastModified: command.lastModified,
        correlationId: command.correlationId
      })
    ];

    // 高重要度の場合は即座に脆弱性検出トリガー
    if (cveDetails.cvssV3?.baseScore >= 9.0) {
      events.push(new VulnerabilityDetectionTriggeredEvent({
        source: 'NVD_CVE',
        cveId: command.cveId,
        priority: 'CRITICAL',
        correlationId: command.correlationId
      }));
    }

    return events;
  }

  private async processModifiedCVE(
    command: NVDCVEUpdateReceivedCommand,
    cveDetails: CVEDetails
  ): Promise<DomainEvent[]> {
    const events: DomainEvent[] = [
      new NVDCVEUpdatedEvent({
        cveId: command.cveId,
        changedFields: command.changeInfo.changedFields,
        previousValues: command.changeInfo.previousValues,
        currentValues: command.changeInfo.currentValues,
        lastModified: command.lastModified,
        correlationId: command.correlationId
      })
    ];

    // CVSS スコア変更の場合
    if (command.changeInfo.changedFields.includes('cvssV3')) {
      events.push(new CVSSScoreUpdatedEvent({
        cveId: command.cveId,
        previousScore: command.changeInfo.previousValues?.cvssV3?.baseScore,
        currentScore: cveDetails.cvssV3?.baseScore,
        correlationId: command.correlationId
      }));
    }

    return events;
  }
}
```

---

## 3. Webhook Infrastructure Implementation

### 3.1 Webhook Validation Service

```typescript
@Injectable()
export class GitHubWebhookValidator {
  constructor(
    @Inject('GITHUB_WEBHOOK_SECRET') private readonly webhookSecret: string,
    private readonly logger: Logger
  ) {}

  async validateSignature(payload: any, signature: string): Promise<void> {
    const expectedSignature = this.calculateSignature(payload);

    if (!this.secureCompare(signature, expectedSignature)) {
      throw new WebhookValidationError('Invalid webhook signature');
    }
  }

  private calculateSignature(payload: any): string {
    const payloadStr = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(payloadStr, 'utf8');
    return `sha256=${hmac.digest('hex')}`;
  }

  private secureCompare(signature1: string, signature2: string): boolean {
    if (signature1.length !== signature2.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature1),
      Buffer.from(signature2)
    );
  }
}
```

### 3.2 Idempotency Service

```typescript
@Injectable()
export class WebhookIdempotencyService {
  constructor(
    private readonly redisClient: Redis,
    private readonly logger: Logger
  ) {}

  async checkIfProcessed(webhookId: string): Promise<boolean> {
    const key = `webhook:processed:${webhookId}`;
    const result = await this.redisClient.get(key);
    return result !== null;
  }

  async markAsProcessed(webhookId: string, ttl: number = 86400): Promise<void> {
    const key = `webhook:processed:${webhookId}`;
    await this.redisClient.setex(key, ttl, new Date().toISOString());
  }

  async getProcessingLock(webhookId: string, ttl: number = 300): Promise<boolean> {
    const key = `webhook:lock:${webhookId}`;
    const result = await this.redisClient.set(key, '1', 'PX', ttl * 1000, 'NX');
    return result === 'OK';
  }

  async releaseLock(webhookId: string): Promise<void> {
    const key = `webhook:lock:${webhookId}`;
    await this.redisClient.del(key);
  }
}
```

### 3.3 Webhook Controller

```typescript
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly idempotencyService: WebhookIdempotencyService,
    private readonly logger: Logger
  ) {}

  @Post('github')
  async handleGitHubWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>
  ): Promise<{ status: string; message: string }> {
    const webhookId = this.generateWebhookId(headers, payload);

    try {
      // 分散ロック取得
      const lockAcquired = await this.idempotencyService.getProcessingLock(webhookId);
      if (!lockAcquired) {
        return { status: 'accepted', message: 'Already processing' };
      }

      // コマンド作成・実行
      const command = new GitHubWebhookReceivedCommand({
        webhookId,
        eventType: headers['x-github-event'] as GitHubEventType,
        repository: this.extractRepository(payload),
        payload,
        headers: {
          signature: headers['x-hub-signature-256'],
          deliveryId: headers['x-github-delivery'],
          event: headers['x-github-event'],
          hookId: parseInt(headers['x-github-hook-id'])
        },
        receivedAt: new Date(),
        correlationId: this.generateCorrelationId()
      });

      await this.commandBus.execute(command);

      return { status: 'success', message: 'Webhook processed' };
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await this.idempotencyService.releaseLock(webhookId);
    }
  }

  @Post('nvd')
  async handleNVDWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>
  ): Promise<{ status: string; message: string }> {
    // Similar implementation for NVD webhooks
    // ...
  }

  private generateWebhookId(headers: Record<string, string>, payload: any): string {
    // GitHub delivery ID をベースにしたユニークID生成
    const deliveryId = headers['x-github-delivery'] || headers['x-nvd-delivery'];
    const contentHash = crypto.createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 8);

    return `${deliveryId}-${contentHash}`;
  }
}
```

---

## 4. Error Handling & Resilience

### 4.1 Webhook Error Handling

```typescript
interface WebhookError {
  webhookId: string;
  errorType: 'VALIDATION' | 'PROCESSING' | 'TIMEOUT' | 'RATE_LIMIT';
  errorMessage: string;
  retryable: boolean;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
}

@Injectable()
export class WebhookErrorHandler {
  constructor(
    private readonly retryQueue: Queue,
    private readonly logger: Logger
  ) {}

  async handleError(
    webhookId: string,
    error: Error,
    command: WebhookCommand
  ): Promise<void> {
    const webhookError = this.classifyError(error);

    if (webhookError.retryable && webhookError.retryCount < webhookError.maxRetries) {
      await this.scheduleRetry(webhookId, command, webhookError);
    } else {
      await this.sendToDeadLetterQueue(webhookId, command, webhookError);
    }
  }

  private classifyError(error: Error): WebhookError {
    if (error instanceof WebhookValidationError) {
      return {
        errorType: 'VALIDATION',
        retryable: false,
        maxRetries: 0
      };
    }

    if (error instanceof TimeoutError) {
      return {
        errorType: 'TIMEOUT',
        retryable: true,
        maxRetries: 3
      };
    }

    // Default to retryable processing error
    return {
      errorType: 'PROCESSING',
      retryable: true,
      maxRetries: 5
    };
  }
}
```

### 4.2 Circuit Breaker for Webhook Processing

```typescript
@Injectable()
export class WebhookCircuitBreaker {
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(private readonly logger: Logger) {}

  async executeWithBreaker<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getOrCreateBreaker(operation);

    if (breaker.state === CircuitBreakerState.OPEN) {
      throw new CircuitBreakerOpenError(`Circuit breaker open for ${operation}`);
    }

    try {
      const result = await fn();
      breaker.recordSuccess();
      return result;
    } catch (error) {
      breaker.recordFailure();
      throw error;
    }
  }

  private getOrCreateBreaker(operation: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operation)) {
      this.circuitBreakers.set(operation, new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000 // 5 minutes
      }));
    }
    return this.circuitBreakers.get(operation)!;
  }
}
```

---

## 5. Monitoring & Observability

### 5.1 Webhook Metrics

```typescript
interface WebhookMetrics {
  webhookType: 'GITHUB' | 'NVD';
  eventType: string;
  processingTime: number;
  success: boolean;
  errorType?: string;
  payloadSize: number;
  timestamp: Date;
}

@Injectable()
export class WebhookMetricsCollector {
  constructor(
    private readonly prometheusRegistry: PrometheusRegistry,
    private readonly logger: Logger
  ) {}

  recordWebhookProcessing(metrics: WebhookMetrics): void {
    // Prometheus metrics
    this.prometheusRegistry
      .getCounter('webhook_requests_total')
      .labels({
        webhook_type: metrics.webhookType,
        event_type: metrics.eventType,
        success: metrics.success.toString()
      })
      .inc();

    this.prometheusRegistry
      .getHistogram('webhook_processing_duration_seconds')
      .labels({
        webhook_type: metrics.webhookType,
        event_type: metrics.eventType
      })
      .observe(metrics.processingTime / 1000);

    // Structured logging
    this.logger.info('Webhook processed', {
      webhookType: metrics.webhookType,
      eventType: metrics.eventType,
      processingTime: metrics.processingTime,
      success: metrics.success,
      payloadSize: metrics.payloadSize
    });
  }
}
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

```typescript
describe('GitHubWebhookReceivedCommandHandler', () => {
  let handler: GitHubWebhookReceivedCommandHandler;
  let mockValidator: jest.Mocked<GitHubWebhookValidator>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    // Setup mocks
  });

  it('should process security advisory webhook', async () => {
    // Given
    const command = createMockSecurityAdvisoryCommand();

    // When
    await handler.execute(command);

    // Then
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'GitHubSecurityAdvisoryReceived'
      })
    );
  });

  it('should handle duplicate webhooks idempotently', async () => {
    // Test idempotency
  });

  it('should trigger vulnerability detection for critical advisories', async () => {
    // Test critical severity handling
  });
});
```

### 6.2 Integration Tests

```typescript
describe('Webhook Integration', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [WebhookModule]
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('should process GitHub webhook end-to-end', async () => {
    const webhookPayload = createMockGitHubPayload();
    const signature = generateValidSignature(webhookPayload);

    const response = await request(app.getHttpServer())
      .post('/webhooks/github')
      .set('X-GitHub-Event', 'security_advisory')
      .set('X-Hub-Signature-256', signature)
      .send(webhookPayload)
      .expect(200);

    expect(response.body.status).toBe('success');
  });
});
```

---

**実装責任者**: Backend Developer + Security Engineer
**レビュー要件**: セキュリティ検証、パフォーマンステスト、障害復旧テスト
**完了予定**: Phase 1 (2週間) - 基本Webhook処理, Phase 2 (1週間) - 高度な障害処理
