# セキュリティ例外処理戦略

**担当**: セキュリティエンジニア
**作成日**: 2025-09-21
**Issue**: #34 (US-SM-001: システム新規登録)
**関連仕様**: System集約設計仕様書 (US-SM-001.md)
**アーキテクチャパターン**: オニオンアーキテクチャ + DDD + CQRS + イベントソーシング

## 1. セキュリティ例外処理フレームワーク

### 1.1 設計原則

**製造業セキュリティ要件**:

- **情報漏洩防止**: 例外メッセージで機密情報を露出させない
- **ゼロトラスト原則**: 全ての例外を潜在的なセキュリティインシデントとして扱う
- **フェイルセキュア**: システム障害時は最も安全な状態にフォールバック
- **攻撃者情報排除**: エラーメッセージから内部構造を推測されない設計
- **完全監査**: 全てのセキュリティ例外を記録・分析

### 1.2 例外分類体系

```typescript
export enum SecurityExceptionCategory {
  // 認証・認可関連
  AUTHENTICATION_FAILURE = 'AUTHENTICATION_FAILURE',
  AUTHORIZATION_VIOLATION = 'AUTHORIZATION_VIOLATION',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',

  // データ保護関連
  PII_EXPOSURE_RISK = 'PII_EXPOSURE_RISK',
  DATA_CLASSIFICATION_VIOLATION = 'DATA_CLASSIFICATION_VIOLATION',
  ENCRYPTION_FAILURE = 'ENCRYPTION_FAILURE',

  // 入力検証関連
  INJECTION_ATTACK_DETECTED = 'INJECTION_ATTACK_DETECTED',
  MALICIOUS_INPUT_DETECTED = 'MALICIOUS_INPUT_DETECTED',
  INPUT_VALIDATION_BYPASS = 'INPUT_VALIDATION_BYPASS',

  // システムセキュリティ
  SECURITY_POLICY_VIOLATION = 'SECURITY_POLICY_VIOLATION',
  THREAT_DETECTION = 'THREAT_DETECTION',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',

  // 運用セキュリティ
  KEY_MANAGEMENT_ERROR = 'KEY_MANAGEMENT_ERROR',
  AUDIT_INTEGRITY_VIOLATION = 'AUDIT_INTEGRITY_VIOLATION',
  COMPLIANCE_VIOLATION = 'COMPLIANCE_VIOLATION'
}

export enum SecuritySeverity {
  LOW = 'LOW',           // 情報提供レベル
  MEDIUM = 'MEDIUM',     // 注意が必要
  HIGH = 'HIGH',         // 即座の対応が必要
  CRITICAL = 'CRITICAL'  // 緊急対応が必要
}
```

## 2. セキュリティ例外基盤クラス

### 2.1 基底例外クラス

```typescript
export abstract class SecurityException extends Error {
  public readonly id: string;
  public readonly category: SecurityExceptionCategory;
  public readonly severity: SecuritySeverity;
  public readonly timestamp: Date;
  public readonly userContext?: UserContext;
  public readonly requestContext?: RequestContext;
  public readonly sanitizedMessage: string;
  public readonly internalDetails: any;

  constructor(
    message: string,
    category: SecurityExceptionCategory,
    severity: SecuritySeverity,
    internalDetails?: any,
    userContext?: UserContext,
    requestContext?: RequestContext
  ) {
    super(message);
    this.name = this.constructor.name;
    this.id = crypto.randomUUID();
    this.category = category;
    this.severity = severity;
    this.timestamp = new Date();
    this.userContext = userContext;
    this.requestContext = requestContext;
    this.sanitizedMessage = this.sanitizeMessage(message);
    this.internalDetails = internalDetails;

    // スタックトレースの機密情報をサニタイズ
    this.stack = this.sanitizeStackTrace(this.stack);
  }

  /**
   * 外部に公開される安全なメッセージを生成
   */
  public getPublicMessage(): string {
    return this.sanitizedMessage;
  }

  /**
   * 内部ログ用の詳細情報を取得
   */
  public getInternalDetails(): SecurityExceptionDetails {
    return {
      id: this.id,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp,
      originalMessage: this.message,
      sanitizedMessage: this.sanitizedMessage,
      internalDetails: this.internalDetails,
      userContext: this.userContext,
      requestContext: this.requestContext,
      stackTrace: this.stack
    };
  }

  /**
   * セキュリティインシデント判定
   */
  public isSecurityIncident(): boolean {
    return this.severity === SecuritySeverity.HIGH ||
           this.severity === SecuritySeverity.CRITICAL;
  }

  /**
   * 緊急対応が必要な例外判定
   */
  public requiresImmediateResponse(): boolean {
    return this.severity === SecuritySeverity.CRITICAL;
  }

  protected abstract sanitizeMessage(message: string): string;

  private sanitizeStackTrace(stackTrace?: string): string {
    if (!stackTrace) return 'スタックトレース情報なし';

    return stackTrace
      .replace(/\/[^\/\s]+\/[^\/\s]+\/[^\/\s]+/g, '/[PATH_REDACTED]')
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_REDACTED]')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
      .replace(/[A-Za-z0-9+/]{40,}/g, '[TOKEN_REDACTED]');
  }
}
```

