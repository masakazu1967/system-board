# TypeScript コーディング規約

## 1. 概要

本ドキュメントは、System Board プロジェクトにおけるTypeScriptのコーディング規約を定義します。
フロントエンド（React）とバックエンド（NestJS）の両方で統一された開発標準を確立し、保守性とコード品質の向上を図ります。

## 2. 基本原則

### 型安全性の優先

- `any`型の使用を禁止
- 型ガードを活用した安全なプログラミング
- strictモードでのコンパイル必須

### 可読性の重視

- 自己文書化されたコード
- 明確なネーミング規則
- 適切なコメント

### 一貫性の確保

- プロジェクト全体での統一されたスタイル
- ESLint・Prettierによる自動フォーマット

## 3. ファイル・ディレクトリ命名規則

### ファイル命名規則

#### クラス・インターフェース・型定義

```typescript
// 主なオブジェクトと同名のファイル名
ValueObject.ts          // ValueObjectクラス定義
UserRepository.ts       // UserRepositoryインターフェース定義
SystemEntity.ts         // SystemEntityクラス定義
```

#### テストファイル

```typescript
ValueObject.spec.ts     // ValueObjectクラスのテスト
SystemEntity.spec.ts    // SystemEntityクラスのテスト
```

#### 関数・ユーティリティ

```typescript
// camelCase形式
validateEmail.ts
formatDateTime.ts
calculateRiskScore.ts
```

#### React コンポーネント

```typescript
// PascalCase形式
SystemDashboard.tsx
VulnerabilityList.tsx
TaskManagement.tsx
```

#### 設定・定数ファイル

```typescript
// kebab-case形式
database-config.ts
api-endpoints.ts
error-messages.ts
```

### ディレクトリ命名規則

```text
// kebab-case形式
src/
├── system-management/
├── task-management/
├── vulnerability-management/
└── shared-components/
```

## 4. 型定義規約

### インターフェース定義

```typescript
// プレフィックス 'I' は使用しない
interface User {
  readonly id: string;
  readonly email: string;
  readonly createdAt: Date;
}

// 設定系インターフェース
interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
}
```

### 型エイリアス

```typescript
// Union型の定義
type UserRole = 'admin' | 'user' | 'viewer';
type VulnerabilitySeverity = 'low' | 'medium' | 'high' | 'critical';

// 汎用型の定義
type Result<T, E = Error> = {
  success: true;
  data: T;
} | {
  success: false;
  error: E;
};
```

### 列挙型（Enum）

```typescript
// 文字列列挙型を優先
enum SystemStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
  EOL = 'end-of-life'
}

// 定数列挙型（const enum）は避ける
```

## 5. クラス設計規約

### 基本構造

#### エンティティ基底クラス設計

```typescript
// 抽象エンティティ基底クラス
export abstract class AbstractEntity<ID extends PrimitiveValueObject<string>, PROPS> {
  protected constructor(public readonly id: ID, protected readonly props: PROPS) {}

  public equals(entity?: AbstractEntity<ID, PROPS>): boolean {
    if (entity == null) {
      return false;
    }
    return this.id.equals(entity.id);
  }
}

// 具象エンティティ基底クラス
interface Props {
  [key: string]: any;
}

export abstract class Entity<
  ID extends PrimitiveValueObject<string>,
  PROPS extends Props
> extends AbstractEntity<ID, PROPS> {
  protected constructor(id: ID, props: PROPS) {
    super(id, props);
  }
}
```

#### 具体的なエンティティ実装例

```typescript
// SystemEntityのプロパティ定義
interface SystemProps {
  name: SystemName;
  status: SystemStatus;
}

// ドメインエンティティの例
export class SystemEntity extends Entity<SystemId, SystemProps> {
  private constructor(id: SystemId, props: SystemProps) {
    super(id, props);
  }

  // ファクトリーメソッド（値オブジェクトでのやり取り）
  public static create(
    id: SystemId,
    props: SystemProps
  ): Result<SystemEntity, ValidationError> {
    // ビジネスルール検証
    if (!id || !props.name || !props.status) {
      return {
        success: false,
        error: new ValidationError('Required properties are missing')
      };
    }

    return {
      success: true,
      data: new SystemEntity(id, props)
    };
  }

  // ゲッター
  public get name(): SystemName {
    return this.props.name;
  }

  public get status(): SystemStatus {
    return this.props.status;
  }

  // ドメインメソッド
  public updateStatus(newStatus: SystemStatus): SystemEntity {
    const newProps: SystemProps = {
      ...this.props,
      status: newStatus
    };
    return new SystemEntity(this.id, newProps);
  }

  public updateName(newName: SystemName): SystemEntity {
    const newProps: SystemProps = {
      ...this.props,
      name: newName
    };
    return new SystemEntity(this.id, newProps);
  }

  // ビジネスルールメソッド
  public isActive(): boolean {
    return this.props.status.equals(SystemStatus.ACTIVE);
  }

  public canBeDeleted(): boolean {
    return this.props.status.equals(SystemStatus.INACTIVE) ||
           this.props.status.equals(SystemStatus.DEPRECATED);
  }
}
```

