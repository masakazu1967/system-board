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
| **ダッシュボード表示** ||||||
| `GET /api/dashboard/systems` | ✓ | ✓ | ✓ | ✓ | 基本情報のみ |
| `GET /api/dashboard/systems/:id` | ✓ | ✓ | ✓ | ✓ | セキュリティ分類により制限 |
| `GET /api/dashboard/statistics` | ✓ | ✓ | ✓ | ✓ | 集約統計のみ |
| **詳細情報** ||||||
| `GET /api/dashboard/systems/:id/vulnerabilities` | ✗ | ✓ | ✓ | ✓ | 脆弱性詳細 |
| `GET /api/dashboard/systems/:id/configuration` | ✗ | ✓ | ✓ | ✓ | システム構成 |
| `GET /api/dashboard/systems/:id/security-metrics` | ✗ | ✗ | ✓ | ✓ | セキュリティメトリクス |
| `GET /api/dashboard/systems/:id/audit-logs` | ✗ | ✗ | ✗ | ✓ | 監査ログ |
| **データエクスポート** ||||||
| `POST /api/dashboard/export` | ✗ | ✗ | ✓ | ✓ | 承認必須 |
| **リアルタイム通信** ||||||
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

#### 5.1.2 エクスポート処理の非同期化

**課題**: 現状の同期的エクスポート処理では、大量データエクスポート時にAPIタイムアウトのリスクがあります。

**解決策**: バックグラウンドジョブキュー（Bull/BullMQ）を使用した非同期処理

