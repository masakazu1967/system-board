# TypeORM Error Handler

DBMS固有のエラーを抽象化して処理するユーティリティ群です。依存性注入（DI）を使用して、実行環境に応じた適切なエラーハンドラーが自動的に選択されます。

## アーキテクチャ

### 設計パターン

- **Strategy Pattern**: DBMS別のエラー処理戦略を切り替え可能
- **Dependency Injection**: 環境変数に基づいて適切な実装を注入
- **Abstract Base Class**: 共通処理を基底クラスに実装

### クラス構成

```text
ITypeOrmErrorHandler (interface)
    ↑
BaseTypeOrmErrorHandler (abstract class)
    ↑
    ├── PostgresErrorHandler (PostgreSQL用)
    ├── MySqlErrorHandler (MySQL用)
    └── SqliteErrorHandler (SQLite用)
```

## 対応DBMS

### PostgreSQL

- UNIQUE制約違反: `23505`
- FOREIGN KEY制約違反: `23503`
- NOT NULL制約違反: `23502`
- CHECK制約違反: `23514`
- デッドロック: `40P01`
- タイムアウト: `57014`, `57P01`

### MySQL

- UNIQUE制約違反: `ER_DUP_ENTRY`
- FOREIGN KEY制約違反: `ER_NO_REFERENCED_ROW_2`, `ER_ROW_IS_REFERENCED_2`
- NOT NULL制約違反: `ER_BAD_NULL_ERROR`
- CHECK制約違反: `ER_CHECK_CONSTRAINT_VIOLATED`
- デッドロック: `ER_LOCK_DEADLOCK`
- タイムアウト: `ER_LOCK_WAIT_TIMEOUT`

### SQLite / better-sqlite3

- UNIQUE制約違反: メッセージに`UNIQUE constraint failed`を含む
- FOREIGN KEY制約違反: メッセージに`FOREIGN KEY constraint failed`を含む
- NOT NULL制約違反: メッセージに`NOT NULL constraint failed`を含む
- CHECK制約違反: メッセージに`CHECK constraint failed`を含む
- デッドロック/ロック: メッセージに`database is locked`を含む

## 使い方

### 1. 環境変数の設定

以下のいずれかの環境変数でDBMS種別を指定します：

```bash
# PostgreSQL
DATABASE_TYPE=postgres
# または
TYPEORM_TYPE=postgresql

# MySQL
DATABASE_TYPE=mysql
# または
TYPEORM_TYPE=mariadb

# SQLite
DATABASE_TYPE=sqlite
# または
TYPEORM_TYPE=better-sqlite3
```

### 2. モジュールへの登録

NestJSモジュールでプロバイダーを登録します：

```typescript
import { Module } from '@nestjs/common';
import { typeOrmErrorHandlerProviders } from './utils/typeorm-error-handler.provider';

@Module({
  providers: [
    ...typeOrmErrorHandlerProviders,
    // 他のプロバイダー
  ],
  exports: [typeOrmErrorHandlerProviders],
})
export class InfrastructureModule {}
```

### 3. サービスでの使用

コンストラクタインジェクションでエラーハンドラーを受け取ります：

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ITypeOrmErrorHandler } from './utils/TypeOrmErrorHandler.interface';
import { TYPEORM_ERROR_HANDLER } from './utils/typeorm-error-handler.provider';

@Injectable()
export class YourService {
  constructor(
    @Inject(TYPEORM_ERROR_HANDLER)
    private readonly errorHandler: ITypeOrmErrorHandler,
  ) {}

  async yourMethod() {
    try {
      // データベース操作
      await this.repository.insert({ ... });
    } catch (error) {
      // UNIQUE制約エラーを冪等的に処理
      this.errorHandler.handleUniqueConstraintError(error, 'record-id', true);
    }
  }
}
```

### 4. テストでの使用

テストでは環境に応じたConfigServiceをモックします：

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { typeOrmErrorHandlerProvider } from './utils/typeorm-error-handler.provider';

const module = await Test.createTestingModule({
  providers: [
    YourService,
    typeOrmErrorHandlerProvider,
    {
      provide: ConfigService,
      useValue: {
        get: jest.fn((key: string) => {
          if (key === 'DATABASE_TYPE') return 'better-sqlite3';
          return undefined;
        }),
      },
    },
  ],
}).compile();
```

## API リファレンス

### ITypeOrmErrorHandler

#### isUniqueConstraintError(error: unknown): boolean

