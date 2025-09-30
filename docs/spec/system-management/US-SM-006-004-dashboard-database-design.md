# US-SM-006-004: ダッシュボードデータベース設計仕様書

**担当**: データベースアーキテクト
**作成日**: 2025-09-30
**Issue**: #173 (US-SM-006-004: ダッシュボードデータベース設計)
**親Issue**: US-SM-006 (ダッシュボード表示)
**関連設計**: US-SM-006-001 (ダッシュボード機能のドメイン設計)

## 1. 設計概要

### 1.1 設計方針

本データベース設計は、CQRS + Event Sourcing パターンにおける **Read Model** として、ダッシュボード表示に最適化された高速クエリ基盤を提供します。

**核心原則**:

- **クエリ最適化優先**: 読み取りパフォーマンスを最優先（2秒未満のレスポンス）
- **意図的な非正規化**: 結合を排除し、単一テーブルでのクエリを実現
- **リアルタイム性**: 数秒以内のデータ更新反映（30秒自動リフレッシュ）
- **スケーラビリティ**: 5-10同時ユーザーに対応可能な設計

### 1.2 技術スタック

- **Database**: PostgreSQL 17.x
- **Extensions**:
  - `pg_cron`: Materialized View自動リフレッシュ
  - `btree_gin`: 複合インデックス最適化
- **Cache**: Redis (多層キャッシュ戦略)
- **Event Source**: Kurrent DB (イベント投影元)

### 1.3 パフォーマンス要件

| 項目 | 目標値 | 計測方法 |
|------|--------|----------|
| ダッシュボード表示 | <2秒 | p95レスポンスタイム |
| 統計情報取得 | <500ms | p95レスポンスタイム |
| リアルタイム更新反映 | <30秒 | イベント発行から投影更新まで |
| 同時ユーザー | 5-10人 | 負荷テスト |
| インデックスヒット率 | >95% | PostgreSQL統計 |

## 2. データベーススキーマ設計

### 2.1 ダッシュボードシステムビューテーブル

**目的**: システムごとの集約データを非正規化して格納し、高速クエリを実現

