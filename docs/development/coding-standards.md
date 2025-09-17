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
UserRepository.spec.ts  // UserRepositoryのテスト
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

```typescript
// ドメインエンティティの例
export class SystemEntity {
  private constructor(
    private readonly _id: SystemId,
    private readonly _name: SystemName,
    private readonly _status: SystemStatus
  ) {}

  // ファクトリーメソッド
  public static create(props: {
    id: string;
    name: string;
    status: string;
  }): Result<SystemEntity, ValidationError> {
    // バリデーションロジック
    const id = SystemId.create(props.id);
    if (!id.success) return id;

    const name = SystemName.create(props.name);
    if (!name.success) return name;

    // インスタンス生成
    return {
      success: true,
      data: new SystemEntity(id.data, name.data, props.status as SystemStatus)
    };
  }

  // ゲッター
  public get id(): SystemId {
    return this._id;
  }

  public get name(): SystemName {
    return this._name;
  }

  // ドメインメソッド
  public updateStatus(newStatus: SystemStatus): SystemEntity {
    return new SystemEntity(this._id, this._name, newStatus);
  }
}
```

### 値オブジェクト

```typescript
export class SystemId {
  private constructor(private readonly value: string) {}

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

  public equals(other: SystemId): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
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

```typescript
@Injectable()
export class SystemService {
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
      const system = System.create(systemData);
      if (!system.success) {
        return { success: false, error: new CreateSystemError(system.error.message) };
      }

      const savedSystem = await this.systemRepository.save(system.data);

      // ドメインイベント発行
      await this.eventBus.publish(new SystemCreatedEvent(savedSystem.id));

      return { success: true, data: savedSystem };
    } catch (error) {
      this.logger.error('Failed to create system', error);
      return { success: false, error: new CreateSystemError('System creation failed') };
    }
  }
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