```typescript
/**
 * エクスポートジョブプロセッサー
 *
 * apps/backend/system-mgmt/src/application/dashboard/export/dashboard-export.processor.ts
 */

import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('dashboard-export')
export class DashboardExportProcessor {
  constructor(
    private readonly exportService: DashboardExportService,
    private readonly notificationService: NotificationService,
    private readonly auditLogger: SecurityAuditLogger,
    private readonly encryptionService: DataEncryptionService,
    private readonly fieldVisibilityService: DashboardFieldVisibilityService,
    private readonly logger: Logger
  ) {}

  /**
   * エクスポートジョブ処理
   */
  @Process('generate-export')
  async handleExportGeneration(job: Job<DashboardExportJobData>): Promise<ExportJobResult> {
    const { exportRequest, user, approvalId } = job.data;

    this.logger.log(`Starting export job ${job.id} for user ${user.id}`);

    try {
      // 1. ジョブ進捗更新（0%）
      await job.progress(0);

      // 2. データ取得（ユーザー権限に応じてフィルタリング）
      await job.progress(10);
      const data = await this.fetchDataForExport(exportRequest, user);

      // 3. フィールド可視性決定
      await job.progress(20);
      const fieldVisibility = await this.fieldVisibilityService.determineVisibility(user.role);

      // 4. 機密情報マスキング
      await job.progress(30);
      const maskedData = await this.applyExportMasking(data, fieldVisibility, user.role);

      // 5. エクスポートファイル生成
      await job.progress(50);
      const exportFile = await this.generateExportFile(
        maskedData,
        exportRequest.format
      );

      // 6. ファイル暗号化
      await job.progress(70);
      const encryptedFile = await this.encryptionService.encryptFile(
        exportFile,
        {
          algorithm: 'AES-256-GCM',
          userId: user.id,
          exportId: job.id
        }
      );

      // 7. S3/Azure Blobへアップロード
      await job.progress(85);
      const uploadResult = await this.uploadEncryptedFile(encryptedFile);

      // 8. 署名付き一時URLを生成（1時間有効）
      await job.progress(95);
      const downloadUrl = await this.generateSecureDownloadUrl(
        uploadResult.fileId,
        user.id,
        3600  // 1時間
      );

      // 9. エクスポート成功監査ログ
      await this.auditLogger.logSuccessfulExport({
        userId: user.id,
        jobId: job.id,
        approvalId,
        dataScope: exportRequest.dataScope,
        recordCount: data.length,
        fileSize: encryptedFile.size,
        fileHash: encryptedFile.hash,
        downloadUrl,
        timestamp: new Date()
      });

      // 10. ユーザーに完了通知
      await this.notificationService.notifyExportReady({
        userId: user.id,
        jobId: job.id,
        downloadUrl,
        expiresAt: new Date(Date.now() + 3600000),
        fileSize: encryptedFile.size,
        recordCount: data.length
      });

      // 11. ジョブ完了（100%）
      await job.progress(100);

      return {
        status: 'SUCCESS',
        downloadUrl,
        fileId: uploadResult.fileId,
        fileHash: encryptedFile.hash,
        recordCount: data.length,
        fileSize: encryptedFile.size,
        expiresAt: new Date(Date.now() + 3600000)
      };

    } catch (error) {
      this.logger.error(`Export job ${job.id} failed`, error);

      // エラー監査ログ
      await this.auditLogger.logFailedExport({
        userId: user.id,
        jobId: job.id,
        approvalId,
        error: error.message,
        timestamp: new Date()
      });

      // ユーザーにエラー通知
      await this.notificationService.notifyExportFailed({
        userId: user.id,
        jobId: job.id,
        error: this.sanitizeErrorMessage(error),
        timestamp: new Date()
      });

      throw error;
    }
  }

  /**
   * ジョブアクティブ時の処理
   */
  @OnQueueActive()
  async onActive(job: Job<DashboardExportJobData>) {
    this.logger.log(`Export job ${job.id} is now active`);

    // ジョブ開始通知
    await this.notificationService.notifyExportStarted({
      userId: job.data.user.id,
      jobId: job.id,
      estimatedDuration: this.estimateJobDuration(job.data.exportRequest)
    });
  }

  /**
   * ジョブ完了時の処理
   */
  @OnQueueCompleted()
  async onCompleted(job: Job<DashboardExportJobData>, result: ExportJobResult) {
    this.logger.log(`Export job ${job.id} completed successfully`);

    // 完了メトリクス記録
    await this.recordJobMetrics(job, result);
  }

  /**
   * ジョブ失敗時の処理
   */
  @OnQueueFailed()
  async onFailed(job: Job<DashboardExportJobData>, error: Error) {
    this.logger.error(`Export job ${job.id} failed`, error);

    // 失敗メトリクス記録
    await this.recordJobFailure(job, error);
  }

  /**
   * データ取得（権限に応じてフィルタリング）
   */
  private async fetchDataForExport(
    exportRequest: DashboardExportRequest,
    user: User
  ): Promise<DashboardSystemViewEntity[]> {
    // PostgreSQL RLSポリシーが自動適用される
    const query = this.dashboardRepository.createQueryBuilder('system')
      .where('system.isDeleted = :isDeleted', { isDeleted: false });

    // エクスポート対象システムIDでフィルタリング
    if (exportRequest.dataScope.systemIds?.length > 0) {
      query.andWhere('system.systemId IN (:...systemIds)', {
        systemIds: exportRequest.dataScope.systemIds
      });
    }

    // 追加フィルター適用
    if (exportRequest.dataScope.filters) {
      this.applyFilters(query, exportRequest.dataScope.filters);
    }

    return query.getMany();
  }

  /**
   * エクスポート用マスキング
   */
  private async applyExportMasking(
    data: DashboardSystemViewEntity[],
    fieldVisibility: DashboardSystemFieldVisibility,
    userRole: UserRole
  ): Promise<any[]> {
    return data.map(record => {
      const masked: any = {};

      // フィールド可視性に基づいてフィルタリング
      Object.keys(record).forEach(key => {
        if (this.isFieldVisibleForExport(key, fieldVisibility)) {
          masked[key] = record[key];
        }
      });

      return masked;
    });
  }

  /**
   * エクスポートファイル生成
   */
  private async generateExportFile(
    data: any[],
    format: 'CSV' | 'JSON' | 'XLSX'
  ): Promise<ExportFile> {
    switch (format) {
      case 'CSV':
        return this.generateCSV(data);
      case 'JSON':
        return this.generateJSON(data);
      case 'XLSX':
        return this.generateXLSX(data);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * CSV生成
   */
  private async generateCSV(data: any[]): Promise<ExportFile> {
    const Papa = require('papaparse');

    const csv = Papa.unparse(data, {
      header: true,
      quotes: true,
      quoteChar: '"',
      escapeChar: '"',
      delimiter: ',',
      newline: '\n'
    });

    const buffer = Buffer.from(csv, 'utf-8');

    return {
      buffer,
      mimeType: 'text/csv',
      filename: `dashboard-export-${Date.now()}.csv`,
      size: buffer.length
    };
  }

  /**
   * JSON生成
   */
  private async generateJSON(data: any[]): Promise<ExportFile> {
    const json = JSON.stringify(data, null, 2);
    const buffer = Buffer.from(json, 'utf-8');

    return {
      buffer,
      mimeType: 'application/json',
      filename: `dashboard-export-${Date.now()}.json`,
      size: buffer.length
    };
  }

  /**
   * Excel生成
   */
  private async generateXLSX(data: any[]): Promise<ExportFile> {
    const XLSX = require('xlsx');

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dashboard Export');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `dashboard-export-${Date.now()}.xlsx`,
      size: buffer.length
    };
  }

  /**
   * 暗号化ファイルのアップロード
   */
  private async uploadEncryptedFile(encryptedFile: EncryptedFile): Promise<UploadResult> {
    // S3またはAzure Blobへアップロード
    const fileId = `export-${Date.now()}-${randomUUID()}`;

    await this.storageService.upload({
      fileId,
      buffer: encryptedFile.buffer,
      mimeType: encryptedFile.mimeType,
      metadata: {
        encrypted: true,
        algorithm: encryptedFile.algorithm,
        hash: encryptedFile.hash
      }
    });

    return { fileId };
  }

  /**
   * セキュアダウンロードURL生成
   */
  private async generateSecureDownloadUrl(
    fileId: string,
    userId: string,
    expiresInSeconds: number
  ): Promise<string> {
    // 署名付きURL生成（S3 presigned URL / Azure SAS token）
    return this.storageService.generatePresignedUrl(fileId, {
      expiresIn: expiresInSeconds,
      userId,
      action: 'download'
    });
  }

  /**
   * エラーメッセージのサニタイズ（情報漏洩防止）
   */
  private sanitizeErrorMessage(error: any): string {
    // 内部実装詳細を隠蔽
    if (error instanceof DatabaseError) {
      return 'データベースエラーが発生しました';
    }
    if (error instanceof FileSystemError) {
      return 'ファイル処理エラーが発生しました';
    }
    return 'エクスポート処理中にエラーが発生しました';
  }

  /**
   * ジョブ所要時間の推定
   */
  private estimateJobDuration(exportRequest: DashboardExportRequest): number {
    // レコード数に基づく推定（100レコード = 1秒）
    const estimatedRecords = exportRequest.dataScope.systemIds?.length || 100;
    return Math.ceil(estimatedRecords / 100) * 1000;  // ミリ秒
  }

  /**
   * ジョブメトリクス記録
   */
  private async recordJobMetrics(job: Job, result: ExportJobResult) {
    await this.metricsService.recordExportJobMetrics({
      jobId: job.id,
      userId: job.data.user.id,
      recordCount: result.recordCount,
      fileSize: result.fileSize,
      duration: job.finishedOn! - job.processedOn!,
      status: 'SUCCESS'
    });
  }

  /**
   * ジョブ失敗メトリクス記録
   */
  private async recordJobFailure(job: Job, error: Error) {
    await this.metricsService.recordExportJobMetrics({
      jobId: job.id,
      userId: job.data.user.id,
      duration: job.finishedOn! - job.processedOn!,
      status: 'FAILED',
      errorType: error.constructor.name
    });
  }

  private isFieldVisibleForExport(
    fieldName: string,
    visibility: DashboardSystemFieldVisibility
  ): boolean {
    // フィールド可視性チェック（セクション3.2と同じロジック）
    for (const category of Object.keys(visibility)) {
      if (visibility[category][fieldName] === true) {
        return true;
      }
    }
    return false;
  }

  private applyFilters(query: any, filters: DashboardFilterCriteria) {
    // フィルター適用ロジック
    if (filters.criticality) {
      query.andWhere('system.criticality = :criticality', { criticality: filters.criticality });
    }
    if (filters.hasVulnerabilities) {
      query.andWhere('system.vulnerabilityCount > 0');
    }
    // その他のフィルター
  }
}

/**
 * 型定義
 */
export interface DashboardExportJobData {
  exportRequest: DashboardExportRequest;
  user: User;
  approvalId?: string;
}

export interface ExportJobResult {
  status: 'SUCCESS' | 'FAILED';
  downloadUrl?: string;
  fileId?: string;
  fileHash?: string;
  recordCount?: number;
  fileSize?: number;
  expiresAt?: Date;
  error?: string;
}

export interface ExportFile {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  size: number;
}

export interface EncryptedFile extends ExportFile {
  algorithm: string;
  hash: string;
}

export interface UploadResult {
  fileId: string;
}
```

