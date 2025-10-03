# EventStore (Kurrent) Integration

EventStoreDB (Kurrent) とKafkaを組み合わせたEvent Sourcing実装です。

## アーキテクチャ

### イベントフロー

```
[Aggregate] → [DomainEvent] → [KafkaEventPublisher] → Kafka
                                                          ↓
                                              [KurrentKafkaSubscriber]
                                                          ↓
                                                  [EventStoreDB]
```

### コンポーネント

1. **KurrentDBClient (Interface)**: EventStoreDB操作の抽象インターフェース
2. **EventStoreDBKurrentClient (Implementation)**: EventStoreDBクライアント具象クラス
3. **KurrentKafkaSubscriber**: Kafkaからイベントを受信してEventStoreDBに永続化

## セットアップ

### 1. 依存関係

```bash
pnpm add @eventstore/db-client
```

### 2. 環境変数

```bash
# EventStoreDB接続文字列
EVENTSTORE_CONNECTION_STRING=esdb://localhost:2113?tls=false
# または
KURRENT_CONNECTION_STRING=esdb://localhost:2113?tls=false
```

### 3. モジュール設定

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { kurrentDbProviders } from './infrastructure/eventstore/kurrent-client.provider';
import { KurrentKafkaSubscriber } from './infrastructure/eventstore/KurrentKafkaSubscriber';

@Module({
  imports: [ConfigModule],
  providers: [
    ...kurrentDbProviders,
    KurrentKafkaSubscriber,
  ],
  exports: [kurrentDbProviders],
})
export class EventStoreModule {}
```

## 使い方

### DomainEventの作成

```typescript
import { DomainEvent } from './domain/base/DomainEvent';

export class SystemRegisteredEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly systemName: string,
    public readonly description: string,
    aggregateVersion: number,
    correlationId: string,
  ) {
    super(
      'SystemRegistered',
      aggregateId,
      'System',
      aggregateVersion,
      correlationId,
    );
  }

  getData(): unknown {
    return {
      systemName: this.systemName,
      description: this.description,
    };
  }
}
```

### イベントの永続化

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { KurrentDBClient } from './KurrentDBClient';
import { KURRENT_DB_CLIENT } from './kurrent-client.provider';

@Injectable()
export class SystemEventStore {
  constructor(
    @Inject(KURRENT_DB_CLIENT)
    private readonly kurrentClient: KurrentDBClient,
  ) {}

  async saveEvents(
    streamName: string,
    events: DomainEvent[],
    expectedVersion?: number,
  ): Promise<void> {
    await this.kurrentClient.appendToStream(
      streamName,
      events,
      { expectedRevision: expectedVersion },
    );
  }

  async loadEvents(streamName: string): Promise<DomainEvent[]> {
    return await this.kurrentClient.readStream(streamName);
  }
}
```

### ストリーム命名規則

```typescript
// システム集約のストリーム名
const streamName = `System-${aggregateId}`;

// 例: System-550e8400-e29b-41d4-a716-446655440000
```

## EventStoreDB 設定

### Docker Compose

```yaml
version: '3.8'
services:
  eventstore:
    image: eventstore/eventstore:latest
    environment:
      - EVENTSTORE_CLUSTER_SIZE=1
      - EVENTSTORE_RUN_PROJECTIONS=All
      - EVENTSTORE_START_STANDARD_PROJECTIONS=true
      - EVENTSTORE_INSECURE=true
    ports:
      - "2113:2113"  # HTTP API
      - "1113:1113"  # TCP
    volumes:
      - eventstore-data:/var/lib/eventstore
      - eventstore-logs:/var/log/eventstore

volumes:
  eventstore-data:
  eventstore-logs:
```

### 起動コマンド

```bash
docker-compose up -d eventstore
```

## Kafkaとの連携

### KurrentKafkaSubscriberの動作

1. Kafkaトピックからイベントを受信
2. DomainEventとしてデシリアライズ
3. EventStoreDBにストリーム形式で永続化
4. ACK/NACKでオフセット制御

### トピック設定

```typescript
// kafka-topics.constants.ts
export const KAFKA_TOPICS = {
  SYSTEM_EVENTS: 'system-events',
  VULNERABILITY_EVENTS: 'vulnerability-events',
  TASK_EVENTS: 'task-events',
  RELATIONSHIP_EVENTS: 'relationship-events',
};
```

### メッセージパターン

```typescript
@Controller()
@Injectable()
export class KurrentKafkaSubscriber {
  @MessagePattern(KAFKA_TOPICS.SYSTEM_EVENTS)
  async handleSystemEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<{ success: boolean; eventId: string }> {
    // イベント永続化処理
  }
}
```

## テスト