#### ビルダーパターンの実装

```typescript
// 値オブジェクト用ビルダー
export class SystemIdBuilder {
  private value: string | undefined;
  private vo: SystemId | undefined;

  private constructor() {}

  public static of(): SystemIdBuilder {
    return new SystemIdBuilder();
  }

  public setValue(value: string): this {
    this.value = value;
    return this;
  }

  public set(vo: SystemId): this {
    this.vo = vo;
    return this;
  }

  public build(): Result<SystemId, ValidationError> {
    if (this.vo != null) {
      return { success: true, data: this.vo };
    }
    if (this.value != null) {
      return SystemId.create(this.value);
    }
    return { success: false, error: new ValidationError('SystemId value not set') };
  }
}

export class SystemNameBuilder {
  private value: string | undefined;
  private vo: SystemName | undefined;

  private constructor() {}

  public static of(): SystemNameBuilder {
    return new SystemNameBuilder();
  }

  public setValue(value: string): this {
    this.value = value;
    return this;
  }

  public set(vo: SystemName): this {
    this.vo = vo;
    return this;
  }

  public build(): Result<SystemName, ValidationError> {
    if (this.vo != null) {
      return { success: true, data: this.vo };
    }
    if (this.value != null) {
      return SystemName.create(this.value);
    }
    return { success: false, error: new ValidationError('SystemName value not set') };
  }
}

export class SystemStatusBuilder {
  private value: string | undefined;
  private vo: SystemStatus | undefined;

  private constructor() {}

  public static of(): SystemStatusBuilder {
    return new SystemStatusBuilder();
  }

  public setValue(value: string): this {
    this.value = value;
    return this;
  }

  public set(vo: SystemStatus): this {
    this.vo = vo;
    return this;
  }

  public build(): Result<SystemStatus, ValidationError> {
    if (this.vo != null) {
      return { success: true, data: this.vo };
    }
    if (this.value != null) {
      return SystemStatus.create(this.value);
    }
    return { success: false, error: new ValidationError('SystemStatus value not set') };
  }
}

// エンティティ用ビルダー
export class SystemEntityBuilder {
  private idBuilder = SystemIdBuilder.of();
  private nameBuilder = SystemNameBuilder.of();
  private statusBuilder = SystemStatusBuilder.of();

  private constructor() {}

  public static of(): SystemEntityBuilder {
    return new SystemEntityBuilder();
  }

  // ID設定メソッド
  public setIdValue(value: string): this {
    this.idBuilder.setValue(value);
    return this;
  }

  public setId(vo: SystemId): this {
    this.idBuilder.set(vo);
    return this;
  }

  // Name設定メソッド
  public setNameValue(value: string): this {
    this.nameBuilder.setValue(value);
    return this;
  }

  public setName(vo: SystemName): this {
    this.nameBuilder.set(vo);
    return this;
  }

  // Status設定メソッド
  public setStatusValue(value: string): this {
    this.statusBuilder.setValue(value);
    return this;
  }

  public setStatus(vo: SystemStatus): this {
    this.statusBuilder.set(vo);
    return this;
  }

  public build(): Result<SystemEntity, ValidationError> {
    // 各値オブジェクトを構築
    const idResult = this.idBuilder.build();
    if (!idResult.success) return idResult;

    const nameResult = this.nameBuilder.build();
    if (!nameResult.success) return nameResult;

    const statusResult = this.statusBuilder.build();
    if (!statusResult.success) return statusResult;

    // エンティティを構築
    return SystemEntity.create(idResult.data, {
      name: nameResult.data,
      status: statusResult.data
    });
  }
}
```

#### ビルダーパターンの使用例