### 2.2 具体的なセキュリティ例外クラス

#### 認証・認可例外

```typescript
export class UnauthorizedOperationException extends SecurityException {
  constructor(
    operation: string,
    requiredRole: UserRole,
    currentRole: UserRole,
    userContext?: UserContext,
    requestContext?: RequestContext
  ) {
    super(
      `操作 '${operation}' には ${requiredRole} 以上の権限が必要です。現在の権限: ${currentRole}`,
      SecurityExceptionCategory.AUTHORIZATION_VIOLATION,
      SecuritySeverity.MEDIUM,
      { operation, requiredRole, currentRole },
      userContext,
      requestContext
    );
  }

  protected sanitizeMessage(message: string): string {
    return 'この操作を実行する権限がありません。';
  }
}

export class AuthenticationFailedException extends SecurityException {
  constructor(
    reason: string,
    attemptCount: number,
    userContext?: UserContext,
    requestContext?: RequestContext
  ) {
    super(
      `認証に失敗しました: ${reason}`,
      SecurityExceptionCategory.AUTHENTICATION_FAILURE,
      attemptCount >= 3 ? SecuritySeverity.HIGH : SecuritySeverity.MEDIUM,
      { reason, attemptCount },
      userContext,
      requestContext
    );
  }

  protected sanitizeMessage(message: string): string {
    return '認証に失敗しました。ユーザー名またはパスワードを確認してください。';
  }
}

export class PrivilegeEscalationAttemptException extends SecurityException {
  constructor(
    attemptedOperation: string,
    suspiciousIndicators: string[],
    userContext?: UserContext,
    requestContext?: RequestContext
  ) {
    super(
      `権限昇格の試行を検出: ${attemptedOperation}`,
      SecurityExceptionCategory.PRIVILEGE_ESCALATION,
      SecuritySeverity.CRITICAL,
      { attemptedOperation, suspiciousIndicators },
      userContext,
      requestContext
    );
  }

  protected sanitizeMessage(message: string): string {
    return 'セキュリティポリシー違反を検出しました。アクセスが拒否されました。';
  }
}
```

#### データ保護例外

```typescript
export class PIIExposureRiskException extends SecurityException {
  constructor(
    piiType: PIIType,
    exposureContext: string,
    riskLevel: string,
    userContext?: UserContext,
    requestContext?: RequestContext
  ) {
    super(
      `PII露出リスクを検出: ${piiType} in ${exposureContext}`,
      SecurityExceptionCategory.PII_EXPOSURE_RISK,
      SecuritySeverity.HIGH,
      { piiType, exposureContext, riskLevel },
      userContext,
      requestContext
    );
  }

  protected sanitizeMessage(message: string): string {
    return '個人情報保護ポリシーに基づき、アクセスが制限されました。';
  }
}

export class DataClassificationViolationException extends SecurityException {
  constructor(
    requiredClassification: SecurityClassification,
    attemptedAccess: SecurityClassification,
    dataType: string,
    userContext?: UserContext,
    requestContext?: RequestContext
  ) {
    super(
      `データ分類違反: ${dataType} requires ${requiredClassification}, attempted ${attemptedAccess}`,
      SecurityExceptionCategory.DATA_CLASSIFICATION_VIOLATION,
      SecuritySeverity.HIGH,
      { requiredClassification, attemptedAccess, dataType },
      userContext,
      requestContext
    );
  }

  protected sanitizeMessage(message: string): string {
    return 'データアクセス権限が不足しています。';
  }
}

export class EncryptionFailureException extends SecurityException {
  constructor(
    operation: string,
    keyId: string,
    errorDetails: string,
    userContext?: UserContext,
    requestContext?: RequestContext
  ) {
    super(
      `暗号化処理失敗: ${operation} with key ${keyId}`,
      SecurityExceptionCategory.ENCRYPTION_FAILURE,
      SecuritySeverity.CRITICAL,
      { operation, keyId, errorDetails },
      userContext,
      requestContext
    );
  }

  protected sanitizeMessage(message: string): string {
    return 'データ処理中にエラーが発生しました。管理者にお問い合わせください。';
  }
}
```