```sql
-- ================================
-- Dashboard System View Table
-- ================================
-- Purpose: 非正規化されたシステム集約ビュー（Read Model専用）
-- Update Strategy: Event Projection Service による非同期更新
-- Query Pattern: 単一テーブルクエリ、結合なし

CREATE TABLE dashboard_system_view (
  -- ============ 主キー ============
  system_id UUID PRIMARY KEY,

  -- ============ システム基本情報 ============
  system_name VARCHAR(255) NOT NULL,
  system_type VARCHAR(50) NOT NULL,
  system_status VARCHAR(50) NOT NULL,
  criticality VARCHAR(50) NOT NULL,
  security_classification VARCHAR(50) NOT NULL,

  -- ============ 脆弱性集約データ ============
  -- Source: Vulnerability Management Context
  vulnerability_count INTEGER NOT NULL DEFAULT 0,
  high_severity_vulnerabilities INTEGER NOT NULL DEFAULT 0,
  critical_vulnerabilities INTEGER NOT NULL DEFAULT 0,
  max_cvss_score NUMERIC(3,1),
  latest_vulnerability_date TIMESTAMP,

  -- ============ EOL（サポート終了）集約データ ============
  -- Source: System Management Context (Package EOL events)
  has_eol_warnings BOOLEAN NOT NULL DEFAULT FALSE,
  eol_days_remaining INTEGER,
  eol_packages_count INTEGER NOT NULL DEFAULT 0,
  nearest_eol_date TIMESTAMP,

  -- ============ タスク集約データ ============
  -- Source: Task Management Context
  open_task_count INTEGER NOT NULL DEFAULT 0,
  urgent_task_count INTEGER NOT NULL DEFAULT 0,
  overdue_task_count INTEGER NOT NULL DEFAULT 0,
  latest_task_due_date TIMESTAMP,

  -- ============ パッケージサマリー ============
  -- Source: System Management Context
  total_packages INTEGER NOT NULL DEFAULT 0,
  vulnerable_packages INTEGER NOT NULL DEFAULT 0,
  outdated_packages INTEGER NOT NULL DEFAULT 0,

  -- ============ メタデータ ============
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_event_applied_at TIMESTAMP NOT NULL,
  last_event_id UUID,

  -- ============ 制約 ============
  CONSTRAINT chk_vulnerability_count CHECK (vulnerability_count >= 0),
  CONSTRAINT chk_high_severity_vulnerabilities CHECK (high_severity_vulnerabilities >= 0),
  CONSTRAINT chk_critical_vulnerabilities CHECK (critical_vulnerabilities >= 0),
  CONSTRAINT chk_max_cvss_score CHECK (max_cvss_score IS NULL OR (max_cvss_score >= 0 AND max_cvss_score <= 10)),
  CONSTRAINT chk_task_counts CHECK (
    open_task_count >= 0 AND
    urgent_task_count >= 0 AND
    overdue_task_count >= 0
  ),
  CONSTRAINT chk_package_counts CHECK (
    total_packages >= 0 AND
    vulnerable_packages >= 0 AND
    outdated_packages >= 0 AND
    vulnerable_packages <= total_packages AND
    outdated_packages <= total_packages
  )
);

-- ============ テーブルコメント ============
COMMENT ON TABLE dashboard_system_view IS 'ダッシュボード専用の非正規化システムビュー（Read Model）';
COMMENT ON COLUMN dashboard_system_view.system_id IS 'システムID（主キー）';
COMMENT ON COLUMN dashboard_system_view.vulnerability_count IS '脆弱性総数（全重要度）';
COMMENT ON COLUMN dashboard_system_view.max_cvss_score IS '最大CVSSスコア（v3.1）';
COMMENT ON COLUMN dashboard_system_view.has_eol_warnings IS 'EOL警告フラグ（90日以内にEOL到達）';
COMMENT ON COLUMN dashboard_system_view.eol_days_remaining IS '最短EOLまでの日数';
COMMENT ON COLUMN dashboard_system_view.last_event_applied_at IS '最終イベント適用日時（Event Sourcing）';
```

### 2.2 ダッシュボード統計情報マテリアライズドビュー

**目的**: 統計情報を事前集計し、超高速取得を実現

