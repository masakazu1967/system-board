# US-SM-006-010: ダッシュボードセキュリティ設計仕様書

**担当**: セキュリティエンジニア
**作成日**: 2025-09-30
**Issue**: #179 (US-SM-006-010: ダッシュボードセキュリティ設計)
**親Issue**: US-SM-006 (ダッシュボード表示)
**関連設計**:
- [セキュリティ分類別認可マトリクス設計仕様](./security-authorization-matrix.md)
- [セキュリティ実装仕様書](../../security/security-implementation-spec.md)
- [ダッシュボードデータベース設計仕様書](./US-SM-006-004-dashboard-database-design.md)

## 1. 設計概要

### 1.1 設計方針

本設計書は、US-SM-006（ダッシュボード表示）における情報漏洩防止を最優先としたセキュリティ統制を定義します。

**核心原則**:

- **情報漏洩防止最優先**: セキュリティ分類に基づく厳格なフィールドレベルアクセス制御
- **最小権限原則**: ユーザーロールに応じた必要最小限の情報開示
- **リアルタイム通信のセキュリティ**: WebSocket通信の暗号化と認証
- **監査証跡の完全性**: すべてのアクセスと操作を記録

### 1.2 脅威モデル

#### 1.2.1 想定される脅威

| 脅威ID | 脅威シナリオ | 影響度 | 対策優先度 |
|--------|------------|--------|-----------|
| **T-DASH-001** | 権限外セキュリティ情報の閲覧 | 高 | 最高 |
| **T-DASH-002** | リアルタイム通信の盗聴 | 高 | 最高 |
| **T-DASH-003** | 大量データエクスポートによる情報漏洩 | 高 | 高 |
| **T-DASH-004** | セッションハイジャック | 中 | 高 |
| **T-DASH-005** | 不正なフィルタリングによる権限昇格 | 高 | 最高 |
| **T-DASH-006** | クライアント側でのセキュリティ情報露出 | 中 | 高 |

#### 1.2.2 攻撃者モデル

**内部脅威**:
- **悪意のある内部者**: 正規アクセス権を持つが、権限外情報を不正取得
- **権限誤用**: 誤操作または意図的な権限乱用

**外部脅威**:
- **認証済み攻撃者**: 正規アカウントを侵害した攻撃者
- **中間者攻撃**: ネットワーク通信を盗聴する攻撃者

### 1.3 適用セキュリティ基準

- **ISO 27001**: A.9 (アクセス制御), A.12 (運用のセキュリティ), A.18 (コンプライアンス)
- **OWASP Top 10 2021**: A01 (アクセス制御の不備), A02 (暗号化の不備), A04 (安全でない設計)
- **製造業セキュリティ要件**: 情報漏洩防止最優先、職務分離の原則

## 2. ダッシュボードアクセス制御設計

### 2.1 アクセス制御アーキテクチャ

#### 2.1.1 多層防御アーキテクチャ

```typescript
/**
 * ダッシュボードアクセス制御の4層防御
 *
 * Layer 1: フロントエンド - UI要素の動的表示制御
 * Layer 2: API Gateway - リクエスト前認可チェック
 * Layer 3: アプリケーション層 - クエリハンドラーでの認可
 * Layer 4: データベース層 - Row-Level Security (RLS)
 */

// Layer 1: フロントエンド UI制御
export interface DashboardUIPermissions {
  canViewVulnerabilityDetails: boolean;    // 脆弱性詳細表示権限
  canViewSystemConfiguration: boolean;     // システム構成情報表示権限
  canViewSecurityMetrics: boolean;         // セキュリティメトリクス表示権限
  canViewAuditLogs: boolean;               // 監査ログ表示権限
  canExportData: boolean;                  // データエクスポート権限
  canViewRealTimeUpdates: boolean;         // リアルタイム更新表示権限
}

// Layer 2: API Gateway認可ガード
@Injectable()
export class DashboardAuthorizationGuard implements CanActivate {
  constructor(
    private readonly authService: DashboardAuthorizationService,
    private readonly auditLogger: SecurityAuditLogger
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const endpoint = request.route.path;

    // エンドポイント別認可チェック
    const authResult = await this.authService.authorizeEndpointAccess(
      user,
      endpoint
    );

    if (!authResult.isAllowed()) {
      await this.auditLogger.logUnauthorizedDashboardAccess({
        userId: user.id,
        endpoint,
        reason: authResult.getReason(),
        timestamp: new Date(),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });
    }

    return authResult.isAllowed();
  }
}

// Layer 3: クエリハンドラー認可
@QueryHandler(GetDashboardSystemsQuery)
export class GetDashboardSystemsHandler {
  constructor(
    private readonly authService: DashboardAuthorizationService,
    private readonly repository: DashboardSystemViewRepository,
    private readonly securityFilter: DashboardSecurityFilterService
  ) {}

  async execute(query: GetDashboardSystemsQuery): Promise<DashboardSystemDTO[]> {
    // 1. クエリ実行権限チェック
    const authResult = await this.authService.authorizeQueryExecution(
      query.userContext,
      'GetDashboardSystems'
    );

    if (!authResult.isAllowed()) {
      throw new UnauthorizedQueryExecutionError(authResult.getReason());
    }

    // 2. ユーザーロールに基づくデータ取得
    const systems = await this.repository.findAll({
      userRole: query.userContext.role,
      filters: query.filters
    });

    // 3. セキュリティフィルタリング適用
    return this.securityFilter.filterSystemsForUser(
      systems,
      query.userContext
    );
  }
}

// Layer 4: データベースRow-Level Security (RLS)
/**
 * PostgreSQL RLS Policy定義
 *
 * CREATE POLICY dashboard_system_view_select_policy
 * ON dashboard_system_view
 * FOR SELECT
 * USING (
 *   CASE
 *     -- SECURITY_OFFICERは全データアクセス可能
 *     WHEN current_setting('app.user_role', true) = 'SECURITY_OFFICER' THEN TRUE
 *
 *     -- ADMINISTRATORはCONFIDENTIAL以下にアクセス可能
 *     WHEN current_setting('app.user_role', true) = 'ADMINISTRATOR' THEN
 *       security_classification IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL')
 *
 *     -- OPERATORはINTERNAL以下にアクセス可能
 *     WHEN current_setting('app.user_role', true) = 'OPERATOR' THEN
 *       security_classification IN ('PUBLIC', 'INTERNAL')
 *
 *     -- GUESTはPUBLICのみアクセス可能
 *     WHEN current_setting('app.user_role', true) = 'GUEST' THEN
 *       security_classification = 'PUBLIC'
 *
 *     ELSE FALSE
 *   END
 * );
 */
```

### 2.2 ダッシュボード固有の認可マトリクス

#### 2.2.1 エンドポイント別認可マトリクス

