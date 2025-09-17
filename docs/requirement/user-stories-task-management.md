# ユーザーストーリー: タスク管理コンテキスト

**作成日**: 2025年9月18日
**更新日**: 2025年9月18日
**ソース**: イベントストーミング Phase1-2 成果物
**Bounded Context**: Task Management Context

---

## 1. タスク生成・割当

### US-TM-001: 緊急タスク自動生成

**As a** システム担当者
**I want to** 高危険度脆弱性に対する緊急タスクが自動生成される
**So that** 対応漏れを防ぎ迅速に対応を開始できる

**受け入れ条件**:

- [ ] CVSS 9.0以上の脆弱性検出時に自動的にタスクが生成される
- [ ] タスクには脆弱性ID、影響システム、推奨対応期限（3日以内）が設定される
- [ ] タスク優先度が「緊急」で自動設定される
- [ ] 生成時に`UrgentTaskCreated`イベントが発行される
- [ ] Task Engine Actorによる自動実行

**Event**: `UrgentTaskCreated`
**Command**: `CreateUrgentTask`（Task Engine Actor自動実行）
**Priority**: High
**Estimate**: 5 Story Points

---

### US-TM-002: タスク手動作成

**As a** システム担当者
**I want to** システムメンテナンスのタスクを手動で作成する
**So that** 計画的な作業を管理できる

**受け入れ条件**:

- [ ] タスク名、説明、期限、優先度を設定してタスク作成
- [ ] 対象システム、作業種別（メンテナンス/更新/調査）を選択
- [ ] 作業工数の見積もりを入力
- [ ] 作成時に`TaskCreated`イベントが発行される
- [ ] 作成後はタスク割当待ち状態になる

**Event**: `TaskCreated`
**Command**: `CreateTask`
**Priority**: Medium
**Estimate**: 3 Story Points

---

### US-TM-003: タスク割当

**As a** 情報システム管理者
**I want to** タスクを適切な担当者に割り当てる
**So that** 効率的に作業を分散できる

**受け入れ条件**:

- [ ] 未割当タスクの一覧から選択して担当者を割当
- [ ] 担当者のスキル、現在の作業負荷を考慮
- [ ] 緊急タスクは自動的に当番担当者に割当
- [ ] 割当時に`TaskAssigned`イベントが発行される
- [ ] 担当者にMicrosoft Teams経由で通知

**Event**: `TaskAssigned`
**Command**: `AssignTask`
**Priority**: High
**Estimate**: 5 Story Points

---

## 2. タスク実行・進捗管理

### US-TM-004: タスク開始

**As a** システム担当者
**I want to** 割り当てられたタスクを開始する
**So that** 作業の進捗を正確に記録できる

**受け入れ条件**:

- [ ] 割り当てられたタスクを開始状態に変更
- [ ] 開始時刻、作業予定時間を記録
- [ ] 作業メモ・注意事項を入力可能
- [ ] 開始時に`TaskStarted`イベントが発行される
- [ ] 開始後は進捗更新が可能になる

**Event**: `TaskStarted`
**Command**: `StartTask`
**Priority**: High
**Estimate**: 3 Story Points

---

### US-TM-005: タスク進捗更新

**As a** システム担当者
**I want to** タスクの進捗状況を更新する
**So that** 管理者や関係者が進捗を把握できる

**受け入れ条件**:

- [ ] 進捗率（0-100%）を設定可能
- [ ] 作業状況コメントを追加可能
- [ ] 作業中に発見した問題点を記録可能
- [ ] 進捗更新時に`TaskProgressUpdated`イベントが発行される
- [ ] 完了予定日の見直しが可能

**Event**: `TaskProgressUpdated`
**Command**: `UpdateTaskProgress`
**Priority**: Medium
**Estimate**: 3 Story Points

---

### US-TM-006: タスク完了

**As a** システム担当者
**I want to** タスクを完了状態にする
**So that** 作業の完了を正式に記録できる

**受け入れ条件**:

