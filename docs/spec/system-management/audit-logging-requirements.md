# 監査ログ要件と実装方針

**担当**: セキュリティエンジニア
**作成日**: 2025-09-21
**Issue**: #34 (US-SM-001: システム新規登録)
**関連仕様**: System集約設計仕様書 (US-SM-001.md)
**アーキテクチャパターン**: オニオンアーキテクチャ + DDD + CQRS + イベントソーシング

## 1. 監査ログフレームワーク概要

### 1.1 設計原則

**製造業監査要件**:

- **完全性保証**: 全ての重要な操作を記録し、改ざん不可能な形で保存
- **否認防止**: デジタル署名とタイムスタンプによる操作の証明
- **ISO 27001準拠**: 情報セキュリティ管理システム監査要件に対応
- **SOX法準拠**: 内部統制報告書作成に必要な監査証跡確保
- **長期保存**: 製造業法規制に基づく7年間の保存義務対応

### 1.2 監査対象分類

```typescript
export enum AuditCategory {
  // システム管理操作
  SYSTEM_LIFECYCLE = 'SYSTEM_LIFECYCLE',          // システム登録・変更・削除
  CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE',  // 設定変更
  PACKAGE_MANAGEMENT = 'PACKAGE_MANAGEMENT',      // パッケージ管理

  // セキュリティ操作
  AUTHENTICATION = 'AUTHENTICATION',              // 認証
  AUTHORIZATION = 'AUTHORIZATION',                // 認可
  ACCESS_CONTROL = 'ACCESS_CONTROL',              // アクセス制御
  PII_HANDLING = 'PII_HANDLING',                  // 個人情報取扱

  // データ操作
  DATA_ACCESS = 'DATA_ACCESS',                    // データアクセス
  DATA_MODIFICATION = 'DATA_MODIFICATION',        // データ変更
  DATA_EXPORT = 'DATA_EXPORT',                    // データエクスポート
  DATA_DELETION = 'DATA_DELETION',                // データ削除

  // 管理操作
  USER_MANAGEMENT = 'USER_MANAGEMENT',            // ユーザー管理
  ROLE_MANAGEMENT = 'ROLE_MANAGEMENT',            // ロール管理
  POLICY_CHANGE = 'POLICY_CHANGE',                // ポリシー変更
  COMPLIANCE_AUDIT = 'COMPLIANCE_AUDIT'           // コンプライアンス監査
}

export enum AuditSeverity {
  INFORMATIONAL = 'INFORMATIONAL',  // 情報記録
  NOTICE = 'NOTICE',               // 通知
  WARNING = 'WARNING',             // 警告
  ERROR = 'ERROR',                 // エラー
  CRITICAL = 'CRITICAL'            // 重大
}
```

## 2. 監査ログデータモデル

### 2.1 基本監査ログ構造

```typescript
export interface AuditEvent {
  // 基本識別情報
  eventId: string;                    // 一意のイベントID (UUID)
  correlationId: string;              // 関連操作のトレース用ID
  timestamp: Date;                    // 正確なタイムスタンプ (RFC3339)

  // 操作分類
  category: AuditCategory;            // 監査カテゴリ
  action: string;                     // 具体的なアクション
  severity: AuditSeverity;            // 重要度

  // 主体・対象
  actor: AuditActor;                  // 操作実行者
  target: AuditTarget;                // 操作対象

  // 操作詳細
  operation: AuditOperation;          // 操作内容
  result: AuditResult;                // 操作結果

  // コンテキスト情報
  context: AuditContext;              // 実行コンテキスト

  // セキュリティ・完全性
  integrity: AuditIntegrity;          // 完全性保証情報
}

export interface AuditActor {
  userId: string;                     // ユーザーID
  userName: string;                   // ユーザー名（PII考慮）
  role: UserRole;                     // ユーザーロール
  sessionId: string;                  // セッションID（ハッシュ化）
  authenticationMethod: string;       // 認証方法
}

export interface AuditTarget {
  resourceType: string;               // リソース種別
  resourceId: string;                 // リソースID
  resourceName?: string;              // リソース名（PII考慮）
  securityClassification?: SecurityClassification; // セキュリティ分類
  previousState?: any;                // 変更前状態（PII除去済み）
  newState?: any;                     // 変更後状態（PII除去済み）
}

export interface AuditOperation {
  command: string;                    // 実行コマンド
  parameters: Record<string, any>;    // パラメータ（PII除去済み）
  businessJustification?: string;     // 業務上の根拠
  approvalWorkflow?: ApprovalInfo;    // 承認ワークフロー情報
}

export interface AuditResult {
  status: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  responseCode?: string;              // レスポンスコード
  errorMessage?: string;              // エラーメッセージ（サニタイズ済み）
  affectedRecords?: number;           // 影響レコード数
  businessImpact?: string;            // ビジネス影響
}

export interface AuditContext {
  applicationName: string;            // アプリケーション名
  version: string;                    // バージョン
  environment: string;                // 環境（本番、テスト等）
  clientInfo: ClientInfo;             // クライアント情報
  networkInfo: NetworkInfo;           // ネットワーク情報
  systemContext: SystemContext;       // システムコンテキスト
}

export interface AuditIntegrity {
  hash: string;                       // イベントのハッシュ値
  previousHash?: string;              // 前のイベントのハッシュ（チェーン）
  digitalSignature: string;           // デジタル署名
  signingKey: string;                 // 署名キーID
  timestampAuthority?: string;        // タイムスタンプ局
}
```