```sql
-- ================================
-- Dashboard Statistics Materialized View
-- ================================
-- Purpose: 統計情報の事前集計（30秒自動リフレッシュ）
-- Refresh Strategy: CONCURRENT REFRESH（ロックフリー）
-- Query Pattern: 統計情報APIで使用

CREATE MATERIALIZED VIEW dashboard_statistics AS
SELECT
  -- ============ システム統計 ============
  COUNT(*) FILTER (WHERE is_deleted = FALSE) AS total_systems,
  COUNT(*) FILTER (WHERE system_status = 'ACTIVE' AND is_deleted = FALSE) AS active_systems,
  COUNT(*) FILTER (WHERE system_status = 'INACTIVE' AND is_deleted = FALSE) AS inactive_systems,
  COUNT(*) FILTER (WHERE system_status = 'MAINTENANCE' AND is_deleted = FALSE) AS maintenance_systems,

  -- ============ 重要度別統計 ============
  COUNT(*) FILTER (WHERE criticality = 'CRITICAL' AND is_deleted = FALSE) AS critical_systems,
  COUNT(*) FILTER (WHERE criticality = 'HIGH' AND is_deleted = FALSE) AS high_criticality_systems,
  COUNT(*) FILTER (WHERE criticality = 'MEDIUM' AND is_deleted = FALSE) AS medium_criticality_systems,
  COUNT(*) FILTER (WHERE criticality = 'LOW' AND is_deleted = FALSE) AS low_criticality_systems,

  -- ============ 脆弱性統計 ============
  COUNT(*) FILTER (WHERE vulnerability_count > 0 AND is_deleted = FALSE) AS systems_with_vulnerabilities,
  COUNT(*) FILTER (WHERE critical_vulnerabilities > 0 AND is_deleted = FALSE) AS systems_with_critical_vulns,
  COALESCE(SUM(vulnerability_count) FILTER (WHERE is_deleted = FALSE), 0) AS total_vulnerabilities,
  COALESCE(SUM(critical_vulnerabilities) FILTER (WHERE is_deleted = FALSE), 0) AS total_critical_vulnerabilities,
  COALESCE(SUM(high_severity_vulnerabilities) FILTER (WHERE is_deleted = FALSE), 0) AS total_high_severity_vulnerabilities,
  COALESCE(MAX(max_cvss_score) FILTER (WHERE is_deleted = FALSE), 0) AS highest_cvss_score,

  -- ============ EOL統計 ============
  COUNT(*) FILTER (WHERE has_eol_warnings = TRUE AND is_deleted = FALSE) AS systems_with_eol_warnings,
  COUNT(*) FILTER (WHERE eol_days_remaining IS NOT NULL AND eol_days_remaining <= 30 AND is_deleted = FALSE) AS systems_eol_within_30_days,
  COUNT(*) FILTER (WHERE eol_days_remaining IS NOT NULL AND eol_days_remaining <= 90 AND is_deleted = FALSE) AS systems_eol_within_90_days,

  -- ============ タスク統計 ============
  COALESCE(SUM(open_task_count) FILTER (WHERE is_deleted = FALSE), 0) AS total_open_tasks,
  COALESCE(SUM(urgent_task_count) FILTER (WHERE is_deleted = FALSE), 0) AS total_urgent_tasks,
  COALESCE(SUM(overdue_task_count) FILTER (WHERE is_deleted = FALSE), 0) AS total_overdue_tasks,

  -- ============ パッケージ統計 ============
  COALESCE(SUM(total_packages) FILTER (WHERE is_deleted = FALSE), 0) AS total_packages,
  COALESCE(SUM(vulnerable_packages) FILTER (WHERE is_deleted = FALSE), 0) AS total_vulnerable_packages,
  COALESCE(SUM(outdated_packages) FILTER (WHERE is_deleted = FALSE), 0) AS total_outdated_packages,

  -- ============ メタデータ ============
  MAX(updated_at) FILTER (WHERE is_deleted = FALSE) AS last_updated,
  NOW() AS refreshed_at
FROM dashboard_system_view;

-- ============ CONCURRENT REFRESHを可能にするユニークインデックス ============
-- Note: Materialized Viewには最低1つのユニークインデックスが必要
CREATE UNIQUE INDEX idx_dashboard_statistics_unique ON dashboard_statistics ((1));

-- ============ ビューコメント ============
COMMENT ON MATERIALIZED VIEW dashboard_statistics IS 'ダッシュボード統計情報（30秒自動リフレッシュ）';
```

## 3. 高速検索用インデックス設計

### 3.1 インデックス戦略

**原則**:

1. **部分インデックス**: WHERE句で絞り込み、インデックスサイズを最小化
2. **複合インデックス**: 頻繁に組み合わせて検索される条件に対応
3. **カバリングインデックス**: SELECT句のカラムも含め、テーブルアクセスを削減
4. **ソート最適化**: ORDER BY句で使用されるカラムをインデックス化

### 3.2 インデックス定義

