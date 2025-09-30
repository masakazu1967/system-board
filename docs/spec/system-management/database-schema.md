# データベーススキーマ設計

**担当**: データベースアーキテクト
**作成日**: 2025-09-20
**Issue**: #121
**見積**: 30分
**親Issue**: #34 US-SM-001: システム新規登録

## 1. PostgreSQL ReadModel テーブル設計

### 1.1 systems テーブル

システム情報を格納するメインテーブル

```sql
CREATE TABLE systems (
    -- Primary Identity
    system_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL REFERENCES system_types(type_code),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PLANNING', 'ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED', 'CANCELLED')),

    -- Host Configuration
    host_cpu_cores INTEGER NOT NULL,
    host_memory_gb INTEGER NOT NULL,
    host_storage_gb INTEGER NOT NULL,
    host_os VARCHAR(100),
    host_os_version VARCHAR(50),
    host_encryption_enabled BOOLEAN NOT NULL DEFAULT false,

    -- Security & Compliance
    security_classification VARCHAR(20) NOT NULL CHECK (security_classification IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')),
    criticality_level VARCHAR(10) NOT NULL CHECK (criticality_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

    -- Lifecycle Management
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decommission_date TIMESTAMP WITH TIME ZONE,

    -- Metadata
    version INTEGER NOT NULL DEFAULT 1,
    created_by VARCHAR(255),
    last_modified_by VARCHAR(255),

    -- Constraints
    UNIQUE(name),
    CHECK (decommission_date IS NULL OR decommission_date > created_date),
    CHECK (last_modified >= created_date)
);
```

### 1.2 system_types テーブル

システム種別の参照マスタテーブル

```sql
CREATE TABLE system_types (
    type_code VARCHAR(20) PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL,
    description TEXT,
    default_criticality VARCHAR(10) NOT NULL CHECK (default_criticality IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    requires_encryption BOOLEAN NOT NULL DEFAULT false,
    min_cpu_cores INTEGER NOT NULL DEFAULT 1,
    min_memory_gb INTEGER NOT NULL DEFAULT 1,
    min_storage_gb INTEGER NOT NULL DEFAULT 10,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- 初期データ投入
INSERT INTO system_types (type_code, type_name, description, default_criticality, requires_encryption, min_cpu_cores, min_memory_gb, min_storage_gb) VALUES
('WEB', 'Webアプリケーション', 'ユーザー向けWebアプリケーションシステム', 'MEDIUM', false, 2, 4, 20),
('API', 'APIサーバー', 'REST/GraphQL APIを提供するシステム', 'HIGH', true, 2, 8, 50),
('DATABASE', 'データベース', 'データベース管理システム', 'CRITICAL', true, 4, 16, 100),
('BATCH', 'バッチ処理', 'バックグラウンドバッチ処理システム', 'MEDIUM', false, 1, 2, 10),
('OTHER', 'その他', 'その他のシステム', 'LOW', false, 1, 1, 10);
```

### 1.3 system_packages テーブル

システムにインストールされているパッケージ情報

```sql
CREATE TABLE system_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES systems(system_id) ON DELETE CASCADE,
    package_name VARCHAR(255) NOT NULL,
    package_version VARCHAR(100) NOT NULL,
    package_type VARCHAR(50) NOT NULL, -- npm, pip, apt, yum, etc.
    install_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_security_compliant BOOLEAN NOT NULL DEFAULT true,
    license_type VARCHAR(100),

    -- Composite unique constraint
    UNIQUE(system_id, package_name, package_type)
);

-- Indexes for performance (created separately)
CREATE INDEX idx_system_packages_system_id ON system_packages(system_id);
CREATE INDEX idx_system_packages_name_type ON system_packages(package_name, package_type);
CREATE INDEX idx_system_packages_security ON system_packages(is_security_compliant);
```

#### パーティショニング戦略の検討

**設計決定**: system_packagesテーブルに対して**当面はパーティショニングを実装しない**

##### 理由

1. **データ規模**: 予想される総レコード数は5,000～10,000件程度（システム数500-1000 × パッケージ平均5-10個）
   - PostgreSQLは数百万レコードまで通常のテーブルで高速動作
   - 現時点の規模ではパーティショニングの利点を享受できない

2. **クエリパターン**: 主なクエリは以下の通りでインデックスで十分対応可能
   - システム別パッケージ一覧: `idx_system_packages_system_id`で最適化済み
   - パッケージ名検索: `idx_system_packages_name_type`で最適化済み
   - セキュリティ準拠チェック: `idx_system_packages_security`で最適化済み

3. **運用複雑性**: パーティショニング導入により以下の制約が発生
   - PRIMARY KEYはパーティションキーを含む必要がある
   - UNIQUE制約もパーティションキーを含む必要がある
   - パーティション管理の運用負荷増加

##### 将来的な再検討基準

以下の条件に該当する場合、パーティショニングの導入を検討する：

1. **データ量の増加**: 総レコード数が10万件を超えた場合
2. **クエリパフォーマンス劣化**: インデックスを使用しても100ms以上かかるクエリが発生
3. **定期的な大量削除**: 古いパッケージデータを定期的に削除する運用が必要になった場合
4. **時系列分析の需要**: install_dateによる時系列分析が頻繁に必要になった場合

##### 将来的な実装候補

パーティショニングを導入する場合の候補アプローチ：

**候補1: Hash Partitioning by system_id**（推奨）

```sql
-- システムIDでハッシュパーティショニング（均等分散）
CREATE TABLE system_packages (
    -- 列定義は同じ
    id UUID,
    system_id UUID NOT NULL,
    -- ...
    PRIMARY KEY (id, system_id)  -- パーティションキーを含める必要あり
) PARTITION BY HASH (system_id);

-- 4つのパーティションを作成（均等分散）
CREATE TABLE system_packages_p0 PARTITION OF system_packages FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE system_packages_p1 PARTITION OF system_packages FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE system_packages_p2 PARTITION OF system_packages FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE system_packages_p3 PARTITION OF system_packages FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

**利点**:

- システムごとのパッケージクエリが同一パーティション内で完結（Partition Pruning）
- 均等にデータ分散される
- パーティション管理が自動的

**候補2: Range Partitioning by install_date**:

```sql
-- インストール日でレンジパーティショニング（時系列分析向け）
CREATE TABLE system_packages (
    -- 列定義は同じ
    id UUID,
    install_date TIMESTAMP WITH TIME ZONE NOT NULL,
    -- ...
    PRIMARY KEY (id, install_date)  -- パーティションキーを含める必要あり
) PARTITION BY RANGE (install_date);

-- 四半期ごとにパーティション作成
CREATE TABLE system_packages_2025q1 PARTITION OF system_packages
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE system_packages_2025q2 PARTITION OF system_packages
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
-- ... 以降も同様
```

**利点**:

- 時系列クエリの高速化
- 古いデータの一括削除が高速（パーティションDROP）
- pg_partman拡張で自動パーティション管理可能

**欠点**:

- パーティション作成の運用負荷
- 時系列クエリ以外では効果薄い

##### 現在の最適化戦略

パーティショニングの代わりに、以下のインデックス戦略で性能を確保：

1. **システム別クエリ**: `idx_system_packages_system_id`
2. **パッケージ名検索**: `idx_system_packages_name_type`（複合インデックス）
3. **セキュリティ準拠フィルタ**: `idx_system_packages_security`（部分インデックス）

これらのインデックスにより、予想されるデータ規模では十分なパフォーマンスを維持できる。

### 1.4 システム名の一意性保証（Redis-based）

**設計決定**: PostgreSQLテーブルではなく、**Redis-based同期予約**を採用

#### 1.4.1 理由

PostgreSQLテーブルでの予約は以下の問題があります：

1. **レースコンディションリスク**: Read Model更新が非同期のため、チェックとイベント永続化の間に重複が発生する可能性
2. **CQRS違反**: コマンド側でRead Modelデータベースに書き込むと、CQRS分離原則に違反
3. **複雑性**: 分散トランザクションやSagaパターンが必要

#### Redis予約戦略

```typescript
// Command Handler内での同期予約フロー
async registerSystem(command: RegisterSystemCommand): Promise<SystemId> {
  const systemName = command.name.toLowerCase();

  // 1. Redis同期予約（原子的操作）
  const reserved = await redis.set(
    `system:name:reservation:${systemName}`,
    command.aggregateId,
    'NX',  // Only set if not exists
    'EX',  // Expiration
    60     // 60秒TTL
  );

  if (!reserved) {
    throw new SystemNameAlreadyExistsException(systemName);
  }

  try {
    // 2. イベント永続化
    await this.eventStore.append(event);

    // 3. 予約を永続化（TTL削除）
    await redis.persist(`system:name:reservation:${systemName}`);

    return systemId;
  } catch (error) {
    // 失敗時は予約をロールバック（TTLで自動削除される）
    await redis.del(`system:name:reservation:${systemName}`);
    throw error;
  }
}
```

#### Redis Key設計

```text
# 一時予約（コマンド処理中）
Key: system:name:reservation:{systemName}
Value: {aggregateId}
TTL: 60秒