### 2.2 System Management固有の監査要素

```typescript
export interface SystemManagementAuditEvent extends AuditEvent {
  systemContext: {
    systemId?: string;                // 対象システムID
    systemName?: string;              // システム名
    systemType?: SystemType;          // システム種別
    securityClassification?: SecurityClassification;
    criticality?: CriticalityLevel;
    hostConfiguration?: {
      cpu: number;
      memory: number;
      storage: number;
      encryptionEnabled: boolean;
    };
  };

  packageContext?: {
    packageId: string;                // パッケージID
    packageName: string;              // パッケージ名
    version: string;                  // バージョン
    vulnerabilities?: VulnerabilityInfo[];
  };

  securityContext: {
    accessPattern: AccessPattern;     // アクセスパターン
    riskIndicators: string[];         // リスク指標
    complianceFlags: ComplianceFlag[]; // コンプライアンスフラグ
  };
}
```

## 3. 監査ログサービス実装

### 3.1 中核監査サービス

```typescript
@Injectable()
export class SecurityAuditLogger {
  constructor(
    private readonly auditRepository: AuditEventRepository,
    private readonly integrityService: AuditIntegrityService,
    private readonly piiMaskingService: PIIMaskingService,
    private readonly encryptionService: EncryptionService,
    private readonly timestampService: TimestampService
  ) {}

  /**
   * システム管理操作の監査ログ記録
   */
  async logSystemManagementOperation(
    operation: SystemManagementOperation
  ): Promise<void> {
    const auditEvent = await this.createSystemManagementAuditEvent(operation);

    // PII マスキング
    const maskedEvent = await this.maskPIIInAuditEvent(auditEvent);

    // 完全性保証
    const securedEvent = await this.secureAuditEvent(maskedEvent);

    // 永続化
    await this.persistAuditEvent(securedEvent);

    // リアルタイム分析（重要操作の場合）
    if (this.isHighRiskOperation(operation)) {
      await this.triggerRealTimeAnalysis(securedEvent);
    }
  }

  /**
   * 認証・認可操作の監査ログ記録
   */
  async logAuthorizationEvent(
    authEvent: AuthorizationEvent
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      eventId: crypto.randomUUID(),
      correlationId: authEvent.correlationId || crypto.randomUUID(),
      timestamp: new Date(),
      category: AuditCategory.AUTHORIZATION,
      action: authEvent.action,
      severity: this.calculateSeverity(authEvent),

      actor: {
        userId: authEvent.userId,
        userName: await this.maskUserName(authEvent.userName),
        role: authEvent.userRole,
        sessionId: this.hashSessionId(authEvent.sessionId),
        authenticationMethod: authEvent.authMethod
      },

      target: {
        resourceType: authEvent.resourceType,
        resourceId: authEvent.resourceId,
        securityClassification: authEvent.securityClassification
      },

      operation: {
        command: authEvent.command,
        parameters: await this.maskPIIInParameters(authEvent.parameters),
        businessJustification: authEvent.justification
      },

      result: {
        status: authEvent.success ? 'SUCCESS' : 'FAILURE',
        errorMessage: authEvent.errorMessage ?
          await this.sanitizeErrorMessage(authEvent.errorMessage) : undefined
      },

      context: await this.collectAuditContext(authEvent),
      integrity: null as any // 後で設定
    };

    const securedEvent = await this.secureAuditEvent(auditEvent);
    await this.persistAuditEvent(securedEvent);
  }

  /**
   * PII操作の監査ログ記録
   */
  async logPIIHandling(
    piiEvent: PIIHandlingEvent
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      eventId: crypto.randomUUID(),
      correlationId: piiEvent.correlationId,
      timestamp: new Date(),
      category: AuditCategory.PII_HANDLING,
      action: piiEvent.operation,
      severity: AuditSeverity.WARNING, // PII操作は常に警告レベル

      actor: await this.createAuditActor(piiEvent.userContext),

      target: {
        resourceType: 'PII_DATA',
        resourceId: this.hashPIIReference(piiEvent.dataReference),
        securityClassification: SecurityClassification.CONFIDENTIAL
      },

      operation: {
        command: piiEvent.operation,
        parameters: {
          piiTypes: piiEvent.detectedPIITypes,
          maskingStrategies: piiEvent.appliedMaskingStrategies,
          processingPurpose: piiEvent.processingPurpose
        }
      },

      result: {
        status: piiEvent.success ? 'SUCCESS' : 'FAILURE',
        businessImpact: piiEvent.businessImpact
      },

      context: await this.collectAuditContext(piiEvent),
      integrity: null as any
    };

    const securedEvent = await this.secureAuditEvent(auditEvent);
    await this.persistAuditEvent(securedEvent);

    // PII操作は即座にコンプライアンス監査対象
    await this.triggerComplianceReview(securedEvent);
  }

  private async secureAuditEvent(event: AuditEvent): Promise<AuditEvent> {
    // 1. 前のイベントのハッシュ取得（チェーン構築）
    const previousHash = await this.getPreviousEventHash();

    // 2. 現在のイベントのハッシュ計算
    const eventHash = await this.calculateEventHash(event);

    // 3. デジタル署名生成
    const signature = await this.integrityService.signEvent(event, eventHash);

    // 4. タイムスタンプ取得
    const timestamp = await this.timestampService.getAuthenticatedTimestamp();

    event.integrity = {
      hash: eventHash,
      previousHash,
      digitalSignature: signature,
      signingKey: await this.integrityService.getCurrentSigningKeyId(),
      timestampAuthority: timestamp.authority
    };

    return event;
  }
}
```