#### 入力検証例外

```typescript
export class InjectionAttackDetectedException extends SecurityException {
  constructor(
    attackType: string,
    maliciousPayload: string,
    detectionRule: string,
    userContext?: UserContext,
    requestContext?: RequestContext
  ) {
    super(
      `${attackType} injection attack detected`,
      SecurityExceptionCategory.INJECTION_ATTACK_DETECTED,
      SecuritySeverity.CRITICAL,
      {
        attackType,
        payloadHash: this.hashPayload(maliciousPayload),
        detectionRule
      },
      userContext,
      requestContext
    );
  }

  protected sanitizeMessage(message: string): string {
    return '入力値に問題があります。正しい形式で入力してください。';
  }

  private hashPayload(payload: string): string {
    return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);
  }
}

export class MaliciousInputDetectedException extends SecurityException {
  constructor(
    inputField: string,
    threatScore: number,
    detectionMethods: string[],
    userContext?: UserContext,
    requestContext?: RequestContext
  ) {
    super(
      `Malicious input detected in ${inputField}, threat score: ${threatScore}`,
      SecurityExceptionCategory.MALICIOUS_INPUT_DETECTED,
      threatScore > 0.8 ? SecuritySeverity.HIGH : SecuritySeverity.MEDIUM,
      { inputField, threatScore, detectionMethods },
      userContext,
      requestContext
    );
  }

  protected sanitizeMessage(message: string): string {
    return '入力内容を確認してください。';
  }
}
```

## 3. セキュリティ例外ハンドラー

### 3.1 グローバル例外ハンドラー

```typescript
@Catch(SecurityException)
export class SecurityExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly securityLogger: SecurityAuditLogger,
    private readonly incidentManager: SecurityIncidentManager,
    private readonly notificationService: SecurityNotificationService
  ) {}

  async catch(exception: SecurityException, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. セキュリティインシデント判定と処理
    if (exception.isSecurityIncident()) {
      await this.handleSecurityIncident(exception, request);
    }

    // 2. 監査ログ記録
    await this.logSecurityException(exception, request);

    // 3. 緊急対応判定
    if (exception.requiresImmediateResponse()) {
      await this.triggerEmergencyResponse(exception);
    }

    // 4. レスポンス生成（情報漏洩防止）
    const safeResponse = this.createSafeResponse(exception);

    response.status(this.getHttpStatus(exception)).json(safeResponse);
  }

  private async handleSecurityIncident(
    exception: SecurityException,
    request: Request
  ): Promise<void> {
    const incident = await this.incidentManager.createIncident({
      id: exception.id,
      category: exception.category,
      severity: exception.severity,
      timestamp: exception.timestamp,
      source: 'SYSTEM_MANAGEMENT_CONTEXT',
      details: exception.getInternalDetails(),
      affectedResources: this.extractAffectedResources(request),
      initiatingUser: exception.userContext?.userId
    });

    // 自動対応アクション
    await this.executeAutomaticResponse(incident);
  }

  private async logSecurityException(
    exception: SecurityException,
    request: Request
  ): Promise<void> {
    await this.securityLogger.logSecurityException({
      exceptionId: exception.id,
      category: exception.category,
      severity: exception.severity,
      timestamp: exception.timestamp,
      sanitizedMessage: exception.getPublicMessage(),
      internalDetails: exception.getInternalDetails(),
      requestInfo: {
        method: request.method,
        url: this.sanitizeUrl(request.url),
        userAgent: this.sanitizeUserAgent(request.headers['user-agent']),
        ip: this.sanitizeIpAddress(this.getClientIp(request)),
        sessionId: this.getSessionId(request)
      }
    });
  }

  private createSafeResponse(exception: SecurityException): any {
    const baseResponse = {
      success: false,
      errorId: exception.id,
      message: exception.getPublicMessage(),
      timestamp: exception.timestamp.toISOString()
    };

    // 開発環境でのみ詳細情報を含める
    if (process.env.NODE_ENV === 'development') {
      return {
        ...baseResponse,
        category: exception.category,
        severity: exception.severity,
        internalDetails: exception.getInternalDetails()
      };
    }

    return baseResponse;
  }

  private getHttpStatus(exception: SecurityException): number {
    switch (exception.category) {
      case SecurityExceptionCategory.AUTHENTICATION_FAILURE:
        return 401;
      case SecurityExceptionCategory.AUTHORIZATION_VIOLATION:
      case SecurityExceptionCategory.PRIVILEGE_ESCALATION:
      case SecurityExceptionCategory.DATA_CLASSIFICATION_VIOLATION:
        return 403;
      case SecurityExceptionCategory.INJECTION_ATTACK_DETECTED:
      case SecurityExceptionCategory.MALICIOUS_INPUT_DETECTED:
        return 400;
      case SecurityExceptionCategory.ENCRYPTION_FAILURE:
      case SecurityExceptionCategory.KEY_MANAGEMENT_ERROR:
        return 500;
      default:
        return 403; // フェイルセキュア: 不明な場合は Forbidden
    }
  }
}
```

