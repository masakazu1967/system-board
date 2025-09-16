# ADR-005: 技術スタック決定の統合的な経緯

**ステータス**: 採用
**決定日**: 2025年9月11日〜2025年9月13日（段階的決定）
**決定者**: 全技術チーム（AI専門エージェント）

## 1. コンテキスト

System Boardプロジェクトの技術スタック選定は、プロジェクト憲章会議（2025年9月11日）から開始され、複数の段階を経て最終的な技術構成が決定されました。このADRは、各技術の選定理由と変更の経緯を統合的に記録します。

## 2. 技術スタック決定の変遷

### 初期決定事項（2025年9月11日）

#### フロントエンド

**React + TypeScript**:

- **選定理由**: エコシステム、型安全性
- **代替案**: Vue.js, Angular
- **決定要因**: 豊富なライブラリ、開発者体験、型安全性

#### バックエンド

**NestJS (TypeScript統一)**:

- **選定理由**: TypeScript統一、豊富な機能、Express内包
- **代替案**: Express.js, Fastify, Spring Boot
- **決定要因**: 企業レベルの機能、DIコンテナ、デコレータベース設計

#### データ層

**複数データベース戦略**:

- **PostgreSQL**: リードモデル（CQRS）
- **EventStore DB**: イベントストア（Event Sourcing）
- **Redis**: キャッシュ、セッション管理
- **選定理由**: 各用途に最適化されたデータストア

#### メッセージング

**Apache Kafka**:

- **選定理由**: 高スループット、イベントストリーミング
- **代替案**: RabbitMQ, AWS SQS
- **決定要因**: Event Sourcingとの親和性、スケーラビリティ

#### 認証・認可

**Auth0 Free Tier + OAuth2.0 + JWT + RBAC**:

- **選定理由**: セキュリティ要件充足、無料枠での対応可能
- **代替案**: AWS Cognito, Firebase Auth
- **決定要因**: 製造業セキュリティ要件、コスト制約

### 監視スタック変更（2025年9月12日〜13日）

#### 第1段階: ELK Stack（初期）

```yaml
initial_monitoring:
  metrics: Prometheus + Grafana
  logs: ELK Stack (Elasticsearch + Logstash + Kibana)
  alerts: Microsoft Teams
```

#### 第2段階: Sentry検討・見送り

- **検討理由**: 運用効率化（50-70%工数削減）
- **見送り理由**: セキュリティリスク（情報漏洩防止優先）
- **リスク評価**: MEDIUM-HIGH → 製造業要件に不適合

#### 第3段階: セルフホステッド検討

```yaml
self_hosted_monitoring:
  error_tracking: GlitchTip
  performance: Jaeger + OpenTelemetry
  logs: Enhanced ELK Stack
```

#### 最終段階: Grafana Loki採用

```yaml
final_monitoring:
  logs: Grafana Loki + Promtail
  metrics: Prometheus + Grafana
  alerts: AlertManager + Microsoft Teams
  security: データローカライゼーション + 暗号化
```

**決定理由**:

- ELKスタック運用工数40%削減
- Prometheusエコシステムとの統合
- パブリッククラウド戦略との整合性

### 運用環境決定（2025年9月13日）

#### パブリッククラウド条件付き採用

- **初期方針**: オンプレミス構築
- **変更理由**: 企業方針変更、オンプレミス環境未構築
- **条件**: 厳格なセキュリティ要件クリア

**セキュリティ要件**:

- 日本リージョン限定
- BYOK（Bring Your Own Key）暗号化
- VPCマイクロセグメンテーション
- 専用セキュリティサブネット

## 3. 最終技術スタック構成

### 3.1 フロントエンド

```yaml
frontend:
  framework: React 18+
  language: TypeScript 5+
  state_management: Redux Toolkit / Zustand
  styling: Tailwind CSS / Styled Components
  build_tool: Vite
  testing: Jest + Testing Library
```

### 3.2 バックエンド

```yaml
backend:
  framework: NestJS 10+
  language: TypeScript 5+
  architecture: Onion Architecture + DDD
  pattern: CQRS + Event Sourcing
  validation: class-validator + class-transformer
  testing: Jest + Supertest
```

### 3.3 データ層

```yaml
data_layer:
  read_model: PostgreSQL 15+
  event_store: EventStore DB 23+
  cache: Redis 7+
  search: (Optional) Elasticsearch
  backup: PostgreSQL Point-in-Time Recovery
```

### 3.4 メッセージング・通信

```yaml
messaging:
  event_streaming: Apache Kafka 3.0+
  inter_service: gRPC (future microservices)
  external_api: REST (GraphQL for client)
  real_time: WebSocket (if needed)
```

### 3.5 セキュリティ

```yaml
security:
  authentication: Auth0 + OAuth2.0
  authorization: RBAC + Policy-based
  encryption: TLS 1.3 + AES-256
  secrets: BYOK + Vault-like solution
  audit: 5-year retention + tamper-proof
```

### 3.6 監視・運用

