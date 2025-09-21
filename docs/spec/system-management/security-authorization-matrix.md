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

### 2.2 層別セキュリティアーキテクチャ

**オニオンアーキテクチャにおけるセキュリティ層分離**:

```typescript
// ドメイン層: ビジネスルールベースのセキュリティ制約
export class System extends AggregateRoot {
  // ビジネスルール: セキュリティ分類に基づく暗号化要件
  public hasEncryptionRequirement(): boolean {
    return this.securityClassification === SecurityClassification.CONFIDENTIAL ||
           this.securityClassification === SecurityClassification.RESTRICTED;
  }

  // ビジネス不変条件: セキュリティ分類整合性
  public validateSecurityClassificationConsistency(): boolean {
    if (this.hasEncryptionRequirement()) {
      return this.hostConfiguration.isEncryptionEnabled() &&
             this.packages.areAllSecurityCompliant();
    }
    return true;
  }

  // ビジネスルール: システム種別と重要度の適合性
  public validateCriticalityLevel(): boolean {
    switch (this.type) {
      case SystemType.DATABASE:
      case SystemType.API:
        return this.criticality !== CriticalityLevel.LOW;
      default:
        return true;
    }
  }
}

// アプリケーション層: セキュリティポリシー制御
export interface SystemSecurityPolicy {
  /**
   * ユーザーロールとセキュリティ分類に基づくフィールド可視性決定
   */
  determineFieldVisibility(
    userRole: UserRole,
    classification: SecurityClassification
  ): SystemFieldVisibility;

  /**
   * 特定フィールドへのアクセス権限チェック
   */
  authorizeFieldAccess(
    fieldName: keyof SystemData,
    userRole: UserRole,
    classification: SecurityClassification
  ): boolean;
}

export interface SystemFieldVisibility {
  basic: boolean;        // systemId, name, type, status (常に表示)
  operational: boolean;  // hostConfiguration(基本), packages(基本) (OPERATOR+)
  confidential: boolean; // encryptionEnabled, vulnerabilities, network (ADMINISTRATOR+)
  restricted: boolean;   // securityKeys, auditTrail, compliance (SECURITY_OFFICER)
}

// インフラストラクチャ層: セキュリティフィルタリングDTO
export class SystemSecurityDto {
  constructor(
    private readonly system: System,
    private readonly visibility: SystemFieldVisibility
  ) {}

  /**
   * セキュリティポリシーに基づくフィルタリング済みレスポンス生成
   */
  toSecureResponse(): SecurityFilteredSystemResponse {
    const response: any = {};

    // PUBLICレベルフィールド (全ユーザー)
    if (this.visibility.basic) {
      response.systemId = this.system.getId().getValue();
      response.name = this.system.getName().getValue();
      response.type = this.system.getType();
      response.status = this.system.getStatus();
    }

    // INTERNALレベルフィールド (OPERATOR+)
    if (this.visibility.operational) {
      response.hostConfiguration = {
        cpu: this.system.getHostConfiguration().getCpu(),
        memory: this.system.getHostConfiguration().getMemory(),
        storage: this.system.getHostConfiguration().getStorage()
      };
      response.packages = this.system.getPackages().getAll().map(pkg => ({
        name: pkg.getName(),
        version: pkg.getVersion()
      }));
    }

    // CONFIDENTIALレベルフィールド (ADMINISTRATOR+)
    if (this.visibility.confidential) {
      response.encryptionEnabled = this.system.getHostConfiguration().isEncryptionEnabled();
      response.vulnerabilityDetails = this.system.getPackages().getVulnerablePackages();
      response.networkConfiguration = this.system.getNetworkConfiguration();
    }

    // RESTRICTEDレベルフィールド (SECURITY_OFFICER)
    if (this.visibility.restricted) {
      response.securityKeys = this.system.getSecurityCredentials();
      response.auditTrail = this.system.getAuditEvents();
      response.complianceReports = this.system.getComplianceData();
    }

    return response;
  }

  /**
   * スタティックファクトリーメソッド: セキュリティフィルタリング済みレスポンス作成
   */
  static createSecureResponse(
    system: System,
    userRole: UserRole,
    securityPolicy: SystemSecurityPolicy
  ): SecurityFilteredSystemResponse {
    const visibility = securityPolicy.determineFieldVisibility(
      userRole,
      system.getSecurityClassification()
    );

    return new SystemSecurityDto(system, visibility).toSecureResponse();
  }
}

export interface SecurityFilteredSystemResponse {
  // 基本情報 (常に含まれる)
  systemId?: string;
  name?: string;
  type?: SystemType;
  status?: SystemStatus;

  // 運用情報 (OPERATOR+)
  hostConfiguration?: {
    cpu: number;
    memory: number;
    storage: number;
  };
  packages?: Array<{
    name: string;
    version: string;
  }>;

  // 機密情報 (ADMINISTRATOR+)
  encryptionEnabled?: boolean;
  vulnerabilityDetails?: VulnerabilityInfo[];
  networkConfiguration?: NetworkConfig;

  // 極秘情報 (SECURITY_OFFICER)
  securityKeys?: SecurityCredentials;
  auditTrail?: AuditEvent[];
  complianceReports?: ComplianceData[];
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
   * システム作成認可チェック (事後認可)
   */
  async authorizeSystemCreation(
    system: System,
    userContext: UserContext
  ): Promise<AuthorizationResult> {
    // 生成されたシステムのセキュリティ制約整合性チェック
    if (!system.validateSecurityClassificationConsistency()) {
      return AuthorizationResult.denied('セキュリティ分類と構成が不整合です');
    }

    // ユーザーのセキュリティクリアランスチェック
    const hasRequiredClearance = this.checkSecurityClearance(
      userContext.role,
      system.getSecurityClassification()
    );

    if (!hasRequiredClearance) {
      return AuthorizationResult.denied(
        `セキュリティ分類 ${system.getSecurityClassification()} のシステム作成には適切なクリアランスが必要です`
      );
    }

    // 追加アクションの決定
    const additionalActions: AuthorizationAction[] = [];

    if (system.getSecurityClassification() === SecurityClassification.RESTRICTED) {
      additionalActions.push({
        type: 'REQUIRE_APPROVAL',
        metadata: { approvalLevel: 'EXECUTIVE' }
      });
    }

    if (system.hasEncryptionRequirement()) {
      additionalActions.push({
        type: 'AUDIT_LOG',
        metadata: { auditLevel: 'DETAILED' }
      });
    }

    return AuthorizationResult.allowed(additionalActions);
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

  private checkSecurityClearance(
    userRole: UserRole,
    classification: SecurityClassification
  ): boolean {
    const clearanceMatrix: Record<SecurityClassification, UserRole> = {
      [SecurityClassification.PUBLIC]: UserRole.GUEST,
      [SecurityClassification.INTERNAL]: UserRole.OPERATOR,
      [SecurityClassification.CONFIDENTIAL]: UserRole.ADMINISTRATOR,
      [SecurityClassification.RESTRICTED]: UserRole.SECURITY_OFFICER
    };

    const requiredRole = clearanceMatrix[classification];
    return this.isRoleSufficient(userRole, requiredRole);
  }

  private checkFieldAuthorization(
    fieldName: string,
    userRole: UserRole,
    classification: SecurityClassification
  ): boolean {
    // フィールドレベルのアクセス制御マトリクス
    const fieldAccessMatrix: Record<string, SecurityClassification> = {
      // PUBLICレベルフィールド
      'systemId': SecurityClassification.PUBLIC,
      'name': SecurityClassification.PUBLIC,
      'type': SecurityClassification.PUBLIC,
      'status': SecurityClassification.PUBLIC,

      // INTERNALレベルフィールド
      'hostConfiguration.cpu': SecurityClassification.INTERNAL,
      'hostConfiguration.memory': SecurityClassification.INTERNAL,
      'hostConfiguration.storage': SecurityClassification.INTERNAL,
      'packages': SecurityClassification.INTERNAL,

      // CONFIDENTIALレベルフィールド
      'hostConfiguration.encryptionEnabled': SecurityClassification.CONFIDENTIAL,
      'vulnerabilityDetails': SecurityClassification.CONFIDENTIAL,
      'networkConfiguration': SecurityClassification.CONFIDENTIAL,

      // RESTRICTEDレベルフィールド
      'securityKeys': SecurityClassification.RESTRICTED,
      'auditTrail': SecurityClassification.RESTRICTED,
      'complianceReports': SecurityClassification.RESTRICTED
    };

    const fieldClassification = fieldAccessMatrix[fieldName] || SecurityClassification.RESTRICTED;
    return this.checkSecurityClearance(userRole, fieldClassification) &&
           this.checkSecurityClearance(userRole, classification);
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

## 4. 層別セキュリティ統合アーキテクチャ

### 4.1 アプリケーション層: コマンドハンドラー統合

```typescript
@CommandHandler(RegisterSystemCommand)
export class RegisterSystemHandler {
  constructor(
    private readonly authorizationService: SystemAuthorizationService,
    private readonly systemUniquenessService: SystemUniquenessService,
    private readonly eventBus: DomainEventBus,
    private readonly auditLogger: SecurityAuditLogger,
    private readonly piiProtectionService: PIIProtectionService,
    private readonly securityPolicy: SystemSecurityPolicy
  ) {}

