# セキュリティ分類別認可マトリクス設計仕様

**担当**: セキュリティエンジニア
**作成日**: 2025-09-21
**Issue**: #34 (US-SM-001: システム新規登録)
**関連仕様**: System集約設計仕様書 (US-SM-001.md)
**アーキテクチャパターン**: オニオンアーキテクチャ + DDD + CQRS + イベントソーシング

## 1. 認可フレームワーク概要

### 1.1 設計原則

**製造業セキュリティ要件**:

- **情報漏洩防止最優先**: セキュリティ分類に基づく厳格なアクセス制御
- **ISO 27001準拠**: 情報セキュリティマネジメントシステム (ISMS) 統制
- **NIST Cybersecurity Framework準拠**: IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER
- **最小権限原則**: ユーザーには必要最小限の権限のみ付与
- **職務分離**: セキュリティクリティカルな操作の複数人承認

### 1.2 セキュリティ分類体系

```typescript
export enum SecurityClassification {
  PUBLIC = 'PUBLIC',           // 公開情報 - 外部公開可能
  INTERNAL = 'INTERNAL',       // 社内限定 - 社員のみアクセス可能
  CONFIDENTIAL = 'CONFIDENTIAL', // 機密 - 特定部門のみアクセス可能
  RESTRICTED = 'RESTRICTED'    // 極秘 - 特権ユーザーのみアクセス可能
}

export enum UserRole {
  GUEST = 'GUEST',             // ゲスト - 読み取り専用（PUBLIC のみ）
  OPERATOR = 'OPERATOR',       // 運用者 - 基本操作（PUBLIC, INTERNAL）
  ADMINISTRATOR = 'ADMINISTRATOR', // 管理者 - 高度操作（PUBLIC, INTERNAL, CONFIDENTIAL）
  SECURITY_OFFICER = 'SECURITY_OFFICER' // セキュリティ責任者 - 全権限（全分類）
}
```

## 2. 認可マトリクス仕様

### 2.1 操作別認可マトリクス

| コマンド/操作 | PUBLIC | INTERNAL | CONFIDENTIAL | RESTRICTED |
|--------------|--------|-----------|--------------|------------|
| **システム参照** |||||
| システム一覧表示 | GUEST+ | OPERATOR+ | ADMINISTRATOR+ | SECURITY_OFFICER |
| システム詳細表示 | GUEST+ | OPERATOR+ | ADMINISTRATOR+ | SECURITY_OFFICER |
| **システム管理** |||||
| システム新規登録 | OPERATOR+ | OPERATOR+ | ADMINISTRATOR+ | SECURITY_OFFICER |
| システム設定変更 | OPERATOR+ | ADMINISTRATOR+ | ADMINISTRATOR+ | SECURITY_OFFICER |
| セキュリティ分類変更 | N/A | ADMINISTRATOR+ | SECURITY_OFFICER | SECURITY_OFFICER |
| システム削除 | ADMINISTRATOR+ | ADMINISTRATOR+ | SECURITY_OFFICER | SECURITY_OFFICER |
| **パッケージ管理** |||||
| パッケージ一覧表示 | GUEST+ | OPERATOR+ | ADMINISTRATOR+ | SECURITY_OFFICER |
| パッケージ追加 | OPERATOR+ | OPERATOR+ | ADMINISTRATOR+ | SECURITY_OFFICER |
| パッケージ削除 | OPERATOR+ | ADMINISTRATOR+ | ADMINISTRATOR+ | SECURITY_OFFICER |
| **監査・ログ** |||||
| 監査ログ参照 | ADMINISTRATOR+ | ADMINISTRATOR+ | ADMINISTRATOR+ | SECURITY_OFFICER |
| セキュリティイベント参照 | SECURITY_OFFICER | SECURITY_OFFICER | SECURITY_OFFICER | SECURITY_OFFICER |

**記号説明**:

- GUEST+: GUEST 以上のロール
- OPERATOR+: OPERATOR 以上のロール
- ADMINISTRATOR+: ADMINISTRATOR 以上のロール
- N/A: 該当なし

### 2.2 データフィールド別アクセス制御

```typescript
export interface SystemSecurityFields {
  // PUBLIC レベル - 全ユーザーアクセス可能
  systemId: string;
  name: string;
  type: SystemType;
  status: SystemStatus;

  // INTERNAL レベル - OPERATOR 以上
  hostConfiguration: {
    cpu: number;
    memory: number;
    storage: number;
    // encryptionEnabled は CONFIDENTIAL
  };
  packages: PackageInfo[];

  // CONFIDENTIAL レベル - ADMINISTRATOR 以上
  encryptionEnabled: boolean;
  vulnerabilityDetails: VulnerabilityInfo[];
  networkConfiguration: NetworkConfig;

  // RESTRICTED レベル - SECURITY_OFFICER のみ
  securityKeys: SecurityCredentials;
  auditTrail: AuditEvent[];
  complianceReports: ComplianceData[];
}
```

