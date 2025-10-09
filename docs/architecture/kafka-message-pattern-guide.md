# Kafka Message Pattern Guide for NestJS Microservices

**作成日**: 2025-10-02
**ステータス**: Active
**関連ADR**: ADR-004 (Modular Monolith to Microservices)

## 概要

本ドキュメントは、System BoardプロジェクトにおけるNestJS Microservicesを使用したKafkaメッセージパターンの実装ガイドです。Event SourcingとCQRSアーキテクチャにおける、ProducerとConsumerの実装パターンを説明します。

---

## 1. アーキテクチャ概要

```text
┌─────────────────┐      Kafka Topics       ┌─────────────────┐
│   Producer      │  ──────────────────►    │   Consumer      │
│ (Publisher)     │   @MessagePattern       │ (Subscriber)    │
│                 │                         │                 │
│ ClientKafka     │                         │ @Controller()   │
│ emit()          │   Request-Response      │ @MessagePattern │
└─────────────────┘                         └─────────────────┘
        │                                            │
        ▼                                            ▼
   Command Handler                           Kurrent EventStore
   トランザクション境界                        永続化 + 冪等性保証
```

### 設計原則

1. **Kafka First Pattern**: Command HandlerはKafka配信完了後にレスポンス
2. **At-Least-Once Delivery**: 冪等性保証により重複配信を許容
3. **Request-Response**: `@MessagePattern`でACK/NACK制御
4. **Event Sourcing Integration**: Kafka → EventStore への非同期永続化

---

## 2. Producer側実装（Event Publisher）

### 2.1 設定（KafkaModule）

**ファイル**: `apps/packages/shared/src/infrastructure/kafka/KafkaModule.ts`

```typescript
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CLIENT',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'system-board',
              brokers: ['localhost:9092'],
            },
            producer: {
              idempotent: true,              // 冪等性保証（重複排除）
              maxInFlightRequests: 5,        // パイプライン数
              transactionalId: 'system-board-producer', // トランザクションID
            },
          },
        }),
      },
    ]),
  ],
  providers: [KafkaEventPublisher],
  exports: [KafkaEventPublisher],
})
export class KafkaModule {}
```

#### 重要設定項目

| 設定項目 | 値 | 説明 |
|---------|---|------|
| `idempotent` | `true` | Producerレベルの重複排除（Kafka内部） |
| `maxInFlightRequests` | `5` | 並列送信リクエスト数（順序保証） |
| `transactionalId` | 必須 | トランザクション制御用の一意ID |

### 2.2 Event Publisher実装

**ファイル**: `apps/packages/shared/src/infrastructure/kafka/KafkaEventPublisher.ts`

```typescript
@Injectable()
export class KafkaEventPublisher implements EventPublisher, OnModuleInit {
  constructor(
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    // レスポンストピックの購読（Request-Response用）
    const topics = ['system-events', 'vulnerability-events', 'task-events'];
    topics.forEach((topic) => {
      this.kafkaClient.subscribeToResponseOf(topic);
    });
    await this.kafkaClient.connect();
  }

  async publish(event: DomainEvent): Promise<void> {
    const topic = this.determineTopicByEventType(event.eventType);

    const payload = {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      data: event.getData(),
    };

    // emit() でメッセージ送信 → Consumer応答を待機
    await lastValueFrom(
      this.kafkaClient.emit(topic, {
        key: event.aggregateId,        // パーティションキー（順序保証）
        value: payload,
        headers: {
          'content-type': 'application/json',
          'event-type': event.eventType,
          'correlation-id': event.correlationId,
        },
      }),
    );
  }

  private determineTopicByEventType(eventType: string): string {
    const topicMap: Record<string, string> = {
      SystemRegistered: 'system-events',
      VulnerabilityDetected: 'vulnerability-events',
      TaskCreated: 'task-events',
    };
    return topicMap[eventType] || 'domain-events';
  }
}
```

### 2.3 Producer実装のポイント

#### ✅ DO（推奨）

1. **`subscribeToResponseOf()` を使用**

   ```typescript
   this.kafkaClient.subscribeToResponseOf('system-events');
   ```

   - Request-ResponseパターンでConsumer応答を受信