```sql
-- ================================
-- Dashboard System View Indexes
-- ================================

-- ============ 基本インデックス（単一カラム） ============

-- システムステータス検索（アクティブシステムのみ）
CREATE INDEX idx_dashboard_system_status
ON dashboard_system_view (system_status)
WHERE is_deleted = FALSE;

-- 重要度検索（削除されていないシステムのみ）
CREATE INDEX idx_dashboard_criticality
ON dashboard_system_view (criticality)
WHERE is_deleted = FALSE;

-- セキュリティ分類検索
CREATE INDEX idx_dashboard_security_classification
ON dashboard_system_view (security_classification)
WHERE is_deleted = FALSE;

-- ============ 部分インデックス（条件付き高速化） ============

-- 脆弱性があるシステム（最も頻繁に検索される）
CREATE INDEX idx_dashboard_has_vulnerabilities
ON dashboard_system_view (vulnerability_count)
WHERE vulnerability_count > 0 AND is_deleted = FALSE;

-- クリティカル脆弱性があるシステム（緊急対応用）
CREATE INDEX idx_dashboard_critical_vulnerabilities
ON dashboard_system_view (critical_vulnerabilities)
WHERE critical_vulnerabilities > 0 AND is_deleted = FALSE;

-- EOL警告があるシステム（サポート終了対応用）
CREATE INDEX idx_dashboard_has_eol_warnings
ON dashboard_system_view (has_eol_warnings, eol_days_remaining)
WHERE has_eol_warnings = TRUE AND is_deleted = FALSE;

-- 緊急タスクがあるシステム（対応優先度判断用）
CREATE INDEX idx_dashboard_urgent_tasks
ON dashboard_system_view (urgent_task_count)
WHERE urgent_task_count > 0 AND is_deleted = FALSE;

-- 期限切れタスクがあるシステム（遅延対応用）
CREATE INDEX idx_dashboard_overdue_tasks
ON dashboard_system_view (overdue_task_count)
WHERE overdue_task_count > 0 AND is_deleted = FALSE;

-- ============ 複合インデックス（複数条件フィルタリング用） ============

-- 重要度 + 脆弱性あり（最頻出クエリパターン）
CREATE INDEX idx_dashboard_criticality_with_vulns
ON dashboard_system_view (criticality, vulnerability_count)
WHERE criticality IN ('HIGH', 'CRITICAL')
  AND vulnerability_count > 0
  AND is_deleted = FALSE;

-- ステータス + 重要度（システム一覧フィルタリング）
CREATE INDEX idx_dashboard_status_criticality
ON dashboard_system_view (system_status, criticality)
WHERE is_deleted = FALSE;

-- 重要度 + EOL警告（リスク評価用）
CREATE INDEX idx_dashboard_criticality_eol
ON dashboard_system_view (criticality, has_eol_warnings)
WHERE has_eol_warnings = TRUE AND is_deleted = FALSE;

-- セキュリティ分類 + 脆弱性（セキュリティレビュー用）
CREATE INDEX idx_dashboard_security_vulns
ON dashboard_system_view (security_classification, vulnerability_count)
WHERE vulnerability_count > 0 AND is_deleted = FALSE;

-- ============ ソート用インデックス（ORDER BY最適化） ============

-- 更新日時降順（最新更新システム取得）
CREATE INDEX idx_dashboard_updated_at_desc
ON dashboard_system_view (updated_at DESC)
WHERE is_deleted = FALSE;

-- CVSSスコア降順（最も危険なシステム取得）
CREATE INDEX idx_dashboard_max_cvss_score_desc
ON dashboard_system_view (max_cvss_score DESC NULLS LAST)
WHERE max_cvss_score IS NOT NULL AND is_deleted = FALSE;

-- 緊急タスク数降順（対応優先度順）
CREATE INDEX idx_dashboard_urgent_tasks_desc
ON dashboard_system_view (urgent_task_count DESC)
WHERE urgent_task_count > 0 AND is_deleted = FALSE;

-- EOL残日数昇順（最も緊急なEOL）
CREATE INDEX idx_dashboard_eol_days_asc
ON dashboard_system_view (eol_days_remaining ASC NULLS LAST)
WHERE has_eol_warnings = TRUE AND is_deleted = FALSE;

-- ============ カバリングインデックス（テーブルアクセス削減） ============

-- ダッシュボード一覧表示用（最頻出クエリパターン）
-- INCLUDE句でSELECT対象カラムも含める
CREATE INDEX idx_dashboard_overview_covering
ON dashboard_system_view (
  system_status,
  criticality
)
INCLUDE (
  system_name,
  system_type,
  vulnerability_count,
  critical_vulnerabilities,
  has_eol_warnings,
  urgent_task_count
)
WHERE is_deleted = FALSE;
```

