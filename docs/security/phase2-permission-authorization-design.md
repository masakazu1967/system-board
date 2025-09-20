# Phase 2: Permission & Authorization Design - セキュリティ方針

## 概要

System Boardの認証・認可システム設計における製造業セキュリティ基準準拠とゼロトラスト原則に基づく包括的なセキュリティ方針です。

## 1. 認証・認可アーキテクチャ

### 1.1 全体アーキテクチャ

```ascii
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Frontend       │    │  API Gateway    │    │  Auth Service   │
│  (React SPA)    │◄──►│  (NestJS)       │◄──►│  (Auth0 + JWT)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Session Store  │    │  Authorization  │    │  Audit Service  │
│  (Redis)        │    │  Engine (RBAC)  │    │  (Kurrent)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 1.2 認証フロー

1. **初回認証**: Auth0 OAuth2.0 + PKCE
2. **MFA認証**: TOTP (Google Authenticator) 必須
3. **JWT発行**: Access Token (15分) + Refresh Token (7日)
4. **セッション管理**: Redis による無効化可能なセッション

### 1.3 認可フロー

1. **RBAC評価**: Role-Based Access Control
2. **ABAC補完**: Attribute-Based (リソース・時間・場所)
3. **動的認可**: コンテキスト依存の権限評価

## 2. ロール・権限モデル

### 2.1 システムロール定義

#### システム管理者 (System Administrator)

```typescript
interface SystemAdministratorPermissions {
  // システム管理
  systemConfig: ['read', 'write', 'delete'];
  userManagement: ['read', 'write', 'delete'];
  roleManagement: ['read', 'write', 'delete'];

  // データ管理
  vulnerabilityData: ['read', 'write', 'delete'];
  systemInventory: ['read', 'write', 'delete'];

  // 監査・ログ
  auditLogs: ['read', 'export'];
  systemLogs: ['read', 'export'];

  // 高リスク操作
  dataExport: ['execute']; // MFA必須
  systemMaintenance: ['execute']; // MFA必須
}
```

#### セキュリティ管理者 (Security Manager)

```typescript
interface SecurityManagerPermissions {
  // 脆弱性管理
  vulnerabilityAssessment: ['read', 'write', 'approve'];
  riskAcceptance: ['read', 'write', 'approve']; // MFA必須
  securityPolicies: ['read', 'write'];

  // システム監視
  securityAlerts: ['read', 'acknowledge', 'escalate'];
  threatIntelligence: ['read', 'write'];

  // 監査・レポート
  securityReports: ['read', 'generate', 'export'];
  complianceReports: ['read', 'generate'];
  auditLogs: ['read'];

  // アクセス制御
  emergencyAccess: ['grant']; // MFA必須
}
```

#### 経営陣 (Executive)

```typescript
interface ExecutivePermissions {
  // ダッシュボード・レポート
  executiveDashboard: ['read'];
  riskSummary: ['read'];
  complianceStatus: ['read'];

  // 承認権限
  budgetApproval: ['approve']; // MFA必須
  riskAcceptance: ['final_approve']; // MFA必須
  policyApproval: ['approve'];

  // エクスポート
  executiveReports: ['export']; // MFA必須
}
```

#### システム担当者 (System Operator)

```typescript
interface SystemOperatorPermissions {
  // 日常運用
  systemMonitoring: ['read'];
  basicMaintenance: ['execute'];
  ticketManagement: ['read', 'write'];

  // データ管理
  inventoryUpdate: ['read', 'write'];
  vulnerabilityScan: ['execute'];