2. **`lastValueFrom()` でPromise変換**

   ```typescript
   await lastValueFrom(this.kafkaClient.emit(topic, payload));
   ```

   - RxJS Observable → Promise変換
   - Kafka配信完了を待機

3. **パーティションキーの設定**

   ```typescript
   key: event.aggregateId,  // 同じAggregateは同じパーティションへ
   ```

   - 順序保証が必要なイベントは同じキーを使用

4. **ヘッダーでメタデータ伝搬**

   ```typescript
   headers: {
     'event-type': event.eventType,
     'correlation-id': event.correlationId,
   }
   ```

#### ❌ DON'T（非推奨）

1. **Fire-and-Forgetでの使用**

   ```typescript
   // ❌ 応答を待たない（EventStoreへの永続化が保証されない）
   this.kafkaClient.emit(topic, payload); // await なし
   ```

2. **`send()` の使用**

   ```typescript
   // ❌ send()はRequest-Reply用（同期的なレスポンス期待）
   await this.kafkaClient.send(topic, payload);
   ```

   - Event Sourcingでは `emit()` を使用

3. **トランザクションIDの省略**
   - 冪等性保証が無効化される

---

## 3. Consumer側実装（Event Subscriber）

### 3.1 設定（Microservice Application）

**ファイル**: `apps/backend/system-management/src/main.ts`（例）

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Kafka Microserviceの接続
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'system-board-consumer',
        brokers: ['localhost:9092'],
      },
      consumer: {
        groupId: 'system-board-consumer-group',
        allowAutoTopicCreation: false,
        sessionTimeout: 30000,        // セッションタイムアウト
        heartbeatInterval: 3000,      // ハートビート間隔
      },
      run: {
        autoCommit: false,            // 手動コミット制御
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(3000);
}
```

#### 3.1.1 重要設定項目

| 設定項目 | 値 | 説明 |
|---------|---|------|
| `groupId` | 必須 | コンシューマーグループID（負荷分散） |
| `autoCommit` | `false` | 手動オフセットコミット（冪等性保証） |
| `sessionTimeout` | `30000` | 30秒（処理時間に応じて調整） |
| `heartbeatInterval` | `3000` | 3秒（sessionTimeoutの1/10推奨） |

### 3.2 Event Subscriber実装

**ファイル**: `apps/packages/shared/src/infrastructure/eventstore/KurrentKafkaSubscriber.ts`

```typescript
@Controller()  // NestJS Microservice Controller
@Injectable()
export class KurrentKafkaSubscriber implements EventSubscriber {
  constructor(
    @Inject('KurrentDBClient')
    private readonly kurrentClient: KurrentDBClient,
  ) {}

  /**
   * システムイベントの受信
   * @MessagePattern でRequest-Responseパターン実装
   */
  @MessagePattern('system-events')
  async handleSystemEvents(
    @Payload() payload: DomainEvent,
    @Ctx() context: KafkaContext,
  ): Promise<{ success: boolean; eventId: string }> {
    const topic = context.getTopic();
    const partition = context.getPartition();

    try {
      // EventStoreに永続化
      await this.persistToEventStore(payload);

      // 成功応答 → Kafkaオフセットコミット（ACK）
      return { success: true, eventId: payload.eventId };
    } catch (error) {
      this.logger.error('Failed to persist event', { error });

      // エラー時は例外スロー → 再処理（NACK）
      throw error;
    }
  }