# 永続確認（イベント処理完了後）
Key: system:name:confirmed:{systemName}
Value: {aggregateId}
TTL: なし（永続）
```

#### Redis障害時のフォールバック

```typescript
try {
  // Redis優先パス
  const reserved = await this.redisReservationService.tryReserve(systemName);
} catch (redisError) {
  // Redis障害時はPostgreSQLで確認（スロー パス）
  const exists = await this.systemRepository.existsByName(systemName);
  if (exists) {
    throw new SystemNameAlreadyExistsException(systemName);
  }
  // 小さなレースコンディションリスクを受け入れて継続
  this.alertService.triggerAlert('REDIS_DOWN');
}
```

#### Redisキャッシュの再構築

```typescript
// Kurrent DBイベントからRedisキャッシュを再構築
async rebuildRedisCache(): Promise<void> {
  const events = await this.kurrentClient.readStream('$ce-System');

  for (const event of events) {
    if (event.type === 'SystemRegistered') {
      await redis.set(`system:name:confirmed:${event.data.name}`, event.data.systemId);
    }
    if (event.type === 'SystemDecommissioned') {
      await redis.del(`system:name:confirmed:${event.data.name}`);
    }
  }
}
```

**注**: PostgreSQLの`systems`テーブルにはUNIQUE制約を保持し、多層防御として機能させます。

### 1.5 processed_events テーブル

イベント処理の冪等性を保証するためのテーブル

```sql
CREATE TABLE processed_events (
    event_id UUID PRIMARY KEY,
    stream_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_number BIGINT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(stream_name, event_number)
);

CREATE INDEX idx_processed_events_stream ON processed_events(stream_name, event_number);
CREATE INDEX idx_processed_events_type ON processed_events(event_type);
CREATE INDEX idx_processed_events_processed_at ON processed_events(processed_at);
```

### 1.6 system_host_history テーブル

システムのホスト構成変更履歴を記録するテーブル（時系列追跡）

#### 設計理由

`systems`テーブルにホスト構成を非正規化して保存すると、以下の問題が発生します：

1. **履歴追跡不可**: 過去のスペック情報が失われる
2. **変更分析困難**: いつ、どのようにスペックが変わったか不明
3. **コンプライアンス**: 監査要件を満たせない（変更履歴の保持が必要）
4. **キャパシティプランニング**: リソース使用傾向の分析ができない

#### テーブル定義

```sql
CREATE TABLE system_host_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES systems(system_id) ON DELETE CASCADE,

    -- ホスト構成情報
    cpu_cores INTEGER NOT NULL CHECK (cpu_cores >= 1),
    memory_gb INTEGER NOT NULL CHECK (memory_gb >= 1),
    storage_gb INTEGER NOT NULL CHECK (storage_gb >= 1),
    operating_system VARCHAR(100),
    os_version VARCHAR(50),
    encryption_enabled BOOLEAN NOT NULL DEFAULT false,

    -- 有効期間（Temporal Table Pattern）
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
    effective_to TIMESTAMP WITH TIME ZONE,

    -- 変更追跡
    changed_by VARCHAR(255),
    change_reason TEXT,

    -- 制約
    CHECK (effective_to IS NULL OR effective_to > effective_from),

    -- 同一システムで有効期間が重複しないことを保証
    EXCLUDE USING gist (
        system_id WITH =,
        tstzrange(effective_from, effective_to, '[)') WITH &&
    )
);

-- インデックス
CREATE INDEX idx_system_host_history_system_id ON system_host_history(system_id, effective_from DESC);
CREATE INDEX idx_system_host_history_current ON system_host_history(system_id) WHERE effective_to IS NULL;
CREATE INDEX idx_system_host_history_effective_range ON system_host_history USING gist(tstzrange(effective_from, effective_to, '[)'));
CREATE INDEX idx_system_host_history_changed_by ON system_host_history(changed_by);
```

#### 使用例

**1. 現在の構成を取得**:

```sql
SELECT
    cpu_cores,
    memory_gb,
    storage_gb,
    operating_system,
    os_version,
    encryption_enabled
FROM system_host_history
WHERE system_id = '550e8400-e29b-41d4-a716-446655440000'
  AND effective_to IS NULL;
```

**2. 特定時点の構成を取得**:

```sql
SELECT
    cpu_cores,
    memory_gb,
    storage_gb,
    operating_system,
    os_version
FROM system_host_history
WHERE system_id = '550e8400-e29b-41d4-a716-446655440000'
  AND effective_from <= '2025-06-01T00:00:00Z'
  AND (effective_to IS NULL OR effective_to > '2025-06-01T00:00:00Z');
```

**3. 構成変更履歴を取得**:

```sql
SELECT
    effective_from,
    effective_to,
    cpu_cores,
    memory_gb,
    storage_gb,
    changed_by,
    change_reason
FROM system_host_history
WHERE system_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY effective_from DESC;
```

**4. スペック増強の傾向分析**:

```sql
SELECT
    date_trunc('month', effective_from) as month,
    AVG(cpu_cores) as avg_cpu,
    AVG(memory_gb) as avg_memory,
    COUNT(*) as config_changes
FROM system_host_history
WHERE effective_from >= NOW() - INTERVAL '1 year'
GROUP BY date_trunc('month', effective_from)
ORDER BY month;
```

#### イベントハンドラーとの連携

```typescript
// SystemConfigurationUpdated イベントハンドラー
@EventsHandler(SystemConfigurationUpdated)
export class SystemConfigurationUpdatedHandler {
  async handle(event: SystemConfigurationUpdated): Promise<void> {
    const { systemId, newConfiguration, previousConfiguration } = event.data;

    // 1. 現在の履歴レコードを閉じる（effective_toを設定）
    await this.hostHistoryRepository.closeCurrentRecord(
      systemId,
      event.occurredAt
    );

    // 2. 新しい履歴レコードを作成
    await this.hostHistoryRepository.create({
      systemId: systemId,
      cpuCores: newConfiguration.host.cpuCores,
      memoryGb: newConfiguration.host.memoryGb,
      storageGb: newConfiguration.host.storageGb,
      operatingSystem: newConfiguration.host.operatingSystem,
      osVersion: newConfiguration.host.osVersion,
      encryptionEnabled: newConfiguration.host.encryptionEnabled,
      effectiveFrom: event.occurredAt,
      effectiveTo: null, // 現在有効
      changedBy: event.data.updatedBy,
      changeReason: event.data.changeReason
    });

    // 3. systems テーブルも更新（最新状態の非正規化）
    await this.systemRepository.updateHostConfiguration(
      systemId,
      newConfiguration.host
    );
  }
}
```

#### データ整合性の保証

**EXCLUDE制約による重複期間防止**:

```sql
EXCLUDE USING gist (
    system_id WITH =,
    tstzrange(effective_from, effective_to, '[)') WITH &&
)
```

この制約により、同一システムで有効期間が重複するレコードの挿入を防ぎます。

**例**:

- レコード1: `effective_from='2025-01-01', effective_to='2025-06-01'` ✅
- レコード2: `effective_from='2025-06-01', effective_to=NULL` ✅
- レコード3: `effective_from='2025-05-01', effective_to='2025-07-01'` ❌ エラー（重複）

#### 運用上の利点

1. **完全な変更履歴**: すべてのスペック変更を記録
2. **時点復元**: 任意の時点の構成を再現可能
3. **監査証跡**: いつ、誰が、なぜ変更したかを記録
4. **容量計画**: リソース使用傾向の分析
5. **コスト追跡**: スペック変更によるコスト変動の可視化

### 1.7 Read Model Materialized View

システム情報の読み取り最適化マテリアライズドビュー（パフォーマンス最適化）

```sql
CREATE MATERIALIZED VIEW system_summary_view AS
SELECT
    s.system_id,
    s.name,
    s.type,
    s.status,
    s.security_classification,
    s.criticality_level,
    s.created_date,
    s.last_modified,
    s.decommission_date,
    st.type_name,
    st.description as type_description,
    COUNT(sp.id) as package_count,
    COUNT(CASE WHEN sp.is_security_compliant = false THEN 1 END) as non_compliant_packages