  // 制限付きアクセス
  operationalLogs: ['read'];
  basicReports: ['read', 'generate'];
}
```

### 2.2 権限継承モデル

```text
Executive (最高権限)
├── SecurityManager (セキュリティ特化)
├── SystemAdministrator (技術特化)
└── SystemOperator (操作限定)
```

## 3. 高リスクコマンド認証強化

### 3.1 高リスク操作定義

```typescript
enum HighRiskCommands {
  // データ操作
  APPROVE_RISK_ACCEPTANCE = 'approve_risk_acceptance',
  EXPORT_SENSITIVE_DATA = 'export_sensitive_data',
  DELETE_AUDIT_LOGS = 'delete_audit_logs',

  // システム操作
  EMERGENCY_ACCESS_GRANT = 'emergency_access_grant',
  SYSTEM_SHUTDOWN = 'system_shutdown',
  BACKUP_RESTORE = 'backup_restore',

  // 設定変更
  SECURITY_POLICY_MODIFY = 'security_policy_modify',
  USER_PRIVILEGE_ESCALATE = 'user_privilege_escalate',
  ENCRYPTION_KEY_ROTATE = 'encryption_key_rotate'
}
```

### 3.2 段階的認証要件

```typescript
interface AuthenticationRequirements {
  standard: {
    methods: ['password', 'mfa'];
    sessionTimeout: 480; // 8時間
  };

  elevated: {
    methods: ['password', 'mfa', 'biometric']; // 可能な場合
    sessionTimeout: 240; // 4時間
    requiresApproval: false;
  };

  critical: {
    methods: ['password', 'mfa', 'manager_approval'];
    sessionTimeout: 60; // 1時間
    requiresApproval: true;
    approverRole: ['SecurityManager', 'Executive'];
  };
}
```

### 3.3 コマンド別認証マップ

```typescript
const commandAuthMap: Record<HighRiskCommands, keyof AuthenticationRequirements> = {
  [HighRiskCommands.APPROVE_RISK_ACCEPTANCE]: 'critical',
  [HighRiskCommands.EXPORT_SENSITIVE_DATA]: 'critical',
  [HighRiskCommands.DELETE_AUDIT_LOGS]: 'critical',
  [HighRiskCommands.EMERGENCY_ACCESS_GRANT]: 'critical',
  [HighRiskCommands.SYSTEM_SHUTDOWN]: 'elevated',
  [HighRiskCommands.BACKUP_RESTORE]: 'elevated',
  [HighRiskCommands.SECURITY_POLICY_MODIFY]: 'elevated',
  [HighRiskCommands.USER_PRIVILEGE_ESCALATE]: 'critical',
  [HighRiskCommands.ENCRYPTION_KEY_ROTATE]: 'elevated'
};
```

## 4. 監査ログ要件（5年間保持）

### 4.1 監査イベント分類

```typescript
enum AuditEventTypes {
  // 認証関連
  AUTHENTICATION_SUCCESS = 'auth.success',
  AUTHENTICATION_FAILURE = 'auth.failure',
  MFA_CHALLENGE = 'auth.mfa_challenge',
  SESSION_TIMEOUT = 'auth.session_timeout',

  // 認可関連
  AUTHORIZATION_SUCCESS = 'authz.success',
  AUTHORIZATION_FAILURE = 'authz.failure',
  PRIVILEGE_ESCALATION = 'authz.privilege_escalation',

  // データアクセス
  DATA_READ = 'data.read',
  DATA_WRITE = 'data.write',
  DATA_DELETE = 'data.delete',
  DATA_EXPORT = 'data.export',

  // システム操作
  SYSTEM_CONFIG_CHANGE = 'system.config_change',
  USER_MANAGEMENT = 'system.user_management',
  EMERGENCY_ACCESS = 'system.emergency_access'
}
```

### 4.2 監査ログ構造

```typescript
interface AuditLogEntry {
  // 基本情報
  id: string;
  timestamp: Date;
  eventType: AuditEventTypes;

  // 主体情報
  userId: string;
  userRole: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;

  // 操作情報
  resource: string;
  action: string;
  outcome: 'success' | 'failure' | 'denied';

  // コンテキスト
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  businessJustification?: string;
  approverInfo?: {
    approverId: string;
    approvalTimestamp: Date;
  };