  private async persistToEventStore(event: DomainEvent): Promise<void> {
    const streamName = `${event.aggregateType}-${event.aggregateId}`;

    await this.kurrentClient.appendToStream(streamName, [
      {
        eventId: event.eventId,
        eventType: event.eventType,
        data: event.getData(),
        metadata: {
          correlationId: event.correlationId,
          occurredOn: event.occurredOn,
        },
      },
    ]);
  }
}
```

### 3.3 Consumer実装のポイント

#### 3.3.1 ✅ DO（推奨）

1. **`@MessagePattern` を使用**

   ```typescript
   @MessagePattern('system-events')
   async handleSystemEvents(
     @Payload() payload: DomainEvent,
     @Ctx() context: KafkaContext,
   ): Promise<{ success: boolean; eventId: string }>
   ```

   - Request-Responseでオフセットコミット制御

2. **成功時に明示的なレスポンス**

   ```typescript
   return { success: true, eventId: payload.eventId };
   ```

   - ACK → Kafkaオフセットコミット

3. **エラー時は例外をスロー**

   ```typescript
   catch (error) {
     throw error;  // NACK → 自動リトライ
   }
   ```

4. **冪等性チェックの実装**

   ```typescript
   if (await this.processedEventService.isProcessed(event.eventId)) {
     return { success: true, eventId: event.eventId }; // 既に処理済み
   }
   await this.processedEventService.markAsProcessed(event.eventId);
   ```

#### 3.3.2 ❌ DON'T（非推奨）

1. **`@EventPattern` の使用**

   ```typescript
   // ❌ Fire-and-Forget（オフセットコミット制御不可）
   @EventPattern('system-events')
   async handleSystemEvents(payload: DomainEvent): Promise<void>
   ```

   - Event Sourcingでは `@MessagePattern` 必須

2. **void戻り値**

   ```typescript
   // ❌ 応答なし（ACK/NACK制御不可）
   async handleSystemEvents(...): Promise<void>
   ```

3. **エラーの握りつぶし**

   ```typescript
   // ❌ エラーログだけでリトライしない
   catch (error) {
     this.logger.error(error);
     return { success: false };  // NACK されない
   }
   ```

---

## 4. メッセージフロー

### 4.1 正常系フロー

```text
1. Command Handler
   ↓
2. KafkaEventPublisher.publish(event)
   ↓ emit() with await
3. Kafka Broker (Topic: system-events)
   ↓ パーティション分散
4. KurrentKafkaSubscriber.handleSystemEvents()
   ↓ @MessagePattern
5. EventStore 永続化
   ↓ 成功
6. return { success: true, eventId }  ← ACK
   ↓
7. Kafka オフセットコミット
   ↓
8. Producer に応答
   ↓
9. Command Handler 完了
```

### 4.2 エラー時フロー

```text
1. Command Handler
   ↓
2. KafkaEventPublisher.publish(event)
   ↓ emit() with await
3. Kafka Broker
   ↓
4. KurrentKafkaSubscriber.handleSystemEvents()
   ↓ @MessagePattern
5. EventStore 永続化
   ↓ ❌ エラー発生
6. throw error  ← NACK
   ↓
7. Kafka オフセット未コミット
   ↓ リトライ（sessionTimeout後）
8. 再度 handleSystemEvents() 実行
   ↓ 冪等性チェック
9. 既に処理済みならスキップ
```

---

## 5. トピック設計

### 5.1 トピック命名規則

| Context | Topic名 | 説明 |
|---------|--------|------|
| System Management | `system-events` | システム登録・更新イベント |
| Vulnerability Management | `vulnerability-events` | 脆弱性検出・解決イベント |
| Task Management | `task-events` | タスク作成・完了イベント |
| Security | `security-events` | セキュリティアラート |
| Urgent | `urgent-events` | 高優先度イベント |
| Generic | `domain-events` | 汎用ドメインイベント |

### 5.2 パーティション戦略

```typescript
// 同じAggregateは同じパーティションへ（順序保証）
key: event.aggregateId,