FROM systems s
LEFT JOIN system_types st ON s.type = st.type_code
LEFT JOIN system_packages sp ON s.system_id = sp.system_id
GROUP BY s.system_id, s.name, s.type, s.status, s.security_classification, s.criticality_level,
         s.created_date, s.last_modified, s.decommission_date, st.type_name, st.description;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_system_summary_view_system_id ON system_summary_view(system_id);

-- Refresh strategy (to be executed by application or cron)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY system_summary_view;
```

## 2. EventStore DB イベントスキーマ設計

### 2.1 System ストリーム設計

**ストリーム命名規則**: `system-{systemId}`

### 2.2 SystemRegistered イベントスキーマ

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "SystemRegistered",
  "version": "1.0",
  "properties": {
    "eventId": {
      "type": "string",
      "format": "uuid",
      "description": "一意のイベントID"
    },
    "eventType": {
      "type": "string",
      "const": "SystemRegistered",
      "description": "イベント種別"
    },
    "eventVersion": {
      "type": "string",
      "const": "1.0",
      "description": "イベントスキーマバージョン"
    },
    "occurredAt": {
      "type": "string",
      "format": "date-time",
      "description": "イベント発生日時"
    },
    "aggregateId": {
      "type": "string",
      "format": "uuid",
      "description": "システムID"
    },
    "aggregateVersion": {
      "type": "integer",
      "minimum": 1,
      "description": "集約バージョン"
    },
    "data": {
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "description": "システムID"
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 255,
          "description": "システム名"
        },
        "type": {
          "type": "string",
          "enum": ["WEB", "API", "DATABASE", "BATCH", "OTHER"],
          "description": "システム種別"
        },
        "hostConfiguration": {
          "type": "object",
          "properties": {
            "cpuCores": {
              "type": "integer",
              "minimum": 1,
              "description": "CPUコア数"
            },
            "memoryGb": {
              "type": "integer",
              "minimum": 1,
              "description": "メモリ容量(GB)"
            },
            "storageGb": {
              "type": "integer",
              "minimum": 1,
              "description": "ストレージ容量(GB)"
            },
            "operatingSystem": {
              "type": "string",
              "description": "OS名"
            },
            "osVersion": {
              "type": "string",
              "description": "OSバージョン"
            },
            "encryptionEnabled": {
              "type": "boolean",
              "description": "暗号化有効フラグ"
            }
          },
          "required": ["cpuCores", "memoryGb", "storageGb", "encryptionEnabled"]
        },
        "securityClassification": {
          "type": "string",
          "enum": ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"],
          "description": "セキュリティ分類"
        },
        "criticalityLevel": {
          "type": "string",
          "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
          "description": "クリティカルレベル"
        },
        "initialPackages": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "description": "パッケージ名"
              },
              "version": {
                "type": "string",
                "description": "パッケージバージョン"
              },
              "type": {
                "type": "string",
                "description": "パッケージ種別"
              },
              "isSecurityCompliant": {
                "type": "boolean",
                "description": "セキュリティ準拠フラグ"
              },
              "licenseType": {
                "type": "string",
                "description": "ライセンス種別"
              }
            },
            "required": ["name", "version", "type", "isSecurityCompliant"]
          },
          "description": "初期インストールパッケージ"
        },
        "registeredAt": {
          "type": "string",
          "format": "date-time",
          "description": "登録日時"
        },
        "registeredBy": {
          "type": "string",
          "description": "登録者"
        }
      },
      "required": [
        "systemId",
        "name",
        "type",
        "hostConfiguration",
        "securityClassification",
        "criticalityLevel",
        "initialPackages",
        "registeredAt"
      ]
    },
    "metadata": {
      "type": "object",
      "properties": {
        "correlationId": {
          "type": "string",
          "format": "uuid",
          "description": "相関ID"
        },
        "causationId": {
          "type": "string",
          "format": "uuid",
          "description": "因果ID"
        },
        "userId": {
          "type": "string",
          "description": "実行ユーザーID"
        },
        "source": {
          "type": "string",
          "description": "イベント発生源"
        }
      },
      "required": ["correlationId", "causationId", "userId"]
    }
  },
  "required": [
    "eventId",
    "eventType",
    "eventVersion",
    "occurredAt",
    "aggregateId",
    "aggregateVersion",
    "data",
    "metadata"
  ]
}
```