### 3.2 監査イベント完全性保証

```typescript
@Injectable()
export class AuditIntegrityService {
  constructor(
    private readonly cryptoService: CryptographicService,
    private readonly keyManagement: KeyManagementService,
    private readonly hsmService: HardwareSecurityModuleService
  ) {}

  /**
   * 監査イベントのデジタル署名生成
   */
  async signEvent(event: AuditEvent, eventHash: string): Promise<string> {
    const signingKey = await this.keyManagement.getAuditSigningKey();

    const signaturePayload = {
      eventId: event.eventId,
      timestamp: event.timestamp.toISOString(),
      hash: eventHash,
      category: event.category,
      actor: event.actor.userId
    };

    const signature = await this.hsmService.sign(
      JSON.stringify(signaturePayload),
      signingKey.keyId
    );

    return signature;
  }

  /**
   * 監査ログチェーンの検証
   */
  async verifyAuditChain(
    startDate: Date,
    endDate: Date
  ): Promise<AuditChainVerificationResult> {
    const events = await this.auditRepository.getEventsByTimeRange(startDate, endDate);

    const verificationResults: EventVerificationResult[] = [];
    let chainValid = true;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const previousEvent = i > 0 ? events[i - 1] : null;

      const eventResult = await this.verifyEvent(event, previousEvent);
      verificationResults.push(eventResult);

      if (!eventResult.valid) {
        chainValid = false;
      }
    }

    return {
      chainValid,
      totalEvents: events.length,
      verificationResults,
      verifiedAt: new Date()
    };
  }

  private async verifyEvent(
    event: AuditEvent,
    previousEvent?: AuditEvent
  ): Promise<EventVerificationResult> {
    const result: EventVerificationResult = {
      eventId: event.eventId,
      valid: true,
      issues: []
    };

    // 1. ハッシュ検証
    const recalculatedHash = await this.calculateEventHash(event);
    if (recalculatedHash !== event.integrity.hash) {
      result.valid = false;
      result.issues.push('ハッシュ値が一致しません');
    }

    // 2. デジタル署名検証
    const signatureValid = await this.verifySignature(event);
    if (!signatureValid) {
      result.valid = false;
      result.issues.push('デジタル署名が無効です');
    }

    // 3. チェーン整合性検証
    if (previousEvent && event.integrity.previousHash !== previousEvent.integrity.hash) {
      result.valid = false;
      result.issues.push('チェーンハッシュが不整合です');
    }

    // 4. タイムスタンプ検証
    const timestampValid = await this.verifyTimestamp(event);
    if (!timestampValid) {
      result.valid = false;
      result.issues.push('タイムスタンプが無効です');
    }

    return result;
  }
}
```

### 3.3 監査ログ検索・分析

