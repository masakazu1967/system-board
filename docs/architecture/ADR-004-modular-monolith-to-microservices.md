# ADR-004: モジュラーモノリスから段階的マイクロサービス化戦略

**ステータス**: 採用
**決定日**: 2025年9月13日
**決定者**: ソフトウェアアーキテクト、バックエンドシステムアーキテクト、DevOpsエンジニア

## コンテキスト

System Boardプロジェクト開始時には、「一足飛びにマイクロサービスにしようと考えています」という方針が示されていました（2025年9月11日）。しかし、以下の要因により、より現実的で段階的なアプローチが必要となりました：

1. **プロジェクト規模**: 個人プロジェクト（業務時間外作業）での実装
2. **複雑性管理**: プロジェクト開始時からのマイクロサービス化は過剰な複雑性
3. **MVP優先**: 段階的機能追加によるリスク分散の必要性
4. **リソース制約**: 限られた時間とリソースでの確実な進捗確保

## 検討した選択肢

### 選択肢1: フルマイクロサービス（初期方針）

- **メリット**:
  - 最終的なスケーラビリティの確保
  - 独立デプロイによる開発効率
  - 技術スタックの柔軟性
- **デメリット**:
  - 初期実装の複雑性が高すぎる
  - 分散システムの運用複雑性
  - 個人プロジェクトでの管理困難

### 選択肢2: モノリシックアーキテクチャ

- **メリット**:
  - 実装・デプロイの簡素性
  - デバッグとテストの容易性
  - 運用の単純性
- **デメリット**:
  - 将来のスケーラビリティ制限
  - 技術スタックの固定化
  - チーム分割の困難（将来的に）

### 選択肢3: モジュラーモノリス戦略

- **メリット**:
  - 明確なドメイン境界の維持
  - 将来のマイクロサービス分離の準備
  - 初期実装の複雑性管理
  - 段階的な進化の可能性
- **デメリット**:
  - 設計時の境界設定の重要性
  - モジュール間結合の管理必要

## 決定内容

**モジュラーモノリスから段階的マイクロサービス化戦略を採用**:

以下の段階的アプローチにより実装します：

### Phase 1: モジュラーモノリス構築

```typescript
// NestJSアプリケーション内でのドメイン境界明確化
src/
├── modules/
│   ├── system-management/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── presentation/
│   ├── vulnerability-management/
│   ├── task-management/
│   └── relationship-management/
├── shared/
│   ├── domain/
│   ├── infrastructure/
│   └── utils/
└── main.ts
```

#### 実装特徴

- **単一NestJSアプリケーション**: 初期実装の簡素化
- **明確なドメイン境界**: 将来分離のための準備
- **内部API**: モジュール間の疎結合通信
- **独立性確保**: 各モジュールの自律性

### Phase 2: サービス分離準備

- **API Gateway導入**: 外部通信の統一化
- **Event Bus実装**: モジュール間の非同期通信
- **独立データベース**: モジュールごとのデータ分離
- **監視・ログ分離**: サービス単位でのオブザーバビリティ

### Phase 3: 段階的マイクロサービス展開

1. **System Management Service**: システム・パッケージ管理
2. **Vulnerability Service**: 脆弱性・評価管理
3. **Task Management Service**: タスク・ワークフロー管理
4. **Relationship Service**: 依存関係管理

## 技術実装戦略

### モジュール間通信設計

#### Phase 1: モジュラーモノリス期

```typescript
// 直接依存性注入による通信
@Module({
  imports: [
    SystemManagementModule,
    VulnerabilityManagementModule
  ],
  providers: [
    {
      provide: 'VULNERABILITY_SERVICE',
      useFactory: (vulnService: VulnerabilityService) => vulnService,
      inject: [VulnerabilityService]
    }
  ]
})
export class ApplicationModule {}
```

#### Phase 2以降: サービス分離期

```typescript
// イベント駆動通信
@EventHandler(SystemRegisteredEvent)
async handleSystemRegistered(event: SystemRegisteredEvent) {
  // 脆弱性スキャンの自動トリガー
  await this.commandBus.execute(
    new TriggerVulnerabilityScanCommand(event.systemId)
  );
}
```

### データ分離戦略

#### Phase 1: 共有データベース + スキーマ分離

```sql
-- 論理的分離による準備
CREATE SCHEMA system_management;
CREATE SCHEMA vulnerability_management;
CREATE SCHEMA task_management;
CREATE SCHEMA relationship_management;
```