### 2.3 SystemConfigurationUpdated イベントスキーマ

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "SystemConfigurationUpdated",
  "version": "1.0",
  "properties": {
    "eventId": {
      "type": "string",
      "format": "uuid"
    },
    "eventType": {
      "type": "string",
      "const": "SystemConfigurationUpdated"
    },
    "eventVersion": {
      "type": "string",
      "const": "1.0"
    },
    "occurredAt": {
      "type": "string",
      "format": "date-time"
    },
    "aggregateId": {
      "type": "string",
      "format": "uuid"
    },
    "aggregateVersion": {
      "type": "integer",
      "minimum": 2
    },
    "data": {
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid"
        },
        "previousConfiguration": {
          "type": "object",
          "description": "変更前の構成情報",
          "properties": {
            "host": {
              "type": "object",
              "properties": {
                "cpuCores": {
                  "type": "integer",
                  "minimum": 1,
                  "description": "CPUコア数"
                },
                "memoryGb": {
                  "type": "integer",
                  "minimum": 1,
                  "description": "メモリ容量(GB)"
                },
                "storageGb": {
                  "type": "integer",
                  "minimum": 1,
                  "description": "ストレージ容量(GB)"
                },
                "operatingSystem": {
                  "type": "string",
                  "description": "OS名"
                },
                "osVersion": {
                  "type": "string",
                  "description": "OSバージョン"
                },
                "encryptionEnabled": {
                  "type": "boolean",
                  "description": "暗号化有効フラグ"
                }
              }
            },
            "securityClassification": {
              "type": "string",
              "enum": ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"],
              "description": "セキュリティ分類"
            },
            "criticalityLevel": {
              "type": "string",
              "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
              "description": "クリティカルレベル"
            }
          }
        },
        "newConfiguration": {
          "type": "object",
          "description": "変更後の構成情報",
          "properties": {
            "host": {
              "type": "object",
              "properties": {
                "cpuCores": {
                  "type": "integer",
                  "minimum": 1,
                  "description": "CPUコア数"
                },
                "memoryGb": {
                  "type": "integer",
                  "minimum": 1,
                  "description": "メモリ容量(GB)"
                },
                "storageGb": {
                  "type": "integer",
                  "minimum": 1,
                  "description": "ストレージ容量(GB)"
                },
                "operatingSystem": {
                  "type": "string",
                  "description": "OS名"
                },
                "osVersion": {
                  "type": "string",
                  "description": "OSバージョン"
                },
                "encryptionEnabled": {
                  "type": "boolean",
                  "description": "暗号化有効フラグ"
                }
              }
            },
            "securityClassification": {
              "type": "string",
              "enum": ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"],
              "description": "セキュリティ分類"
            },
            "criticalityLevel": {
              "type": "string",
              "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
              "description": "クリティカルレベル"
            }
          }
        },
        "changedFields": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "変更されたフィールドのリスト（例: ['host.cpuCores', 'securityClassification']）"
        },
        "updatedAt": {
          "type": "string",
          "format": "date-time"
        },
        "updatedBy": {
          "type": "string"
        },
        "changeReason": {
          "type": "string",
          "description": "変更理由"
        }
      },
      "required": ["systemId", "newConfiguration", "updatedAt"]
    },
    "metadata": {
      "type": "object",
      "properties": {
        "correlationId": {
          "type": "string",
          "format": "uuid",
          "description": "相関ID"
        },
        "causationId": {
          "type": "string",
          "format": "uuid",
          "description": "因果ID"
        },
        "userId": {
          "type": "string",
          "description": "実行ユーザーID"
        },
        "source": {
          "type": "string",
          "description": "イベント発生源"
        }
      },
      "required": ["correlationId", "causationId", "userId"]
    }
  },
  "required": [
    "eventId",
    "eventType",
    "eventVersion",
    "occurredAt",
    "aggregateId",
    "aggregateVersion",
    "data",
    "metadata"
  ]
}
```

#### SystemConfigurationUpdated イベント例

```json
{
  "eventId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "eventType": "SystemConfigurationUpdated",
  "eventVersion": "1.0",
  "occurredAt": "2025-09-30T15:30:00.000Z",
  "aggregateId": "550e8400-e29b-41d4-a716-446655440000",
  "aggregateVersion": 3,
  "data": {
    "systemId": "550e8400-e29b-41d4-a716-446655440000",
    "previousConfiguration": {
      "host": {
        "cpuCores": 4,
        "memoryGb": 8,
        "storageGb": 100,
        "operatingSystem": "Ubuntu",
        "osVersion": "20.04",
        "encryptionEnabled": false
      },
      "securityClassification": "INTERNAL",
      "criticalityLevel": "MEDIUM"
    },
    "newConfiguration": {
      "host": {
        "cpuCores": 8,
        "memoryGb": 16,
        "storageGb": 200,
        "operatingSystem": "Ubuntu",
        "osVersion": "22.04",
        "encryptionEnabled": true
      },
      "securityClassification": "CONFIDENTIAL",
      "criticalityLevel": "HIGH"
    },
    "changedFields": [
      "host.cpuCores",
      "host.memoryGb",
      "host.storageGb",
      "host.osVersion",
      "host.encryptionEnabled",
      "securityClassification",
      "criticalityLevel"
    ],
    "updatedAt": "2025-09-30T15:30:00.000Z",
    "updatedBy": "admin@example.com",
    "changeReason": "セキュリティ要件の強化に伴うスペック増強とOS更新"
  },
  "metadata": {
    "correlationId": "c89e7f5a-9b4d-4c4f-9e3d-5f8c9d5e6a7b",
    "causationId": "a12b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p",
    "userId": "admin@example.com",
    "source": "system-management-api"
  }
}
```

**変更追跡の利点:**

1. **監査証跡**: 変更前後の完全な状態を保持
2. **変更分析**: `changedFields`により差分を高速特定
3. **イベントリプレイ**: 構成履歴の完全な再構築が可能
4. **コンプライアンス**: 変更理由の記録による説明責任

### 2.4 PackageInstalled イベントスキーマ

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "PackageInstalled",
  "version": "1.0",
  "properties": {
    "eventId": {
      "type": "string",
      "format": "uuid"
    },
    "eventType": {
      "type": "string",
      "const": "PackageInstalled"
    },
    "eventVersion": {
      "type": "string",
      "const": "1.0"
    },
    "occurredAt": {
      "type": "string",
      "format": "date-time"
    },
    "aggregateId": {
      "type": "string",
      "format": "uuid"
    },
    "aggregateVersion": {
      "type": "integer",
      "minimum": 1
    },
    "data": {
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid"
        },
        "package": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "version": {
              "type": "string"
            },
            "type": {
              "type": "string"
            },
            "isSecurityCompliant": {
              "type": "boolean"
            },
            "licenseType": {
              "type": "string"
            }
          },
          "required": ["name", "version", "type", "isSecurityCompliant"]
        },
        "installedAt": {
          "type": "string",
          "format": "date-time"
        },
        "installedBy": {
          "type": "string"
        }
      },
      "required": ["systemId", "package", "installedAt"]
    },
    "metadata": {
      "type": "object",
      "properties": {
        "correlationId": {
          "type": "string",
          "format": "uuid",
          "description": "相関ID"
        },
        "causationId": {
          "type": "string",
          "format": "uuid",
          "description": "因果ID"
        },
        "userId": {
          "type": "string",
          "description": "実行ユーザーID"
        },
        "source": {
          "type": "string",
          "description": "イベント発生源"
        }
      },
      "required": ["correlationId", "causationId", "userId"]
    }
  },
  "required": [
    "eventId",
    "eventType",
    "eventVersion",
    "occurredAt",
    "aggregateId",
    "aggregateVersion",
    "data",
    "metadata"
  ]
}
```

### 2.5 SystemDecommissioned イベントスキーマ

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "SystemDecommissioned",
  "version": "1.0",
  "properties": {
    "eventId": {
      "type": "string",
      "format": "uuid"
    },
    "eventType": {
      "type": "string",
      "const": "SystemDecommissioned"
    },
    "eventVersion": {
      "type": "string",
      "const": "1.0"
    },
    "occurredAt": {
      "type": "string",
      "format": "date-time"
    },
    "aggregateId": {
      "type": "string",
      "format": "uuid"
    },
    "aggregateVersion": {
      "type": "integer",
      "minimum": 1
    },
    "data": {
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid"
        },
        "decommissionReason": {
          "type": "string",
          "description": "廃止理由"
        },
        "dataRetentionPeriod": {
          "type": "integer",
          "minimum": 0,
          "description": "データ保持期間(日)"
        },
        "decommissionedAt": {
          "type": "string",
          "format": "date-time"
        },
        "decommissionedBy": {
          "type": "string"
        },
        "finalBackupLocation": {
          "type": "string",
          "description": "最終バックアップ場所"
        }
      },
      "required": ["systemId", "decommissionedAt"]
    },
    "metadata": {
      "type": "object",
      "properties": {
        "correlationId": {
          "type": "string",
          "format": "uuid",
          "description": "相関ID"
        },
        "causationId": {
          "type": "string",
          "format": "uuid",
          "description": "因果ID"
        },
        "userId": {
          "type": "string",
          "description": "実行ユーザーID"
        },
        "source": {
          "type": "string",
          "description": "イベント発生源"
        }
      },
      "required": ["correlationId", "causationId", "userId"]
    }
  },
  "required": [
    "eventId",
    "eventType",
    "eventVersion",
    "occurredAt",
    "aggregateId",
    "aggregateVersion",
    "data",
    "metadata"
  ]
}
```

## 3. インデックス・制約の定義

### 3.1 PostgreSQL インデックス設計

```sql
-- systems テーブルのインデックス
CREATE INDEX idx_systems_name ON systems(name); -- 一意制約により自動作成されるが明示
CREATE INDEX idx_systems_type ON systems(type);
CREATE INDEX idx_systems_status ON systems(status);
CREATE INDEX idx_systems_security_classification ON systems(security_classification);
CREATE INDEX idx_systems_criticality_level ON systems(criticality_level);
CREATE INDEX idx_systems_created_date ON systems(created_date);
CREATE INDEX idx_systems_last_modified ON systems(last_modified);
CREATE INDEX idx_systems_decommission_date ON systems(decommission_date) WHERE decommission_date IS NOT NULL;

-- 複合インデックス (よく使われるクエリパターン用)
CREATE INDEX idx_systems_type_status ON systems(type, status);
CREATE INDEX idx_systems_security_criticality ON systems(security_classification, criticality_level);
CREATE INDEX idx_systems_active_systems ON systems(status, last_modified) WHERE status IN ('ACTIVE', 'MAINTENANCE');

-- system_packages テーブルのインデックス
CREATE INDEX idx_system_packages_system_id ON system_packages(system_id);
CREATE INDEX idx_system_packages_name_type ON system_packages(package_name, package_type);
CREATE INDEX idx_system_packages_security_compliance ON system_packages(is_security_compliant) WHERE is_security_compliant = false;
CREATE INDEX idx_system_packages_install_date ON system_packages(install_date);

-- processed_events テーブルのインデックス（セクション1.5で定義）
-- CREATE INDEX idx_processed_events_stream ON processed_events(stream_name, event_number);
-- CREATE INDEX idx_processed_events_type ON processed_events(event_type);

-- 部分インデックス (パフォーマンス最適化)
CREATE INDEX idx_systems_active_high_criticality ON systems(system_id, name)
WHERE status = 'ACTIVE' AND criticality_level IN ('HIGH', 'CRITICAL');