```typescript
@Injectable()
export class AuditAnalysisService {
  constructor(
    private readonly auditRepository: AuditEventRepository,
    private readonly patternAnalyzer: AuditPatternAnalyzer,
    private readonly complianceAnalyzer: ComplianceAnalyzer
  ) {}

  /**
   * セキュリティインシデント関連監査ログ検索
   */
  async findSecurityIncidentAuditTrail(
    incidentId: string,
    timeWindow: TimeWindow
  ): Promise<SecurityAuditTrail> {
    const query: AuditQuery = {
      categories: [
        AuditCategory.AUTHENTICATION,
        AuditCategory.AUTHORIZATION,
        AuditCategory.ACCESS_CONTROL,
        AuditCategory.PII_HANDLING
      ],
      severities: [AuditSeverity.WARNING, AuditSeverity.ERROR, AuditSeverity.CRITICAL],
      timeRange: timeWindow,
      correlationId: incidentId
    };

    const events = await this.auditRepository.search(query);

    return {
      incidentId,
      totalEvents: events.length,
      timeline: this.buildEventTimeline(events),
      riskIndicators: await this.analyzeRiskIndicators(events),
      complianceImpact: await this.assessComplianceImpact(events),
      relatedActors: this.extractRelatedActors(events),
      affectedResources: this.extractAffectedResources(events)
    };
  }

  /**
   * ユーザー行動パターン分析
   */
  async analyzeUserBehaviorPattern(
    userId: string,
    analysisWindow: TimeWindow
  ): Promise<UserBehaviorAnalysis> {
    const userEvents = await this.auditRepository.findByUser(userId, analysisWindow);

    const analysis: UserBehaviorAnalysis = {
      userId,
      analysisWindow,
      totalOperations: userEvents.length,
      operationFrequency: this.calculateOperationFrequency(userEvents),
      accessPatterns: this.analyzeAccessPatterns(userEvents),
      riskScore: await this.calculateUserRiskScore(userEvents),
      anomalies: await this.detectAnomalies(userEvents),
      complianceViolations: this.findComplianceViolations(userEvents)
    };

    return analysis;
  }

  /**
   * システム変更履歴追跡
   */
  async traceSystemChanges(
    systemId: string,
    timeRange: TimeWindow
  ): Promise<SystemChangeTrail> {
    const systemEvents = await this.auditRepository.findByTarget(
      'SYSTEM',
      systemId,
      timeRange
    );

    const changeTrail: SystemChangeTrail = {
      systemId,
      timeRange,
      changes: this.buildChangeSequence(systemEvents),
      configurationDrift: this.analyzeConfigurationDrift(systemEvents),
      securityClassificationHistory: this.extractSecurityClassificationHistory(systemEvents),
      complianceStatus: await this.checkComplianceStatus(systemEvents)
    };

    return changeTrail;
  }

  private async calculateUserRiskScore(events: AuditEvent[]): Promise<number> {
    let riskScore = 0;

    // 失敗した操作
    const failedOperations = events.filter(e => e.result.status === 'FAILURE');
    riskScore += failedOperations.length * 0.1;

    // 高セキュリティ分類へのアクセス
    const highSecurityAccess = events.filter(e =>
      e.target.securityClassification === SecurityClassification.CONFIDENTIAL ||
      e.target.securityClassification === SecurityClassification.RESTRICTED
    );
    riskScore += highSecurityAccess.length * 0.2;

    // 異常時間帯でのアクセス
    const afterHoursAccess = events.filter(e => this.isAfterHours(e.timestamp));
    riskScore += afterHoursAccess.length * 0.15;

    // PII関連操作
    const piiOperations = events.filter(e => e.category === AuditCategory.PII_HANDLING);
    riskScore += piiOperations.length * 0.25;

    return Math.min(riskScore, 10.0); // 最大10点
  }
}
```

## 4. コンプライアンス監査支援

### 4.1 ISO 27001 監査支援