**コントローラー統合（非同期エクスポート）**:

```typescript
/**
 * ダッシュボードエクスポートコントローラー
 */
@Controller('dashboard/export')
@UseGuards(AuthGuard)
export class DashboardExportController {
  constructor(
    @InjectQueue('dashboard-export') private readonly exportQueue: Queue,
    private readonly authService: DashboardAuthorizationService,
    private readonly auditLogger: SecurityAuditLogger
  ) {}

  /**
   * エクスポート要求（非同期）
   */
  @Post()
  async requestExport(
    @Body() dto: DashboardExportRequestDto,
    @CurrentUser() user: User
  ): Promise<ExportRequestResponse> {
    // 1. エクスポート権限チェック
    const authResult = await this.authService.authorizeExport(
      user,
      dto.dataScope
    );

    if (!authResult.isAllowed()) {
      await this.auditLogger.logUnauthorizedExportAttempt({
        userId: user.id,
        dataScope: dto.dataScope,
        reason: authResult.getReason(),
        timestamp: new Date()
      });

      throw new ForbiddenException('エクスポート権限がありません');
    }

    // 2. データ量推定
    const estimatedRecords = dto.dataScope.systemIds?.length ||
      await this.estimateRecordCount(dto.dataScope.filters);

    // 3. 大量エクスポートの場合は承認必須
    if (estimatedRecords > 1000) {
      // 承認ワークフロー開始（セクション5.1.1と同じ）
      // ...
      return {
        status: 'PENDING_APPROVAL',
        message: '大量データエクスポートには承認が必要です'
      };
    }

    // 4. ジョブをキューに追加
    const job = await this.exportQueue.add('generate-export', {
      exportRequest: dto,
      user: {
        id: user.id,
        role: user.role,
        email: user.email
      }
    }, {
      // ジョブオプション
      attempts: 3,  // 最大3回リトライ
      backoff: {
        type: 'exponential',
        delay: 5000  // 5秒から開始
      },
      removeOnComplete: false,  // 完了後もジョブ情報を保持
      removeOnFail: false,
      timeout: 600000  // 10分タイムアウト
    });

    // 5. エクスポート要求監査ログ
    await this.auditLogger.logExportRequested({
      userId: user.id,
      jobId: job.id,
      dataScope: dto.dataScope,
      estimatedRecords,
      timestamp: new Date()
    });

    return {
      status: 'PROCESSING',
      jobId: job.id,
      message: 'エクスポート処理を開始しました。完了時に通知されます。',
      estimatedDuration: Math.ceil(estimatedRecords / 100) * 1000
    };
  }

  /**
   * エクスポートジョブステータス取得
   */
  @Get(':jobId/status')
  async getExportStatus(
    @Param('jobId') jobId: string,
    @CurrentUser() user: User
  ): Promise<ExportJobStatusResponse> {
    const job = await this.exportQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('エクスポートジョブが見つかりません');
    }

    // ジョブの所有者確認
    if (job.data.user.id !== user.id) {
      throw new ForbiddenException('このジョブにアクセスする権限がありません');
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      jobId: job.id,
      status: state,
      progress,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      result: job.returnvalue
    };
  }

  /**
   * エクスポートファイルダウンロード
   */
  @Get('download/:fileId')
  async downloadExport(
    @Param('fileId') fileId: string,
    @Query('token') token: string,
    @CurrentUser() user: User,
    @Res() res: Response
  ) {
    // 1. トークン検証
    const isValidToken = await this.verifyDownloadToken(fileId, token, user.id);

    if (!isValidToken) {
      throw new ForbiddenException('無効なダウンロードトークンです');
    }

    // 2. ファイル取得
    const file = await this.storageService.getFile(fileId);

    // 3. ダウンロード監査ログ
    await this.auditLogger.logFileDownload({
      userId: user.id,
      fileId,
      fileSize: file.size,
      timestamp: new Date()
    });

    // 4. ファイル送信
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Length': file.size,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    res.send(file.buffer);
  }

  private async estimateRecordCount(filters?: DashboardFilterCriteria): Promise<number> {
    // フィルター条件に基づくレコード数推定
    return 100;  // 簡易実装
  }

  private async verifyDownloadToken(
    fileId: string,
    token: string,
    userId: string
  ): Promise<boolean> {
    // トークン検証ロジック（セクション5.1.1と同じ）
    const [expiry, signature] = token.split('.');
    const now = Date.now();

    if (parseInt(expiry) < now) {
      return false;  // 期限切れ
    }

    // HMAC署名検証
    const expectedSignature = this.generateTokenSignature(fileId, userId, expiry);
    return signature === expectedSignature;
  }

  private generateTokenSignature(fileId: string, userId: string, expiry: string): string {
    const hmac = createHmac('sha256', process.env.EXPORT_TOKEN_SECRET!);
    hmac.update(`${fileId}:${userId}:${expiry}`);
    return hmac.digest('hex');
  }
}

/**
 * レスポンス型定義
 */
export interface ExportRequestResponse {
  status: 'PROCESSING' | 'PENDING_APPROVAL' | 'DENIED';
  jobId?: string;
  approvalRequestId?: string;
  message: string;
  estimatedDuration?: number;
}

export interface ExportJobStatusResponse {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
  result?: ExportJobResult;
}
```