-- カバリングインデックス (テーブルスキャンを回避)
-- System list with basic info (avoids table scan)
CREATE INDEX idx_systems_list_covering ON systems(status, type, last_modified)
    INCLUDE (system_id, name, security_classification, criticality_level)
    WHERE status IN ('ACTIVE', 'MAINTENANCE');

-- Package security check (covering index)
CREATE INDEX idx_system_packages_security_covering ON system_packages(system_id, is_security_compliant)
    INCLUDE (package_name, package_version, package_type)
    WHERE is_security_compliant = false;

-- Audit query optimization
CREATE INDEX idx_systems_created_by ON systems(created_by);
CREATE INDEX idx_systems_last_modified_by ON systems(last_modified_by);
```

### 3.2 制約とトリガー

```sql
-- 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_last_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_systems_last_modified
    BEFORE UPDATE ON systems
    FOR EACH ROW EXECUTE FUNCTION update_last_modified_column();

CREATE TRIGGER update_system_packages_last_updated
    BEFORE UPDATE ON system_packages
    FOR EACH ROW EXECUTE FUNCTION update_last_modified_column();

-- バージョン自動インクリメント関数（オプティミスティックロック用）
CREATE OR REPLACE FUNCTION increment_version_on_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = OLD.version + 1;
    NEW.last_modified = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_systems_version
    BEFORE UPDATE ON systems
    FOR EACH ROW EXECUTE FUNCTION increment_version_on_update();
```

**注**: 以前の設計にあった `cleanup_expired_reservations()` 関数は削除されました。
システム名の一意性保証はRedisで行われ、TTL（Time-To-Live）による自動クリーンアップが機能します。

### 3.3 Redis設計仕様

#### 3.3.1 Redis構成

```yaml
# Redis Configuration for System Name Reservation
redis:
  host: ${REDIS_HOST:-localhost}
  port: ${REDIS_PORT:-6379}
  database: 0  # システム名予約専用DB

  # 永続化設定（耐久性確保）
  persistence:
    aof: true              # Append-Only File
    appendfsync: everysec  # 毎秒fsync（パフォーマンスと耐久性のバランス）
    rdb_snapshots:
      - save: "900 1"      # 15分で1キー変更
      - save: "300 10"     # 5分で10キー変更
      - save: "60 10000"   # 1分で10000キー変更

  # 接続プール
  pool:
    min: 10
    max: 50

  # リトライ戦略
  retry:
    max_attempts: 3
    backoff_ms: 50
```

#### 3.3.2 システム名予約サービス実装

```typescript
// redis-name-reservation.service.ts
@Injectable()
export class RedisNameReservationService {
  private readonly RESERVATION_PREFIX = 'system:name:reservation:';
  private readonly CONFIRMED_PREFIX = 'system:name:confirmed:';
  private readonly RESERVATION_TTL = 60; // 60秒

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly logger: Logger
  ) {}

  /**
   * システム名を一時予約（原子的操作）
   * @returns true=予約成功, false=既に存在
   */
  async tryReserve(
    systemName: string,
    aggregateId: string
  ): Promise<boolean> {
    const key = `${this.RESERVATION_PREFIX}${systemName}`;
    const confirmedKey = `${this.CONFIRMED_PREFIX}${systemName}`;

    // 1. 確定済み名前をチェック
    const isConfirmed = await this.redis.exists(confirmedKey);
    if (isConfirmed) {
      return false; // 既に登録済み
    }

    // 2. 原子的に予約（NX=存在しない場合のみセット）
    const result = await this.redis.set(
      key,
      JSON.stringify({
        aggregateId,
        reservedAt: new Date().toISOString()
      }),
      'NX',  // Only set if not exists
      'EX',  // Set expiry
      this.RESERVATION_TTL
    );

    return result === 'OK';
  }

  /**
   * 予約を確定（TTL削除して永続化）
   */
  async confirm(systemName: string): Promise<void> {
    const reservationKey = `${this.RESERVATION_PREFIX}${systemName}`;
    const confirmedKey = `${this.CONFIRMED_PREFIX}${systemName}`;

    // Redis Pipeline（トランザクション的実行）
    const pipeline = this.redis.pipeline();

    // 予約キーから確定キーへ移動
    pipeline.rename(reservationKey, confirmedKey);
    pipeline.persist(confirmedKey); // TTL削除

    await pipeline.exec();

    this.logger.debug('System name confirmed', { systemName });
  }

  /**
   * 予約を解放（エラー時のロールバック）
   */
  async release(systemName: string): Promise<void> {
    const key = `${this.RESERVATION_PREFIX}${systemName}`;
    await this.redis.del(key);

    this.logger.debug('System name reservation released', { systemName });
  }

  /**
   * システム廃止時の名前解放
   */
  async releaseConfirmed(systemName: string): Promise<void> {
    const confirmedKey = `${this.CONFIRMED_PREFIX}${systemName}`;
    await this.redis.del(confirmedKey);

    this.logger.info('System name released from confirmed list', { systemName });
  }

  /**
   * 名前の利用可能性チェック
   */
  async isAvailable(systemName: string): Promise<boolean> {
    const reservationExists = await this.redis.exists(
      `${this.RESERVATION_PREFIX}${systemName}`
    );
    const confirmedExists = await this.redis.exists(
      `${this.CONFIRMED_PREFIX}${systemName}`
    );

    return !reservationExists && !confirmedExists;
  }
}
```

#### 3.3.3 Redisキャッシュ復旧サービス

```typescript
// redis-recovery.service.ts
@Injectable()
export class RedisRecoveryService {
  constructor(
    private readonly kurrentClient: KurrentDBClient,
    private readonly reservationService: RedisNameReservationService,
    private readonly logger: Logger
  ) {}

  /**
   * アプリケーション起動時にRedisキャッシュを再構築
   */
  @OnApplicationBootstrap()
  async onApplicationBootstrap(): Promise<void> {
    const isHealthy = await this.checkRedisHealth();

    if (!isHealthy) {
      this.logger.warn('Redis is not healthy, attempting rebuild');
      await this.rebuildFromEvents();
    }
  }

  /**
   * Kurrent DBイベントからRedisキャッシュを再構築
   */
  async rebuildFromEvents(): Promise<void> {
    this.logger.info('Starting Redis cache rebuild from Kurrent DB');

    const startTime = Date.now();
    let processedCount = 0;

    try {
      // System集約の全イベントを読み込み
      const events = await this.kurrentClient.readStream('$ce-System', {
        direction: 'forward',
        fromRevision: 'start'
      });

      for await (const resolvedEvent of events) {
        const event = resolvedEvent.event;

        if (event.type === 'SystemRegistered') {
          // 確定済みとして登録（TTLなし）
          await this.reservationService.confirm(event.data.name);
          processedCount++;
        }

        if (event.type === 'SystemDecommissioned') {
          // 名前を解放
          await this.reservationService.releaseConfirmed(event.data.name);
        }
      }

      const duration = Date.now() - startTime;

      this.logger.info('Redis cache rebuild completed', {
        processedCount,
        durationMs: duration
      });

    } catch (error) {
      this.logger.error('Redis cache rebuild failed', error);
      throw error;
    }
  }

  /**
   * Redisキャッシュの整合性チェック
   */
  async checkRedisHealth(): Promise<boolean> {
    try {
      // Redisへのping
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        return false;
      }

      // キーの存在確認（最低限のヘルスチェック）
      const keyCount = await this.redis.dbsize();
      this.logger.debug('Redis health check passed', { keyCount });

      return true;
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return false;
    }
  }
}
```

#### 3.3.4 監視・アラート設定

```typescript
// system-name-reservation.metrics.ts
@Injectable()
export class SystemNameReservationMetrics {
  constructor(
    @Inject('METRICS_SERVICE') private readonly metrics: MetricsService
  ) {}

  // 予約試行回数
  @Counter()
  reservationAttempts: number;

  // 予約衝突回数（既に存在）
  @Counter()
  reservationConflicts: number;

  // 予約期限切れ回数
  @Counter()
  reservationExpiries: number;

  // Redis接続失敗回数
  @Counter()
  redisConnectionFailures: number;