```typescript
@Injectable()
export class ISO27001AuditSupport {
  constructor(
    private readonly auditRepository: AuditEventRepository,
    private readonly controlAssessment: ControlAssessmentService
  ) {}

  /**
   * ISO 27001 附属書A統制の監査証跡生成
   */
  async generateControlAuditEvidence(
    controlId: string,
    auditPeriod: AuditPeriod
  ): Promise<ControlAuditEvidence> {
    const controlMap = this.getISO27001ControlMapping();
    const control = controlMap[controlId];

    const relevantEvents = await this.auditRepository.search({
      categories: control.auditCategories,
      timeRange: auditPeriod.timeRange,
      customFilters: control.evidenceFilters
    });

    return {
      controlId,
      controlName: control.name,
      auditPeriod,
      evidenceCount: relevantEvents.length,
      evidenceSummary: this.summarizeEvidence(relevantEvents, control),
      complianceGaps: await this.identifyComplianceGaps(relevantEvents, control),
      recommendations: this.generateRecommendations(relevantEvents, control)
    };
  }

  private getISO27001ControlMapping(): Record<string, ISO27001Control> {
    return {
      'A.9.1.1': {
        name: 'アクセス制御方針',
        auditCategories: [AuditCategory.ACCESS_CONTROL, AuditCategory.AUTHORIZATION],
        evidenceFilters: {
          actions: ['ACCESS_GRANTED', 'ACCESS_DENIED', 'POLICY_CHANGE']
        }
      },
      'A.12.4.1': {
        name: 'イベントログ記録',
        auditCategories: [AuditCategory.SYSTEM_LIFECYCLE, AuditCategory.DATA_ACCESS],
        evidenceFilters: {
          severities: [AuditSeverity.WARNING, AuditSeverity.ERROR, AuditSeverity.CRITICAL]
        }
      },
      'A.18.1.4': {
        name: 'プライバシー及びPIIの保護',
        auditCategories: [AuditCategory.PII_HANDLING],
        evidenceFilters: {
          actions: ['PII_ACCESS', 'PII_PROCESSING', 'PII_DELETION']
        }
      }
    };
  }
}
```

### 4.2 SOX法対応監査

```typescript
@Injectable()
export class SOXComplianceAudit {
  constructor(
    private readonly auditRepository: AuditEventRepository,
    private readonly internalControlService: InternalControlService
  ) {}

  /**
   * SOX法 ITGCの監査証跡生成
   */
  async generateITGCAuditReport(
    quarter: Quarter,
    fiscalYear: number
  ): Promise<ITGCAuditReport> {
    const auditPeriod = this.getQuarterPeriod(quarter, fiscalYear);

    const itgcEvidence = await Promise.all([
      this.gatherAccessControlEvidence(auditPeriod),
      this.gatherChangeManagementEvidence(auditPeriod),
      this.gatherDataIntegrityEvidence(auditPeriod),
      this.gatherSecurityManagementEvidence(auditPeriod)
    ]);

    return {
      quarter,
      fiscalYear,
      auditPeriod,
      itgcAssessment: {
        accessControl: itgcEvidence[0],
        changeManagement: itgcEvidence[1],
        dataIntegrity: itgcEvidence[2],
        securityManagement: itgcEvidence[3]
      },
      overallRating: this.calculateOverallITGCRating(itgcEvidence),
      deficiencies: this.identifyDeficiencies(itgcEvidence),
      managementRecommendations: this.generateManagementRecommendations(itgcEvidence)
    };
  }
}
```

## 5. 実装チェックリスト

### 5.1 監査ログ基盤

- [ ] SecurityAuditLogger実装
- [ ] AuditEvent データモデル定義
- [ ] AuditIntegrityService実装
- [ ] AuditEventRepository実装
- [ ] PII マスキング統合

### 5.2 完全性保証

- [ ] デジタル署名機能実装
- [ ] ハッシュチェーン構築
- [ ] タイムスタンプサービス統合
- [ ] HSM統合（本番環境）
- [ ] チェーン検証機能実装

### 5.3 分析・検索

- [ ] AuditAnalysisService実装
- [ ] 高度検索機能実装
- [ ] パターン分析機能
- [ ] リスクスコア計算
- [ ] 異常検知機能

### 5.4 コンプライアンス支援

- [ ] ISO27001監査支援実装
- [ ] SOX法対応機能実装
- [ ] 自動レポート生成
- [ ] ダッシュボード作成
- [ ] アラート機能実装

## 6. 運用要件

### 6.1 性能要件

- **ログ記録**: 99%の操作で50ms以内
- **検索**: 複雑クエリで5秒以内
- **完全性検証**: 1万件で30秒以内
- **レポート生成**: 月次レポートで10分以内

### 6.2 保存・保持ポリシー

- **オンライン保存**: 直近1年分
- **ニアライン保存**: 1-3年分
- **アーカイブ保存**: 3-7年分
- **削除ポリシー**: 法的保持期間経過後
- **暗号化**: 保存時AES-256で暗号化

### 6.3 監視・アラート

- **ログ記録失敗**: 即座にアラート
- **完全性違反**: 緊急アラート
- **異常パターン**: 24時間以内に通知
- **容量逼迫**: 事前アラート（80%）
- **パフォーマンス低下**: 閾値ベースアラート