| エンドポイント | GUEST | OPERATOR | ADMINISTRATOR | SECURITY_OFFICER | 備考 |
|--------------|-------|----------|---------------|------------------|------|
| **ダッシュボード表示** |||||||
| `GET /api/dashboard/systems` | ✓ | ✓ | ✓ | ✓ | 基本情報のみ |
| `GET /api/dashboard/systems/:id` | ✓ | ✓ | ✓ | ✓ | セキュリティ分類により制限 |
| `GET /api/dashboard/statistics` | ✓ | ✓ | ✓ | ✓ | 集約統計のみ |
| **詳細情報** |||||||
| `GET /api/dashboard/systems/:id/vulnerabilities` | ✗ | ✓ | ✓ | ✓ | 脆弱性詳細 |
| `GET /api/dashboard/systems/:id/configuration` | ✗ | ✓ | ✓ | ✓ | システム構成 |
| `GET /api/dashboard/systems/:id/security-metrics` | ✗ | ✗ | ✓ | ✓ | セキュリティメトリクス |
| `GET /api/dashboard/systems/:id/audit-logs` | ✗ | ✗ | ✗ | ✓ | 監査ログ |
| **データエクスポート** |||||||
| `POST /api/dashboard/export` | ✗ | ✗ | ✓ | ✓ | 承認必須 |
| **リアルタイム通信** |||||||
| `WS /api/dashboard/realtime` | ✓ | ✓ | ✓ | ✓ | 認証必須 |

#### 2.2.2 フィールドレベル認可マトリクス

```typescript
/**
 * ダッシュボードシステムビューのフィールドレベルアクセス制御
 */
export interface DashboardSystemFieldVisibility {
  // 基本情報（全ユーザー）
  basic: {
    systemId: boolean;
    systemName: boolean;
    systemType: boolean;
    systemStatus: boolean;
    criticality: boolean;
  };

  // 運用情報（OPERATOR以上）
  operational: {
    vulnerabilityCount: boolean;         // 脆弱性総数（数値のみ）
    hasEolWarnings: boolean;             // EOL警告フラグ
    openTaskCount: boolean;              // オープンタスク数
    totalPackages: boolean;              // 総パッケージ数
  };

  // 機密情報（ADMINISTRATOR以上）
  confidential: {
    highSeverityVulnerabilities: boolean;  // 高重要度脆弱性数
    criticalVulnerabilities: boolean;      // クリティカル脆弱性数
    maxCvssScore: boolean;                 // 最大CVSSスコア
    latestVulnerabilityDate: boolean;      // 最新脆弱性日時
    eolDaysRemaining: boolean;             // EOL残日数
    nearestEolDate: boolean;               // 最短EOL日付
    urgentTaskCount: boolean;              // 緊急タスク数
    overdueTaskCount: boolean;             // 期限切れタスク数
    vulnerablePackages: boolean;           // 脆弱性パッケージ数
  };

  // 極秘情報（SECURITY_OFFICER のみ）
  restricted: {
    securityClassification: boolean;       // セキュリティ分類
    lastEventAppliedAt: boolean;           // 最終イベント適用日時
    lastEventId: boolean;                  // 最終イベントID
  };
}

/**
 * フィールド可視性決定サービス
 */
@Injectable()
export class DashboardFieldVisibilityService {
  /**
   * ユーザーロールに基づくフィールド可視性を決定
   */
  determineVisibility(userRole: UserRole): DashboardSystemFieldVisibility {
    const visibility: DashboardSystemFieldVisibility = {
      basic: {
        systemId: true,
        systemName: true,
        systemType: true,
        systemStatus: true,
        criticality: true
      },
      operational: {
        vulnerabilityCount: false,
        hasEolWarnings: false,
        openTaskCount: false,
        totalPackages: false
      },
      confidential: {
        highSeverityVulnerabilities: false,
        criticalVulnerabilities: false,
        maxCvssScore: false,
        latestVulnerabilityDate: false,
        eolDaysRemaining: false,
        nearestEolDate: false,
        urgentTaskCount: false,
        overdueTaskCount: false,
        vulnerablePackages: false
      },
      restricted: {
        securityClassification: false,
        lastEventAppliedAt: false,
        lastEventId: false
      }
    };

    // ロール別権限設定
    switch (userRole) {
      case UserRole.SECURITY_OFFICER:
        // 全フィールドアクセス可能
        Object.keys(visibility).forEach(category => {
          Object.keys(visibility[category]).forEach(field => {
            visibility[category][field] = true;
          });
        });
        break;

      case UserRole.ADMINISTRATOR:
        // 機密情報まで アクセス可能
        Object.keys(visibility.operational).forEach(field => {
          visibility.operational[field] = true;
        });
        Object.keys(visibility.confidential).forEach(field => {
          visibility.confidential[field] = true;
        });
        break;

      case UserRole.OPERATOR:
        // 運用情報までアクセス可能
        Object.keys(visibility.operational).forEach(field => {
          visibility.operational[field] = true;
        });
        break;

      case UserRole.GUEST:
        // 基本情報のみアクセス可能（デフォルト設定のまま）
        break;
    }

    return visibility;
  }

  /**
   * フィールド可視性に基づくDTOフィルタリング
   */
  filterSystemDTO(
    system: DashboardSystemViewEntity,
    visibility: DashboardSystemFieldVisibility
  ): Partial<DashboardSystemDTO> {
    const filtered: any = {};

    // 基本情報
    if (visibility.basic.systemId) filtered.systemId = system.systemId;
    if (visibility.basic.systemName) filtered.systemName = system.systemName;
    if (visibility.basic.systemType) filtered.systemType = system.systemType;
    if (visibility.basic.systemStatus) filtered.systemStatus = system.systemStatus;
    if (visibility.basic.criticality) filtered.criticality = system.criticality;

    // 運用情報
    if (visibility.operational.vulnerabilityCount) {
      filtered.vulnerabilityCount = system.vulnerabilityCount;
    }
    if (visibility.operational.hasEolWarnings) {
      filtered.hasEolWarnings = system.hasEolWarnings;
    }
    if (visibility.operational.openTaskCount) {
      filtered.openTaskCount = system.openTaskCount;
    }
    if (visibility.operational.totalPackages) {
      filtered.totalPackages = system.totalPackages;
    }

    // 機密情報
    if (visibility.confidential.highSeverityVulnerabilities) {
      filtered.highSeverityVulnerabilities = system.highSeverityVulnerabilities;
    }
    if (visibility.confidential.criticalVulnerabilities) {
      filtered.criticalVulnerabilities = system.criticalVulnerabilities;
    }
    if (visibility.confidential.maxCvssScore) {
      filtered.maxCvssScore = system.maxCvssScore;
    }
    if (visibility.confidential.latestVulnerabilityDate) {
      filtered.latestVulnerabilityDate = system.latestVulnerabilityDate;
    }
    if (visibility.confidential.eolDaysRemaining) {
      filtered.eolDaysRemaining = system.eolDaysRemaining;
    }
    if (visibility.confidential.nearestEolDate) {
      filtered.nearestEolDate = system.nearestEolDate;
    }
    if (visibility.confidential.urgentTaskCount) {
      filtered.urgentTaskCount = system.urgentTaskCount;
    }
    if (visibility.confidential.overdueTaskCount) {
      filtered.overdueTaskCount = system.overdueTaskCount;
    }
    if (visibility.confidential.vulnerablePackages) {
      filtered.vulnerablePackages = system.vulnerablePackages;
    }

    // 極秘情報
    if (visibility.restricted.securityClassification) {
      filtered.securityClassification = system.securityClassification;
    }
    if (visibility.restricted.lastEventAppliedAt) {
      filtered.lastEventAppliedAt = system.lastEventAppliedAt;
    }
    if (visibility.restricted.lastEventId) {
      filtered.lastEventId = system.lastEventId;
    }

    return filtered;
  }
}
```

## 3. 機密情報表示の権限管理設計

### 3.1 セキュリティ分類に基づく表示制御

#### 3.1.1 セキュリティ分類マッピング