  // 予約処理時間
  @Histogram()
  reservationDuration: number[];

  /**
   * Microsoft Teamsへのアラート送信
   */
  async sendAlert(alertType: string, message: string): Promise<void> {
    if (alertType === 'REDIS_DOWN' && this.redisConnectionFailures > 3) {
      await this.teamsClient.sendAlert({
        title: '🔴 Redis Name Reservation Service Down',
        message: 'Redis接続に失敗しています。システム名の一意性保証が低下しています。',
        severity: 'critical',
        timestamp: new Date().toISOString()
      });
    }
  }
}
```

#### 3.3.5 Redis障害時のフォールバック戦略

**戦略**: PostgreSQL Read Modelへのフォールバック（スローパス）

```typescript
// register-system.command-handler.ts（抜粋）
async execute(command: RegisterSystemCommand): Promise<SystemId> {
  const systemName = command.name.getValue().toLowerCase();

  try {
    // ファストパス: Redis同期予約
    const reserved = await this.redisReservationService.tryReserve(
      systemName,
      command.aggregateId
    );

    if (!reserved) {
      throw new SystemNameAlreadyExistsException(systemName);
    }

  } catch (redisError) {
    // Redis障害時のフォールバック
    this.logger.warn('Redis unavailable, falling back to PostgreSQL', {
      error: redisError.message,
      systemName
    });

    // スローパス: PostgreSQLで確認
    const exists = await this.systemRepository.existsByName(systemName);

    if (exists) {
      throw new SystemNameAlreadyExistsException(systemName);
    }

    // レースコンディションリスクを受け入れて継続
    // （小さなウィンドウのみ、Redis復旧後は正常化）

    // アラート送信
    this.metrics.redisConnectionFailures++;
    await this.metrics.sendAlert('REDIS_DOWN', 'Falling back to PostgreSQL');
  }

  // ドメインロジック継続...
}
```

#### 3.3.6 アプリケーション層でのクリーンアップ処理

**設計決定**: PostgreSQLの`pg_cron`拡張ではなく、**NestJSのスケジューラー**を使用

##### 3.3.6.1 理由

PostgreSQL `pg_cron`拡張の問題点：

1. **環境依存**: すべてのPostgreSQL環境で利用可能とは限らない
2. **監視困難**: データベース側の実行ログをアプリケーション側で把握できない
3. **テスト困難**: データベース拡張のテストが複雑
4. **デプロイ制約**: フリー/OSSツールのみの制約に抵触する可能性

##### NestJS Cronスケジューラー実装

```typescript
// system-cleanup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ProcessedEvent } from './entities/processed-event.entity';

@Injectable()
export class SystemCleanupService {
  private readonly logger = new Logger(SystemCleanupService.name);

  constructor(
    @InjectRepository(ProcessedEvent)
    private readonly processedEventRepository: Repository<ProcessedEvent>,
  ) {}

  /**
   * 古いprocessed_eventsレコードのクリーンアップ
   *
   * 実行頻度: 毎日午前3時（サーバー時間）
   * 保持期間: 90日間
   */
  @Cron('0 3 * * *', {
    name: 'cleanup-processed-events',
    timeZone: 'Asia/Tokyo',
  })
  async cleanupProcessedEvents(): Promise<void> {
    const retentionDays = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.logger.log(`Starting cleanup of processed_events older than ${cutoffDate.toISOString()}`);

    try {
      const result = await this.processedEventRepository.delete({
        processed_at: LessThan(cutoffDate),
      });

      this.logger.log(`Cleanup completed: ${result.affected || 0} records deleted`);

      // メトリクス記録
      await this.recordMetric('processed_events_cleanup', {
        deleted_count: result.affected || 0,
        cutoff_date: cutoffDate.toISOString(),
      });

    } catch (error) {
      this.logger.error('Failed to cleanup processed_events', error.stack);

      // アラート送信
      await this.sendAlert('CLEANUP_FAILED', {
        service: 'processed_events_cleanup',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * 古いsystem_host_historyレコードのアーカイブ
   *
   * 実行頻度: 毎月1日午前2時
   * アーカイブ期間: 2年以上前の履歴レコード
   */
  @Cron('0 2 1 * *', {
    name: 'archive-old-host-history',
    timeZone: 'Asia/Tokyo',
  })
  async archiveOldHostHistory(): Promise<void> {
    const archiveYears = 2;
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - archiveYears);

    this.logger.log(`Starting archive of host_history older than ${cutoffDate.toISOString()}`);

    try {
      // 注: 実際のアーカイブ処理では、削除ではなく別テーブルへの移動を推奨
      const query = `
        WITH archived_records AS (
          DELETE FROM system_host_history
          WHERE effective_to < $1
          RETURNING *
        )
        INSERT INTO system_host_history_archive
        SELECT * FROM archived_records
      `;

      const result = await this.processedEventRepository.query(query, [cutoffDate]);

      this.logger.log(`Archive completed: ${result.length || 0} records archived`);

      // メトリクス記録
      await this.recordMetric('host_history_archive', {
        archived_count: result.length || 0,
        cutoff_date: cutoffDate.toISOString(),
      });

    } catch (error) {
      this.logger.error('Failed to archive host_history', error.stack);

      // アラート送信
      await this.sendAlert('ARCHIVE_FAILED', {
        service: 'host_history_archive',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Redis期限切れキーの検証とクリーンアップ
   *
   * 実行頻度: 1時間ごと
   *
   * Redis自体がTTLで自動削除するが、念のため定期的に検証
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'verify-redis-reservations',
  })
  async verifyRedisReservations(): Promise<void> {
    this.logger.debug('Starting Redis reservation verification');

    try {
      // Redis内の期限切れ予約キーをスキャン
      const pattern = 'system:name:reservation:*';
      const keys = await this.redis.keys(pattern);

      let expiredCount = 0;

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);

        // TTLが設定されていない（-1）場合は異常
        if (ttl === -1) {
          this.logger.warn(`Found reservation without TTL: ${key}`);

          // 60秒のTTLを再設定
          await this.redis.expire(key, 60);
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        this.logger.warn(`Fixed ${expiredCount} reservations without TTL`);
      } else {
        this.logger.debug('All Redis reservations are valid');
      }

      // メトリクス記録
      await this.recordMetric('redis_reservation_verification', {
        total_keys: keys.length,
        fixed_keys: expiredCount,
      });

    } catch (error) {
      this.logger.error('Failed to verify Redis reservations', error.stack);
      // エラーは記録するが処理は継続（クリティカルではない）
    }
  }

  /**
   * メトリクス記録（Prometheus等）
   */
  private async recordMetric(metricName: string, data: Record<string, any>): Promise<void> {
    // Prometheusメトリクス記録の実装
    // 例: this.metricsService.recordCounter(metricName, data);
  }

  /**
   * アラート送信（Microsoft Teams）
   */
  private async sendAlert(alertType: string, details: Record<string, any>): Promise<void> {
    // Microsoft Teamsへのアラート送信実装
    // 例: await this.teamsClient.sendAlert({ type: alertType, ...details });
  }
}
```

##### Cronスケジュール設定

```typescript
// system-management.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SystemCleanupService } from './services/system-cleanup.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Cronスケジューラーを有効化
    TypeOrmModule.forFeature([ProcessedEvent, SystemHostHistory]),
  ],
  providers: [
    SystemCleanupService,
    // 他のサービス...
  ],
})
export class SystemManagementModule {}
```

##### クリーンアップ設定

```yaml
# config/cleanup.yaml
cleanup:
  processed_events:
    schedule: '0 3 * * *'  # 毎日午前3時
    retention_days: 90     # 90日間保持

  host_history:
    schedule: '0 2 1 * *'  # 毎月1日午前2時
    archive_years: 2       # 2年以上前をアーカイブ

  redis_verification:
    schedule: '0 * * * *'  # 1時間ごと
    enabled: true
```

##### モニタリング・アラート

```typescript
// システムクリーンアップのメトリクス
interface CleanupMetrics {
  // processed_events クリーンアップ
  processed_events_deleted: Counter;
  processed_events_cleanup_duration: Histogram;
  processed_events_cleanup_errors: Counter;

  // host_history アーカイブ
  host_history_archived: Counter;
  host_history_archive_duration: Histogram;
  host_history_archive_errors: Counter;