// パーティション数: 3-5個（スケーラビリティとのバランス）
partitions: 3
```

---

## 6. エラーハンドリング戦略

### 6.1 リトライ設定

```typescript
// KafkaModule設定
consumer: {
  retry: {
    retries: 5,              // 最大リトライ回数
    initialRetryTime: 300,   // 初回リトライ: 300ms
    multiplier: 2,           // 指数バックオフ（2倍ずつ増加）
    maxRetryTime: 30000,     // 最大リトライ間隔: 30秒
  },
}
```

### 6.2 Dead Letter Queue (DLQ)

```typescript
// 5回リトライ後もエラーならDLQへ
@MessagePattern('system-events')
async handleSystemEvents(...): Promise<{ success: boolean }> {
  try {
    await this.persistToEventStore(event);
    return { success: true };
  } catch (error) {
    if (this.isUnrecoverableError(error)) {
      // DLQトピックへ転送
      await this.sendToDLQ(event, error);
      return { success: false };  // これ以上リトライしない
    }
    throw error;  // リトライ対象エラー
  }
}
```

---

## 7. モニタリングとオブザーバビリティ

### 7.1 メトリクス

```typescript
// Prometheus メトリクス例
kafka_messages_published_total{topic="system-events"}
kafka_messages_consumed_total{topic="system-events"}
kafka_message_processing_duration_seconds{topic="system-events"}
kafka_message_errors_total{topic="system-events"}
```

### 7.2 ログ

```typescript
this.logger.debug('Event published to Kafka', {
  eventType: event.eventType,
  aggregateId: event.aggregateId,
  topic,
  correlationId: event.correlationId,
});

this.logger.error('Failed to persist event to EventStore', {
  eventId: event.eventId,
  topic,
  partition,
  error: error.message,
  correlationId: event.correlationId,
});
```

---

## 8. ベストプラクティス

### 8.1 Producer側

✅ **推奨**

- `emit()` を `await` で使用（応答確認）
- パーティションキーで順序保証
- トランザクションIDで冪等性保証
- ヘッダーでメタデータ伝搬

❌ **非推奨**

- Fire-and-Forgetでの使用
- `send()` の使用（Event Sourcingには不適切）
- 応答確認なしでCommand Handler完了

### 8.2 Consumer側

✅ **推奨**

- `@MessagePattern` で明示的なACK/NACK
- 冪等性チェックの実装
- エラー時は例外スロー（自動リトライ）
- `autoCommit: false` で手動コミット制御

❌ **非推奨**

- `@EventPattern` の使用（Event Sourcingには不適切）
- エラーの握りつぶし
- void戻り値（応答なし）

---

## 9. テスト戦略

### 9.1 Producer単体テスト

```typescript
describe('KafkaEventPublisher', () => {
  it('should publish event and wait for acknowledgment', async () => {
    const mockKafkaClient = {
      emit: jest.fn().mockReturnValue(of({ success: true })),
    };

    const publisher = new KafkaEventPublisher(mockKafkaClient);
    await publisher.publish(event);

    expect(mockKafkaClient.emit).toHaveBeenCalledWith(
      'system-events',
      expect.objectContaining({
        key: event.aggregateId,
        value: expect.objectContaining({
          eventId: event.eventId,
        }),
      }),
    );
  });
});
```

### 9.2 Consumer単体テスト

```typescript
describe('KurrentKafkaSubscriber', () => {
  it('should persist event and return success', async () => {
    const mockKurrentClient = {
      appendToStream: jest.fn().mockResolvedValue(undefined),
    };

    const subscriber = new KurrentKafkaSubscriber(mockKurrentClient);
    const result = await subscriber.handleSystemEvents(event, context);

    expect(result).toEqual({ success: true, eventId: event.eventId });
    expect(mockKurrentClient.appendToStream).toHaveBeenCalled();
  });

  it('should throw error on persistence failure', async () => {
    const mockKurrentClient = {
      appendToStream: jest.fn().mockRejectedValue(new Error('DB Error')),
    };

    const subscriber = new KurrentKafkaSubscriber(mockKurrentClient);

    await expect(
      subscriber.handleSystemEvents(event, context)
    ).rejects.toThrow('DB Error');
  });
});
```

---

## 10. 関連ドキュメント

- [Event Sourcing + CQRS](./event-sourcing-cqrs.md)
- [ADR-004: Modular Monolith to Microservices](./ADR-004-modular-monolith-to-microservices.md)
- [Exception Handling Design](./exception-handling-design.md)

---

## 変更履歴

| 日付 | 変更内容 | 変更者 |
|-----|---------|--------|
| 2025-10-02 | 初版作成（@EventPattern → @MessagePattern 移行） | Claude Code |