  // 技術詳細
  requestPayload?: Record<string, any>;
  responseMetadata?: Record<string, any>;
  errorDetails?: string;

  // データ分類
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  retentionPeriod: number; // 5年 = 1825日
}
```

### 4.3 ログ保管戦略

```typescript
interface LogRetentionStrategy {
  // 即座のアクセス (0-90日)
  hotStorage: {
    location: 'ElasticSearch';
    queryPerformance: 'real-time';
    retention: 90; // 日
  };

  // 通常アクセス (91日-2年)
  warmStorage: {
    location: 'PostgreSQL';
    queryPerformance: 'near-real-time';
    retention: 730; // 日
  };

  // アーカイブ (2年-5年)
  coldStorage: {
    location: 'Kurrent + 圧縮ファイル';
    queryPerformance: 'batch';
    retention: 1825; // 日
    encryption: 'AES-256';
    compression: 'gzip';
  };
}
```

## 5. セッション管理・タイムアウト設定

### 5.1 セッション分類

```typescript
interface SessionConfiguration {
  // 一般セッション
  standard: {
    maxAge: 8 * 60 * 60 * 1000; // 8時間
    slidingExpiration: true;
    inactivityTimeout: 2 * 60 * 60 * 1000; // 2時間
  };

  // 高権限セッション
  privileged: {
    maxAge: 4 * 60 * 60 * 1000; // 4時間
    slidingExpiration: false;
    inactivityTimeout: 30 * 60 * 1000; // 30分
  };

  // 緊急アクセス
  emergency: {
    maxAge: 1 * 60 * 60 * 1000; // 1時間
    slidingExpiration: false;
    inactivityTimeout: 15 * 60 * 1000; // 15分
    requiresContinuousMonitoring: true;
  };
}
```

### 5.2 セッション検証

```typescript
interface SessionValidation {
  // 標準チェック
  tokenValidation: {
    jwtSignatureVerification: true;
    tokenExpirationCheck: true;
    issuerValidation: true;
  };

  // セキュリティチェック
  securityValidation: {
    ipAddressConsistency: true;
    userAgentConsistency: true;
    geolocationAnomalyDetection: true;
    concurrentSessionLimits: 3; // 最大3セッション
  };

  // 行動分析
  behavioralAnalysis: {
    accessPatternAnalysis: true;
    velocityChecks: true;
    riskScoring: true;
  };
}
```

## 6. 外部API連携セキュリティ境界

### 6.1 API分類とセキュリティレベル

```typescript
interface ExternalAPISecurityBoundaries {
  // 公開API (低リスク)
  publicAPIs: {
    examples: ['EndOfLife.date API'];
    security: {
      authentication: 'API Key';
      rateLimit: '100 req/min';
      dataClassification: 'public';
      monitoring: 'basic';
    };
  };

  // 制限API (中リスク)
  restrictedAPIs: {
    examples: ['GitHub API'];
    security: {
      authentication: 'OAuth2 + API Key';
      rateLimit: '50 req/min';
      dataClassification: 'internal';
      monitoring: 'enhanced';
      dataRetention: '30 days';
    };
  };

  // 機密API (高リスク)
  confidentialAPIs: {
    examples: ['NVD API'];
    security: {
      authentication: 'OAuth2 + Client Certificate';
      rateLimit: '20 req/min';
      dataClassification: 'confidential';
      monitoring: 'full_audit';
      dataRetention: '5 years';
      encryptionInTransit: 'TLS 1.3';
      encryptionAtRest: 'AES-256';
    };
  };
}
```

### 6.2 API Gateway セキュリティポリシー

```typescript
interface APIGatewaySecurityPolicy {
  // 入力検証
  inputValidation: {
    requestSizeLimit: '10MB';
    contentTypeValidation: true;
    schemaValidation: true;
    sqlInjectionPrevention: true;
    xssProtection: true;
  };