  // Redis検証
  redis_reservations_verified: Counter;
  redis_reservations_fixed: Counter;
}
```

**Microsoft Teamsアラート例**:

```json
{
  "title": "🧹 System Cleanup Failed",
  "message": "processed_events cleanup failed",
  "severity": "warning",
  "details": {
    "service": "processed_events_cleanup",
    "error": "Connection timeout",
    "timestamp": "2025-09-30T03:00:00Z"
  }
}
```

##### 手動実行コマンド（管理用）

```typescript
// CLI管理コマンド
import { Command, CommandRunner } from 'nest-commander';

@Command({
  name: 'cleanup:processed-events',
  description: 'Manually trigger processed_events cleanup',
})
export class CleanupProcessedEventsCommand extends CommandRunner {
  constructor(private readonly cleanupService: SystemCleanupService) {
    super();
  }

  async run(): Promise<void> {
    await this.cleanupService.cleanupProcessedEvents();
  }
}
```

**実行例**:

```bash
# 手動クリーンアップ実行
npm run cli cleanup:processed-events

# クリーンアップ状況確認
npm run cli cleanup:status
```

##### 利点のまとめ

| 側面 | PostgreSQL pg_cron | NestJS Cron（推奨） |
|------|-------------------|---------------------|
| **環境依存性** | ❌ 拡張が必要 | ✅ Node.js標準 |
| **監視・ログ** | ❌ 困難 | ✅ アプリケーションログで一元管理 |
| **アラート** | ❌ 別途実装必要 | ✅ 既存のアラート機構を使用可能 |
| **テスト** | ❌ 複雑 | ✅ ユニットテスト容易 |
| **設定変更** | ❌ DB再起動必要 | ✅ アプリ再起動のみ |
| **メトリクス** | ❌ 収集困難 | ✅ Prometheus連携容易 |
| **デバッグ** | ❌ 困難 | ✅ IDE・ログで容易 |

### 3.4 EventStore DB プロジェクション設定

```javascript
// System Name Uniqueness Projection
fromStream('$ce-system')
    .when({
        'SystemRegistered': function(state, event) {
            try {
                const systemName = event.data.name?.toLowerCase();

                if (!systemName) {
                    // Log error but don't throw - emit to error stream
                    linkTo('system-projection-errors', event);
                    return state;
                }

                if (state.registeredNames && state.registeredNames[systemName]) {
                    // Emit duplicate detection event instead of throwing
                    linkTo('system-duplicate-names', event);
                    return state;
                }

                if (!state.registeredNames) {
                    state.registeredNames = {};
                }

                state.registeredNames[systemName] = {
                    systemId: event.data.systemId,
                    registeredAt: event.data.registeredAt
                };

                return state;
            } catch (error) {
                // Log error and continue - emit to error stream
                linkTo('system-projection-errors', event);
                return state;
            }
        },
        'SystemDecommissioned': function(state, event) {
            try {
                const systemName = event.data.name?.toLowerCase();
                if (state.registeredNames && systemName && state.registeredNames[systemName]) {
                    delete state.registeredNames[systemName];
                }
                return state;
            } catch (error) {
                // Log error and continue
                linkTo('system-projection-errors', event);
                return state;
            }
        }
    })
    .outputState();

// Active Systems by Type Projection
fromStream('$ce-system')
    .when({
        'SystemRegistered': function(state, event) {
            try {
                if (!state.systemsByType) {
                    state.systemsByType = {};
                }

                const type = event.data.type;
                if (!type) {
                    linkTo('system-projection-errors', event);
                    return state;
                }

                if (!state.systemsByType[type]) {
                    state.systemsByType[type] = [];
                }

                state.systemsByType[type].push({
                    systemId: event.data.systemId,
                    name: event.data.name,
                    status: 'ACTIVE', // 初期状態
                    criticality: event.data.criticalityLevel,
                    packageCount: event.data.initialPackages?.length || 0
                });

                return state;
            } catch (error) {
                linkTo('system-projection-errors', event);
                return state;
            }
        },
        'SystemDecommissioned': function(state, event) {
            try {
                if (state.systemsByType) {
                    Object.keys(state.systemsByType).forEach(type => {
                        state.systemsByType[type] = state.systemsByType[type].filter(
                            system => system.systemId !== event.aggregateId
                        );
                    });
                }
                return state;
            } catch (error) {
                linkTo('system-projection-errors', event);
                return state;
            }
        }
    })
    .outputState();
```

### 3.4 イベントプロジェクション戦略

#### イベントハンドラーフロー

```text
┌─────────────────┐
│  EventStore DB  │
│  (Write Model)  │
└────────┬────────┘
         │
         │ 1. Event Persistence
         │
         ▼
┌─────────────────┐
│   Event Stream  │
│   system-*      │
└────────┬────────┘
         │
         │ 2. Event Subscription
         │    (NestJS subscribes)
         ▼
┌─────────────────┐
│ Event Handlers  │
│  (Projections)  │
└────────┬────────┘
         │
         │ 3. Read Model Update
         │    (Idempotency Check)
         ▼
┌─────────────────┐
│  PostgreSQL DB  │
│  (Read Model)   │
└────────┬────────┘
         │
         │ 4. Cache Invalidation
         ▼
┌─────────────────┐
│   Redis Cache   │
└─────────────────┘
```

#### 冪等性保証

すべてのイベントハンドラーは以下の方法で冪等性を保証する：

```typescript
// Example: Event Handler with Idempotency
async handleSystemRegistered(event: SystemRegistered): Promise<void> {
    // Step 1: Check if already processed
    const exists = await this.processedEventsRepository.exists(event.eventId);
    if (exists) {
        this.logger.debug(`Event ${event.eventId} already processed, skipping`);
        return; // Skip duplicate
    }

    // Step 2: Begin transaction
    await this.dataSource.transaction(async (manager) => {
        // Step 3: Update Read Model (Upsert operation)
        await manager.query(`
            INSERT INTO systems (system_id, name, type, status, ...)
            VALUES ($1, $2, $3, $4, ...)
            ON CONFLICT (system_id) DO UPDATE SET
                name = EXCLUDED.name,
                last_modified = CURRENT_TIMESTAMP,
                version = systems.version + 1
        `, [event.data.systemId, event.data.name, ...]);

        // Step 4: Mark event as processed
        await manager.query(`
            INSERT INTO processed_events (event_id, stream_name, event_type, event_number)
            VALUES ($1, $2, $3, $4)
        `, [event.eventId, event.streamName, event.eventType, event.eventNumber]);

        // Step 5: Invalidate cache
        await this.cacheService.invalidate(`system:${event.data.systemId}`);
    });
}
```

#### Read Modelの再構築

イベントストアから全イベントをリプレイしてRead Modelを再構築する手順：

```sql
-- Step 1: Truncate Read Models (data loss warning!)
TRUNCATE systems, system_packages, system_name_reservations CASCADE;
TRUNCATE processed_events;

-- Step 2: Reset materialized view
DROP MATERIALIZED VIEW IF EXISTS system_summary_view;
CREATE MATERIALIZED VIEW system_summary_view AS
    -- (definition above)
;
CREATE UNIQUE INDEX idx_system_summary_view_system_id ON system_summary_view(system_id);
```

```typescript
// Step 3: Replay all events from EventStore (application code)
async rebuildReadModel(): Promise<void> {
    const streams = await this.eventStore.readAllStreams('system-*');

    for (const stream of streams) {
        const events = await this.eventStore.readStream(stream.streamName);

        for (const event of events) {
            // Process each event in order
            await this.eventHandler.handle(event);
        }
    }

    // Step 4: Refresh materialized views
    await this.dataSource.query('REFRESH MATERIALIZED VIEW CONCURRENTLY system_summary_view');
}
```

#### エラーハンドリング戦略

- **プロジェクションエラー**: `system-projection-errors` ストリームに記録
- **重複名検出**: `system-duplicate-names` ストリームに記録
- **リトライ戦略**: 指数バックオフで最大3回リトライ
- **Dead Letter Queue**: 3回失敗したイベントは `system-dlq` ストリームへ移動

## 4. データマイグレーション設計

### 4.1 マイグレーション戦略

#### Phase 1: スキーマ作成 (V1.0.0)

```sql
-- migrations/V1.0.0__create_system_tables.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create system_types table first (referenced by systems)
CREATE TABLE system_types (
    -- テーブル定義 (上記参照)
);

-- Insert initial data
INSERT INTO system_types VALUES (
    -- 初期データ (上記参照)
);

-- Create systems table
CREATE TABLE systems (
    -- テーブル定義 (上記参照)
);

-- Create system_packages table
CREATE TABLE system_packages (
    -- テーブル定義 (上記参照)
);

-- Create processed_events table
CREATE TABLE processed_events (
    -- テーブル定義 (上記参照)
);

-- Create system_host_history table
CREATE TABLE system_host_history (
    -- テーブル定義 (上記参照)
);

-- Note: system_name_reservations table is NOT created
-- システム名の一意性はRedisで保証される（セクション1.4参照）

-- Create indexes
-- インデックス作成 (上記参照)

-- Create triggers and functions
-- トリガー・関数作成 (上記参照)

-- Create views
CREATE VIEW system_summary_view AS (
    -- ビュー定義 (上記参照)
);
```

#### Phase 2: 初期データ投入 (V1.0.1)

```sql
-- migrations/V1.0.1__insert_sample_data.sql

-- サンプルシステムデータ (開発・テスト用)
DO $$
DECLARE
    system1_id UUID := gen_random_uuid();
    system2_id UUID := gen_random_uuid();
    system3_id UUID := gen_random_uuid();
BEGIN
    -- システムデータ投入
    INSERT INTO systems (
        system_id, name, type, status,
        host_cpu_cores, host_memory_gb, host_storage_gb,
        host_encryption_enabled, security_classification, criticality_level,
        created_by
    ) VALUES
    (
        system1_id, 'web-frontend-prod', 'WEB', 'ACTIVE',
        4, 8, 100, true, 'INTERNAL', 'HIGH',
        'system-admin'
    ),
    (
        system2_id, 'api-gateway-prod', 'API', 'ACTIVE',
        8, 16, 200, true, 'CONFIDENTIAL', 'CRITICAL',
        'system-admin'
    ),
    (
        system3_id, 'database-primary', 'DATABASE', 'ACTIVE',
        16, 64, 1000, true, 'RESTRICTED', 'CRITICAL',
        'system-admin'
    );