**Bull/BullMQモジュール設定**:

```typescript
/**
 * エクスポートキューモジュール設定
 */
@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: 1  // エクスポート専用DB
      },
      defaultJobOptions: {
        removeOnComplete: 100,  // 最新100件の完了ジョブを保持
        removeOnFail: 1000,     // 最新1000件の失敗ジョブを保持
      }
    }),
    BullModule.registerQueue({
      name: 'dashboard-export',
      limiter: {
        max: 5,        // 同時実行ジョブ数: 5
        duration: 1000 // 1秒あたり
      }
    })
  ],
  providers: [DashboardExportProcessor],
  controllers: [DashboardExportController],
  exports: [BullModule]
})
export class DashboardExportModule {}
```

**通知サービス（Microsoft Teams統合）**:

```typescript
/**
 * エクスポート完了通知サービス
 */
@Injectable()
export class ExportNotificationService {
  constructor(
    private readonly teamsWebhookService: TeamsWebhookService,
    private readonly emailService: EmailService
  ) {}

  /**
   * エクスポート完了通知
   */
  async notifyExportReady(params: {
    userId: string;
    jobId: string;
    downloadUrl: string;
    expiresAt: Date;
    fileSize: number;
    recordCount: number;
  }) {
    const user = await this.getUserInfo(params.userId);

    // Microsoft Teams通知
    await this.teamsWebhookService.sendMessage({
      title: '📊 ダッシュボードエクスポート完了',
      text: `${user.name} さん、データエクスポートが完了しました`,
      sections: [
        {
          activityTitle: 'エクスポート詳細',
          facts: [
            { name: 'ジョブID', value: params.jobId },
            { name: 'レコード数', value: params.recordCount.toString() },
            { name: 'ファイルサイズ', value: this.formatFileSize(params.fileSize) },
            { name: '有効期限', value: params.expiresAt.toLocaleString('ja-JP') }
          ]
        }
      ],
      potentialAction: [
        {
          '@type': 'OpenUri',
          name: 'ダウンロード',
          targets: [{ os: 'default', uri: params.downloadUrl }]
        }
      ]
    });

    // メール通知
    await this.emailService.send({
      to: user.email,
      subject: 'ダッシュボードエクスポート完了',
      template: 'export-ready',
      context: {
        userName: user.name,
        downloadUrl: params.downloadUrl,
        expiresAt: params.expiresAt,
        recordCount: params.recordCount,
        fileSize: this.formatFileSize(params.fileSize)
      }
    });
  }

  /**
   * エクスポート失敗通知
   */
  async notifyExportFailed(params: {
    userId: string;
    jobId: string;
    error: string;
    timestamp: Date;
  }) {
    const user = await this.getUserInfo(params.userId);

    // Microsoft Teams通知
    await this.teamsWebhookService.sendMessage({
      title: '⚠️ ダッシュボードエクスポート失敗',
      text: `${user.name} さん、データエクスポートが失敗しました`,
      themeColor: 'FF0000',
      sections: [
        {
          activityTitle: 'エラー詳細',
          facts: [
            { name: 'ジョブID', value: params.jobId },
            { name: 'エラー', value: params.error },
            { name: '発生時刻', value: params.timestamp.toLocaleString('ja-JP') }
          ]
        }
      ]
    });
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private async getUserInfo(userId: string) {
    // ユーザー情報取得
    return { name: 'User', email: 'user@example.com' };
  }
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

## 6. スケーラビリティとパフォーマンス最適化

### 6.1 WebSocket接続管理のスケーラビリティ対応

#### 6.1.1 課題

現状のWebSocket実装では、`connectedClients` がメモリ内Mapで管理されており、以下の課題があります：

- **水平スケール不可**: 複数サーバーインスタンス間で接続情報を共有できない
- **単一障害点**: サーバークラッシュ時に全WebSocket接続が切断される
- **メモリ制限**: 接続数増加に伴いメモリ使用量が線形に増加

#### 6.1.2 解決策: Redis Pub/Sub + socket.io-redis アダプター

```typescript
/**
 * 分散WebSocket接続管理
 *
 * apps/backend/system-mgmt/src/infrastructure/websocket/distributed-websocket.gateway.ts
 */

import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