  // 出力制御
  outputControl: {
    dataLossPreventionScanning: true;
    sensitiveDataMasking: true;
    responseHeaderFiltering: true;
    errorMessageSanitization: true;
  };

  // セキュリティヘッダー
  securityHeaders: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains';
    'X-Frame-Options': 'DENY';
    'X-Content-Type-Options': 'nosniff';
    'X-XSS-Protection': '1; mode=block';
    'Referrer-Policy': 'strict-origin-when-cross-origin';
    'Content-Security-Policy': "default-src 'self'";
  };
}
```

### 6.3 データ境界制御

```typescript
interface DataBoundaryControls {
  // 入力データ境界
  inboundControls: {
    dataClassificationTagging: true;
    malwareScanning: true;
    dataValidation: true;
    sanitization: true;
  };

  // 出力データ境界
  outboundControls: {
    dlpScanning: true; // Data Loss Prevention
    dataClassificationEnforcement: true;
    encryptionEnforcement: true;
    auditLogging: true;
  };

  // 内部データ境界
  internalControls: {
    microserviceAuthentication: 'mTLS';
    serviceToServiceAuthorization: 'RBAC';
    dataEncryptionInTransit: 'TLS 1.3';
    dataEncryptionAtRest: 'AES-256-GCM';
  };
}
```

## 7. 実装技術詳細

### 7.1 Auth0設定

```typescript
interface Auth0Configuration {
  // アプリケーション設定
  applicationSettings: {
    applicationType: 'Single Page Application';
    allowedCallbackURLs: ['https://system-board.company.local/callback'];
    allowedLogoutURLs: ['https://system-board.company.local/logout'];
    allowedOrigins: ['https://system-board.company.local'];
  };

  // セキュリティ設定
  securitySettings: {
    tokenEndpointAuthMethod: 'none'; // PKCE使用
    requirePushedAuthorizationRequests: true;
    rotateRefreshToken: true;
    refreshTokenExpiration: 'expiring';
    refreshTokenLifetime: 604800; // 7日
  };

  // MFA設定
  mfaSettings: {
    enabled: true;
    enrollmentPolicy: 'required';
    factors: ['otp', 'sms']; // TOTPを優先
    challengeOnLogin: true;
  };
}
```

### 7.2 JWT設定

```typescript
interface JWTConfiguration {
  // Access Token
  accessToken: {
    algorithm: 'RS256';
    expiresIn: '15m';
    audience: 'system-board-api';
    issuer: 'https://system-board.auth0.com/';
    claims: {
      sub: 'user_id';
      roles: 'user_roles[]';
      permissions: 'user_permissions[]';
      session_id: 'session_identifier';
    };
  };

  // Refresh Token
  refreshToken: {
    expiresIn: '7d';
    rotating: true;
    absoluteLifetime: '30d';
    inactivityLifetime: '7d';
  };
}
```

### 7.3 RBAC実装

```typescript
interface RBACImplementation {
  // ポリシー評価エンジン
  policyEngine: {
    type: 'attribute-based';
    evaluationOrder: ['deny', 'allow'];
    conflictResolution: 'deny_overrides';
  };

  // 権限キャッシュ
  permissionCache: {
    provider: 'Redis';
    ttl: 300; // 5分
    invalidationStrategy: 'immediate';
  };

  // 監査統合
  auditIntegration: {
    logAllDecisions: true;
    includeContextData: true;
    performanceMonitoring: true;
  };
}
```

## 8. セキュリティ監視・アラート

### 8.1 リアルタイム監視

```typescript
interface SecurityMonitoring {
  // 認証監視
  authenticationMonitoring: {
    failedLoginThreshold: 5;
    suspiciousLocationDetection: true;
    timeBasedAccessPatterns: true;
    concurrentSessionAnomalies: true;
  };