```typescript
/**
 * システムのセキュリティ分類とダッシュボード表示内容の対応
 */
export enum SecurityClassification {
  PUBLIC = 'PUBLIC',           // 公開情報
  INTERNAL = 'INTERNAL',       // 社内限定
  CONFIDENTIAL = 'CONFIDENTIAL', // 機密
  RESTRICTED = 'RESTRICTED'    // 極秘
}

/**
 * セキュリティ分類別表示ポリシー
 */
export interface SecurityClassificationDisplayPolicy {
  classification: SecurityClassification;
  displayName: string;
  allowedRoles: UserRole[];
  visibleFields: string[];
  maskingRules: MaskingRule[];
  auditLevel: AuditLevel;
}

export const DASHBOARD_SECURITY_DISPLAY_POLICIES: SecurityClassificationDisplayPolicy[] = [
  {
    classification: SecurityClassification.PUBLIC,
    displayName: '公開',
    allowedRoles: [
      UserRole.GUEST,
      UserRole.OPERATOR,
      UserRole.ADMINISTRATOR,
      UserRole.SECURITY_OFFICER
    ],
    visibleFields: [
      'systemId',
      'systemName',
      'systemType',
      'systemStatus',
      'criticality'
    ],
    maskingRules: [],
    auditLevel: AuditLevel.MINIMAL
  },
  {
    classification: SecurityClassification.INTERNAL,
    displayName: '社内限定',
    allowedRoles: [
      UserRole.OPERATOR,
      UserRole.ADMINISTRATOR,
      UserRole.SECURITY_OFFICER
    ],
    visibleFields: [
      'systemId',
      'systemName',
      'systemType',
      'systemStatus',
      'criticality',
      'vulnerabilityCount',
      'hasEolWarnings',
      'openTaskCount',
      'totalPackages'
    ],
    maskingRules: [
      {
        field: 'vulnerabilityCount',
        rule: 'show_range_only', // 例: "1-5件" のように範囲表示
        condition: (userRole) => userRole === UserRole.OPERATOR
      }
    ],
    auditLevel: AuditLevel.STANDARD
  },
  {
    classification: SecurityClassification.CONFIDENTIAL,
    displayName: '機密',
    allowedRoles: [
      UserRole.ADMINISTRATOR,
      UserRole.SECURITY_OFFICER
    ],
    visibleFields: [
      // すべてのINTERNALフィールド +
      'highSeverityVulnerabilities',
      'criticalVulnerabilities',
      'maxCvssScore',
      'latestVulnerabilityDate',
      'eolDaysRemaining',
      'nearestEolDate',
      'urgentTaskCount',
      'overdueTaskCount',
      'vulnerablePackages'
    ],
    maskingRules: [],
    auditLevel: AuditLevel.DETAILED
  },
  {
    classification: SecurityClassification.RESTRICTED,
    displayName: '極秘',
    allowedRoles: [
      UserRole.SECURITY_OFFICER
    ],
    visibleFields: [
      // すべてのフィールド
      '*'
    ],
    maskingRules: [],
    auditLevel: AuditLevel.COMPREHENSIVE
  }
];

/**
 * マスキングルール定義
 */
export interface MaskingRule {
  field: string;
  rule: 'show_range_only' | 'show_flag_only' | 'mask_completely' | 'redact_partially';
  condition?: (userRole: UserRole) => boolean;
}

export enum AuditLevel {
  MINIMAL = 'MINIMAL',           // 最小限の監査
  STANDARD = 'STANDARD',         // 標準監査
  DETAILED = 'DETAILED',         // 詳細監査
  COMPREHENSIVE = 'COMPREHENSIVE' // 包括的監査
}
```

### 3.2 動的マスキングサービス

```typescript
/**
 * ダッシュボードデータ動的マスキングサービス
 */
@Injectable()
export class DashboardDataMaskingService {
  /**
   * セキュリティ分類とユーザーロールに基づく動的マスキング
   */
  applyMasking(
    data: DashboardSystemDTO,
    systemClassification: SecurityClassification,
    userRole: UserRole
  ): DashboardSystemDTO {
    const policy = this.getDisplayPolicy(systemClassification);

    // アクセス権限チェック
    if (!policy.allowedRoles.includes(userRole)) {
      throw new UnauthorizedAccessError(
        `ユーザーロール ${userRole} はセキュリティ分類 ${systemClassification} のデータにアクセスできません`
      );
    }

    // マスキングルール適用
    const masked = { ...data };

    policy.maskingRules.forEach(rule => {
      if (rule.condition && !rule.condition(userRole)) {
        return;
      }

      switch (rule.rule) {
        case 'show_range_only':
          masked[rule.field] = this.convertToRange(data[rule.field]);
          break;

        case 'show_flag_only':
          masked[rule.field] = data[rule.field] > 0;
          break;

        case 'mask_completely':
          masked[rule.field] = '***MASKED***';
          break;

        case 'redact_partially':
          masked[rule.field] = this.redactPartially(data[rule.field]);
          break;
      }
    });

    return masked;
  }

  /**
   * 数値を範囲表示に変換
   * 例: 3 -> "1-5件"
   */
  private convertToRange(value: number): string {
    if (value === 0) return '0件';
    if (value <= 5) return '1-5件';
    if (value <= 10) return '6-10件';
    if (value <= 20) return '11-20件';
    return '21件以上';
  }

  /**
   * 部分的なマスキング
   */
  private redactPartially(value: any): string {
    if (typeof value === 'string') {
      const length = value.length;
      if (length <= 4) return '****';
      return value.substring(0, 2) + '****' + value.substring(length - 2);
    }
    return '***';
  }

  private getDisplayPolicy(
    classification: SecurityClassification
  ): SecurityClassificationDisplayPolicy {
    return DASHBOARD_SECURITY_DISPLAY_POLICIES.find(
      p => p.classification === classification
    )!;
  }
}
```

### 3.3 クライアント側セキュリティ制御

```typescript
/**
 * React フロントエンド用セキュリティフック
 */
export const useDashboardSecurity = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<DashboardUIPermissions | null>(null);

  useEffect(() => {
    // サーバーから権限情報を取得
    fetchDashboardPermissions(user.role).then(setPermissions);
  }, [user.role]);

  /**
   * フィールド表示権限チェック
   */
  const canViewField = useCallback((
    fieldName: keyof DashboardSystemDTO
  ): boolean => {
    if (!permissions) return false;

    // セキュリティ分類別のフィールド可視性チェック
    const fieldCategory = getFieldCategory(fieldName);

    switch (fieldCategory) {
      case 'basic':
        return true; // 基本情報は常に表示可能
      case 'operational':
        return permissions.canViewSystemConfiguration;
      case 'confidential':
        return permissions.canViewSecurityMetrics;
      case 'restricted':
        return permissions.canViewAuditLogs;
      default:
        return false;
    }
  }, [permissions]);

  /**
   * セキュリティ警告の表示判定
   */
  const shouldShowSecurityWarning = useCallback((
    system: DashboardSystemDTO
  ): boolean => {
    // SECURITY_OFFICERとADMINISTRATORのみ警告表示
    if (!permissions?.canViewSecurityMetrics) {
      return false;
    }

    return (
      system.criticalVulnerabilities > 0 ||
      (system.eolDaysRemaining !== null && system.eolDaysRemaining <= 30)
    );
  }, [permissions]);

  return {
    permissions,
    canViewField,
    shouldShowSecurityWarning
  };
};

/**
 * セキュリティ情報表示コンポーネント（条件付きレンダリング）
 */
export const SecureField: React.FC<{
  fieldName: keyof DashboardSystemDTO;
  value: any;
  maskingRule?: MaskingRule;
}> = ({ fieldName, value, maskingRule }) => {
  const { canViewField } = useDashboardSecurity();

  // 表示権限がない場合は何も表示しない
  if (!canViewField(fieldName)) {
    return null;
  }

  // マスキングルールがある場合は適用
  if (maskingRule) {
    return <span>{applyClientMasking(value, maskingRule)}</span>;
  }

  return <span>{value}</span>;
};
```