  @Span('RegisterSystemCommand') // 分散トレーシング
  async execute(command: RegisterSystemCommand): Promise<SystemId> {
    try {
      // 1. 事前認可チェック (セキュリティ分類に基づく)
      const preAuthResult = await this.authorizationService.authorizeCommand(
        command.getSecurityMetadata()
      );

      if (!preAuthResult.isAllowed()) {
        await this.auditLogger.logUnauthorizedAccess({
          command: 'RegisterSystemCommand',
          reason: preAuthResult.getReason(),
          userContext: command.userContext,
          securityClassification: command.securityClassification,
          timestamp: new Date()
        });

        throw new UnauthorizedOperationError(preAuthResult.getReason());
      }

      // 2. ドメインモデル生成 (ドメイン層でビジネスルール適用)
      const system = System.register(command);

      // 3. 事後認可チェック (生成されたシステムに対して)
      const postAuthResult = await this.authorizationService.authorizeSystemCreation(
        system,
        command.userContext
      );

      if (!postAuthResult.isAllowed()) {
        await this.auditLogger.logUnauthorizedAccess({
          command: 'RegisterSystemCommand',
          systemId: system.getIdValue(),
          reason: postAuthResult.getReason(),
          userContext: command.userContext,
          timestamp: new Date()
        });

        throw new UnauthorizedOperationError(postAuthResult.getReason());
      }

      // 4. 一意性制約チェック
      const isUnique = await this.systemUniquenessService.isUnique(system);
      if (!isUnique) {
        throw new SystemAlreadyExistsError(system.getIdValue());
      }

      // 5. セキュリティ監査ログ記録
      await this.auditLogger.logAuthorizedSystemCreation({
        systemId: system.getIdValue(),
        securityClassification: system.getSecurityClassification(),
        userContext: command.userContext,
        additionalActions: postAuthResult.getAdditionalActions(),
        timestamp: new Date()
      });

      // 6. PIIマスキング適用したイベント生成
      const maskedEvents = await this.piiProtectionService.maskEventsForLogging(
        system.getUncommittedEvents()
      );

      // 7. ドメインイベント発行 (インフラストラクチャ層でKafkaに送信)
      await this.eventBus.publishAll(system.getUncommittedEvents());

      return system.getId();
    } catch (error) {
      // PIIマスキング適用したエラーログ
      const maskedError = await this.piiProtectionService.maskErrorForLogging(error);
      this.logger.error('System registration failed', {
        error: maskedError,
        userContext: command.userContext
      });
      throw error;
    }
  }
}
```

### 4.2 インフラストラクチャ層: コントローラー統合

```typescript
@Controller('systems')
@UseGuards(AuthGuard, SecurityClassificationGuard)
export class SystemController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly securityPolicy: SystemSecurityPolicy,
    private readonly piiProtectionService: PIIProtectionService
  ) {}

  @Post()
  @SecurityClassification(SecurityClassification.INTERNAL) // デコレーターでセキュリティ分類指定
  async registerSystem(
    @Body() dto: RegisterSystemDto,
    @CurrentUser() user: User
  ): Promise<SystemResponse> {
    try {
      // コマンド作成時にユーザーコンテキストを含める
      const command = new RegisterSystemCommand({
        ...dto,
        userContext: UserContext.fromUser(user)
      });

      const systemId = await this.commandBus.execute(command);

      // 作成成功レスポンス
      return {
        systemId: systemId.getValue(),
        status: 'created',
        message: 'System registered successfully'
      };
    } catch (error) {
      // PIIマスキング適用したエラーレスポンス
      const maskedError = await this.piiProtectionService.maskErrorForLogging(error);
      this.logger.error('System registration failed', maskedError);

      if (error instanceof UnauthorizedOperationError) {
        throw new ForbiddenException('アクセスが拒否されました');
      }

      throw new BadRequestException('システム登録に失敗しました');
    }
  }

  @Get(':id')
  async getSystem(
    @Param('id') id: string,
    @CurrentUser() user: User
  ): Promise<SecurityFilteredSystemResponse> {
    // クエリ実行
    const system = await this.queryBus.execute(
      new GetSystemByIdQuery(id)
    );

    // ユーザーロールに基づくセキュリティフィルタリング
    return SystemSecurityDto.createSecureResponse(
      system,
      user.role,
      this.securityPolicy
    );
  }
}