@WebSocketGateway({
  namespace: 'dashboard',
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
    credentials: true
  },
  transports: ['websocket'],
  // Redis アダプターで複数サーバーインスタンス間の通信を実現
  adapter: undefined  // 初期化時に設定
})
@UseGuards(WsAuthGuard, WsRoleGuard)
export class DashboardRealtimeGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly authService: DashboardAuthorizationService,
    private readonly auditLogger: SecurityAuditLogger,
    private readonly rateLimiter: WebSocketRateLimiterService,
    private readonly redis: RedisService,
    private readonly pubSub: RedisPubSubService,
    private readonly configService: ConfigService
  ) {}

  /**
   * ゲートウェイ初期化時にRedisアダプターを設定
   */
  async afterInit(server: Server) {
    // Redis クライアント作成
    const pubClient = createClient({
      host: this.configService.get('REDIS_HOST'),
      port: this.configService.get('REDIS_PORT'),
      password: this.configService.get('REDIS_PASSWORD')
    });

    const subClient = pubClient.duplicate();

    await Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]);

    // socket.io-redis アダプターを設定
    server.adapter(createAdapter(pubClient, subClient));

    this.logger.log('Distributed WebSocket adapter initialized');
  }

  /**
   * WebSocket接続時の処理（分散環境対応）
   */
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

      // 4. Redisに接続情報を保存（分散環境対応）
      await this.redis.hset(
        `ws:connections:${user.id}`,
        client.id,
        JSON.stringify({
          connectedAt: new Date(),
          serverId: process.env.SERVER_ID || 'default',
          serverHostname: process.env.HOSTNAME,
          ipAddress: client.handshake.address,
          userAgent: client.handshake.headers['user-agent']
        }),
        { ttl: 86400 }  // 24時間
      );

      // 5. クライアントデータに権限情報を保存
      client.data.user = user;
      client.data.permissions = await this.authService.getDashboardPermissions(user.role);
      client.data.connectedAt = new Date();

      // 6. 他のサーバーインスタンスに接続通知
      await this.pubSub.publish('ws:connection', {
        event: 'client_connected',
        userId: user.id,
        clientId: client.id,
        serverId: process.env.SERVER_ID,
        timestamp: new Date()
      });

      // 7. 接続成功監査ログ
      await this.auditLogger.logWebSocketConnection({
        userId: user.id,
        clientId: client.id,
        serverId: process.env.SERVER_ID,
        ipAddress: client.handshake.address,
        timestamp: new Date()
      });

      // 8. 初期データ送信
      await this.sendInitialDashboardData(client, user);

    } catch (error) {
      this.logger.error('WebSocket connection failed', error);
      client.disconnect();
    }
  }

  /**
   * WebSocket切断時の処理（分散環境対応）
   */
  async handleDisconnect(client: Socket) {
    const user = client.data.user;

    if (user) {
      // 1. Redisから接続情報を削除
      await this.redis.hdel(`ws:connections:${user.id}`, client.id);

      // 2. 他のサーバーインスタンスに切断通知
      await this.pubSub.publish('ws:disconnection', {
        event: 'client_disconnected',
        userId: user.id,
        clientId: client.id,
        serverId: process.env.SERVER_ID,
        timestamp: new Date()
      });

      // 3. 切断監査ログ
      await this.auditLogger.logWebSocketDisconnection({
        userId: user.id,
        clientId: client.id,
        serverId: process.env.SERVER_ID,
        duration: Date.now() - client.data.connectedAt.getTime(),
        timestamp: new Date()
      });
    }
  }

  /**
   * ダッシュボード更新通知（全サーバーインスタンスに配信）
   */
  @SubscribeMessage('dashboard_update')
  async handleDashboardUpdate(
    @MessageBody() data: DashboardUpdatePayload,
    @ConnectedSocket() client: Socket
  ) {
    const user = client.data.user;
    const permissions = client.data.permissions;

    if (!user || !permissions) {
      return;
    }

    // 更新データに対するアクセス権限チェック
    const authResult = await this.authService.authorizeDataAccess(
      user,
      data.systemId,
      data.securityClassification
    );

    if (!authResult.isAllowed()) {
      await this.auditLogger.logUnauthorizedDataAccess({
        userId: user.id,
        systemId: data.systemId,
        classification: data.securityClassification,
        timestamp: new Date()
      });
      return;
    }

    // ユーザー権限に応じたフィールドフィルタリング
    const filteredData = await this.filterUpdateDataForUser(
      data,
      user,
      permissions
    );

    // **重要**: server.to() を使用することで、
    // Redis Pub/Sub経由で全サーバーインスタンスのクライアントに配信される
    this.server.to(`user:${user.id}`).emit('dashboard_update', filteredData);
  }

  /**
   * ユーザー別ルームへの参加（サーバーインスタンス間で共有）
   */
  @SubscribeMessage('join_user_room')
  async handleJoinUserRoom(@ConnectedSocket() client: Socket) {
    const user = client.data.user;

    if (user) {
      // ユーザー専用ルームに参加
      // Redis Pub/Sub により全サーバーインスタンス間で共有される
      await client.join(`user:${user.id}`);

      this.logger.log(`Client ${client.id} joined room user:${user.id}`);
    }
  }

  /**
   * 特定ユーザーの全接続数取得（全サーバーインスタンス）
   */
  private async getUserConnectionCount(userId: string): Promise<number> {
    const connections = await this.redis.hgetall(`ws:connections:${userId}`);
    return Object.keys(connections).length;
  }

  /**
   * 特定ユーザーの全接続をサーバーインスタンス横断で取得
   */
  private async getUserConnections(userId: string): Promise<ConnectionInfo[]> {
    const connections = await this.redis.hgetall(`ws:connections:${userId}`);

    return Object.entries(connections).map(([clientId, data]) => ({
      clientId,
      ...JSON.parse(data)
    }));
  }

  private extractToken(client: Socket): string {
    const token = client.handshake.auth.token ||
                  client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('認証トークンが見つかりません');
    }

    return token;
  }

  private async sendInitialDashboardData(client: Socket, user: User) {
    const permissions = await this.authService.getDashboardPermissions(user.role);
    const systems = await this.getDashboardSystemsForUser(user, permissions);

    client.emit('initial_data', {
      systems,
      permissions,
      timestamp: new Date()
    });
  }

  private async filterUpdateDataForUser(
    data: DashboardUpdatePayload,
    user: User,
    permissions: DashboardUIPermissions
  ): Promise<Partial<DashboardUpdatePayload>> {
    const fieldVisibility = await this.authService.getFieldVisibility(user.role);

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
    for (const category of Object.keys(visibility)) {
      if (visibility[category][fieldName] === true) {
        return true;
      }
    }
    return false;
  }

  private async getDashboardSystemsForUser(
    user: User,
    permissions: DashboardUIPermissions
  ): Promise<any[]> {
    // 実装省略
    return [];
  }
}

/**
 * 接続情報型定義
 */