- [ ] 作業完了報告書を作成
- [ ] 実施内容、結果、注意事項を記録
- [ ] 関連する検証結果やエビデンスを添付
- [ ] 完了時に`TaskCompleted`イベントが発行される
- [ ] 完了後は管理者による承認待ち状態になる

**Event**: `TaskCompleted`
**Command**: `CompleteTask`
**Priority**: High
**Estimate**: 5 Story Points

---

## 3. タスクエスカレーション

### US-TM-007: 自動エスカレーション

**As a** 情報システム管理者
**I want to** 期限超過タスクが自動的にエスカレーションされる
**So that** 対応遅延を早期に発見し対処できる

**受け入れ条件**:

- [ ] 期限を24時間超過したタスクが自動的にエスカレーション
- [ ] 緊急タスクは期限の50%経過時点でエスカレーション
- [ ] エスカレーション時に`TaskEscalated`イベントが発行される
- [ ] 管理者とエスカレーション担当者に自動通知
- [ ] エスカレーション履歴が記録される

**Event**: `TaskEscalated`
**Command**: `EscalateTask`（Task Engine Actor自動実行）
**Priority**: High
**Estimate**: 5 Story Points

---

### US-TM-008: 手動エスカレーション

**As a** システム担当者
**I want to** 困難な問題を管理者にエスカレーションする
**So that** 適切な支援を受けて問題を解決できる

**受け入れ条件**:

- [ ] 作業中に技術的困難や判断が必要な場合にエスカレーション要求
- [ ] エスカレーション理由とこれまでの試行内容を記録
- [ ] エスカレーション先（技術リーダー/管理者/外部専門家）を選択
- [ ] 要求時に`TaskEscalationRequested`イベントが発行される
- [ ] エスカレーション先に詳細情報が通知される

**Event**: `TaskEscalationRequested`
**Command**: `RequestTaskEscalation`
**Priority**: Medium
**Estimate**: 3 Story Points

---

## 4. ワークフロー管理

### US-TM-009: タスク優先順位付け

**As a** 情報システム管理者
**I want to** タスクの優先順位を自動的に調整する
**So that** 重要度に応じた効率的な作業順序を確保できる

**受け入れ条件**:

- [ ] CVSSスコア、システム重要度、業務影響度に基づく自動優先順位付け
- [ ] 新規緊急タスク発生時の既存タスク優先度再調整
- [ ] 手動での優先順位調整も可能
- [ ] 優先順位付け完了時に`TaskPrioritizationCompleted`イベントが発行される
- [ ] 担当者に優先順位変更が通知される

**Event**: `TaskPrioritizationCompleted`
**Command**: `PrioritizeTasks`（Task Engine Actor自動実行）
**Priority**: High
**Estimate**: 8 Story Points

---

### US-TM-010: ワークフロー実行

**As a** システム担当者
**I want to** 定義されたワークフローに従ってタスクを進行する
**So that** 標準化された手順で確実に作業を実施できる

**受け入れ条件**:

- [ ] タスク種別に応じた標準ワークフローが自動適用
- [ ] 各ステップの完了条件とチェック項目が表示
- [ ] ワークフロー進行状況の可視化
- [ ] 完了時に`WorkflowCompleted`イベントが発行される
- [ ] ワークフロー逸脱時の警告と修正手順の提示

**Event**: `WorkflowCompleted`
**Command**: `ExecuteWorkflow`
**Priority**: Medium
**Estimate**: 8 Story Points

---

## 5. タスク監視・報告

### US-TM-011: タスクダッシュボード表示

**As a** システム担当者
**I want to** 自分のタスク状況をダッシュボードで確認する
**So that** 日々の作業を効率的に管理できる

**受け入れ条件**:

- [ ] 担当中のタスク一覧と進捗状況を表示
- [ ] 期限が近いタスクのハイライト表示
- [ ] 今日実施すべきタスクの優先順位表示
- [ ] 完了したタスクの実績表示
- [ ] タスク種別・優先度でのフィルタリング機能