### 3.2 自動セキュリティ対応

```typescript
@Injectable()
export class SecurityIncidentManager {
  constructor(
    private readonly userBlockingService: UserBlockingService,
    private readonly networkIsolationService: NetworkIsolationService,
    private readonly emergencyNotificationService: EmergencyNotificationService
  ) {}

  async executeAutomaticResponse(incident: SecurityIncident): Promise<void> {
    const responseActions: AutomaticResponseAction[] = [];

    // 重要度に基づく自動対応
    switch (incident.severity) {
      case SecuritySeverity.CRITICAL:
        responseActions.push(...await this.getCriticalResponseActions(incident));
        break;
      case SecuritySeverity.HIGH:
        responseActions.push(...await this.getHighResponseActions(incident));
        break;
      case SecuritySeverity.MEDIUM:
        responseActions.push(...await this.getMediumResponseActions(incident));
        break;
    }

    // カテゴリ別の特定対応
    responseActions.push(...await this.getCategorySpecificActions(incident));

    // 対応アクション実行
    for (const action of responseActions) {
      try {
        await this.executeAction(action, incident);
        await this.logActionExecution(action, incident, 'SUCCESS');
      } catch (error) {
        await this.logActionExecution(action, incident, 'FAILURE', error);
      }
    }
  }

  private async getCriticalResponseActions(
    incident: SecurityIncident
  ): Promise<AutomaticResponseAction[]> {
    return [
      {
        type: 'IMMEDIATE_USER_SUSPENSION',
        priority: 1,
        description: 'ユーザーアカウントの即座の一時停止'
      },
      {
        type: 'SESSION_TERMINATION',
        priority: 2,
        description: '全てのアクティブセッションの強制終了'
      },
      {
        type: 'EMERGENCY_NOTIFICATION',
        priority: 3,
        description: 'セキュリティチームへの緊急通知'
      },
      {
        type: 'FORENSIC_DATA_CAPTURE',
        priority: 4,
        description: 'フォレンジック分析用データ保全'
      }
    ];
  }

  private async getCategorySpecificActions(
    incident: SecurityIncident
  ): Promise<AutomaticResponseAction[]> {
    const actions: AutomaticResponseAction[] = [];

    switch (incident.category) {
      case SecurityExceptionCategory.INJECTION_ATTACK_DETECTED:
        actions.push({
          type: 'IP_TEMPORARY_BLOCK',
          priority: 1,
          description: '攻撃元IPアドレスの一時ブロック'
        });
        break;

      case SecurityExceptionCategory.PII_EXPOSURE_RISK:
        actions.push({
          type: 'DATA_ACCESS_FREEZE',
          priority: 1,
          description: 'PII関連データアクセスの一時凍結'
        });
        break;

      case SecurityExceptionCategory.ENCRYPTION_FAILURE:
        actions.push({
          type: 'CRYPTOGRAPHIC_SYSTEM_ISOLATION',
          priority: 1,
          description: '暗号化システムの分離と安全化'
        });
        break;
    }

    return actions;
  }
}
```