  // 認可監視
  authorizationMonitoring: {
    privilegeEscalationDetection: true;
    unauthorizedAccessAttempts: true;
    dataExfiltrationPatterns: true;
    highRiskCommandExecution: true;
  };

  // システム監視
  systemMonitoring: {
    apiAbuseDetection: true;
    performanceAnomalies: true;
    resourceExhaustion: true;
    securityControlBypass: true;
  };
}
```

### 8.2 アラート設定

```typescript
interface AlertConfiguration {
  // 緊急アラート (即座対応)
  critical: {
    triggers: [
      'multiple_failed_authentications',
      'privilege_escalation_attempt',
      'data_exfiltration_detected',
      'security_control_bypass'
    ];
    channels: ['Microsoft Teams', 'Email', 'SMS'];
    responseTime: '< 5 minutes';
  };

  // 高優先度アラート
  high: {
    triggers: [
      'suspicious_login_location',
      'high_risk_command_execution',
      'api_rate_limit_exceeded'
    ];
    channels: ['Microsoft Teams', 'Email'];
    responseTime: '< 30 minutes';
  };

  // 中優先度アラート
  medium: {
    triggers: [
      'session_anomaly_detected',
      'policy_violation',
      'audit_log_gap'
    ];
    channels: ['Microsoft Teams'];
    responseTime: '< 4 hours';
  };
}
```

## 9. コンプライアンス・ガバナンス

### 9.1 製造業セキュリティ基準準拠

```typescript
interface ManufacturingSecurityCompliance {
  // ISO 27001要件
  iso27001: {
    informationSecurityPolicy: 'implemented';
    riskManagement: 'continuous';
    accessControl: 'role_based';
    cryptography: 'aes_256';
    securityIncidentManagement: 'automated';
  };

  // NIST Cybersecurity Framework
  nistCSF: {
    identify: 'asset_inventory_complete';
    protect: 'access_controls_implemented';
    detect: 'continuous_monitoring';
    respond: 'incident_response_plan';
    recover: 'business_continuity_plan';
  };

  // 製造業特有要件
  manufacturingSpecific: {
    operationalTechnologySecurity: 'segregated';
    intellectualPropertyProtection: 'classified';
    supplychainSecurity: 'verified';
    industrialControlSystemSecurity: 'monitored';
  };
}
```

### 9.2 定期監査要件

```typescript
interface AuditRequirements {
  // 内部監査
  internalAudit: {
    frequency: 'quarterly';
    scope: 'full_system';
    requirements: [
      'access_review',
      'privilege_verification',
      'policy_compliance',
      'log_retention_verification'
    ];
  };

  // 外部監査
  externalAudit: {
    frequency: 'annually';
    scope: 'security_controls';
    certifications: ['ISO 27001', 'SOC 2 Type II'];
  };

  // 監査証跡
  auditTrail: {
    completeness: 'guaranteed';
    integrity: 'cryptographically_protected';
    availability: 'five_years';
    searchability: 'full_text_indexed';
  };
}
```

## 10. 実装優先度・フェーズ計画

### Phase 2A: 基本認証・認可実装 (2週間)

- [ ] Auth0統合とOAuth2.0フロー実装
- [ ] 基本RBAC実装
- [ ] JWT トークン管理
- [ ] セッション管理基盤

### Phase 2B: セキュリティ強化 (2週間)

- [ ] MFA実装
- [ ] 高リスクコマンド認証強化
- [ ] 監査ログ基盤実装
- [ ] セキュリティ監視基盤

### Phase 2C: 監査・コンプライアンス (2週間)

- [ ] 5年間ログ保持システム
- [ ] コンプライアンスダッシュボード
- [ ] 外部API セキュリティ境界実装
- [ ] セキュリティテスト・検証

---

**文書作成**: Security Engineer
**作成日**: 2025-09-15
**バージョン**: 1.0
**次回レビュー**: Phase 2完了時