## 3. 認可チェック実装仕様

### 3.1 認可サービス設計

```typescript
@Injectable()
export class SystemAuthorizationService {
  constructor(
    private readonly userContext: UserContextService,
    private readonly securityClassificationService: SecurityClassificationService
  ) {}

  /**
   * コマンド実行認可チェック
   */
  async authorizeCommand(
    command: SystemCommand,
    targetSystem: System
  ): Promise<AuthorizationResult> {
    const userRole = await this.userContext.getCurrentUserRole();
    const classification = targetSystem.getSecurityClassification();

    return this.checkCommandAuthorization(command, userRole, classification);
  }

  /**
   * データフィールドアクセス認可チェック
   */
  async authorizeFieldAccess(
    fieldName: string,
    classification: SecurityClassification
  ): Promise<boolean> {
    const userRole = await this.userContext.getCurrentUserRole();
    return this.checkFieldAuthorization(fieldName, userRole, classification);
  }

  /**
   * セキュリティ分類変更認可チェック
   */
  async authorizeClassificationChange(
    from: SecurityClassification,
    to: SecurityClassification
  ): Promise<AuthorizationResult> {
    const userRole = await this.userContext.getCurrentUserRole();

    // セキュリティ分類のアップグレード（より機密）
    if (this.isClassificationUpgrade(from, to)) {
      return this.authorizeClassificationUpgrade(userRole, to);
    }

    // セキュリティ分類のダウングレード（より公開）
    if (this.isClassificationDowngrade(from, to)) {
      return this.authorizeClassificationDowngrade(userRole, from);
    }

    return AuthorizationResult.denied('同等レベルへの変更は不要');
  }

  private checkCommandAuthorization(
    command: SystemCommand,
    userRole: UserRole,
    classification: SecurityClassification
  ): AuthorizationResult {
    const matrix = this.getAuthorizationMatrix();
    const requiredRole = matrix[command.getType()][classification];

    if (this.isRoleSufficient(userRole, requiredRole)) {
      return AuthorizationResult.allowed();
    }

    return AuthorizationResult.denied(
      `コマンド ${command.getType()} には ${requiredRole} 以上の権限が必要です`
    );
  }

  private getAuthorizationMatrix(): AuthorizationMatrix {
    return {
      [SystemCommandType.REGISTER]: {
        [SecurityClassification.PUBLIC]: UserRole.OPERATOR,
        [SecurityClassification.INTERNAL]: UserRole.OPERATOR,
        [SecurityClassification.CONFIDENTIAL]: UserRole.ADMINISTRATOR,
        [SecurityClassification.RESTRICTED]: UserRole.SECURITY_OFFICER
      },
      [SystemCommandType.UPDATE_CONFIGURATION]: {
        [SecurityClassification.PUBLIC]: UserRole.OPERATOR,
        [SecurityClassification.INTERNAL]: UserRole.ADMINISTRATOR,
        [SecurityClassification.CONFIDENTIAL]: UserRole.ADMINISTRATOR,
        [SecurityClassification.RESTRICTED]: UserRole.SECURITY_OFFICER
      },
      [SystemCommandType.CHANGE_CLASSIFICATION]: {
        [SecurityClassification.PUBLIC]: UserRole.ADMINISTRATOR,
        [SecurityClassification.INTERNAL]: UserRole.ADMINISTRATOR,
        [SecurityClassification.CONFIDENTIAL]: UserRole.SECURITY_OFFICER,
        [SecurityClassification.RESTRICTED]: UserRole.SECURITY_OFFICER
      },
      [SystemCommandType.DELETE]: {
        [SecurityClassification.PUBLIC]: UserRole.ADMINISTRATOR,
        [SecurityClassification.INTERNAL]: UserRole.ADMINISTRATOR,
        [SecurityClassification.CONFIDENTIAL]: UserRole.SECURITY_OFFICER,
        [SecurityClassification.RESTRICTED]: UserRole.SECURITY_OFFICER
      }
    };
  }

  private isRoleSufficient(userRole: UserRole, requiredRole: UserRole): boolean {
    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.GUEST]: 0,
      [UserRole.OPERATOR]: 1,
      [UserRole.ADMINISTRATOR]: 2,
      [UserRole.SECURITY_OFFICER]: 3
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }
}
```

### 3.2 認可結果型定義

