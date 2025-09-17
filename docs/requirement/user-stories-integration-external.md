# ユーザーストーリー: 外部連携・統合コンテキスト

**作成日**: 2025年9月18日
**更新日**: 2025年9月18日
**ソース**: イベントストーミング Phase1-2 成果物
**Bounded Context**: External Integration Context

---

## 1. GitHub API連携

### US-EI-001: GitHubリポジトリ情報取得

**As a** システム担当者
**I want to** GitHubリポジトリの基本情報を自動取得する
**So that** 開発中システムの状況を把握できる

**受け入れ条件**:

- [ ] リポジトリ名、言語、最終更新日、ライセンス情報を取得
- [ ] アクティブな開発状況（コミット頻度、コントリビューター数）を把握
- [ ] パブリック/プライベート状況とセキュリティ設定を確認
- [ ] 取得完了時に`GitHubRepositoryDataReceived`イベントが発行される
- [ ] Rate Limit（5,000 requests/hour）を考慮した取得制御

**Event**: `GitHubRepositoryDataReceived`
**Command**: `FetchGitHubRepositoryData`（Integration Gateway Actor自動実行）
**Priority**: High
**Estimate**: 5 Story Points

---

### US-EI-002: GitHub依存関係情報同期

**As a** システム担当者
**I want to** GitHubの依存関係情報を自動同期する
**So that** 最新の開発依存関係を反映できる

**受け入れ条件**:

- [ ] package.json、pom.xml、requirements.txt等の依存関係ファイルを解析
- [ ] ダイレクトな依存関係とトランジティブ依存関係を区別
- [ ] バージョン制約と実際に使用されているバージョンを取得
- [ ] 同期完了時に`GitHubDependencyInfoSynchronized`イベントが発行される
- [ ] 同期エラー時のリトライとFallback機能

**Event**: `GitHubDependencyInfoSynchronized`
**Command**: `SynchronizeWithGitHub`（Integration Gateway Actor自動実行）
**Priority**: High
**Estimate**: 8 Story Points

---

### US-EI-003: GitHub Webhook処理

**As a** システム担当者
**I want to** GitHubからのWebhookイベントを処理する
**So that** リアルタイムで変更を反映できる

**受け入れ条件**:

- [ ] Push、Pull Request、Release等のイベントを受信
- [ ] HMAC-SHA256署名による認証検証
- [ ] Webhook内容の解析と関連システムの特定
- [ ] 処理完了時に`GitHubWebhookEventProcessed`イベントが発行される
- [ ] 処理失敗時のエラー通知と再処理機能

**Event**: `GitHubWebhookEventProcessed`
**Command**: `ProcessRepositoryUpdate`（Integration Gateway Actor自動実行）
**Priority**: Medium
**Estimate**: 8 Story Points

---

### US-EI-004: GitHub Security Advisory連携

**As a** システム担当者
**I want to** GitHubのSecurity Advisoryを自動取得する
**So that** 開発中のコードの脆弱性を把握できる

**受け入れ条件**:

- [ ] リポジトリ固有のSecurity Advisoryを取得
- [ ] 影響するパッケージとバージョン範囲を特定
- [ ] CVE IDとの関連付け
- [ ] 修正バージョンと対応策の情報を取得
- [ ] Advisory情報の変更通知機能

**Event**: `GitHubSecurityAdvisoryReceived`
**Command**: `FetchGitHubSecurityAdvisory`（Integration Gateway Actor自動実行）
**Priority**: Medium
**Estimate**: 5 Story Points

---

## 2. NVD API連携

### US-EI-005: CVE情報自動更新

**As a** システム担当者
**I want to** NVD APIからCVE情報を自動更新する
**So that** 最新の脆弱性情報を常に把握できる

**受け入れ条件**:

- [ ] 日次でNVD APIから新規・更新CVE情報を取得（毎日02:30）
- [ ] CVE ID、説明、CVSSスコア、影響製品を取得
- [ ] 前回取得以降の差分更新を効率的に実行
- [ ] 取得完了時に`CVEInformationReceived`イベントが発行される
- [ ] Rate Limit（2,000 requests/30分）を考慮した取得制御

**Event**: `CVEInformationReceived`
**Command**: `FetchCVEUpdates`（Integration Gateway Actor自動実行）
**Priority**: High
**Estimate**: 8 Story Points