```yaml
monitoring:
  logs: Grafana Loki + Promtail
  metrics: Prometheus + Grafana
  tracing: (Future) Jaeger + OpenTelemetry
  alerting: AlertManager + Microsoft Teams
  uptime: Health checks + Kubernetes probes
```

### 3.7 開発・デプロイ

```yaml
development:
  monorepo: Turborepo / Nx
  package_manager: pnpm
  containerization: Docker + Docker Compose
  orchestration: Kubernetes (production)
  ci_cd: GitHub Actions
  quality: ESLint + Prettier + Husky
```

## 4. 選定基準と制約条件

### 技術選定基準

1. **セキュリティ第一**: 製造業要件への完全準拠
2. **型安全性**: TypeScript統一による品質確保
3. **スケーラビリティ**: 将来の拡張性確保
4. **コスト制約**: 無料/OSS優先
5. **学習コスト**: 既存知識の活用

### 制約条件

1. **予算制約**: 無料/OSSツールのみ
2. **人的リソース**: 個人プロジェクト（業務時間外）
3. **時間制約**: 1年間での実装完了
4. **セキュリティ**: 情報漏洩防止最優先
5. **コンプライアンス**: 製造業監査要件

## 5. 代替案の検討

### 各カテゴリの主要代替案

#### バックエンドフレームワーク

| 選択肢 | メリット | デメリット | 評価 |
|--------|----------|-----------|------|
| NestJS | TypeScript統一、豊富な機能 | 学習コスト | ✅採用 |
| Express.js | シンプル、軽量 | 機能不足 | ❌ |
| Spring Boot | 企業レベル | Java必須 | ❌ |

#### データベース（リードモデル）

| 選択肢 | メリット | デメリット | 評価 |
|--------|----------|-----------|------|
| PostgreSQL | 高機能、JSON対応 | 運用複雑性 | ✅採用 |
| MySQL | 軽量、実績 | JSON機能制限 | ❌ |
| MongoDB | ドキュメントDB | SQL不可 | ❌ |

#### 監視ソリューション

| 選択肢 | メリット | デメリット | 評価 |
|--------|----------|-----------|------|
| Grafana Loki | 統合性、コスト | 新しい技術 | ✅採用 |
| ELK Stack | 実績、高機能 | 運用工数大 | ❌ |
| Sentry | 高機能、SaaS | セキュリティリスク | ❌ |

## 技術選定の意思決定プロセス

### ガバナンス体制

```yaml
decision_process:
  architecture_decisions:
    primary: Software Architect
    review: All technical agents
    approval: Product Manager

  security_decisions:
    primary: Cybersecurity Advisor
    mandatory_review: true
    veto_power: true

  infrastructure_decisions:
    primary: DevOps Engineer
    input: Database Architect
    consideration: Cost constraints
```

### 評価プロセス

1. **要件適合性評価**: 機能要件・非機能要件との整合性
2. **セキュリティ評価**: サイバーセキュリティアドバイザーによる必須評価
3. **運用性評価**: DevOpsエンジニアによる運用工数・複雑性評価
4. **コスト評価**: 無料/OSS制約との適合性
5. **統合性評価**: 既存技術スタックとの整合性

## 将来の進化戦略

### 短期（6ヶ月）

- モジュラーモノリス実装完了
- 基本監視機能の安定運用
- セキュリティ要件の完全クリア

### 中期（1年）

- マイクロサービス化開始
- 高度な監視機能追加
- パフォーマンス最適化

### 長期（2年以降）

- フルマイクロサービス化完了
- マルチクラウド戦略検討
- AI/ML機能の統合検討

## 技術負債の管理

### 識別された技術負債

1. **Grafana Loki**: エラートラッキング機能の30%不足
2. **Event Sourcing**: 新技術導入による学習コスト
3. **マイクロサービス移行**: 段階的実装による一時的複雑性

### 対応戦略

1. **段階的解決**: MVP優先での機能追加
2. **継続的評価**: 四半期ごとの技術評価
3. **代替案準備**: 必要時の追加ツール導入準備

## 影響

### ポジティブな影響

- **型安全性**: TypeScript統一による品質向上
- **セキュリティ**: 製造業要件への完全対応
- **スケーラビリティ**: Event Sourcing + マイクロサービス戦略
- **運用効率**: 適切な監視・自動化の実現

### 課題とリスク

- **複雑性**: 多数の技術スタックの統合管理
- **学習コスト**: 新技術の習得に必要な時間投資
- **運用負荷**: セルフホステッドソリューションの管理

## 関連するADR

- ADR-001: オニオンアーキテクチャ採用
- ADR-002: パブリッククラウド採用戦略
- ADR-003: 監視スタック進化
- ADR-004: モジュラーモノリス戦略

## 参照

- プロジェクト憲章共有会議議事録 (2025-09-11)
- System Boardキックオフミーティング議事録 (2025-09-12)
- Sentry導入検討会議議事録 (2025-09-12)
- 自己ホスティング監視スタック技術検討会議議事録 (2025-09-12)
- アーキテクチャ変更会議議事録 (2025-09-13)