// セキュリティガード: コントローラーメソッド実行前の認可チェック
@Injectable()
export class SecurityClassificationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: SystemAuthorizationService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredClassification = this.reflector.get<SecurityClassification>(
      'securityClassification',
      context.getHandler()
    );

    if (!requiredClassification) {
      return true; // セキュリティ分類指定なしの場合はアクセス許可
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const authResult = await this.authorizationService.authorizeCommand({
      commandType: 'CONTROLLER_ACCESS',
      targetClassification: requiredClassification,
      requiredAction: SystemAction.READ,
      userRole: user.role
    });

    return authResult.isAllowed();
  }
}

// セキュリティ分類デコレーター
export const SecurityClassification = (classification: SecurityClassification) =>
  SetMetadata('securityClassification', classification);
```
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

### 6.1 層別実装チェックリスト

**ドメイン層**:
- [ ] System集約のセキュリティビジネスルール実装
- [ ] SecurityClassification列挙型定義
- [ ] 値オブジェクトのZodバリデーション統合
- [ ] ドメイン不変条件実装

**アプリケーション層**:
- [ ] SystemAuthorizationService実装
- [ ] SystemSecurityPolicy実装
- [ ] PIIProtectionService実装
- [ ] SecurityAuditLogger実装
- [ ] AuthorizationResult型定義
- [ ] 認可マトリクス設定
- [ ] コマンドハンドラー認可チェック統合

**インフラストラクチャ層**:
- [ ] SystemSecurityDto実装
- [ ] SecurityClassificationGuard実装
- [ ] コントローラーセキュリティ統合
- [ ] PIIマスキングインフラ実装
- [ ] セキュリティ例外ハンドリング

**横断関心事**:
- [ ] ユーザーコンテキスト管理
- [ ] セキュリティ監査ログ統合
- [ ] 分散トレーシング統合

### 6.2 層別テスト要件

**ドメイン層テスト**:
- [ ] System集約のセキュリティビジネスルールテスト
- [ ] 値オブジェクトのZodバリデーションテスト
- [ ] ドメイン不変条件テスト

**アプリケーション層テスト**:
- [ ] 各セキュリティ分類での認可テスト
- [ ] ロール階層テスト
- [ ] PIIProtectionServiceテスト
- [ ] SecurityAuditLoggerテスト
- [ ] コマンドハンドラー統合テスト

**インフラストラクチャ層テスト**:
- [ ] SecurityClassificationGuardテスト
- [ ] SystemSecurityDtoフィルタリングテスト
- [ ] コントローラーセキュリティ統合テスト

**統合テスト**:
- [ ] 不正アクセス検出テスト
- [ ] セキュリティ分類変更テスト
- [ ] 監査ログ記録テスト
- [ ] PIIマスキング統合テスト
- [ ] End-to-Endセキュリティテスト

### 6.3 コンプライアンス・ガバナンス要件

**セキュリティフレームワーク適合性**:
- [ ] ISO 27001 統制マッピングと実装確認
- [ ] NIST Cybersecurity Framework適合性確認
- [ ] OWASP Top 10 対策確認
- [ ] 職務分離統制実装確認

**アーキテクチャガバナンス**:
- [ ] オニオンアーキテクチャ原則遵守確認
- [ ] SOLID原則適用確認
- [ ] 依存性逆転原則遵守確認
- [ ] 層分離の適切性確認

**データ保護コンプライアンス**:
- [ ] PII保護法令適合性確認
- [ ] 個人情報保護法適合性確認
- [ ] データガバナンスポリシー遵守確認
- [ ] 監査ログ保存期間遵守確認