```typescript
export class AuthorizationResult {
  constructor(
    private readonly allowed: boolean,
    private readonly reason?: string,
    private readonly requiredRole?: UserRole,
    private readonly additionalActions?: AuthorizationAction[]
  ) {}

  static allowed(actions?: AuthorizationAction[]): AuthorizationResult {
    return new AuthorizationResult(true, undefined, undefined, actions);
  }

  static denied(reason: string, requiredRole?: UserRole): AuthorizationResult {
    return new AuthorizationResult(false, reason, requiredRole);
  }

  isAllowed(): boolean {
    return this.allowed;
  }

  getReason(): string | undefined {
    return this.reason;
  }

  getRequiredRole(): UserRole | undefined {
    return this.requiredRole;
  }

  getAdditionalActions(): AuthorizationAction[] {
    return this.additionalActions || [];
  }
}

export interface AuthorizationAction {
  type: 'AUDIT_LOG' | 'NOTIFY_SECURITY' | 'REQUIRE_APPROVAL';
  metadata: Record<string, any>;
}
```

## 4. コマンドハンドラー統合

### 4.1 認可チェック統合

```typescript
@CommandHandler(RegisterSystemCommand)
export class RegisterSystemHandler {
  constructor(
    private readonly authorizationService: SystemAuthorizationService,
    private readonly systemUniquenessService: SystemUniquenessService,
    private readonly eventBus: DomainEventBus,
    private readonly auditLogger: SecurityAuditLogger
  ) {}

  async execute(command: RegisterSystemCommand): Promise<SystemId> {
    // 1. 事前認可チェック
    const preAuthResult = await this.authorizationService.authorizeCommand(
      command,
      null // 新規登録のため対象システムなし
    );

    if (!preAuthResult.isAllowed()) {
      await this.auditLogger.logUnauthorizedAccess({
        command: command.constructor.name,
        reason: preAuthResult.getReason(),
        requiredRole: preAuthResult.getRequiredRole(),
        userContext: await this.getCurrentUserContext()
      });

      throw new UnauthorizedOperationError(preAuthResult.getReason());
    }

    // 2. ドメインモデル生成
    const system = System.register(command);

    // 3. 事後認可チェック（生成されたシステムに対して）
    const postAuthResult = await this.authorizationService.authorizeCommand(
      command,
      system
    );

    if (!postAuthResult.isAllowed()) {
      await this.auditLogger.logUnauthorizedAccess({
        command: command.constructor.name,
        systemId: system.getIdValue(),
        reason: postAuthResult.getReason(),
        userContext: await this.getCurrentUserContext()
      });

      throw new UnauthorizedOperationError(postAuthResult.getReason());
    }

    // 4. 一意性制約チェック
    const isUnique = await this.systemUniquenessService.isUnique(system);
    if (!isUnique) {
      throw new SystemAlreadyExistsError(system.getIdValue());
    }

    // 5. セキュリティ監査ログ
    await this.auditLogger.logAuthorizedAccess({
      command: command.constructor.name,
      systemId: system.getIdValue(),
      securityClassification: system.getSecurityClassification(),
      userContext: await this.getCurrentUserContext(),
      additionalActions: postAuthResult.getAdditionalActions()
    });

    // 6. ドメインイベント発行
    await this.eventBus.publishAll(system.getUncommittedEvents());

    return system.getId();
  }

  private async getCurrentUserContext(): Promise<UserContext> {
    // UserContextServiceから現在のユーザー情報を取得
    return await this.userContextService.getCurrentContext();
  }
}
```

## 5. セキュリティ例外定義

```typescript
export class UnauthorizedOperationError extends SystemDomainError {
  constructor(reason: string) {
    super(`認可されていない操作です: ${reason}`, 'UNAUTHORIZED_OPERATION');
  }
}

export class InsufficientPrivilegesError extends SystemDomainError {
  constructor(requiredRole: UserRole, currentRole: UserRole) {
    super(
      `不十分な権限です。必要: ${requiredRole}, 現在: ${currentRole}`,
      'INSUFFICIENT_PRIVILEGES'
    );
  }
}

export class SecurityClassificationViolationError extends SystemDomainError {
  constructor(classification: SecurityClassification, operation: string) {
    super(
      `セキュリティ分類 ${classification} に対する操作 ${operation} は許可されていません`,
      'SECURITY_CLASSIFICATION_VIOLATION'
    );
  }
}
```

## 6. 実装チェックリスト

### 6.1 必須実装項目

- [ ] SystemAuthorizationService実装
- [ ] AuthorizationResult型定義
- [ ] 認可マトリクス設定
- [ ] コマンドハンドラー認可チェック統合
- [ ] セキュリティ例外クラス実装
- [ ] ユーザーロール管理
- [ ] セキュリティ監査ログ統合

### 6.2 テスト要件

- [ ] 各セキュリティ分類での認可テスト
- [ ] ロール階層テスト
- [ ] 不正アクセス検出テスト
- [ ] セキュリティ分類変更テスト
- [ ] 監査ログ記録テスト

### 6.3 コンプライアンス要件

- [ ] ISO 27001 統制マッピング
- [ ] NIST Cybersecurity Framework適合性確認
- [ ] OWASP Top 10 対策確認
- [ ] 職務分離統制実装確認