### 3.3 インデックス使用パターン

| クエリパターン | 使用されるインデックス | 期待性能 |
|----------------|------------------------|----------|
| `WHERE criticality = 'CRITICAL' AND vulnerability_count > 0` | `idx_dashboard_criticality_with_vulns` | <10ms |
| `WHERE system_status = 'ACTIVE' ORDER BY updated_at DESC` | `idx_dashboard_status_criticality` + `idx_dashboard_updated_at_desc` | <50ms |
| `WHERE has_eol_warnings = TRUE ORDER BY eol_days_remaining` | `idx_dashboard_eol_days_asc` | <20ms |
| `WHERE urgent_task_count > 0 ORDER BY urgent_task_count DESC` | `idx_dashboard_urgent_tasks_desc` | <30ms |
| ダッシュボード一覧（SELECT多数カラム） | `idx_dashboard_overview_covering` | <100ms |

## 4. リアルタイム更新機構設計

### 4.1 自動リフレッシュ機構

```sql
-- ================================
-- Materialized View Auto-Refresh
-- ================================

-- pg_cron拡張の有効化
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 30秒ごとの自動リフレッシュジョブ
-- Note: リアルタイム性要件（数秒以内）を満たすため、30秒間隔で設定
SELECT cron.schedule(
  'refresh-dashboard-stats-30s',
  '*/30 * * * * *', -- 30秒ごと (Cron拡張形式)
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_statistics$$
);

-- ジョブ確認
SELECT * FROM cron.job WHERE jobname = 'refresh-dashboard-stats-30s';
```

### 4.2 手動リフレッシュ関数

```sql
-- ================================
-- Manual Refresh Functions
-- ================================

-- 統計情報即時リフレッシュ（管理者用）
CREATE OR REPLACE FUNCTION refresh_dashboard_statistics()
RETURNS TABLE(
  success BOOLEAN,
  refreshed_at TIMESTAMP,
  execution_time_ms INTEGER
) AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
BEGIN
  start_time := clock_timestamp();

  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_statistics;

  end_time := clock_timestamp();

  RETURN QUERY
  SELECT
    TRUE AS success,
    NOW() AS refreshed_at,
    EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER AS execution_time_ms;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_dashboard_statistics() IS 'ダッシュボード統計情報を即座にリフレッシュ（管理者用）';
```

### 4.3 Event Projection更新トリガー

```sql
-- ================================
-- Projection Update Triggers
-- ================================

-- 更新日時自動更新トリガー
CREATE OR REPLACE FUNCTION update_dashboard_system_view_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dashboard_system_view_timestamp
BEFORE UPDATE ON dashboard_system_view
FOR EACH ROW
EXECUTE FUNCTION update_dashboard_system_view_timestamp();

-- イベント適用通知トリガー（WebSocket通知用）
CREATE OR REPLACE FUNCTION notify_dashboard_update()
RETURNS TRIGGER AS $$
BEGIN
  -- PostgreSQL NOTIFY でWebSocketサーバーに通知
  PERFORM pg_notify(
    'dashboard_update',
    json_build_object(
      'system_id', NEW.system_id,
      'system_name', NEW.system_name,
      'event_type', TG_OP,
      'timestamp', NEW.updated_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_dashboard_update
AFTER INSERT OR UPDATE ON dashboard_system_view
FOR EACH ROW
EXECUTE FUNCTION notify_dashboard_update();

COMMENT ON FUNCTION notify_dashboard_update() IS 'ダッシュボード更新をWebSocketサーバーに通知';
```