## 4. リアルタイム通信のセキュリティ検証

### 4.1 WebSocket接続のセキュリティ

#### 4.1.1 WebSocket認証・認可フロー

```typescript
/**
 * WebSocketゲートウェイ - セキュリティ統合
 */
@WebSocketGateway({
  namespace: 'dashboard',
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
    credentials: true
  },
  transports: ['websocket'], // WebSocketのみ（ポーリング無効化）
})
@UseGuards(WsAuthGuard, WsRoleGuard)
export class DashboardRealtimeGateway {
  constructor(
    private readonly authService: DashboardAuthorizationService,
    private readonly auditLogger: SecurityAuditLogger,
    private readonly rateLimiter: WebSocketRateLimiterService
  ) {}

  /**
   * WebSocket接続時の認証・認可
   */
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, AuthenticatedWebSocketClient>();

  async handleConnection(client: Socket) {
    try {
      // 1. JWT認証
      const token = this.extractToken(client);
      const user = await this.authService.validateToken(token);

      // 2. レート制限チェック
      const rateLimitResult = await this.rateLimiter.checkLimit(
        user.id,
        'websocket_connection'
      );

      if (!rateLimitResult.allowed) {
        client.emit('error', {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'WebSocket接続レート制限を超過しました'
        });
        client.disconnect();
        return;
      }

      // 3. 接続認可チェック
      const authResult = await this.authService.authorizeWebSocketConnection(user);

      if (!authResult.isAllowed()) {
        await this.auditLogger.logUnauthorizedWebSocketConnection({
          userId: user.id,
          reason: authResult.getReason(),
          ipAddress: client.handshake.address,
          timestamp: new Date()
        });

        client.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'WebSocket接続が拒否されました'
        });
        client.disconnect();
        return;
      }

      // 4. クライアント登録
      this.connectedClients.set(client.id, {
        socket: client,
        user,
        permissions: await this.authService.getDashboardPermissions(user.role),
        connectedAt: new Date()
      });

      // 5. 接続成功監査ログ
      await this.auditLogger.logWebSocketConnection({
        userId: user.id,
        clientId: client.id,
        ipAddress: client.handshake.address,
        timestamp: new Date()
      });

      // 6. 初期データ送信（ユーザー権限に応じて）
      await this.sendInitialDashboardData(client, user);

    } catch (error) {
      this.logger.error('WebSocket connection failed', error);
      client.disconnect();
    }
  }

  /**
   * WebSocket切断時の処理
   */
  async handleDisconnect(client: Socket) {
    const clientInfo = this.connectedClients.get(client.id);

    if (clientInfo) {
      // 切断監査ログ
      await this.auditLogger.logWebSocketDisconnection({
        userId: clientInfo.user.id,
        clientId: client.id,
        duration: Date.now() - clientInfo.connectedAt.getTime(),
        timestamp: new Date()
      });

      this.connectedClients.delete(client.id);
    }
  }

  /**
   * ダッシュボード更新通知（権限に応じたフィルタリング）
   */
  @SubscribeMessage('dashboard_update')
  async handleDashboardUpdate(
    @MessageBody() data: DashboardUpdatePayload,
    @ConnectedSocket() client: Socket
  ) {
    const clientInfo = this.connectedClients.get(client.id);

    if (!clientInfo) {
      return;
    }

    // 更新データに対するアクセス権限チェック
    const authResult = await this.authService.authorizeDataAccess(
      clientInfo.user,
      data.systemId,
      data.securityClassification
    );

    if (!authResult.isAllowed()) {
      // 権限外データへのアクセス試行を監査ログに記録
      await this.auditLogger.logUnauthorizedDataAccess({
        userId: clientInfo.user.id,
        systemId: data.systemId,
        classification: data.securityClassification,
        timestamp: new Date()
      });
      return;
    }

    // ユーザー権限に応じたフィールドフィルタリング
    const filteredData = await this.filterUpdateDataForUser(
      data,
      clientInfo.user,
      clientInfo.permissions
    );

    // フィルタリング済みデータを送信
    client.emit('dashboard_update', filteredData);
  }

  /**
   * トークン抽出
   */
  private extractToken(client: Socket): string {
    const token = client.handshake.auth.token ||
                  client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('認証トークンが見つかりません');
    }

    return token;
  }

  /**
   * ユーザー権限に基づく初期データ送信
   */
  private async sendInitialDashboardData(client: Socket, user: User) {
    const permissions = await this.authService.getDashboardPermissions(user.role);

    // ユーザーがアクセス可能なシステムのみ取得
    const systems = await this.getDashboardSystemsForUser(user, permissions);

    client.emit('initial_data', {
      systems,
      permissions,
      timestamp: new Date()
    });
  }

  /**
   * 更新データのフィルタリング
   */
  private async filterUpdateDataForUser(
    data: DashboardUpdatePayload,
    user: User,
    permissions: DashboardUIPermissions
  ): Promise<Partial<DashboardUpdatePayload>> {
    const fieldVisibility = await this.authService.getFieldVisibility(user.role);

    // フィールド可視性に基づいてデータをフィルタリング
    const filtered: any = {
      systemId: data.systemId,
      timestamp: data.timestamp
    };

    Object.keys(data).forEach(key => {
      if (this.isFieldVisible(key, fieldVisibility)) {
        filtered[key] = data[key];
      }
    });

    return filtered;
  }

  private isFieldVisible(
    fieldName: string,
    visibility: DashboardSystemFieldVisibility
  ): boolean {
    // フィールド可視性チェックロジック
    for (const category of Object.keys(visibility)) {
      if (visibility[category][fieldName] === true) {
        return true;
      }
    }
    return false;
  }
}

/**
 * WebSocket認証ガード
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const token = this.extractToken(client);

    try {
      const payload = await this.jwtService.verifyAsync(token);
      client.data.user = payload;
      return true;
    } catch {
      return false;
    }
  }

  private extractToken(client: Socket): string {
    return client.handshake.auth.token ||
           client.handshake.headers.authorization?.replace('Bearer ', '') ||
           '';
  }
}

/**
 * WebSocketロールガード
 */
@Injectable()
export class WsRoleGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const user = client.data.user;

    if (!user || !user.role) {
      return false;
    }

    // 最低限OPERATORロールが必要
    const allowedRoles = [
      UserRole.OPERATOR,
      UserRole.ADMINISTRATOR,
      UserRole.SECURITY_OFFICER
    ];

    return allowedRoles.includes(user.role);
  }
}
```

#### 4.1.2 WebSocketレート制限

