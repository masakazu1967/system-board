# ユーザーストーリー: システム管理コンテキスト

**作成日**: 2025年9月18日
**更新日**: 2025年9月18日
**ソース**: イベントストーミング Phase1-2 成果物
**Bounded Context**: System Management Context

---

## 1. システム登録・管理

### US-SM-001: システム新規登録

**As a** システム担当者
**I want to** 新しいシステムを登録する
**So that** システムの脆弱性管理とライフサイクル管理ができる

**受け入れ条件**:

- [ ] システムID、システム名、ホストID、システム種別、重要度を入力できる
- [ ] システム種別は定義済みリスト（web-server, database, application, middleware, monitoring）から選択
- [ ] 重要度は1-5の数値で設定（4以上は高重要度システム）
- [ ] 登録完了時に`SystemRegistered`イベントが発行される
- [ ] 登録後、自動的に初回脆弱性スキャンがトリガーされる

**Event**: `SystemRegistered`
**Command**: `RegisterSystem`
**Priority**: High
**Estimate**: 5 Story Points

---

### US-SM-002: システム構成更新

**As a** システム担当者
**I want to** システムの構成情報を更新する
**So that** 最新の構成状態を正確に管理できる

**受け入れ条件**:

- [ ] システム名、重要度、システム種別を変更できる
- [ ] 構成変更時に変更履歴が記録される
- [ ] 構成変更完了時に`SystemConfigurationUpdated`イベントが発行される
- [ ] 高重要度システムの変更時は管理者承認が必要
- [ ] 変更後、システム検証プロセスが自動開始される

**Event**: `SystemConfigurationUpdated`
**Command**: `UpdateSystemConfiguration`
**Priority**: Medium
**Estimate**: 3 Story Points

---

### US-SM-003: システム検証実行

**As a** システム担当者
**I want to** システムの動作検証を実行する
**So that** システムが正常に動作していることを確認できる

**受け入れ条件**:

- [ ] 手動でシステム検証を開始できる
- [ ] 検証項目には接続確認、性能確認、セキュリティ確認が含まれる
- [ ] 検証結果（成功/失敗/警告）が記録される
- [ ] 検証完了時に`SystemValidationCompleted`イベントが発行される
- [ ] 検証失敗時は自動的にタスクが生成される

**Event**: `SystemValidationCompleted`
**Command**: `ValidateSystem`
**Priority**: Medium
**Estimate**: 5 Story Points

---

### US-SM-004: システム廃止

**As a** 情報システム管理者
**I want to** 運用終了したシステムを廃止する
**So that** 管理対象システムを適切に整理できる

**受け入れ条件**:

- [ ] 廃止前に依存関係の確認が必要
- [ ] 他システムに影響がある場合は警告表示
- [ ] 廃止理由とスケジュールを記録
- [ ] 管理者承認後に廃止実行
- [ ] 廃止完了時に`SystemDecommissioned`イベントが発行される

**Event**: `SystemDecommissioned`
**Command**: `DecommissionSystem`
**Priority**: Low
**Estimate**: 3 Story Points

---

## 2. ホスト・リソース管理

### US-SM-005: ホストリソーススケーリング

**As a** システム担当者
**I want to** ホストのリソース（CPU/メモリ/ディスク）を増減する
**So that** システムの性能要件に対応できる

**受け入れ条件**:

- [ ] CPU、メモリ、ディスクの現在値と目標値を設定できる
- [ ] リソース上限と予算制約をチェック
- [ ] スケーリング計画の事前確認が可能
- [ ] 実行前に影響範囲の確認
- [ ] 完了時に`HostResourcesScaled`イベントが発行される

**Event**: `HostResourcesScaled`
**Command**: `ScaleHostResources`
**Priority**: Medium
**Estimate**: 5 Story Points

---

## 3. システム状況確認

### US-SM-006: ダッシュボード表示

**As a** システム担当者
**I want to** システム全体の状況をダッシュボードで確認する
**So that** 日常業務で対応すべき項目を素早く把握できる