```typescript
// 値オブジェクトと値本体が混在する場合の例
const existingId: SystemId = SystemId.create('sys-123').data;
const name: string = 'Production Server';
const existingStatus: SystemStatus = SystemStatus.ACTIVE;

const systemResult = SystemEntityBuilder
  .of()
  .setId(existingId)           // 既存の値オブジェクト
  .setNameValue(name)          // 文字列値
  .setStatus(existingStatus)   // 既存の値オブジェクト
  .build();

if (systemResult.success) {
  const system = systemResult.data;
  console.log(`Created system: ${system.name.toString()}`);
}
```

### 値オブジェクト

#### 基底クラス設計

```typescript
import deepEqual from 'deep-equal';

// 抽象基底クラス
export abstract class AbstractValueObject<T> {
  protected constructor(protected readonly props: T) {}

  public equals(vo?: AbstractValueObject<T>): boolean {
    if (vo == null) {
      return false;
    }
    return deepEqual(this.props, vo.props);
  }
}

// プリミティブ型値オブジェクト基底クラス
export abstract class PrimitiveValueObject<T extends string | number | bigint | boolean>
  extends AbstractValueObject<T> {
  protected constructor(props: T) {
    super(props);
  }

  public get value(): T {
    return this.props;
  }
}

// 複合型値オブジェクト基底クラス
interface Props {
  [key: string]: any;
}

export abstract class ValueObject<T extends Props> extends AbstractValueObject<T> {
  protected constructor(props: T) {
    super(props);
  }
}
```

#### 具体的な値オブジェクト実装例

```typescript
// プリミティブ型値オブジェクトの例
export class SystemId extends PrimitiveValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  public static create(value: string): Result<SystemId, ValidationError> {
    if (!value || value.length === 0) {
      return {
        success: false,
        error: new ValidationError('SystemId cannot be empty')
      };
    }

    return {
      success: true,
      data: new SystemId(value)
    };
  }

  public toString(): string {
    return this.value;
  }
}

// 複合型値オブジェクトの例
interface EmailProps {
  localPart: string;
  domain: string;
}

export class EmailAddress extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  public static create(email: string): Result<EmailAddress, ValidationError> {
    const emailRegex = /^([^@]+)@([^@]+)$/;
    const match = email.match(emailRegex);

    if (!match) {
      return {
        success: false,
        error: new ValidationError('Invalid email format')
      };
    }

    return {
      success: true,
      data: new EmailAddress({
        localPart: match[1],
        domain: match[2]
      })
    };
  }

  public toString(): string {
    return `${this.props.localPart}@${this.props.domain}`;
  }

  public get localPart(): string {
    return this.props.localPart;
  }

  public get domain(): string {
    return this.props.domain;
  }
}
```

## 6. 関数・メソッド規約

### 関数定義

```typescript
// アロー関数を優先（純粋関数）
const calculateRiskScore = (
  vulnerabilities: Vulnerability[],
  systemCriticality: SystemCriticality
): RiskScore => {
  // 実装
};

// 非同期関数
const fetchSystemData = async (
  systemId: SystemId
): Promise<Result<SystemData, FetchError>> => {
  try {
    // 実装
  } catch (error) {
    return {
      success: false,
      error: new FetchError('Failed to fetch system data', error)
    };
  }
};
```

### メソッドの可視性

```typescript
class UserService {
  // パブリックメソッド：インターフェース
  public async createUser(userData: CreateUserRequest): Promise<Result<User, CreateUserError>> {
    const validationResult = this.validateUserData(userData);
    if (!validationResult.success) return validationResult;

    return this.persistUser(userData);
  }

  // プライベートメソッド：内部実装
  private validateUserData(userData: CreateUserRequest): Result<void, ValidationError> {
    // バリデーションロジック
  }

  private async persistUser(userData: CreateUserRequest): Promise<Result<User, PersistenceError>> {
    // 永続化ロジック
  }
}
```

## 7. エラーハンドリング規約

### カスタムエラークラス

```typescript
// 基底エラークラス
export abstract class DomainError extends Error {
  protected constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// 具体的なエラークラス
export class ValidationError extends DomainError {
  constructor(message: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', cause);
  }
}

export class SystemNotFoundError extends DomainError {
  constructor(systemId: string, cause?: Error) {
    super(`System with ID ${systemId} not found`, 'SYSTEM_NOT_FOUND', cause);
  }
}
```

### Result型パターン