```typescript
/**
 * WebSocket接続・メッセージのレート制限
 */
@Injectable()
export class WebSocketRateLimiterService {
  private readonly limits = {
    websocket_connection: {
      max: 5,           // 最大5接続
      window: 60000     // 1分間
    },
    dashboard_update_subscription: {
      max: 100,         // 最大100メッセージ
      window: 60000     // 1分間
    }
  };

  constructor(private readonly redis: RedisService) {}

  /**
   * レート制限チェック
   */
  async checkLimit(
    userId: string,
    action: keyof typeof this.limits
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const limit = this.limits[action];
    const key = `rate_limit:${action}:${userId}`;

    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, Math.ceil(limit.window / 1000));
    }

    const ttl = await this.redis.ttl(key);
    const resetAt = new Date(Date.now() + ttl * 1000);

    return {
      allowed: current <= limit.max,
      remaining: Math.max(0, limit.max - current),
      resetAt
    };
  }
}
```

### 4.2 WebSocket通信の暗号化

#### 4.2.1 TLS 1.3設定

```typescript
/**
 * WebSocket Secure (WSS) 設定
 */
export const webSocketSSLConfig = {
  // TLS 1.3必須
  minVersion: 'TLSv1.3',

  // 強力な暗号スイートのみ許可
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256'
  ].join(':'),

  // 証明書設定
  cert: fs.readFileSync('/etc/ssl/certs/dashboard.crt'),
  key: fs.readFileSync('/etc/ssl/private/dashboard.key'),

  // セキュリティオプション
  honorCipherOrder: true,
  secureOptions: constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv1_1,

  // クライアント証明書検証（オプション）
  requestCert: false,
  rejectUnauthorized: true
};
```

## 5. 情報漏洩防止対策の設計

### 5.1 データエクスポート制御

#### 5.1.1 エクスポート認可・監査

```typescript
/**
 * ダッシュボードデータエクスポートサービス
 */
@Injectable()
export class DashboardExportService {
  constructor(
    private readonly authService: DashboardAuthorizationService,
    private readonly auditLogger: SecurityAuditLogger,
    private readonly approvalService: DataExportApprovalService,
    private readonly encryptionService: DataEncryptionService
  ) {}

  /**
   * データエクスポート要求
   */
  async requestExport(
    exportRequest: DashboardExportRequest,
    user: User
  ): Promise<ExportRequestResult> {
    // 1. エクスポート権限チェック
    const authResult = await this.authService.authorizeExport(
      user,
      exportRequest.dataScope
    );

    if (!authResult.isAllowed()) {
      await this.auditLogger.logUnauthorizedExportAttempt({
        userId: user.id,
        dataScope: exportRequest.dataScope,
        reason: authResult.getReason(),
        timestamp: new Date()
      });

      throw new UnauthorizedExportError(authResult.getReason());
    }

    // 2. データ量チェック（大量エクスポート検知）
    const dataVolumeCheck = await this.checkDataVolume(exportRequest);

    if (dataVolumeCheck.exceedsThreshold) {
      // 大量エクスポートの場合は承認必須
      return this.requestApprovalForLargeExport(exportRequest, user, dataVolumeCheck);
    }

    // 3. 通常エクスポート実行
    return this.executeExport(exportRequest, user);
  }

  /**
   * 大量エクスポートの承認要求
   */
  private async requestApprovalForLargeExport(
    exportRequest: DashboardExportRequest,
    user: User,
    volumeCheck: DataVolumeCheck
  ): Promise<ExportRequestResult> {
    // 承認ワークフロー開始
    const approvalRequest = await this.approvalService.createApprovalRequest({
      requestedBy: user.id,
      exportScope: exportRequest.dataScope,
      estimatedRecords: volumeCheck.estimatedRecords,
      estimatedSizeBytes: volumeCheck.estimatedSizeBytes,
      businessJustification: exportRequest.justification,
      requiredApprovers: this.determineRequiredApprovers(user.role)
    });

    // 承認待ち監査ログ
    await this.auditLogger.logExportApprovalRequested({
      userId: user.id,
      approvalRequestId: approvalRequest.id,
      dataVolume: volumeCheck,
      timestamp: new Date()
    });

    return {
      status: 'PENDING_APPROVAL',
      approvalRequestId: approvalRequest.id,
      message: '大量データエクスポートには承認が必要です'
    };
  }

  /**
   * エクスポート実行
   */
  private async executeExport(
    exportRequest: DashboardExportRequest,
    user: User
  ): Promise<ExportRequestResult> {
    // 1. データ取得（ユーザー権限に応じてフィルタリング）
    const data = await this.fetchDataForExport(exportRequest, user);

    // 2. 機密情報マスキング
    const maskedData = await this.applyExportMasking(data, user.role);

    // 3. エクスポートファイル生成
    const exportFile = await this.generateExportFile(
      maskedData,
      exportRequest.format
    );

    // 4. ファイル暗号化（機密データの場合）
    const encryptedFile = await this.encryptionService.encryptFile(
      exportFile,
      { algorithm: 'AES-256-GCM' }
    );

    // 5. エクスポート成功監査ログ
    await this.auditLogger.logSuccessfulExport({
      userId: user.id,
      dataScope: exportRequest.dataScope,
      recordCount: data.length,
      fileSize: encryptedFile.size,
      fileHash: encryptedFile.hash,
      timestamp: new Date()
    });

    return {
      status: 'SUCCESS',
      downloadUrl: this.generateSecureDownloadUrl(encryptedFile),
      expiresAt: new Date(Date.now() + 3600000), // 1時間で失効
      fileHash: encryptedFile.hash
    };
  }

  /**
   * データ量チェック
   */
  private async checkDataVolume(
    exportRequest: DashboardExportRequest
  ): Promise<DataVolumeCheck> {
    const LARGE_EXPORT_THRESHOLD = 1000; // レコード数

    const estimatedRecords = await this.estimateRecordCount(exportRequest);

    return {
      estimatedRecords,
      estimatedSizeBytes: estimatedRecords * 1024, // 概算
      exceedsThreshold: estimatedRecords > LARGE_EXPORT_THRESHOLD
    };
  }

  /**
   * 必要承認者の決定
   */
  private determineRequiredApprovers(userRole: UserRole): string[] {
    switch (userRole) {
      case UserRole.ADMINISTRATOR:
        return ['SECURITY_OFFICER']; // セキュリティ責任者の承認必須
      case UserRole.OPERATOR:
        return ['ADMINISTRATOR', 'SECURITY_OFFICER']; // 管理者またはセキュリティ責任者
      default:
        return ['ADMINISTRATOR', 'SECURITY_OFFICER'];
    }
  }

  /**
   * エクスポート用マスキング
   */
  private async applyExportMasking(
    data: any[],
    userRole: UserRole
  ): Promise<any[]> {
    const fieldVisibility = await this.authService.getFieldVisibility(userRole);

    return data.map(record => {
      const masked = {};

      Object.keys(record).forEach(key => {
        if (this.isFieldVisibleForExport(key, fieldVisibility)) {
          masked[key] = record[key];
        }
      });

      return masked;
    });
  }

  private isFieldVisibleForExport(
    fieldName: string,
    visibility: DashboardSystemFieldVisibility
  ): boolean {
    // エクスポート時のフィールド可視性判定
    // （表示権限と同じロジックを使用）
    return this.isFieldVisible(fieldName, visibility);
  }

  /**
   * セキュアダウンロードURL生成
   */
  private generateSecureDownloadUrl(file: EncryptedFile): string {
    // 署名付き一時URLを生成
    const token = this.generateSecureToken(file.id);
    return `/api/dashboard/export/download/${file.id}?token=${token}`;
  }

  private generateSecureToken(fileId: string): string {
    // HMAC-SHA256による署名付きトークン生成
    const hmac = createHmac('sha256', process.env.EXPORT_TOKEN_SECRET!);
    const expiry = Date.now() + 3600000; // 1時間
    hmac.update(`${fileId}:${expiry}`);
    return `${expiry}.${hmac.digest('hex')}`;
  }
}

/**
 * エクスポート要求型定義
 */
export interface DashboardExportRequest {
  dataScope: {
    systemIds?: string[];
    filters?: DashboardFilterCriteria;
    includeFields: string[];
  };
  format: 'CSV' | 'JSON' | 'XLSX';
  justification: string; // 業務上の正当化理由
}

export interface ExportRequestResult {
  status: 'SUCCESS' | 'PENDING_APPROVAL' | 'DENIED';
  downloadUrl?: string;
  approvalRequestId?: string;
  expiresAt?: Date;
  fileHash?: string;
  message?: string;
}

export interface DataVolumeCheck {
  estimatedRecords: number;
  estimatedSizeBytes: number;
  exceedsThreshold: boolean;
}
```