**受け入れ条件**:

- [ ] システム一覧と各ステータスが表示される
- [ ] 緊急対応が必要なシステムがハイライト表示される
- [ ] 脆弱性スコア、EOL近接状況が一目で分かる
- [ ] 重要度別でのフィルタリングが可能
- [ ] リアルタイムでの情報更新

**Event**: `DashboardViewRequested`
**Command**: `ViewDashboard`
**Priority**: High
**Estimate**: 8 Story Points

---

### US-SM-007: システムリスト検索・フィルタリング

**As a** システム担当者
**I want to** 特定の条件でシステムを検索・フィルタリングする
**So that** 目的のシステムを効率的に見つけることができる

**受け入れ条件**:

- [ ] システム名、システム種別、重要度での検索が可能
- [ ] ホストID、ステータスでのフィルタリングが可能
- [ ] 検証期限が近いシステムの抽出が可能
- [ ] EOL近接システムの抽出が可能
- [ ] 検索結果のソートが可能

**Event**: なし（Read操作）
**Command**: なし（Query操作）
**Priority**: Medium
**Estimate**: 3 Story Points

---

## 4. EOL・ライフサイクル管理

### US-SM-008: EOL警告通知

**As a** システム担当者
**I want to** サポート終了が近いシステムの警告を受け取る
**So that** 事前に移行計画を立てることができる

**受け入れ条件**:

- [ ] EOL 30日前に自動警告が発行される
- [ ] Microsoft Teams経由で通知が送信される
- [ ] 警告対象システムと残り日数が明確に表示される
- [ ] 警告確認後、移行計画タスクが自動生成される
- [ ] 警告履歴が管理される

**Event**: `EOLWarningIssued`
**Command**: `IssueEOLWarning`（システム自動実行）
**Priority**: High
**Estimate**: 5 Story Points

---

### US-SM-009: システムヘルスチェック

**As a** システム担当者
**I want to** システムの稼働状況を定期的に監視する
**So that** 問題を早期に発見し対処できる

**受け入れ条件**:

- [ ] 5分間隔で自動ヘルスチェックが実行される
- [ ] CPU使用率、メモリ使用率、ディスク使用率を監視
- [ ] 応答時間、可用性を確認
- [ ] 閾値超過時にアラートが発行される
- [ ] ヘルスチェック履歴が記録される

**Event**: `SystemHealthCheckCompleted`
**Command**: `CheckSystemHealth`（システム自動実行）
**Priority**: Medium
**Estimate**: 8 Story Points

---

## 5. 承認・管理機能

### US-SM-010: システム変更承認

**As a** 情報システム管理者
**I want to** 重要システムの変更を承認する
**So that** システムの安定性と信頼性を確保できる

**受け入れ条件**:

- [ ] 高重要度システム（criticality 4-5）の変更申請を確認できる
- [ ] 変更内容、影響範囲、リスク評価が表示される
- [ ] 承認/拒否の判断とコメントを記録できる
- [ ] 承認後に変更処理が実行される
- [ ] 拒否時は申請者に理由が通知される

**Event**: `SystemChangeApproved` / `SystemChangeRejected`
**Command**: `ApproveSystemChange` / `RejectSystemChange`
**Priority**: Medium
**Estimate**: 5 Story Points

---

## 関連ドキュメント

- イベントストーミング Phase1: `/docs/event-storming/phase1-domain-events.md`
- イベントストーミング Phase2: `/docs/event-storming/phase2-commands-actors.md`
- ビジネス要件: `/docs/requirement/business-requirement.md`

## 実装優先順位

1. **P1 (高)**: US-SM-001, US-SM-006, US-SM-008 - 基本機能
2. **P2 (中)**: US-SM-002, US-SM-003, US-SM-009 - 運用機能
3. **P3 (低)**: US-SM-004, US-SM-005, US-SM-007, US-SM-010 - 拡張機能