```typescript
// 成功・失敗を型で表現
type Result<T, E = Error> = Success<T> | Failure<E>;

interface Success<T> {
  success: true;
  data: T;
}

interface Failure<E> {
  success: false;
  error: E;
}

// 使用例
const processSystemData = (data: RawSystemData): Result<ProcessedData, ProcessingError> => {
  try {
    const processed = processData(data);
    return { success: true, data: processed };
  } catch (error) {
    return { success: false, error: new ProcessingError('Processing failed', error) };
  }
};
```

## 8. React/Frontend 固有規約

### コンポーネント定義

```typescript
// 関数コンポーネント（推奨）
interface SystemDashboardProps {
  readonly systemId: string;
  readonly onSystemUpdate?: (system: System) => void;
}

export const SystemDashboard: React.FC<SystemDashboardProps> = ({
  systemId,
  onSystemUpdate
}) => {
  const [system, setSystem] = useState<System | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadSystem = async () => {
      try {
        setLoading(true);
        const result = await fetchSystem(systemId);
        if (result.success) {
          setSystem(result.data);
        } else {
          setError(result.error);
        }
      } finally {
        setLoading(false);
      }
    };

    loadSystem();
  }, [systemId]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!system) return <NotFound />;

  return (
    <div className="system-dashboard">
      {/* JSX実装 */}
    </div>
  );
};
```

### Hooks規約

```typescript
// カスタムフック
export const useSystemData = (systemId: string) => {
  const [state, setState] = useState<{
    data: System | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const result = await fetchSystem(systemId);

        if (cancelled) return;

        if (result.success) {
          setState({ data: result.data, loading: false, error: null });
        } else {
          setState({ data: null, loading: false, error: result.error });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ data: null, loading: false, error: error as Error });
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [systemId]);

  return state;
};
```

## 9. NestJS/Backend 固有規約

### コントローラー

```typescript
@Controller('systems')
@ApiTags('systems')
export class SystemController {
  constructor(
    private readonly systemService: SystemService,
    private readonly logger: Logger
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get system by ID' })
  @ApiResponse({ status: 200, type: SystemResponseDto })
  @ApiResponse({ status: 404, description: 'System not found' })
  public async getSystem(
    @Param('id') id: string
  ): Promise<SystemResponseDto> {
    this.logger.log(`Fetching system with ID: ${id}`);

    const result = await this.systemService.getSystem(id);
    if (!result.success) {
      throw new NotFoundException(result.error.message);
    }

    return SystemResponseDto.fromDomain(result.data);
  }

  @Post()
  @ApiOperation({ summary: 'Create new system' })
  @ApiResponse({ status: 201, type: SystemResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  public async createSystem(
    @Body() createSystemDto: CreateSystemDto
  ): Promise<SystemResponseDto> {
    const result = await this.systemService.createSystem(createSystemDto.toDomain());
    if (!result.success) {
      throw new BadRequestException(result.error.message);
    }

    return SystemResponseDto.fromDomain(result.data);
  }
}
```

### サービス

#### アプリケーションサービス vs ドメインサービスの区別

**アプリケーションサービス**: ユースケースの実行、外部システムとの連携、トランザクション制御、ドメインイベントによるモジュール間連携を担当
**ドメインサービス**: 単一コンテキスト内の複数ドメインオブジェクト間の複雑なビジネスロジックを担当