### 5.2 異常アクセスパターン検知

```typescript
/**
 * ダッシュボード異常アクセス検知サービス
 */
@Injectable()
export class DashboardAnomalyDetectionService {
  constructor(
    private readonly redis: RedisService,
    private readonly auditLogger: SecurityAuditLogger,
    private readonly alertService: SecurityAlertService
  ) {}

  /**
   * アクセスパターン分析
   */
  async analyzeAccessPattern(
    userId: string,
    action: DashboardAction,
    metadata: AccessMetadata
  ): Promise<AnomalyDetectionResult> {
    // 1. 短時間での大量アクセス検知
    const rapidAccessCheck = await this.checkRapidAccess(userId);

    // 2. 異常な時間帯のアクセス検知
    const timeAnomalyCheck = this.checkTimeAnomaly(metadata.timestamp);

    // 3. 通常と異なる地理的位置からのアクセス検知
    const locationAnomalyCheck = await this.checkLocationAnomaly(
      userId,
      metadata.ipAddress
    );

    // 4. 権限ぎりぎりのアクセスパターン検知
    const privilegeEscalationCheck = await this.checkPrivilegeEscalation(
      userId,
      action
    );

    // 異常検知結果の統合
    const anomalies: AnomalyType[] = [];

    if (rapidAccessCheck.isAnomalous) {
      anomalies.push({
        type: 'RAPID_ACCESS',
        severity: 'HIGH',
        details: rapidAccessCheck.details
      });
    }

    if (timeAnomalyCheck.isAnomalous) {
      anomalies.push({
        type: 'TIME_ANOMALY',
        severity: 'MEDIUM',
        details: timeAnomalyCheck.details
      });
    }

    if (locationAnomalyCheck.isAnomalous) {
      anomalies.push({
        type: 'LOCATION_ANOMALY',
        severity: 'HIGH',
        details: locationAnomalyCheck.details
      });
    }

    if (privilegeEscalationCheck.isAnomalous) {
      anomalies.push({
        type: 'PRIVILEGE_ESCALATION_ATTEMPT',
        severity: 'CRITICAL',
        details: privilegeEscalationCheck.details
      });
    }

    // 異常検知時の対応
    if (anomalies.length > 0) {
      await this.handleAnomalies(userId, action, anomalies, metadata);
    }

    return {
      isAnomalous: anomalies.length > 0,
      anomalies,
      riskScore: this.calculateRiskScore(anomalies)
    };
  }

  /**
   * 短時間での大量アクセス検知
   */
  private async checkRapidAccess(userId: string): Promise<AnomalyCheck> {
    const key = `access_count:dashboard:${userId}`;
    const timeWindow = 60; // 1分間
    const threshold = 100;  // 100リクエスト/分

    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, timeWindow);
    }

    return {
      isAnomalous: count > threshold,
      details: {
        accessCount: count,
        threshold,
        timeWindow
      }
    };
  }

  /**
   * 異常な時間帯のアクセス検知
   */
  private checkTimeAnomaly(timestamp: Date): AnomalyCheck {
    const hour = timestamp.getHours();
    const day = timestamp.getDay();

    // 深夜帯（22時〜6時）または週末のアクセスを検知
    const isOutsideBusinessHours =
      hour < 6 || hour >= 22 || day === 0 || day === 6;

    return {
      isAnomalous: isOutsideBusinessHours,
      details: {
        hour,
        day,
        type: 'outside_business_hours'
      }
    };
  }

  /**
   * 地理的位置異常検知
   */
  private async checkLocationAnomaly(
    userId: string,
    ipAddress: string
  ): Promise<AnomalyCheck> {
    // 過去のアクセス元IPアドレスを取得
    const recentIPs = await this.redis.smembers(`user_ips:${userId}`);

    // 新規IPアドレスからのアクセス
    const isNewIP = !recentIPs.includes(ipAddress);

    if (isNewIP) {
      // 新規IPを記録（最大10件保持）
      await this.redis.sadd(`user_ips:${userId}`, ipAddress);
      await this.redis.expire(`user_ips:${userId}`, 2592000); // 30日間保持
    }

    // GeoIP lookup（簡易実装）
    const isJapanIP = await this.isJapaneseIP(ipAddress);

    return {
      isAnomalous: isNewIP && !isJapanIP,
      details: {
        ipAddress,
        isNewIP,
        isJapanIP,
        recentIPCount: recentIPs.length
      }
    };
  }

  /**
   * 権限昇格試行検知
   */
  private async checkPrivilegeEscalation(
    userId: string,
    action: DashboardAction
  ): Promise<AnomalyCheck> {
    // 権限ぎりぎりのアクセスパターンを検知
    // 例: 短時間に複数のセキュリティ分類境界アクセス

    const key = `privilege_access:${userId}`;
    const recentAccesses = await this.redis.lrange(key, 0, 9); // 直近10件

    // 高権限アクションのカウント
    const highPrivilegeCount = recentAccesses.filter(
      a => JSON.parse(a).requiresHighPrivilege
    ).length;

    await this.redis.lpush(
      key,
      JSON.stringify({
        action: action.type,
        requiresHighPrivilege: action.requiresHighPrivilege,
        timestamp: Date.now()
      })
    );
    await this.redis.ltrim(key, 0, 9); // 最新10件のみ保持
    await this.redis.expire(key, 3600); // 1時間保持

    return {
      isAnomalous: highPrivilegeCount >= 7, // 10件中7件以上が高権限
      details: {
        highPrivilegeAccessCount: highPrivilegeCount,
        totalRecentAccess: recentAccesses.length
      }
    };
  }

  /**
   * 異常検知時の処理
   */
  private async handleAnomalies(
    userId: string,
    action: DashboardAction,
    anomalies: AnomalyType[],
    metadata: AccessMetadata
  ): Promise<void> {
    // 1. セキュリティ監査ログ記録
    await this.auditLogger.logAnomalousAccess({
      userId,
      action: action.type,
      anomalies,
      metadata,
      timestamp: new Date()
    });

    // 2. リスクスコアに応じた対応
    const riskScore = this.calculateRiskScore(anomalies);

    if (riskScore >= 80) {
      // 高リスク: セッション無効化 + セキュリティチーム通知
      await this.alertService.sendCriticalAlert({
        type: 'HIGH_RISK_ACCESS_DETECTED',
        userId,
        anomalies,
        riskScore,
        recommendedAction: 'IMMEDIATE_SESSION_TERMINATION'
      });

      // セッション無効化（実装は認証サービス側）
      // await this.authService.invalidateUserSessions(userId);

    } else if (riskScore >= 50) {
      // 中リスク: セキュリティチーム通知
      await this.alertService.sendAlert({
        type: 'SUSPICIOUS_ACCESS_DETECTED',
        userId,
        anomalies,
        riskScore,
        recommendedAction: 'MONITOR_CLOSELY'
      });

    } else {
      // 低リスク: 監査ログのみ
      this.logger.warn('Low-risk anomaly detected', { userId, anomalies });
    }
  }

  /**
   * リスクスコア計算
   */
  private calculateRiskScore(anomalies: AnomalyType[]): number {
    const weights = {
      CRITICAL: 40,
      HIGH: 25,
      MEDIUM: 15,
      LOW: 5
    };

    return anomalies.reduce((score, anomaly) => {
      return score + weights[anomaly.severity];
    }, 0);
  }

  /**
   * 日本国内IPアドレスチェック（簡易実装）
   */
  private async isJapaneseIP(ipAddress: string): Promise<boolean> {
    // GeoIP lookup実装
    // 実際の実装では MaxMind GeoIP2 などのサービスを使用
    return true; // プレースホルダー
  }
}

/**
 * 型定義
 */
export interface AnomalyDetectionResult {
  isAnomalous: boolean;
  anomalies: AnomalyType[];
  riskScore: number;
}

export interface AnomalyCheck {
  isAnomalous: boolean;
  details: Record<string, any>;
}

export interface AnomalyType {
  type: 'RAPID_ACCESS' | 'TIME_ANOMALY' | 'LOCATION_ANOMALY' | 'PRIVILEGE_ESCALATION_ATTEMPT';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  details: Record<string, any>;
}

export interface DashboardAction {
  type: string;
  requiresHighPrivilege: boolean;
}

export interface AccessMetadata {
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
}
```