### モックを使用したテスト

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { KurrentDBClient } from './KurrentDBClient';
import { KURRENT_DB_CLIENT } from './kurrent-client.provider';

describe('EventStore Integration', () => {
  let kurrentClient: MockProxy<KurrentDBClient>;

  beforeEach(async () => {
    kurrentClient = mock<KurrentDBClient>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YourService,
        {
          provide: KURRENT_DB_CLIENT,
          useValue: kurrentClient,
        },
      ],
    }).compile();
  });

  it('should append events to stream', async () => {
    // Arrange
    const events = [new SystemRegisteredEvent(...)];
    kurrentClient.appendToStream.mockResolvedValue(undefined);

    // Act
    await service.saveEvents('System-123', events);

    // Assert
    expect(kurrentClient.appendToStream).toHaveBeenCalledWith(
      'System-123',
      events,
      expect.any(Object),
    );
  });
});
```

## イベントの読み込み

### ストリームからの読み込み

```typescript
// すべてのイベントを読み込み
const events = await kurrentClient.readStream('System-123');

// イベントを再生してアグリゲートを再構築
const aggregate = new SystemAggregate();
events.forEach(event => aggregate.apply(event));
```

### Event Sourcing パターン

```typescript
export class SystemAggregate {
  private version = 0;
  private state: SystemState = {};

  apply(event: DomainEvent): void {
    switch (event.eventType) {
      case 'SystemRegistered':
        this.whenSystemRegistered(event);
        break;
      case 'SystemUpdated':
        this.whenSystemUpdated(event);
        break;
    }
    this.version++;
  }

  private whenSystemRegistered(event: DomainEvent): void {
    const data = event.getData() as SystemRegisteredData;
    this.state = {
      id: event.aggregateId,
      name: data.systemName,
      description: data.description,
    };
  }
}
```

## 楽観的並行性制御

### Expected Versionの使用

```typescript
// バージョンを指定してイベント追加
await kurrentClient.appendToStream(
  'System-123',
  [newEvent],
  { expectedRevision: currentVersion }, // 楽観的ロック
);
```

### 競合エラーハンドリング

```typescript
try {
  await kurrentClient.appendToStream(streamName, events, {
    expectedRevision: expectedVersion,
  });
} catch (error) {
  if (error.type === 'WrongExpectedVersion') {
    // リトライまたはマージ処理
    const currentEvents = await kurrentClient.readStream(streamName);
    // アグリゲートを再構築して再試行
  }
  throw error;
}
```

## イベントメタデータ

### Correlation ID / Causation ID

```typescript
const event = new SystemRegisteredEvent(
  aggregateId,
  'My System',
  'Description',
  1, // version
  'correlation-id-from-request', // correlation ID
);

// Causation IDは自動設定（前のイベントのeventId）
```

### メタデータの活用

- **Correlation ID**: リクエスト全体を追跡
- **Causation ID**: イベントチェーンを追跡
- **Aggregate Version**: 楽観的並行性制御

## EventStoreDB UI

### アクセス

```
http://localhost:2113
```

### 主な機能

- ストリームの閲覧
- イベントの検索
- プロジェクションの管理
- 統計情報の表示

## トラブルシューティング

### 接続エラー

**症状**: `ECONNREFUSED` エラー

**解決策**:
1. EventStoreDBが起動しているか確認
2. 接続文字列が正しいか確認
3. ファイアウォール設定を確認

### イベント追加失敗

**症状**: `WrongExpectedVersion` エラー

**解決策**:
- Expected Versionが正しいか確認
- 並行アクセスがある場合はリトライロジックを実装

### ストリームが見つからない

**症状**: `StreamNotFoundError`

**解決策**:
- ストリーム名が正しいか確認
- イベントが実際に追加されているか確認
- `readStream`は空配列を返すので、エラーにならない

## ベストプラクティス

1. **ストリーム命名**: `{AggregateType}-{AggregateId}` 形式を使用
2. **イベント設計**: 過去形の名前を使用 (`SystemRegistered`, `SystemUpdated`)
3. **バージョン管理**: 楽観的ロックでExpected Versionを常に指定
4. **メタデータ**: Correlation ID/Causation IDを必ず設定
5. **エラーハンドリング**: 並行性エラーは適切にリトライ
6. **テスト**: モックを使用して単体テスト、実際のEventStoreDBで統合テスト

## パフォーマンス

### 推奨設定

- **バッチ追加**: 複数イベントを一度に追加
- **プロジェクション**: Read Model用にプロジェクションを活用
- **キャッシュ**: 頻繁にアクセスするストリームはキャッシュ

### モニタリング

- イベント追加レート
- ストリーム読み込み時間
- 接続プールサイズ
- メモリ使用量