export interface ConnectionInfo {
  clientId: string;
  connectedAt: Date;
  serverId: string;
  serverHostname: string;
  ipAddress: string;
  userAgent: string;
}
```

#### 6.1.3 スケーラビリティメトリクス

```typescript
/**
 * WebSocketスケーラビリティ監視サービス
 */
@Injectable()
export class WebSocketMetricsService {
  constructor(
    private readonly redis: RedisService,
    private readonly prometheus: PrometheusService
  ) {
    // メトリクス定義
    this.totalConnectionsGauge = new prometheus.Gauge({
      name: 'websocket_connections_total',
      help: 'Total WebSocket connections across all servers',
      labelNames: ['server_id']
    });

    this.connectionsPerUserGauge = new prometheus.Histogram({
      name: 'websocket_connections_per_user',
      help: 'Number of connections per user',
      buckets: [1, 2, 3, 5, 10, 20]
    });
  }

  /**
   * 全サーバーインスタンスの総接続数を取得
   */
  async getTotalConnections(): Promise<number> {
    const keys = await this.redis.keys('ws:connections:*');
    let total = 0;

    for (const key of keys) {
      const connections = await this.redis.hlen(key);
      total += connections;
    }

    return total;
  }

  /**
   * サーバーインスタンス別接続数を取得
   */
  async getConnectionsByServer(): Promise<Map<string, number>> {
    const keys = await this.redis.keys('ws:connections:*');
    const serverCounts = new Map<string, number>();

    for (const key of keys) {
      const connections = await this.redis.hgetall(key);

      Object.values(connections).forEach(data => {
        const { serverId } = JSON.parse(data);
        serverCounts.set(serverId, (serverCounts.get(serverId) || 0) + 1);
      });
    }

    return serverCounts;
  }

  /**
   * メトリクスを定期的に更新
   */
  @Cron('*/30 * * * * *')  // 30秒ごと
  async updateMetrics() {
    const serverCounts = await this.getConnectionsByServer();

    serverCounts.forEach((count, serverId) => {
      this.totalConnectionsGauge.set({ server_id: serverId }, count);
    });
  }
}
```

### 6.2 PostgreSQL Row-Level Security (RLS) 実装

#### 6.2.1 データベースマイグレーション

```sql
-- ============================================
-- Dashboard Row-Level Security Implementation
-- ============================================
-- File: apps/backend/system-mgmt/db/migrations/20250930_add_dashboard_rls.sql
-- Purpose: セキュリティ分類に基づくRow-Level Securityポリシー実装

-- ============ 1. Row-Level Securityを有効化 ============

ALTER TABLE dashboard_system_view ENABLE ROW LEVEL SECURITY;

-- ============ 2. セッション変数設定用関数 ============