## 6. OWASP Top 10 準拠チェック

### 6.1 OWASP Top 10 2021 対策マッピング

| OWASP カテゴリ | 対策内容 | 実装箇所 | 検証方法 |
|---------------|---------|---------|---------|
| **A01: アクセス制御の不備** | 4層防御アーキテクチャ、RLS、フィールドレベル認可 | `DashboardAuthorizationGuard`, `GetDashboardSystemsHandler`, PostgreSQL RLS | ユニットテスト + 侵入テスト |
| **A02: 暗号化の失敗** | TLS 1.3、AES-256-GCM、エンドツーエンド暗号化 | `webSocketSSLConfig`, `DataEncryptionService` | SSL Labs テスト + 暗号化検証 |
| **A03: インジェクション** | パラメータ化クエリ、ORM使用、入力バリデーション | TypeORM、Zod バリデーション | 自動SQLインジェクションテスト |
| **A04: 安全でない設計** | 脅威モデリング、セキュリティ設計レビュー | 本設計書全体 | アーキテクチャレビュー |
| **A05: セキュリティ設定ミス** | セキュアデフォルト、最小権限原則 | 環境変数管理、RBAC設定 | 設定監査 + 脆弱性スキャン |
| **A06: 脆弱で古いコンポーネント** | 依存関係自動更新、SCA | Dependabot、Snyk | 定期脆弱性スキャン |
| **A07: 識別と認証の失敗** | JWT認証、MFA、セッション管理 | Auth0統合、`WsAuthGuard` | 認証テスト |
| **A08: ソフトウェアとデータの整合性** | イベントソーシング、監査ログ | Kurrent DB、監査ログ基盤 | 整合性検証テスト |
| **A09: セキュリティログと監視の失敗** | 包括的監査ログ、異常検知 | `SecurityAuditLogger`, `AnomalyDetectionService` | ログレビュー + SIEM統合 |
| **A10: サーバーサイドリクエストフォージェリ(SSRF)** | 外部リクエスト制限、URL検証 | API Gateway設定 | SSRFテスト |

### 6.2 セキュリティテスト要件

#### 6.2.1 必須テスト項目

```typescript
/**
 * ダッシュボードセキュリティテストスイート
 */
describe('Dashboard Security Tests', () => {
  describe('Access Control Tests', () => {
    it('should deny GUEST access to confidential fields', async () => {
      const guestUser = createMockUser(UserRole.GUEST);
      const system = createMockSystem(SecurityClassification.CONFIDENTIAL);

      await expect(
        dashboardService.getSystemDetails(system.id, guestUser)
      ).rejects.toThrow(UnauthorizedAccessError);
    });

    it('should filter fields based on user role', async () => {
      const operatorUser = createMockUser(UserRole.OPERATOR);
      const system = createMockSystem(SecurityClassification.INTERNAL);

      const result = await dashboardService.getSystemDetails(system.id, operatorUser);

      expect(result).toHaveProperty('vulnerabilityCount');
      expect(result).not.toHaveProperty('maxCvssScore'); // ADMINISTRATOR以上のみ
    });

    it('should enforce Row-Level Security', async () => {
      const operatorUser = createMockUser(UserRole.OPERATOR);

      const systems = await dashboardRepository.findAll({
        userRole: operatorUser.role
      });

      // RESTRICTEDシステムが含まれていないことを確認
      systems.forEach(system => {
        expect(system.securityClassification).not.toBe(
          SecurityClassification.RESTRICTED
        );
      });
    });
  });

  describe('WebSocket Security Tests', () => {
    it('should reject WebSocket connection without valid token', async () => {
      const client = createMockSocketClient({ token: 'invalid' });

      await expect(
        webSocketGateway.handleConnection(client)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should disconnect client on rate limit exceeded', async () => {
      const user = createMockUser(UserRole.OPERATOR);
      const client = createMockSocketClient({ user });

      // 101回の接続試行（制限: 100回/分）
      for (let i = 0; i < 101; i++) {
        await webSocketGateway.handleConnection(client);
      }

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should filter WebSocket updates based on user permissions', async () => {
      const operatorUser = createMockUser(UserRole.OPERATOR);
      const client = createAuthenticatedSocketClient(operatorUser);

      const update = createMockDashboardUpdate({
        systemId: 'sys-123',
        maxCvssScore: 9.8, // 機密情報
        vulnerabilityCount: 5
      });

      await webSocketGateway.handleDashboardUpdate(update, client);

      const emittedData = client.emit.mock.calls[0][1];
      expect(emittedData).toHaveProperty('vulnerabilityCount');
      expect(emittedData).not.toHaveProperty('maxCvssScore'); // フィルタリング済み
    });
  });

  describe('Data Export Security Tests', () => {
    it('should require approval for large data exports', async () => {
      const adminUser = createMockUser(UserRole.ADMINISTRATOR);
      const exportRequest = createMockExportRequest({ recordCount: 5000 });

      const result = await exportService.requestExport(exportRequest, adminUser);

      expect(result.status).toBe('PENDING_APPROVAL');
      expect(result).toHaveProperty('approvalRequestId');
    });

    it('should encrypt exported files', async () => {
      const adminUser = createMockUser(UserRole.ADMINISTRATOR);
      const exportRequest = createMockExportRequest({ recordCount: 100 });

      const result = await exportService.requestExport(exportRequest, adminUser);

      const fileMetadata = await getExportFileMetadata(result.downloadUrl);
      expect(fileMetadata.encrypted).toBe(true);
      expect(fileMetadata.algorithm).toBe('AES-256-GCM');
    });

    it('should apply field masking during export', async () => {
      const operatorUser = createMockUser(UserRole.OPERATOR);
      const exportRequest = createMockExportRequest({
        includeFields: ['maxCvssScore'] // 機密フィールド
      });

      const result = await exportService.requestExport(exportRequest, operatorUser);

      expect(result.status).toBe('SUCCESS');

      const exportedData = await downloadAndDecryptFile(result.downloadUrl);
      expect(exportedData[0]).not.toHaveProperty('maxCvssScore'); // マスキング済み
    });
  });

  describe('Anomaly Detection Tests', () => {
    it('should detect rapid access pattern', async () => {
      const user = createMockUser(UserRole.OPERATOR);

      // 短時間に150回アクセス
      for (let i = 0; i < 150; i++) {
        await dashboardService.getSystemList(user);
      }

      const anomalyResult = await anomalyDetectionService.analyzeAccessPattern(
        user.id,
        { type: 'GET_SYSTEM_LIST', requiresHighPrivilege: false },
        { timestamp: new Date(), ipAddress: '192.168.1.1', userAgent: 'test' }
      );

      expect(anomalyResult.isAnomalous).toBe(true);
      expect(anomalyResult.anomalies).toContainEqual(
        expect.objectContaining({ type: 'RAPID_ACCESS' })
      );
    });

    it('should detect access from unusual location', async () => {
      const user = createMockUser(UserRole.OPERATOR);

      const anomalyResult = await anomalyDetectionService.analyzeAccessPattern(
        user.id,
        { type: 'GET_SYSTEM_DETAILS', requiresHighPrivilege: false },
        {
          timestamp: new Date(),
          ipAddress: '1.2.3.4', // 海外IP
          userAgent: 'test'
        }
      );

      expect(anomalyResult.isAnomalous).toBe(true);
      expect(anomalyResult.anomalies).toContainEqual(
        expect.objectContaining({ type: 'LOCATION_ANOMALY' })
      );
    });
  });

  describe('Audit Logging Tests', () => {
    it('should log all unauthorized access attempts', async () => {
      const guestUser = createMockUser(UserRole.GUEST);
      const restrictedSystem = createMockSystem(SecurityClassification.RESTRICTED);

      try {
        await dashboardService.getSystemDetails(restrictedSystem.id, guestUser);
      } catch (error) {
        // エラーは期待通り
      }

      const auditLogs = await auditLogger.getLogs({
        userId: guestUser.id,
        eventType: 'UNAUTHORIZED_ACCESS'
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]).toMatchObject({
        userId: guestUser.id,
        systemId: restrictedSystem.id,
        reason: expect.stringContaining('insufficient privileges')
      });
    });

    it('should log all data exports with complete metadata', async () => {
      const adminUser = createMockUser(UserRole.ADMINISTRATOR);
      const exportRequest = createMockExportRequest({ recordCount: 100 });

      await exportService.requestExport(exportRequest, adminUser);

      const auditLogs = await auditLogger.getLogs({
        userId: adminUser.id,
        eventType: 'DATA_EXPORT'
      });

      expect(auditLogs[0]).toHaveProperty('recordCount');
      expect(auditLogs[0]).toHaveProperty('fileSize');
      expect(auditLogs[0]).toHaveProperty('fileHash');
      expect(auditLogs[0]).toHaveProperty('businessJustification');
    });
  });
});
```