```typescript
// リポジトリインターフェース - 値オブジェクトを使用
export interface SystemRepository {
  findById(id: SystemId): Promise<SystemEntity | null>;
  save(system: SystemEntity): Promise<SystemEntity>;
  delete(id: SystemId): Promise<void>;
  findByStatus(status: SystemStatus): Promise<SystemEntity[]>;
  findAll(): Promise<SystemEntity[]>;
}

// アプリケーションサービス - ユースケースの実行と外部システムとの連携
@Injectable()
export class SystemApplicationService {
  constructor(
    private readonly systemRepository: SystemRepository,
    private readonly eventBus: EventBus,
    private readonly logger: Logger
  ) {}

  public async getSystem(id: string): Promise<Result<System, SystemNotFoundError>> {
    const systemId = SystemId.create(id);
    if (!systemId.success) {
      return { success: false, error: new SystemNotFoundError(id) };
    }

    const system = await this.systemRepository.findById(systemId.data);
    if (!system) {
      return { success: false, error: new SystemNotFoundError(id) };
    }

    return { success: true, data: system };
  }

  public async createSystem(
    systemData: CreateSystemData
  ): Promise<Result<System, CreateSystemError>> {
    try {
      // ドメインオブジェクト生成
      const system = System.create(systemData);
      if (!system.success) {
        return { success: false, error: new CreateSystemError(system.error.message) };
      }

      // 永続化
      const savedSystem = await this.systemRepository.save(system.data);

      // ドメインイベント発行
      await this.eventBus.publish(new SystemCreatedEvent(savedSystem.id));

      return { success: true, data: savedSystem };
    } catch (error) {
      this.logger.error('Failed to create system', error);
      return { success: false, error: new CreateSystemError('System creation failed') };
    }
  }

  // モジュラーモノリス: ドメインイベントによる非同期連携
  public async requestSystemRiskCalculation(systemId: string): Promise<Result<void, DomainError>> {
    try {
      const systemIdVO = SystemId.create(systemId);
      if (!systemIdVO.success) {
        return { success: false, error: new ValidationError('Invalid system ID') };
      }

      // システム情報を取得
      const system = await this.systemRepository.findById(systemIdVO.data);
      if (!system) {
        return { success: false, error: new SystemNotFoundError(systemId) };
      }

      // ドメインイベント発行: 他のコンテキストに脆弱性データ要求
      await this.eventBus.publish(new SystemRiskCalculationRequestedEvent({
        systemId: systemIdVO.data,
        requestId: RequestId.generate(),
        requestedAt: new Date(),
        systemCriticality: system.criticality.value,
        exposureLevel: system.exposureLevel.value
      }));

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to request risk calculation', error);
      return { success: false, error: new DomainError('Risk calculation request failed') };
    }
  }

  // イベントハンドラー: 他のコンテキストからの応答を処理
  @EventHandler(VulnerabilityDataProvidedEvent)
  public async handleVulnerabilityDataProvided(event: VulnerabilityDataProvidedEvent): Promise<void> {
    try {
      // システム情報を再取得
      const system = await this.systemRepository.findById(event.systemId);
      if (!system) {
        this.logger.error(`System not found: ${event.systemId}`);
        return;
      }

      // リスクスコア計算
      const riskScore = this.calculateRiskScore(
        system.criticality.value,
        event.vulnerabilityScore,
        system.exposureLevel.value
      );

      // リスクスコア更新
      const updatedSystem = system.updateRiskScore(riskScore);
      await this.systemRepository.save(updatedSystem);

      // 計算完了イベント発行
      await this.eventBus.publish(new SystemRiskCalculationCompletedEvent({
        systemId: event.systemId,
        requestId: event.requestId,
        riskScore: riskScore.value,
        calculatedAt: new Date()
      }));

    } catch (error) {
      this.logger.error('Failed to process vulnerability data', error);
    }
  }

  private calculateRiskScore(
    systemCriticality: number,
    vulnerabilityScore: number,
    exposureLevel: number
  ): RiskScore {
    const totalRisk = systemCriticality * vulnerabilityScore * exposureLevel;
    return RiskScore.create(totalRisk);
  }
}

// ドメインサービス - 単一コンテキスト内の複雑なビジネスロジック
export class SystemDomainService {
  // システムコンテキスト内のビジネスルール
  public calculateSystemCriticality(
    systemType: SystemType,
    businessImpact: BusinessImpact,
    userCount: UserCount
  ): SystemCriticality {
    // システムタイプ、ビジネス影響度、利用者数から重要度を算出
    let criticalityScore = systemType.baseScore;

    if (businessImpact.isHigh()) {
      criticalityScore *= 2;
    }

    if (userCount.isLarge()) {
      criticalityScore *= 1.5;
    }

    return SystemCriticality.create(criticalityScore);
  }

  public validateSystemConfiguration(
    system: SystemEntity,
    requiredComponents: SystemComponent[]
  ): Result<void, SystemConfigurationError> {
    // システム構成の妥当性検証
    const missingComponents = requiredComponents.filter(
      component => !system.hasComponent(component)
    );

    if (missingComponents.length > 0) {
      return {
        success: false,
        error: new SystemConfigurationError(
          `Missing required components: ${missingComponents.map(c => c.name).join(', ')}`
        )
      };
    }

    return { success: true, data: undefined };
  }
}

// ドメインイベント定義例
export class SystemRiskCalculationRequestedEvent implements DomainEvent {
  public readonly eventId: string = EventId.generate();
  public readonly occurredAt: Date = new Date();
  public readonly eventType: string = 'SystemRiskCalculationRequested';

  constructor(
    public readonly payload: {
      systemId: SystemId;
      requestId: RequestId;
      requestedAt: Date;
      systemCriticality: number;
      exposureLevel: number;
    }
  ) {}
}

export class VulnerabilityDataProvidedEvent implements DomainEvent {
  public readonly eventId: string = EventId.generate();
  public readonly occurredAt: Date = new Date();
  public readonly eventType: string = 'VulnerabilityDataProvided';

  constructor(
    public readonly payload: {
      systemId: SystemId;
      requestId: RequestId;
      vulnerabilityScore: number;
      vulnerabilityCount: number;
      providedAt: Date;
    }
  ) {}

  public get systemId(): SystemId { return this.payload.systemId; }
  public get requestId(): RequestId { return this.payload.requestId; }
  public get vulnerabilityScore(): number { return this.payload.vulnerabilityScore; }
}

export class SystemRiskCalculationCompletedEvent implements DomainEvent {
  public readonly eventId: string = EventId.generate();
  public readonly occurredAt: Date = new Date();
  public readonly eventType: string = 'SystemRiskCalculationCompleted';

  constructor(
    public readonly payload: {
      systemId: SystemId;
      requestId: RequestId;
      riskScore: number;
      calculatedAt: Date;
    }
  ) {}
}
```