## 5. クエリ最適化戦略

### 5.1 クエリ実行計画の例

```sql
-- ================================
-- Query Execution Plan Examples
-- ================================

-- クエリ1: 脆弱性があるクリティカルシステム一覧
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT
  system_id,
  system_name,
  system_type,
  criticality,
  vulnerability_count,
  critical_vulnerabilities,
  max_cvss_score
FROM dashboard_system_view
WHERE criticality IN ('CRITICAL', 'HIGH')
  AND vulnerability_count > 0
  AND is_deleted = FALSE
ORDER BY max_cvss_score DESC NULLS LAST
LIMIT 50;

-- 期待される実行計画:
-- -> Index Scan using idx_dashboard_criticality_with_vulns
-- -> Sort using idx_dashboard_max_cvss_score_desc

-- クエリ2: EOL警告があるシステム（緊急度順）
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT
  system_id,
  system_name,
  has_eol_warnings,
  eol_days_remaining,
  nearest_eol_date
FROM dashboard_system_view
WHERE has_eol_warnings = TRUE
  AND is_deleted = FALSE
ORDER BY eol_days_remaining ASC
LIMIT 20;

-- 期待される実行計画:
-- -> Index Scan using idx_dashboard_eol_days_asc

-- クエリ3: ダッシュボード統計取得（超高速）
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM dashboard_statistics;

-- 期待される実行計画:
-- -> Seq Scan on dashboard_statistics (1行のみなので極めて高速)
```

### 5.2 クエリチューニングガイドライン

1. **WHERE句フィルタリング**: 必ず `is_deleted = FALSE` を含める
2. **LIMIT句の活用**: 大量データ取得時は必ずLIMITを設定
3. **カバリングインデックス**: 頻繁なクエリには専用インデックスを検討
4. **統計情報更新**: 定期的に `ANALYZE` を実行してプランナーを最適化

```sql
-- 統計情報更新（週次推奨）
ANALYZE dashboard_system_view;
ANALYZE dashboard_statistics;
```

## 6. パフォーマンス監視

### 6.1 監視用ビュー

```sql
-- ================================
-- Performance Monitoring Views
-- ================================

-- インデックス使用統計
CREATE OR REPLACE VIEW dashboard_index_usage_stats AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename = 'dashboard_system_view'
ORDER BY idx_scan DESC;

-- テーブルサイズ統計
CREATE OR REPLACE VIEW dashboard_table_size_stats AS
SELECT
  'dashboard_system_view' AS table_name,
  pg_size_pretty(pg_total_relation_size('dashboard_system_view')) AS total_size,
  pg_size_pretty(pg_relation_size('dashboard_system_view')) AS table_size,
  pg_size_pretty(pg_total_relation_size('dashboard_system_view') - pg_relation_size('dashboard_system_view')) AS indexes_size,
  (SELECT COUNT(*) FROM dashboard_system_view WHERE is_deleted = FALSE) AS row_count
UNION ALL
SELECT
  'dashboard_statistics' AS table_name,
  pg_size_pretty(pg_total_relation_size('dashboard_statistics')) AS total_size,
  pg_size_pretty(pg_relation_size('dashboard_statistics')) AS table_size,
  pg_size_pretty(pg_total_relation_size('dashboard_statistics') - pg_relation_size('dashboard_statistics')) AS indexes_size,
  (SELECT COUNT(*) FROM dashboard_statistics) AS row_count;

-- クエリパフォーマンス統計（pg_stat_statements拡張必要）
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

CREATE OR REPLACE VIEW dashboard_query_performance AS
SELECT
  LEFT(query, 100) AS query_preview,
  calls,
  ROUND(total_exec_time::numeric, 2) AS total_time_ms,
  ROUND(mean_exec_time::numeric, 2) AS avg_time_ms,
  ROUND(stddev_exec_time::numeric, 2) AS stddev_time_ms,
  ROUND((100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric, 2) AS cache_hit_ratio
FROM pg_stat_statements
WHERE query LIKE '%dashboard_system_view%'
   OR query LIKE '%dashboard_statistics%'
ORDER BY total_exec_time DESC
LIMIT 20;
```