-- ユーザーコンテキスト設定関数
CREATE OR REPLACE FUNCTION set_user_context(
  p_user_id UUID,
  p_user_role VARCHAR(50)
)
RETURNS VOID AS $$
BEGIN
  -- セッション変数にユーザーIDとロールを設定
  -- false: トランザクション終了後も保持
  PERFORM set_config('app.user_id', p_user_id::TEXT, false);
  PERFORM set_config('app.user_role', p_user_role, false);

  -- 監査ログ用にIPアドレスも保存（オプション）
  -- PERFORM set_config('app.user_ip', inet_client_addr()::TEXT, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_user_context IS 'Webアプリケーションからのユーザーコンテキスト設定用関数';

-- ============ 3. ユーザーコンテキスト取得関数 ============

-- 現在のユーザーIDを取得
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.user_id', true)::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 現在のユーザーロールを取得
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS VARCHAR(50) AS $$
BEGIN
  RETURN current_setting('app.user_role', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'GUEST';  -- デフォルトは最小権限
END;
$$ LANGUAGE plpgsql STABLE;

-- ============ 4. RLSポリシー: セキュリティ分類別アクセス制御 ============

-- ダッシュボードシステムビュー: SELECT ポリシー
CREATE POLICY dashboard_system_view_select_policy
ON dashboard_system_view
FOR SELECT
USING (
  -- セキュリティ分類とユーザーロールに基づくアクセス制御
  CASE get_current_user_role()
    -- SECURITY_OFFICERは全データアクセス可能
    WHEN 'SECURITY_OFFICER' THEN TRUE

    -- ADMINISTRATORはCONFIDENTIAL以下にアクセス可能
    WHEN 'ADMINISTRATOR' THEN
      security_classification IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL')

    -- OPERATORはINTERNAL以下にアクセス可能
    WHEN 'OPERATOR' THEN
      security_classification IN ('PUBLIC', 'INTERNAL')

    -- GUESTはPUBLICのみアクセス可能
    WHEN 'GUEST' THEN
      security_classification = 'PUBLIC'

    -- 未認証またはロール未設定の場合はアクセス拒否
    ELSE FALSE
  END

  -- 論理削除されたレコードは全ユーザーから非表示
  AND is_deleted = FALSE
);

COMMENT ON POLICY dashboard_system_view_select_policy ON dashboard_system_view IS
'セキュリティ分類とユーザーロールに基づくアクセス制御ポリシー';

-- ============ 5. RLSポリシー: 監査ログアクセス制御 ============

-- 監査ログテーブルのRLS有効化
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- 監査ログ: SECURITY_OFFICERのみアクセス可能
CREATE POLICY security_audit_log_select_policy
ON security_audit_log
FOR SELECT
USING (
  get_current_user_role() = 'SECURITY_OFFICER'
);

COMMENT ON POLICY security_audit_log_select_policy ON security_audit_log IS
'監査ログはSECURITY_OFFICERのみアクセス可能';

-- ============ 6. パフォーマンス最適化インデックス ============

-- セキュリティ分類 + 論理削除フラグの複合インデックス
-- RLSポリシーのWHERE句を高速化
CREATE INDEX IF NOT EXISTS idx_dashboard_rls_security_classification
ON dashboard_system_view (security_classification, is_deleted)
WHERE is_deleted = FALSE;

COMMENT ON INDEX idx_dashboard_rls_security_classification IS
'RLSポリシー高速化用インデックス（セキュリティ分類 + 論理削除フラグ）';

-- ============ 7. RLSポリシーテスト用関数 ============

-- RLSポリシーの動作確認用関数
CREATE OR REPLACE FUNCTION test_rls_policy(
  p_user_role VARCHAR(50)
)
RETURNS TABLE(
  role VARCHAR(50),
  visible_systems_count BIGINT,
  visible_classifications TEXT[]
) AS $$
BEGIN
  -- テスト用ユーザーコンテキストを設定
  PERFORM set_user_context(
    gen_random_uuid(),  -- ダミーユーザーID
    p_user_role
  );

  -- 可視システム数を取得
  RETURN QUERY
  SELECT
    p_user_role AS role,
    COUNT(*) AS visible_systems_count,
    ARRAY_AGG(DISTINCT security_classification ORDER BY security_classification) AS visible_classifications
  FROM dashboard_system_view;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION test_rls_policy IS 'RLSポリシーの動作確認用関数（開発・テスト用）';

-- ============ 8. 使用例 ============

/*
-- アプリケーション側からの使用例（NestJS）

// 1. リクエスト開始時にユーザーコンテキストを設定
await this.connection.query(
  'SELECT set_user_context($1, $2)',
  [req.user.id, req.user.role]
);

// 2. 通常のクエリ実行（RLSポリシーが自動適用される）
const systems = await this.dashboardRepository.find();
// -> ユーザーロールに応じて自動的にフィルタリングされる

// 3. トランザクション終了後、セッション変数はリセット
*/

-- ============ 9. テスト実行例 ============

/*
-- GUEST権限でのアクセステスト
SELECT * FROM test_rls_policy('GUEST');
-- 結果: PUBLIC分類のシステムのみ表示

-- OPERATOR権限でのアクセステスト
SELECT * FROM test_rls_policy('OPERATOR');
-- 結果: PUBLIC, INTERNAL分類のシステムが表示

-- ADMINISTRATOR権限でのアクセステスト
SELECT * FROM test_rls_policy('ADMINISTRATOR');
-- 結果: PUBLIC, INTERNAL, CONFIDENTIAL分類のシステムが表示

-- SECURITY_OFFICER権限でのアクセステスト
SELECT * FROM test_rls_policy('SECURITY_OFFICER');
-- 結果: すべての分類のシステムが表示
*/

-- ============ 10. RLSポリシー監視ビュー ============

-- RLSポリシーの適用状況を確認するビュー
CREATE OR REPLACE VIEW v_rls_policy_status AS
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('dashboard_system_view', 'security_audit_log')
ORDER BY tablename, policyname;

COMMENT ON VIEW v_rls_policy_status IS 'RLSポリシー適用状況確認ビュー';

-- ============ 11. セキュリティベストプラクティス ============

-- RLSをバイパスする特権ユーザーを作成しない
-- すべてのアプリケーションユーザーはRLSポリシーに従う

-- 管理者権限が必要な場合は、SECURITY_OFFICERロールを使用
-- データベーススーパーユーザーはアプリケーションから使用しない

-- セッション変数のリセット（接続プーリング使用時）
CREATE OR REPLACE FUNCTION reset_user_context()
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.user_id', '', false);
  PERFORM set_config('app.user_role', 'GUEST', false);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_user_context IS '接続プーリング使用時のセッション変数リセット用';
```

#### 6.2.2 NestJSミドルウェア統合

```typescript
/**
 * PostgreSQL RLSコンテキスト設定ミドルウェア
 *
 * apps/backend/system-mgmt/src/infrastructure/database/middleware/rls-context.middleware.ts
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class RLSContextMiddleware implements NestMiddleware {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly logger: Logger
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 未認証リクエストはスキップ
    if (!req.user) {
      // GESTロールをデフォルト設定
      await this.setGuestContext();
      return next();
    }

    try {
      // PostgreSQLセッション変数を設定
      await this.connection.query(
        'SELECT set_user_context($1, $2)',
        [req.user.id, req.user.role]
      );

      this.logger.debug(
        `RLS context set: userId=${req.user.id}, role=${req.user.role}`
      );

      // レスポンス送信後にセッション変数をリセット
      res.on('finish', async () => {
        try {
          await this.connection.query('SELECT reset_user_context()');
        } catch (error) {
          this.logger.error('Failed to reset RLS context', error);
        }
      });

      next();
    } catch (error) {
      this.logger.error('Failed to set RLS context', error);
      // エラー発生時はGUESTロールにフォールバック
      await this.setGuestContext();
      next();
    }
  }

  /**
   * GUESTロールのデフォルトコンテキストを設定
   */
  private async setGuestContext() {
    try {
      await this.connection.query(
        'SELECT set_user_context($1, $2)',
        ['00000000-0000-0000-0000-000000000000', 'GUEST']
      );
    } catch (error) {
      this.logger.error('Failed to set guest context', error);
    }
  }
}

/**
 * RLSミドルウェアモジュール設定
 *
 * apps/backend/system-mgmt/src/infrastructure/database/database-security.module.ts
 */

@Module({
  providers: [RLSContextMiddleware],
  exports: [RLSContextMiddleware]
})
export class DatabaseSecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // すべてのルートにRLSコンテキスト設定ミドルウェアを適用
    consumer
      .apply(RLSContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

/**
 * アプリケーションモジュールでのインポート
 */
@Module({
  imports: [
    DatabaseSecurityModule,
    // ... 他のモジュール
  ]
})
export class AppModule {}
```

#### 6.2.3 RLSポリシーテスト

```typescript
/**
 * RLSポリシー統合テスト
 *
 * apps/backend/system-mgmt/test/integration/rls-policy.spec.ts
 */

describe('PostgreSQL RLS Policy Integration Tests', () => {
  let connection: Connection;
  let dashboardRepository: Repository<DashboardSystemViewEntity>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseModule]
    }).compile();

    connection = module.get<Connection>(Connection);
    dashboardRepository = connection.getRepository(DashboardSystemViewEntity);
  });

  describe('Row-Level Security Policies', () => {
    it('should allow GUEST to see only PUBLIC systems', async () => {
      // GUESTユーザーコンテキストを設定
      await connection.query(
        'SELECT set_user_context($1, $2)',
        ['guest-user-id', 'GUEST']
      );

      const systems = await dashboardRepository.find();

      // PUBLICシステムのみ取得されることを確認
      expect(systems.every(s => s.securityClassification === 'PUBLIC')).toBe(true);
      expect(systems.some(s => s.securityClassification === 'INTERNAL')).toBe(false);
      expect(systems.some(s => s.securityClassification === 'CONFIDENTIAL')).toBe(false);
      expect(systems.some(s => s.securityClassification === 'RESTRICTED')).toBe(false);
    });

    it('should allow OPERATOR to see PUBLIC and INTERNAL systems', async () => {
      // OPERATORユーザーコンテキストを設定
      await connection.query(
        'SELECT set_user_context($1, $2)',
        ['operator-user-id', 'OPERATOR']
      );

      const systems = await dashboardRepository.find();

      // PUBLIC, INTERNALシステムのみ取得されることを確認
      expect(
        systems.every(s =>
          s.securityClassification === 'PUBLIC' ||
          s.securityClassification === 'INTERNAL'
        )
      ).toBe(true);
      expect(systems.some(s => s.securityClassification === 'CONFIDENTIAL')).toBe(false);
      expect(systems.some(s => s.securityClassification === 'RESTRICTED')).toBe(false);
    });

    it('should allow ADMINISTRATOR to see up to CONFIDENTIAL systems', async () => {
      // ADMINISTRATORユーザーコンテキストを設定
      await connection.query(
        'SELECT set_user_context($1, $2)',
        ['admin-user-id', 'ADMINISTRATOR']
      );

      const systems = await dashboardRepository.find();

      // PUBLIC, INTERNAL, CONFIDENTIALシステムのみ取得されることを確認
      expect(
        systems.every(s =>
          s.securityClassification === 'PUBLIC' ||
          s.securityClassification === 'INTERNAL' ||
          s.securityClassification === 'CONFIDENTIAL'
        )
      ).toBe(true);
      expect(systems.some(s => s.securityClassification === 'RESTRICTED')).toBe(false);
    });

    it('should allow SECURITY_OFFICER to see all systems', async () => {
      // SECURITY_OFFICERユーザーコンテキストを設定
      await connection.query(
        'SELECT set_user_context($1, $2)',
        ['security-officer-id', 'SECURITY_OFFICER']
      );

      const allSystems = await dashboardRepository.find();
      const publicSystems = await dashboardRepository.find({
        where: { securityClassification: 'PUBLIC' }
      });
      const restrictedSystems = await dashboardRepository.find({
        where: { securityClassification: 'RESTRICTED' }
      });

      // すべての分類のシステムが取得されることを確認
      expect(allSystems.length).toBeGreaterThan(publicSystems.length);
      expect(restrictedSystems.length).toBeGreaterThan(0);
    });

    it('should hide logically deleted systems from all users', async () => {
      // SECURITY_OFFICERでも論理削除されたシステムは見えない
      await connection.query(
        'SELECT set_user_context($1, $2)',
        ['security-officer-id', 'SECURITY_OFFICER']
      );

      const systems = await dashboardRepository.find();

      expect(systems.every(s => s.isDeleted === false)).toBe(true);
    });
  });

  describe('Audit Log RLS Policy', () => {
    it('should deny access to audit logs for non-SECURITY_OFFICER users', async () => {
      // ADMINISTRATORユーザーコンテキストを設定
      await connection.query(
        'SELECT set_user_context($1, $2)',
        ['admin-user-id', 'ADMINISTRATOR']
      );

      const auditLogs = await connection
        .getRepository('SecurityAuditLog')
        .find();

      // ADMINISTRATORは監査ログにアクセスできない
      expect(auditLogs.length).toBe(0);
    });

    it('should allow SECURITY_OFFICER to access audit logs', async () => {
      // SECURITY_OFFICERユーザーコンテキストを設定
      await connection.query(
        'SELECT set_user_context($1, $2)',
        ['security-officer-id', 'SECURITY_OFFICER']
      );

      const auditLogs = await connection
        .getRepository('SecurityAuditLog')
        .find();

      // SECURITY_OFFICERは監査ログにアクセスできる
      expect(auditLogs.length).toBeGreaterThan(0);
    });
  });

  afterEach(async () => {
    // セッション変数をリセット
    await connection.query('SELECT reset_user_context()');
  });
});
```

## 7. OWASP Top 10 準拠チェック

### 7.1 OWASP Top 10 2021 対策マッピング

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

### 7.2 セキュリティテスト要件

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

## 8. 実装チェックリスト

### 8.1 バックエンド実装

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

### 8.2 フロントエンド実装

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

### 8.3 テスト実装

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

### 8.4 ドキュメント整備

- [ ] APIセキュリティドキュメント
- [ ] WebSocketセキュリティガイド
- [ ] データエクスポートポリシー
- [ ] インシデント対応手順書

## 9. 成功基準

### 9.1 セキュリティ基準

| 基準項目 | 目標値 | 計測方法 |
|---------|--------|---------|
| 不正アクセス検知率 | 100% | セキュリティテスト |
| 認可バイパス脆弱性 | 0件 | 侵入テスト |
| 機密情報漏洩 | 0件 | データ漏洩テスト |
| 監査ログ完全性 | 100% | 監査ログレビュー |
| OWASP Top 10準拠 | 100% | セキュリティスキャン |

### 9.2 パフォーマンス基準

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