## 10. テスト規約

### 単体テスト

```typescript
// ドメインオブジェクトのテスト
describe('SystemEntity', () => {
  describe('create', () => {
    it('should create valid system entity', () => {
      // Arrange
      const validProps = {
        id: 'sys-123',
        name: 'Test System',
        status: 'active'
      };

      // Act
      const result = SystemEntity.create(validProps);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id.toString()).toBe('sys-123');
        expect(result.data.name.toString()).toBe('Test System');
      }
    });

    it('should fail when id is empty', () => {
      // Arrange
      const invalidProps = {
        id: '',
        name: 'Test System',
        status: 'active'
      };

      // Act
      const result = SystemEntity.create(invalidProps);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });
});
```

### 統合テスト

```typescript
// Nestjs コントローラーのテスト
describe('SystemController (e2e)', () => {
  let app: INestApplication;
  let systemRepository: SystemRepository;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    systemRepository = moduleFixture.get<SystemRepository>(SystemRepository);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/systems (GET)', () => {
    it('should return system list', async () => {
      // Arrange
      const system = await systemRepository.save(createTestSystem());

      // Act
      const response = await request(app.getHttpServer())
        .get('/systems')
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(system.id.toString());
    });
  });
});
```

## 11. インポート規約

### インポート順序

```typescript
// 1. Node.js標準ライブラリ
import { readFile } from 'fs/promises';
import { join } from 'path';

// 2. 外部ライブラリ
import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import React, { useState, useEffect } from 'react';

// 3. 内部ライブラリ（相対パス以外）
import { SystemEntity } from '@/domain/entities/SystemEntity';
import { SystemRepository } from '@/domain/repositories/SystemRepository';

// 4. 相対パス
import { validateSystemData } from '../utils/validateSystemData';
import { SystemService } from './SystemService';
```

### エクスポート規約

```typescript
// 名前付きエクスポートを優先
export { SystemEntity } from './SystemEntity';
export { SystemRepository } from './SystemRepository';
export { SystemService } from './SystemService';

// インデックスファイル（index.ts）でのreexport
export * from './entities';
export * from './repositories';
export * from './services';

// デフォルトエクスポートは限定的に使用（React コンポーネントなど）
export default SystemDashboard;
```

## 12. 設定・環境

### ESLint設定

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/prefer-readonly": "warn"
  }
}
```

### tsconfig.json 重要設定

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## 13. 推奨プラクティス

### パフォーマンス

- 遅延ローディングの活用
- メモ化による最適化
- 適切なインデックスファイル

### セキュリティ

- 入力値検証の徹底
- SQLインジェクション対策
- XSS対策

### 保守性

- 単一責任原則の遵守
- 依存性注入の活用
- 設定の外部化

## 14. 禁止事項

### 型関連

- `any`型の使用
- `@ts-ignore`の使用
- `eval()`の使用

### 14.1 コード品質

- 未使用変数・インポートの残存
- 不適切なネーミング
- ハードコーディング

### 14.2 セキュリティ

- 機密情報のハードコーディング
- 不適切な権限設定
- 入力値検証の省略

---

このコーディング規約は、System Board プロジェクトの品質向上と開発効率の向上を目的としています。
定期的な見直しと改善を行い、プロジェクトの成長に合わせて発展させていきます。