---

### US-EI-006: CVSSスコア更新処理

**As a** システム担当者
**I want to** CVE情報の更新時にCVSSスコアを自動更新する
**So that** 最新の脅威評価を反映できる

**受け入れ条件**:

- [ ] CVSS 2.0、3.0、3.1の複数バージョンに対応
- [ ] ベーススコア、テンポラルスコア、環境スコアを取得
- [ ] スコア変更時の既存脆弱性評価への影響分析
- [ ] 更新完了時に`CVSSScoreUpdated`イベントが発行される
- [ ] スコア大幅変更時の緊急通知機能

**Event**: `CVSSScoreUpdated`
**Command**: `UpdateCVSSScore`（システム自動実行）
**Priority**: High
**Estimate**: 5 Story Points

---

### US-EI-007: NVD連携エラー処理

**As a** システム担当者
**I want to** NVD API連携エラー時に適切に対処する
**So that** サービス継続性を確保できる

**受け入れ条件**:

- [ ] API接続エラー時の自動リトライ（指数バックオフ）
- [ ] Rate Limit超過時の待機と再実行
- [ ] 部分的な取得失敗時の差分補完
- [ ] Fallbackモード（キャッシュデータ使用）の起動
- [ ] エラー状況の監視者への通知

**Event**: `NVDAPIErrorHandled`
**Command**: `HandleNVDAPIError`（Integration Gateway Actor自動実行）
**Priority**: Medium
**Estimate**: 8 Story Points

---

## 3. EndOfLife.date API連携

### US-EI-008: EOL情報自動取得

**As a** システム担当者
**I want to** EndOfLife.date APIからサポート終了情報を自動取得する
**So that** ライフサイクル管理を適切に行える

**受け入れ条件**:

- [ ] OS、ミドルウェア、フレームワークのEOL情報を週次取得（毎週月曜01:00）
- [ ] サポート終了日、拡張サポート終了日、LTS情報を取得
- [ ] 新規製品の追加とEOL日付の更新を処理
- [ ] 取得完了時に`EOLDateUpdated`イベントが発行される
- [ ] 無制限APIだが適切なキャッシュ戦略を実装

**Event**: `EOLDateUpdated`
**Command**: `RetrieveEOLInformation`（Integration Gateway Actor自動実行）
**Priority**: High
**Estimate**: 5 Story Points

---

### US-EI-009: ライフサイクル状況変更処理

**As a** システム担当者
**I want to** 製品のライフサイクル状況変更を自動処理する
**So that** 適切なタイミングで対応を開始できる

**受け入れ条件**:

- [ ] EOL情報更新時の対象システム自動特定
- [ ] ライフサイクルステージ（Active/Maintenance/EOL）の自動判定
- [ ] EOL 30日前警告の自動発行
- [ ] 変更時に`LifecycleStatusChanged`イベントが発行される
- [ ] 影響システムの優先度に応じた通知レベル調整

**Event**: `LifecycleStatusChanged`
**Command**: `ProcessLifecycleChange`（システム自動実行）
**Priority**: High
**Estimate**: 8 Story Points

---

## 4. 統合データ処理

### US-EI-010: 外部データ統合

**As a** システム担当者
**I want to** 複数の外部ソースからのデータを統合する
**So that** 一元的な情報管理ができる

**受け入れ条件**:

- [ ] GitHub、NVD、EndOfLife.dateからの情報を統合
- [ ] データソース間の情報の整合性チェック
- [ ] 競合する情報の優先度ルールに基づく解決
- [ ] 統合結果の品質評価とレポート生成
- [ ] 統合データの変更履歴管理

**Event**: `ExternalDataIntegrated`
**Command**: `IntegrateExternalData`（システム自動実行）
**Priority**: Medium
**Estimate**: 10 Story Points

---

### US-EI-011: データ同期失敗時の処理

**As a** システム担当者
**I want to** 外部API同期失敗時に適切に対処する
**So that** データの整合性を維持できる

**受け入れ条件**:

- [ ] 同期失敗の種類（接続エラー、認証エラー、データエラー）を分類
- [ ] 失敗時の自動リトライとエスカレーション
- [ ] 部分同期失敗時の差分補完処理
- [ ] 失敗時に`DataSynchronizationFailed`イベントが発行される
- [ ] 手動での同期再実行機能