### 6.2 アラート条件

| メトリクス | 閾値 | アクション |
|-----------|------|-----------|
| クエリ平均応答時間 | >2秒 | インデックス見直し |
| キャッシュヒット率 | <90% | メモリ増強検討 |
| テーブルサイズ | >10GB | パーティショニング検討 |
| Materialized Viewリフレッシュ時間 | >5秒 | 統計情報簡素化 |

## 7. データメンテナンス

### 7.1 定期メンテナンス

```sql
-- ================================
-- Regular Maintenance Tasks
-- ================================

-- VACUUM（週次推奨）
-- Note: 削除済みレコードの物理削除とインデックス最適化
VACUUM (ANALYZE, VERBOSE) dashboard_system_view;

-- REINDEX（月次推奨）
-- Note: インデックスの断片化解消
REINDEX TABLE CONCURRENTLY dashboard_system_view;

-- 統計情報更新（週次推奨）
ANALYZE dashboard_system_view;
ANALYZE dashboard_statistics;
```

### 7.2 論理削除データのアーカイブ

```sql
-- ================================
-- Soft Delete Archiving
-- ================================

-- 論理削除から1年経過したデータをアーカイブテーブルに移動
CREATE TABLE IF NOT EXISTS dashboard_system_view_archive (
  LIKE dashboard_system_view INCLUDING ALL
);

-- アーカイブ関数
CREATE OR REPLACE FUNCTION archive_old_deleted_systems()
RETURNS TABLE(archived_count INTEGER) AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 1年以上前に論理削除されたデータをアーカイブ
  INSERT INTO dashboard_system_view_archive
  SELECT * FROM dashboard_system_view
  WHERE is_deleted = TRUE
    AND updated_at < NOW() - INTERVAL '1 year';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- 元テーブルから物理削除
  DELETE FROM dashboard_system_view
  WHERE is_deleted = TRUE
    AND updated_at < NOW() - INTERVAL '1 year';

  RETURN QUERY SELECT deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 月次アーカイブジョブ（pg_cron）
SELECT cron.schedule(
  'archive-deleted-systems-monthly',
  '0 2 1 * *', -- 毎月1日 午前2時
  $$SELECT archive_old_deleted_systems()$$
);
```

## 8. セキュリティ設計

### 8.1 アクセス制御

```sql
-- ================================
-- Database Access Control
-- ================================

-- 読み取り専用ロール（アプリケーション用）
CREATE ROLE dashboard_readonly;
GRANT SELECT ON dashboard_system_view TO dashboard_readonly;
GRANT SELECT ON dashboard_statistics TO dashboard_readonly;

-- 更新ロール（Event Projection Service用）
CREATE ROLE dashboard_writer;
GRANT SELECT, INSERT, UPDATE ON dashboard_system_view TO dashboard_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dashboard_writer;

-- 管理ロール（DBA用）
CREATE ROLE dashboard_admin;
GRANT ALL PRIVILEGES ON dashboard_system_view TO dashboard_admin;
GRANT ALL PRIVILEGES ON dashboard_statistics TO dashboard_admin;
GRANT EXECUTE ON FUNCTION refresh_dashboard_statistics() TO dashboard_admin;
```

### 8.2 Row Level Security (RLS)

```sql
-- ================================
-- Row Level Security Policies
-- ================================

-- RLS有効化
ALTER TABLE dashboard_system_view ENABLE ROW LEVEL SECURITY;

-- ポリシー1: 一般ユーザーは自分がアクセス権を持つシステムのみ閲覧可能
CREATE POLICY dashboard_view_own_systems ON dashboard_system_view
FOR SELECT
USING (
  security_classification IN (
    SELECT allowed_classification
    FROM user_security_clearance
    WHERE user_id = current_setting('app.current_user_id')::UUID
  )
);

-- ポリシー2: 管理者は全システム閲覧可能
CREATE POLICY dashboard_view_all_systems ON dashboard_system_view
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = current_setting('app.current_user_id')::UUID
      AND role IN ('ADMIN', 'SECURITY_ADMIN')
  )
);
```