## 7. 実装チェックリスト

### 7.1 バックエンド実装

- [ ] **アクセス制御**
  - [ ] `DashboardAuthorizationGuard` 実装
  - [ ] `DashboardAuthorizationService` 実装
  - [ ] `DashboardFieldVisibilityService` 実装
  - [ ] PostgreSQL Row-Level Security (RLS) ポリシー作成
  - [ ] フィールドレベル認可テスト

- [ ] **リアルタイム通信**
  - [ ] `DashboardRealtimeGateway` 実装
  - [ ] `WsAuthGuard` / `WsRoleGuard` 実装
  - [ ] `WebSocketRateLimiterService` 実装
  - [ ] TLS 1.3設定
  - [ ] WebSocket接続テスト

- [ ] **データエクスポート**
  - [ ] `DashboardExportService` 実装
  - [ ] `DataExportApprovalService` 実装
  - [ ] `DataEncryptionService` 実装
  - [ ] エクスポートファイル暗号化
  - [ ] 大量エクスポート検知・承認ワークフロー

- [ ] **異常検知**
  - [ ] `DashboardAnomalyDetectionService` 実装
  - [ ] 短時間大量アクセス検知
  - [ ] 地理的位置異常検知
  - [ ] 権限昇格試行検知
  - [ ] セキュリティアラート統合

- [ ] **監査ログ**
  - [ ] `SecurityAuditLogger` 実装
  - [ ] 不正アクセス試行ログ
  - [ ] データエクスポートログ
  - [ ] WebSocket接続/切断ログ
  - [ ] 異常アクセスログ

### 7.2 フロントエンド実装

- [ ] **セキュリティフック**
  - [ ] `useDashboardSecurity` フック実装
  - [ ] `SecureField` コンポーネント実装
  - [ ] フィールド可視性制御
  - [ ] セキュリティ警告表示

- [ ] **WebSocket統合**
  - [ ] WebSocket接続管理
  - [ ] 認証トークン送信
  - [ ] リアルタイム更新受信
  - [ ] エラーハンドリング

### 7.3 テスト実装

- [ ] **ユニットテスト**
  - [ ] アクセス制御テスト
  - [ ] フィールドフィルタリングテスト
  - [ ] マスキングロジックテスト
  - [ ] 異常検知ロジックテスト

- [ ] **統合テスト**
  - [ ] WebSocketセキュリティテスト
  - [ ] データエクスポートフローテスト
  - [ ] 承認ワークフローテスト
  - [ ] End-to-Endセキュリティテスト

- [ ] **セキュリティテスト**
  - [ ] 侵入テスト
  - [ ] 認可バイパステスト
  - [ ] レート制限テスト
  - [ ] SSRFテスト

### 7.4 ドキュメント整備

- [ ] APIセキュリティドキュメント
- [ ] WebSocketセキュリティガイド
- [ ] データエクスポートポリシー
- [ ] インシデント対応手順書

## 8. 成功基準

### 8.1 セキュリティ基準

| 基準項目 | 目標値 | 計測方法 |
|---------|--------|---------|
| 不正アクセス検知率 | 100% | セキュリティテスト |
| 認可バイパス脆弱性 | 0件 | 侵入テスト |
| 機密情報漏洩 | 0件 | データ漏洩テスト |
| 監査ログ完全性 | 100% | 監査ログレビュー |
| OWASP Top 10準拠 | 100% | セキュリティスキャン |

### 8.2 パフォーマンス基準

| 基準項目 | 目標値 | 計測方法 |
|---------|--------|---------|
| 認可チェックオーバーヘッド | <50ms | パフォーマンステスト |
| WebSocket接続確立 | <1秒 | WebSocketテスト |
| フィールドフィルタリング | <10ms | ベンチマークテスト |
| データエクスポート | <5秒/1000レコード | エクスポートテスト |

---

**文書承認者**: セキュリティエンジニア
**レビュー実施者**: プロダクトマネージャー、ソフトウェアアーキテクト、バックエンドデベロッパー
**最終更新**: 2025-09-30
**次回レビュー予定**: スプリント終了時

**重要**: 本設計書は情報漏洩防止を最優先とし、製造業セキュリティ要件とOWASP Top 10に完全準拠したダッシュボードセキュリティ統制を定義します。すべてのセキュリティ統制は実装前にセキュリティレビューを実施し、実装後は侵入テストで検証すること。