    -- ホスト構成履歴の初期レコード投入
    INSERT INTO system_host_history (
        system_id, cpu_cores, memory_gb, storage_gb,
        operating_system, os_version, encryption_enabled,
        effective_from, effective_to, changed_by, change_reason
    ) VALUES
    (
        system1_id, 4, 8, 100,
        'Ubuntu', '22.04', true,
        CURRENT_TIMESTAMP, NULL, 'system-admin', '初期構成'
    ),
    (
        system2_id, 8, 16, 200,
        'Ubuntu', '22.04', true,
        CURRENT_TIMESTAMP, NULL, 'system-admin', '初期構成'
    ),
    (
        system3_id, 16, 64, 1000,
        'PostgreSQL on Ubuntu', '22.04', true,
        CURRENT_TIMESTAMP, NULL, 'system-admin', '初期構成'
    );
END $$;
```

#### Phase 3: パフォーマンス最適化 (V1.1.0)

```sql
-- migrations/V1.1.0__performance_optimization.sql

-- パーティショニング (将来的なデータ増加対応)
-- 年月でパーティショニング
CREATE TABLE system_packages_y2025m09 PARTITION OF system_packages
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

-- 統計情報の更新
ANALYZE systems;
ANALYZE system_packages;
ANALYZE system_types;

-- 追加インデックス (運用データ分析後)
CREATE INDEX CONCURRENTLY idx_systems_vulnerability_scan
    ON systems(system_id, last_modified)
    WHERE status = 'ACTIVE';
```

### 4.2 データ整合性チェック

```sql
-- データ整合性チェッククエリ集

-- 1. システムテーブルの基本整合性
SELECT
    'systems基本チェック' as check_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN name IS NULL OR name = '' THEN 1 END) as invalid_names,
    COUNT(CASE WHEN type NOT IN ('WEB', 'API', 'DATABASE', 'BATCH', 'OTHER') THEN 1 END) as invalid_types,
    COUNT(CASE WHEN status NOT IN ('PLANNING', 'ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED', 'CANCELLED') THEN 1 END) as invalid_status
FROM systems;

-- 2. ホスト構成の妥当性チェック
SELECT
    'ホスト構成チェック' as check_name,
    COUNT(CASE WHEN host_cpu_cores < 1 THEN 1 END) as invalid_cpu,
    COUNT(CASE WHEN host_memory_gb < 1 THEN 1 END) as invalid_memory,
    COUNT(CASE WHEN host_storage_gb < 1 THEN 1 END) as invalid_storage
FROM systems;

-- 3. セキュリティ分類の整合性チェック
SELECT
    'セキュリティ整合性チェック' as check_name,
    COUNT(*) as high_security_systems,
    COUNT(CASE WHEN host_encryption_enabled = false THEN 1 END) as unencrypted_systems
FROM systems
WHERE security_classification IN ('CONFIDENTIAL', 'RESTRICTED');

-- 4. パッケージ参照整合性チェック
SELECT
    'パッケージ参照整合性' as check_name,
    COUNT(sp.*) as total_packages,
    COUNT(s.system_id) as valid_references
FROM system_packages sp
LEFT JOIN systems s ON sp.system_id = s.system_id;

-- 5. 期限切れ予約チェック
SELECT
    '期限切れ予約' as check_name,
    COUNT(*) as expired_reservations
FROM system_name_reservations
WHERE expires_at < CURRENT_TIMESTAMP;
```

### 4.3 ロールバック手順

```sql
-- ロールバック用スクリプト (緊急時)

-- Step 1: 外部キー制約を無効化
ALTER TABLE system_packages DISABLE TRIGGER ALL;

-- Step 2: データバックアップ
CREATE TABLE systems_backup_$(date +%Y%m%d) AS SELECT * FROM systems;
CREATE TABLE system_packages_backup_$(date +%Y%m%d) AS SELECT * FROM system_packages;

-- Step 3: テーブル削除 (必要に応じて)
DROP VIEW IF EXISTS system_summary_view;
DROP TABLE IF EXISTS system_packages;
DROP TABLE IF EXISTS systems;
DROP TABLE IF EXISTS system_name_reservations;
DROP TABLE IF EXISTS system_types;

-- Step 4: 関数・トリガー削除
DROP FUNCTION IF EXISTS update_last_modified_column();
DROP FUNCTION IF EXISTS cleanup_expired_reservations();
```

### 4.4 運用メンテナンス

```sql
-- 日次メンテナンス用クエリ

-- 1. 期限切れ予約の削除
DELETE FROM system_name_reservations WHERE expires_at < CURRENT_TIMESTAMP;

-- 2. 統計情報の更新
ANALYZE systems;
ANALYZE system_packages;

-- 3. インデックスの再構築 (週次)
REINDEX INDEX CONCURRENTLY idx_systems_name;
REINDEX INDEX CONCURRENTLY idx_system_packages_system_id;

-- 4. バキューム処理 (週次)
VACUUM ANALYZE systems;
VACUUM ANALYZE system_packages;

-- 5. ディスク使用量チェック
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 5. 受け入れ条件確認

- ✅ **systems テーブルのスキーマ定義**: 完了
- ✅ **system_types テーブルのスキーマ定義**: 完了
- ✅ **EventStore イベントスキーマ定義**: 完了
- ✅ **インデックス・制約の実装**: 完了

## 6. 実装優先度

### Phase 1: 基本スキーマ (Sprint 1)

1. PostgreSQL テーブル作成
2. 基本インデックス設定
3. 初期データ投入

### Phase 2: EventStore 統合 (Sprint 2)

1. イベントスキーマ実装
2. プロジェクション設定
3. イベント→ReadModel更新処理

### Phase 3: 運用最適化 (Sprint 3)

1. パフォーマンス最適化
2. データマイグレーション手順
3. 監視・メンテナンス体制

---

**文書管理**:

- **作成者**: データベースアーキテクト
- **レビュー要求**: ソフトウェアアーキテクト、バックエンドエンジニア
- **次期作業**: NestJS実装 (Repository層、EventStore統合)