UNIQUE制約違反エラーかどうかを判定します。

#### isForeignKeyConstraintError(error: unknown): boolean

FOREIGN KEY制約違反エラーかどうかを判定します。

#### isNotNullConstraintError(error: unknown): boolean

NOT NULL制約違反エラーかどうかを判定します。

#### isCheckConstraintError(error: unknown): boolean

CHECK制約違反エラーかどうかを判定します。

#### isDeadlockError(error: unknown): boolean

デッドロックエラーかどうかを判定します。

#### isTimeoutError(error: unknown): boolean

タイムアウトエラーかどうかを判定します。

#### handleUniqueConstraintError(error: unknown, identifier: string, suppressError?: boolean): void

UNIQUE制約エラーを安全に処理します（冪等性保証）。

- `error`: エラーオブジェクト
- `identifier`: 処理対象の識別子（ログ用）
- `suppressError`: エラーを抑制するか（デフォルト: true）

#### logError(error: unknown, context: string): void

エラー情報を整形してログ出力します。

- `error`: エラーオブジェクト
- `context`: コンテキスト情報

## 実装例

### 冪等性を保証した挿入処理

```typescript
async markAsProcessed(eventId: string, eventType: string, processedAt: Date): Promise<void> {
  try {
    await this.processedEventRepository.insert({
      eventId,
      eventType,
      processedAt,
    });
  } catch (error: unknown) {
    // UNIQUE制約エラーは無視（ON CONFLICT DO NOTHING相当）
    this.errorHandler.handleUniqueConstraintError(error, eventId, true);
  }
}
```

### 外部キー制約エラーのハンドリング

```typescript
async deleteRecord(id: string): Promise<void> {
  try {
    await this.repository.delete(id);
  } catch (error: unknown) {
    if (this.errorHandler.isForeignKeyConstraintError(error)) {
      throw new BadRequestException('Cannot delete: record is referenced by other data');
    }
    throw error;
  }
}
```

### デッドロックのリトライ処理

```typescript
async updateWithRetry(id: string, data: any, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await this.repository.update(id, data);
      return;
    } catch (error: unknown) {
      if (this.errorHandler.isDeadlockError(error) && attempt < maxRetries) {
        await this.delay(100 * attempt); // exponential backoff
        continue;
      }
      throw error;
    }
  }
}

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## 拡張方法

新しいDBMSをサポートする場合：

1. `BaseTypeOrmErrorHandler`を継承した具象クラスを作成
2. 各メソッドでDBMS固有のエラーコード/メッセージを判定
3. `typeorm-error-handler.provider.ts`のファクトリーに追加

```typescript
// 例: Oracle用ハンドラー
@Injectable()
export class OracleErrorHandler extends BaseTypeOrmErrorHandler {
  isUniqueConstraintError(error: unknown): boolean {
    const driverError = this.getDriverError(error);
    return driverError?.code === 'ORA-00001';
  }
  // 他のメソッドも実装...
}

// プロバイダーに追加
case 'oracle':
  return new OracleErrorHandler();
```

## ベストプラクティス

1. **環境変数の設定**: 本番環境では必ず`DATABASE_TYPE`を明示的に設定
2. **冪等性の保証**: UNIQUE制約エラーは通常抑制して冪等性を確保
3. **ログ出力**: `logError`メソッドでDBMS固有のエラー詳細を記録
4. **リトライ戦略**: デッドロックやタイムアウトは適切にリトライ
5. **テスト**: 各DBMS環境でのテストを実施

## トラブルシューティング

### 問題: エラーハンドラーが正しく動作しない

**原因**: 環境変数が設定されていない、または値が不正

**解決策**:

```bash
# 環境変数を確認
echo $DATABASE_TYPE

# 正しい値を設定
export DATABASE_TYPE=postgres
```

### 問題: DIの注入エラー

**原因**: プロバイダーがモジュールに登録されていない

**解決策**:

```typescript
@Module({
  providers: [
    ...typeOrmErrorHandlerProviders, // これを追加
  ],
})
```

### 問題: テストで予期しないエラーハンドラーが使用される

**原因**: ConfigServiceのモックが不適切

**解決策**:

```typescript
{
  provide: ConfigService,
  useValue: {
    get: jest.fn((key: string) => {
      if (key === 'DATABASE_TYPE') return 'better-sqlite3'; // テスト用のDBMS
      return undefined;
    }),
  },
}
```