#### Phase 2以降: 物理的データベース分離

```yaml
services:
  system-service:
    database: system_management_db
  vulnerability-service:
    database: vulnerability_management_db
  task-service:
    database: task_management_db
```

### 通信プロトコル戦略

#### 段階的移行アプローチ

1. **Phase 1**: モジュール間直接呼び出し（DI経由）
2. **Phase 2**: 内部REST API（サービス分離準備）
3. **Phase 3**: gRPC（マイクロサービス間通信）
4. **外部向け**: GraphQL（クライアント向け統一API）

#### 使い分け基準

- **同期通信**: REST API（外部向け）→ gRPC（サービス間、高頻度）
- **非同期通信**: Kafka（イベント通知、バックグラウンド処理、疎結合要件）

## 実装スケジュール

### Phase 1: モジュラーモノリス実装（6週間）

| 週 | 実装内容 | 成果物 |
|----|----------|---------|
| 1-2 | ドメインモジュール設計 | モジュール境界定義 |
| 3-4 | システム管理モジュール実装 | システム登録・管理機能 |
| 5-6 | 脆弱性管理モジュール実装 | CVE連携・評価機能 |

### Phase 2: サービス分離準備（4週間）

| 週 | 実装内容 | 成果物 |
|----|----------|---------|
| 1-2 | API Gateway + Event Bus | 通信基盤整備 |
| 3-4 | データベース分離 | スキーマ分割・移行 |

### Phase 3: マイクロサービス展開（8週間）

| 週 | 実装内容 | 成果物 |
|----|----------|---------|
| 1-2 | System Service分離 | 独立デプロイ可能 |
| 3-4 | Vulnerability Service分離 | 独立サービス化 |
| 5-6 | Task Service分離 | ワークフロー独立化 |
| 7-8 | 最適化・監視強化 | 運用基盤完成 |

## サービス境界定義

### System Management Service

- **責任範囲**: システム登録、OS・パッケージ管理、EOL管理
- **外部依存**: GitHub API、EndOfLife API
- **提供API**: システム検索、パッケージ情報取得

### Vulnerability Management Service

- **責任範囲**: 脆弱性検出、CVSS評価、リスク分析
- **外部依存**: NVD API、セキュリティベンダーAPI
- **提供API**: 脆弱性検索、リスク評価結果

### Task Management Service

- **責任範囲**: タスク作成、ワークフロー管理、進捗追跡
- **外部依存**: Microsoft Teams API
- **提供API**: タスク管理、進捗レポート

### Relationship Management Service

- **責任範囲**: システム依存関係、影響範囲分析
- **外部依存**: なし（内部データ）
- **提供API**: 依存関係グラフ、影響分析

## 影響

### ポジティブな影響

- **段階的リスク軽減**: MVP優先での確実な進捗
- **将来拡張性**: マイクロサービスへの進化準備
- **開発効率**: 初期段階での実装・デバッグの容易性
- **運用簡素性**: 段階的な運用複雑性の増加

### 課題とリスク

- **設計品質**: モジュール境界の適切な設計が重要
- **技術負債**: 不適切な境界設定による将来的な修正コスト
- **移行複雑性**: Phase 2以降での移行作業の管理

### 緩和策

- **境界検証**: 定期的なモジュール境界の見直し
- **段階的テスト**: 各Phaseでの品質確保
- **文書化**: 設計決定と移行手順の明文化

## 成功指標

### Phase 1完了時

- [ ] 各ドメインモジュールの独立動作確認
- [ ] モジュール間APIの動作確認
- [ ] 基本機能の実装完了

### Phase 2完了時

- [ ] Event Bus経由の非同期通信動作確認
- [ ] データベース分離完了
- [ ] API Gateway経由の外部アクセス確認

### Phase 3完了時

- [ ] 各サービスの独立デプロイ確認
- [ ] サービス間通信の性能要件達成
- [ ] 99%以上の可用性確保

## 関連するADR

- ADR-001: オニオンアーキテクチャ採用
- ADR-002: パブリッククラウド採用戦略
- ADR-003: 監視スタック変更
- ADR-005: Event Sourcing実装戦略

## 参照

- プロジェクト憲章共有会議議事録 (2025-09-11)
- アーキテクチャ変更会議議事録 (2025-09-13)
- Event Sourcing設計ドキュメント
- NestJSモジュール設計ガイドライン