## 9. バックアップ・リカバリ

### 9.1 バックアップ戦略

| バックアップ種別 | 頻度 | 保持期間 | 目的 |
|-----------------|------|----------|------|
| 論理バックアップ (pg_dump) | 日次 | 30日 | データ復旧 |
| 物理バックアップ (PITR) | 連続 | 7日 | ポイントインタイムリカバリ |
| Materialized View スナップショット | なし | - | 自動リフレッシュで再構築可能 |

### 9.2 リカバリ手順

```sql
-- ================================
-- Recovery Procedures
-- ================================

-- Read Modelの完全再構築（最終手段）
-- Note: Event Storeから全イベントを再投影
CREATE OR REPLACE FUNCTION rebuild_dashboard_read_model()
RETURNS void AS $$
BEGIN
  -- 1. 既存データをクリア
  TRUNCATE TABLE dashboard_system_view CASCADE;

  -- 2. Event Projection Serviceに再投影を指示
  -- (アプリケーション側で実装)
  RAISE NOTICE 'Dashboard Read Model cleared. Trigger full projection rebuild from Event Store.';
END;
$$ LANGUAGE plpgsql;
```

## 10. 移行戦略

### 10.1 初期データ投入

```sql
-- ================================
-- Initial Data Migration
-- ================================

-- 既存システムデータからの初期投影（本番移行時）
INSERT INTO dashboard_system_view (
  system_id,
  system_name,
  system_type,
  system_status,
  criticality,
  security_classification,
  last_event_applied_at
)
SELECT
  id AS system_id,
  name AS system_name,
  type AS system_type,
  status AS system_status,
  criticality,
  security_classification,
  NOW() AS last_event_applied_at
FROM systems
WHERE is_deleted = FALSE;

-- 統計情報の初回構築
REFRESH MATERIALIZED VIEW dashboard_statistics;
```

## 11. 実装チェックリスト

- [x] dashboard_system_view テーブル設計完了
- [x] dashboard_statistics Materialized View設計完了
- [x] 高速検索用インデックス設計完了（15種類）
- [x] リアルタイム更新トリガー設計完了
- [x] 自動リフレッシュ機構設計完了（30秒間隔）
- [x] パフォーマンス監視ビュー設計完了
- [x] メンテナンス手順設計完了
- [x] セキュリティ設計完了（RLS含む）
- [x] バックアップ・リカバリ戦略設計完了
- [x] 移行戦略設計完了

## 12. 次のステップ

### Phase 1: 基本実装 (US-SM-006-005)

- [ ] DDLスクリプト作成
- [ ] マイグレーションファイル作成
- [ ] 開発環境でのスキーマ構築

### Phase 2: Event Projection実装 (US-SM-006-006)

- [ ] DashboardProjectionService実装
- [ ] イベントハンドラー実装
- [ ] リトライ機構実装

### Phase 3: パフォーマンステスト

- [ ] 負荷テスト実施
- [ ] インデックス効果検証
- [ ] クエリ最適化

## 13. 関連ドキュメント

- [US-SM-006-001: ダッシュボード機能のドメイン設計](./US-SM-006-dashboard-domain-design.md)
- [Database Schema (System Management)](./database-schema.md)
- [Security Authorization Matrix](./security-authorization-matrix.md)

---

**レビュー依頼**:

- Backend Developer: Event Projection Serviceとの連携確認
- DevOps Engineer: pg_cron設定、監視メトリクス設計確認
- Security Engineer: RLSポリシー、アクセス制御確認