**Event**: `TaskDashboardRequested`
**Command**: `ViewTaskDashboard`
**Priority**: High
**Estimate**: 8 Story Points

---

### US-TM-012: チーム作業状況確認

**As a** 情報システム管理者
**I want to** チーム全体のタスク状況を確認する
**So that** リソース配分と進捗管理を適切に行える

**受け入れ条件**:

- [ ] チームメンバー別の作業負荷と進捗状況を表示
- [ ] 期限超過・エスカレーション中のタスクを把握
- [ ] 週次・月次の実績サマリーを表示
- [ ] ボトルネックとなっているタスクを特定
- [ ] タスク配分の最適化提案を表示

**Event**: `TeamStatusRequested`
**Command**: `ViewTeamStatus`
**Priority**: Medium
**Estimate**: 8 Story Points

---

### US-TM-013: タスク実績レポート生成

**As a** 情報システム管理者
**I want to** タスクの実績レポートを生成する
**So that** 業務改善と工数管理に活用できる

**受け入れ条件**:

- [ ] 期間指定でのタスク完了実績を集計
- [ ] 作業種別別、担当者別の工数分析
- [ ] SLA達成状況（緊急タスク3日以内対応等）の評価
- [ ] エスカレーション頻度と原因分析
- [ ] レポート生成時に`TaskReportGenerated`イベントが発行される

**Event**: `TaskReportGenerated`
**Command**: `GenerateTaskReport`
**Priority**: Medium
**Estimate**: 8 Story Points

---

## 6. 外部連携・通知

### US-TM-014: Microsoft Teams通知

**As a** システム担当者
**I want to** タスクの重要な更新をTeams経由で受け取る
**So that** リアルタイムで状況を把握し対応できる

**受け入れ条件**:

- [ ] 緊急タスク割当時の即座通知
- [ ] 期限24時間前の事前通知
- [ ] エスカレーション発生時の緊急通知
- [ ] 通知設定のカスタマイズが可能
- [ ] 通知からタスク詳細への直接リンク

**Event**: `TaskNotificationSent`
**Command**: `SendTaskNotification`（Notification System Actor自動実行）
**Priority**: High
**Estimate**: 5 Story Points

---

### US-TM-015: タスク自動クローズ

**As a** システム担当者
**I want to** 関連する問題が解決されたタスクが自動的にクローズされる
**So that** タスクリストが常に最新状態を保てる

**受け入れ条件**:

- [ ] 脆弱性解決時に関連タスクが自動クローズ
- [ ] システム廃止時に関連タスクが自動クローズ
- [ ] 自動クローズ前に担当者への確認通知
- [ ] クローズ時に`TaskAutoClosed`イベントが発行される
- [ ] 手動でのクローズ取り消しも可能

**Event**: `TaskAutoClosed`
**Command**: `AutoCloseTask`（Task Engine Actor自動実行）
**Priority**: Medium
**Estimate**: 3 Story Points

---

## 関連ドキュメント

- イベントストーミング Phase1: `/docs/event-storming/phase1-domain-events.md`
- イベントストーミング Phase2: `/docs/event-storming/phase2-commands-actors.md`
- ビジネス要件: `/docs/requirement/business-requirement.md`

## 実装優先順位

1. **P1 (高)**: US-TM-001, US-TM-003, US-TM-004, US-TM-006, US-TM-007, US-TM-011 - 基本タスク管理
2. **P2 (中)**: US-TM-002, US-TM-005, US-TM-009, US-TM-012, US-TM-014 - 運用効率化
3. **P3 (低)**: US-TM-008, US-TM-010, US-TM-013, US-TM-015 - 高度な管理機能

## Critical Path（緊急タスク対応フロー）

US-TM-001 → US-TM-003 → US-TM-004 → US-TM-006 または US-TM-007（期限超過時）

## 業務ルール（Phase3 Business Rules準拠）

- **CVSS 9.0以上**: 3日以内対応必須、自動緊急タスク生成
- **期限超過**: 24時間超過で自動エスカレーション
- **緊急タスク**: 50%経過時点でエスカレーション