## 4. 製造業特化セキュリティ対応

### 4.1 情報漏洩防止特化処理

```typescript
export class ManufacturingSecurityHandler {
  constructor(
    private readonly dataClassificationService: DataClassificationService,
    private readonly complianceManager: ComplianceManagerService
  ) {}

  /**
   * 製造業特有のセキュリティインシデント処理
   */
  async handleManufacturingSecurityIncident(
    incident: SecurityIncident
  ): Promise<void> {
    // 1. 生産システムへの影響評価
    const productionImpact = await this.assessProductionSystemImpact(incident);

    // 2. 知的財産保護の確認
    const ipProtectionStatus = await this.verifyIntellectualPropertyProtection(incident);

    // 3. サプライチェーンセキュリティ確認
    const supplyChainRisk = await this.assessSupplyChainSecurityRisk(incident);

    // 4. 製造業コンプライアンス確認
    const complianceImpact = await this.assessRegulatoryCompliance(incident);

    // 5. 統合リスク評価と対応計画
    const riskAssessment = {
      productionImpact,
      ipProtectionStatus,
      supplyChainRisk,
      complianceImpact,
      overallRiskLevel: this.calculateOverallRisk([
        productionImpact.riskLevel,
        ipProtectionStatus.riskLevel,
        supplyChainRisk.riskLevel,
        complianceImpact.riskLevel
      ])
    };

    // 6. 製造業特化の対応実行
    await this.executeManufacturingSpecificResponse(incident, riskAssessment);
  }

  private async executeManufacturingSpecificResponse(
    incident: SecurityIncident,
    riskAssessment: ManufacturingRiskAssessment
  ): Promise<void> {
    if (riskAssessment.overallRiskLevel === 'CRITICAL') {
      // 生産システムの緊急停止検討
      await this.considerProductionSystemShutdown(incident, riskAssessment);
    }

    if (riskAssessment.ipProtectionStatus.isCompromised) {
      // 知的財産保護の強化
      await this.enhanceIntellectualPropertyProtection();
    }

    if (riskAssessment.supplyChainRisk.riskLevel === 'HIGH') {
      // サプライチェーンパートナーへの通知
      await this.notifySupplyChainPartners(incident);
    }

    // 規制当局への報告が必要な場合
    if (riskAssessment.complianceImpact.requiresRegulatoryReporting) {
      await this.initiateRegulatoryReporting(incident, riskAssessment);
    }
  }
}
```

## 5. 実装チェックリスト

### 5.1 例外処理基盤

- [ ] SecurityException基底クラス実装
- [ ] 具体的なセキュリティ例外クラス群実装
- [ ] SecurityExceptionFilter実装
- [ ] メッセージサニタイゼーション機能実装
- [ ] 例外コンテキスト情報収集機能実装

### 5.2 自動対応システム

- [ ] SecurityIncidentManager実装
- [ ] 自動対応アクション定義
- [ ] 緊急通知システム統合
- [ ] ユーザーブロック機能実装
- [ ] フォレンジックデータ収集機能実装

### 5.3 製造業特化機能

- [ ] ManufacturingSecurityHandler実装
- [ ] 生産システム影響評価機能
- [ ] 知的財産保護機能
- [ ] サプライチェーンリスク評価
- [ ] 規制報告機能

### 5.4 監視・分析

- [ ] セキュリティ例外メトリクス収集
- [ ] 傾向分析・パターン検出
- [ ] ダッシュボード表示
- [ ] アラート閾値設定
- [ ] レポート生成機能

## 6. 運用要件

### 6.1 監視項目

- セキュリティ例外発生頻度
- 例外カテゴリ別分布
- 自動対応成功率
- インシデント解決時間
- 偽陽性率

### 6.2 メンテナンス

- 例外パターン定期見直し
- 自動対応ルール調整
- サニタイゼーション規則更新
- 緊急連絡先情報更新
- コンプライアンス要件変更対応