**Event**: `DataSynchronizationFailed`
**Command**: `HandleSyncFailure`（システム自動実行）
**Priority**: Medium
**Estimate**: 8 Story Points

---

## 5. API管理・監視

### US-EI-012: API接続状況監視

**As a** システム担当者
**I want to** 外部APIの接続状況を監視する
**So that** サービス品質を維持できる

**受け入れ条件**:

- [ ] 各API（GitHub、NVD、EOL）の応答時間を監視
- [ ] 成功率、エラー率の継続的な追跡
- [ ] Rate Limit使用状況の監視とアラート
- [ ] API障害時の自動通知機能
- [ ] 監視結果のダッシュボード表示

**Event**: `APIMonitoringReportGenerated`
**Command**: `MonitorAPIConnections`（Monitoring Agent Actor自動実行）
**Priority**: Medium
**Estimate**: 8 Story Points

---

### US-EI-013: API認証情報管理

**As a** 情報システム管理者
**I want to** 外部APIの認証情報を安全に管理する
**So that** セキュリティを確保しながら連携できる

**受け入れ条件**:

- [ ] API キー、トークンの暗号化保存
- [ ] 認証情報の定期ローテーション
- [ ] 認証失敗時の自動通知とアラート
- [ ] 認証情報の使用履歴記録
- [ ] 緊急時の認証情報無効化機能

**Event**: `APICredentialsRotated`
**Command**: `RotateAPICredentials`
**Priority**: High
**Estimate**: 8 Story Points

---

## 6. フォールバック・障害対応

### US-EI-014: フォールバックモード起動

**As a** システム担当者
**I want to** 外部API障害時にフォールバックモードを起動する
**So that** サービス継続性を確保できる

**受け入れ条件**:

- [ ] API障害検出時の自動フォールバックモード起動
- [ ] キャッシュデータを使用した制限的なサービス継続
- [ ] フォールバック状況の利用者への通知
- [ ] 起動時に`FallbackModeActivated`イベントが発行される
- [ ] 外部API復旧時の自動復帰処理

**Event**: `FallbackModeActivated`
**Command**: `ActivateFallbackMode`（Integration Gateway Actor自動実行）
**Priority**: High
**Estimate**: 8 Story Points

---

### US-EI-015: 手動データ補完

**As a** システム担当者
**I want to** 外部API障害時に手動でデータを補完する
**So that** 重要な情報を逃さず管理できる

**受け入れ条件**:

- [ ] 手動での脆弱性情報、EOL情報の入力インターフェース
- [ ] 入力データの妥当性チェックと警告
- [ ] 手動入力データと自動取得データの区別
- [ ] 外部API復旧時の手動データとの整合性確認
- [ ] 手動補完の実行履歴と承認記録

**Event**: `ManualDataSupplemented`
**Command**: `SupplementDataManually`
**Priority**: Low
**Estimate**: 5 Story Points

---

## 関連ドキュメント

- イベントストーミング Phase1: `/docs/event-storming/phase1-domain-events.md`
- イベントストーミング Phase2: `/docs/event-storming/phase2-commands-actors.md`
- ビジネス要件: `/docs/requirement/business-requirement.md`

## 実装優先順位

1. **P1 (高)**: US-EI-001, US-EI-002, US-EI-005, US-EI-008, US-EI-014 - 基本外部連携
2. **P2 (中)**: US-EI-006, US-EI-007, US-EI-009, US-EI-011, US-EI-013 - 信頼性・セキュリティ
3. **P3 (低)**: US-EI-003, US-EI-004, US-EI-010, US-EI-012, US-EI-015 - 高度な統合機能

## API Rate Limit管理

- **GitHub API**: 5,000 requests/hour
- **NVD API**: 2,000 requests/30分
- **EndOfLife.date API**: 制限なし（適切なキャッシュ戦略）

## Resilience Pattern実装

- **Circuit Breaker**: API障害時の自動遮断
- **Retry with Exponential Backoff**: 一時的障害への対応
- **Fallback**: キャッシュデータによるサービス継続
- **Bulkhead**: 各API連携の障害分離
