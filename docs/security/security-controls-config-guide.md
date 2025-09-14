# セキュリティ統制設定ガイド

## 概要

System Board自己ホスティング監視スタック（パブリッククラウド環境）におけるセキュリティ統制の具体的な設定手順とコンフィギュレーション例を提供します。本ガイドは実装担当者が実際の設定作業を行うための詳細な技術資料です。

**対象環境**: パブリッククラウド（Azure/AWS）
**対象システム**: Grafana Loki, Jaeger, OpenTelemetry, Prometheus, Grafana, AlertManager
**最終更新**: 2025-09-14

---

## 1. クラウドプラットフォーム基盤設定

### 1.1 Azure環境でのセキュリティ基盤

**注意**: 以下はAzure CLIでの設定例です。AWS環境での設定については「1.2 AWS環境でのセキュリティ基盤（Terraform）」を参照してください。

#### Resource Group設定

```bash
#!/bin/bash
# System Board 監視システム用リソースグループ作成

# 変数定義
RESOURCE_GROUP="rg-systemboard-monitoring-prod"
LOCATION="japaneast"
BACKUP_LOCATION="japanwest"

# メインリソースグループ作成
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --tags \
    Environment=Production \
    Project=SystemBoard \
    Security=High \
    DataClassification=Confidential

# バックアップ用リソースグループ作成
az group create \
  --name "${RESOURCE_GROUP}-backup" \
  --location $BACKUP_LOCATION \
  --tags \
    Environment=Production \
    Project=SystemBoard \
    Purpose=DisasterRecovery
```

#### Virtual Network設定

```bash
#!/bin/bash
# VNet・マイクロセグメンテーション設定

# VNet作成
az network vnet create \
  --resource-group $RESOURCE_GROUP \
  --name "vnet-systemboard-monitoring" \
  --address-prefix 10.100.0.0/16 \
  --location $LOCATION

# 機密データ処理サブネット
az network vnet subnet create \
  --resource-group $RESOURCE_GROUP \
  --vnet-name "vnet-systemboard-monitoring" \
  --name "subnet-monitoring-critical" \
  --address-prefix 10.100.1.0/24 \
  --network-security-group "nsg-monitoring-critical"

# 一般監視データサブネット
az network vnet subnet create \
  --resource-group $RESOURCE_GROUP \
  --vnet-name "vnet-systemboard-monitoring" \
  --name "subnet-monitoring-standard" \
  --address-prefix 10.100.2.0/24 \
  --network-security-group "nsg-monitoring-standard"

# アプリケーション統合サブネット
az network vnet subnet create \
  --resource-group $RESOURCE_GROUP \
  --vnet-name "vnet-systemboard-monitoring" \
  --name "subnet-app-integration" \
  --address-prefix 10.100.3.0/24 \
  --network-security-group "nsg-app-integration"
```

#### Network Security Groups設定

```bash
#!/bin/bash
# NSGルール設定（機密データ処理サブネット用）

# NSG作成
az network nsg create \
  --resource-group $RESOURCE_GROUP \
  --name "nsg-monitoring-critical" \
  --location $LOCATION

# インバウンドルール - HTTPSのみ許可
az network nsg rule create \
  --resource-group $RESOURCE_GROUP \
  --nsg-name "nsg-monitoring-critical" \
  --name "AllowHTTPS" \
  --priority 1000 \
  --source-address-prefixes "10.100.2.0/24" \
  --source-port-ranges "*" \
  --destination-address-prefixes "10.100.1.0/24" \
  --destination-port-ranges "443" \
  --access "Allow" \
  --protocol "Tcp"

# インバウンドルール - Active Directory LDAPS
az network nsg rule create \
  --resource-group $RESOURCE_GROUP \
  --nsg-name "nsg-monitoring-critical" \
  --name "AllowLDAPS" \
  --priority 1100 \
  --source-address-prefixes "10.1.0.0/16" \
  --destination-port-ranges "636" \
  --access "Allow" \
  --protocol "Tcp"

# アウトバウンドルール - インターネットアクセス拒否
az network nsg rule create \
  --resource-group $RESOURCE_GROUP \
  --nsg-name "nsg-monitoring-critical" \
  --name "DenyInternet" \
  --priority 4000 \
  --direction "Outbound" \
  --source-address-prefixes "*" \
  --destination-address-prefixes "Internet" \
  --access "Deny" \
  --protocol "*"
```

### 1.2 AWS環境でのセキュリティ基盤（Terraform）

以下はAWS環境でのTerraform設定例です。

#### VPC・ネットワークセキュリティ設定

```hcl
# main.tf
# System Board 監視システム AWS基盤設定

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# プロバイダー設定（日本リージョン限定）
provider "aws" {
  region = "ap-northeast-1"  # Tokyo
}

provider "aws" {
  alias  = "osaka"
  region = "ap-northeast-3"  # Osaka（バックアップ用）
}

# データ主権確保のための変数定義
locals {
  project_name = "systemboard-monitoring"
  environment  = "production"

  tags = {
    Project             = "SystemBoard"
    Environment         = "Production"
    Security            = "High"
    DataClassification  = "Confidential"
    DataResidency      = "Japan"
  }
}

# VPC作成
resource "aws_vpc" "monitoring_vpc" {
  cidr_block           = "10.100.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, {
    Name = "vpc-${local.project_name}"
  })
}

# インターネットゲートウェイ（制限的使用）
resource "aws_internet_gateway" "monitoring_igw" {
  vpc_id = aws_vpc.monitoring_vpc.id

  tags = merge(local.tags, {
    Name = "igw-${local.project_name}"
  })
}

# 機密データ処理サブネット（パブリックアクセス不可）
resource "aws_subnet" "monitoring_critical" {
  vpc_id                  = aws_vpc.monitoring_vpc.id
  cidr_block              = "10.100.1.0/24"
  availability_zone       = "ap-northeast-1a"
  map_public_ip_on_launch = false

  tags = merge(local.tags, {
    Name = "subnet-monitoring-critical"
    Tier = "Critical"
  })
}

# 一般監視データサブネット
resource "aws_subnet" "monitoring_standard" {
  vpc_id                  = aws_vpc.monitoring_vpc.id
  cidr_block              = "10.100.2.0/24"
  availability_zone       = "ap-northeast-1b"
  map_public_ip_on_launch = false

  tags = merge(local.tags, {
    Name = "subnet-monitoring-standard"
    Tier = "Standard"
  })
}

# アプリケーション統合サブネット
resource "aws_subnet" "app_integration" {
  vpc_id                  = aws_vpc.monitoring_vpc.id
  cidr_block              = "10.100.3.0/24"
  availability_zone       = "ap-northeast-1c"
  map_public_ip_on_launch = true

  tags = merge(local.tags, {
    Name = "subnet-app-integration"
    Tier = "Integration"
  })
}

# NAT Gateway（アウトバウンドアクセス制御）
resource "aws_eip" "nat_eip" {
  domain = "vpc"

  tags = merge(local.tags, {
    Name = "eip-nat-${local.project_name}"
  })
}

resource "aws_nat_gateway" "monitoring_nat" {
  allocation_id = aws_eip.nat_eip.id
  subnet_id     = aws_subnet.app_integration.id

  tags = merge(local.tags, {
    Name = "nat-${local.project_name}"
  })

  depends_on = [aws_internet_gateway.monitoring_igw]
}

# ルートテーブル設定
resource "aws_route_table" "critical_rt" {
  vpc_id = aws_vpc.monitoring_vpc.id

  # NAT Gateway経由のみ（インターネットアクセス制限）
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.monitoring_nat.id
  }

  tags = merge(local.tags, {
    Name = "rt-critical"
  })
}

resource "aws_route_table_association" "critical_rta" {
  subnet_id      = aws_subnet.monitoring_critical.id
  route_table_id = aws_route_table.critical_rt.id
}

# セキュリティグループ設定
resource "aws_security_group" "monitoring_critical_sg" {
  name_prefix = "sg-monitoring-critical"
  vpc_id      = aws_vpc.monitoring_vpc.id

  # HTTPSのみ許可（内部通信）
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.100.2.0/24"]
  }

  # LDAPS（Active Directory）
  ingress {
    from_port   = 636
    to_port     = 636
    protocol    = "tcp"
    cidr_blocks = ["10.1.0.0/16"]  # 既存ADネットワーク
  }

  # アウトバウンド制限（NAT Gateway経由のみ）
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, {
    Name = "sg-monitoring-critical"
  })
}

resource "aws_security_group" "monitoring_standard_sg" {
  name_prefix = "sg-monitoring-standard"
  vpc_id      = aws_vpc.monitoring_vpc.id

  # 標準監視通信
  ingress {
    from_port   = 3000
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = ["10.100.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["10.100.0.0/16"]
  }

  tags = merge(local.tags, {
    Name = "sg-monitoring-standard"
  })
}
```

#### AWS KMS・暗号化設定

```hcl
# kms.tf
# カスタマー管理キー設定

# System Board メインデータ暗号化キー
resource "aws_kms_key" "systemboard_data_key" {
  description = "System Board製造データ・脆弱性情報専用暗号化キー - 製造業機密情報保護用のBYOKカスタマー管理暗号化キー"
  key_usage   = "ENCRYPT_DECRYPT"
  key_spec    = "SYMMETRIC_DEFAULT"

  # ポリシー設定
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableSystemBoardAccess"
        Effect = "Allow"
        Principal = {
          AWS = [
            aws_iam_role.monitoring_role.arn,
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
          ]
        }
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey",
          "kms:ReEncrypt*",
          "kms:CreateGrant",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = [
              "s3.ap-northeast-1.amazonaws.com",
              "rds.ap-northeast-1.amazonaws.com"
            ]
          }
        }
      }
    ]
  })

  # 削除保護
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(local.tags, {
    Name        = "kms-systemboard-data"
    Purpose     = "ManufacturingDataEncryption"
    KeyRotation = "Enabled"
  })
}

# ログデータ専用キー
resource "aws_kms_key" "systemboard_logs_key" {
  description = "System Board監視ログ・トレースデータ専用暗号化キー"
  key_usage   = "ENCRYPT_DECRYPT"
  key_spec    = "SYMMETRIC_DEFAULT"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableLogsAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.monitoring_role.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      }
    ]
  })

  deletion_window_in_days = 7  # ログは短期保持
  enable_key_rotation     = true

  tags = merge(local.tags, {
    Name    = "kms-systemboard-logs"
    Purpose = "LogDataEncryption"
  })
}

# バックアップ専用キー
resource "aws_kms_key" "systemboard_backup_key" {
  description = "System Board災害復旧・バックアップ専用暗号化キー"
  key_usage   = "ENCRYPT_DECRYPT"
  key_spec    = "SYMMETRIC_DEFAULT"

  # バックアップは大阪リージョンでも利用
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableBackupAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.monitoring_role.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = [
              "s3.ap-northeast-1.amazonaws.com",
              "s3.ap-northeast-3.amazonaws.com"  # 大阪リージョン
            ]
          }
        }
      }
    ]
  })

  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(local.tags, {
    Name    = "kms-systemboard-backup"
    Purpose = "BackupEncryption"
  })
}

# KMSキーエイリアス
resource "aws_kms_alias" "systemboard_data_key_alias" {
  name          = "alias/systemboard-data-encryption"
  target_key_id = aws_kms_key.systemboard_data_key.key_id
}

resource "aws_kms_alias" "systemboard_logs_key_alias" {
  name          = "alias/systemboard-logs-encryption"
  target_key_id = aws_kms_key.systemboard_logs_key.key_id
}

resource "aws_kms_alias" "systemboard_backup_key_alias" {
  name          = "alias/systemboard-backup-encryption"
  target_key_id = aws_kms_key.systemboard_backup_key.key_id
}

# IAMロール（監視アプリケーション用）
resource "aws_iam_role" "monitoring_role" {
  name = "SystemBoardMonitoringRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = ["ec2.amazonaws.com", "ecs-tasks.amazonaws.com"]
        }
      }
    ]
  })

  tags = local.tags
}

# S3バケット（ログストレージ）
resource "aws_s3_bucket" "monitoring_logs" {
  bucket = "systemboard-monitoring-logs-${random_string.bucket_suffix.result}"

  tags = merge(local.tags, {
    Name    = "s3-monitoring-logs"
    Purpose = "LogStorage"
  })
}

resource "aws_s3_bucket_encryption_configuration" "monitoring_logs_encryption" {
  bucket = aws_s3_bucket.monitoring_logs.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.systemboard_logs_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# ランダム文字列（バケット名重複回避）
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# データ取得用
data "aws_caller_identity" "current" {}
```

#### ネットワークACL設定

```hcl
# network_acls.tf
# 追加のネットワーク層セキュリティ

resource "aws_network_acl" "monitoring_critical_nacl" {
  vpc_id     = aws_vpc.monitoring_vpc.id
  subnet_ids = [aws_subnet.monitoring_critical.id]

  # インバウンド: HTTPS のみ許可
  ingress {
    protocol   = "tcp"
    rule_no    = 100
    action     = "allow"
    cidr_block = "10.100.2.0/24"
    from_port  = 443
    to_port    = 443
  }

  # インバウンド: LDAPS 許可
  ingress {
    protocol   = "tcp"
    rule_no    = 110
    action     = "allow"
    cidr_block = "10.1.0.0/16"
    from_port  = 636
    to_port    = 636
  }

  # アウトバウンド: 必要最小限
  egress {
    protocol   = "tcp"
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 443
    to_port    = 443
  }

  # デフォルト拒否（明示的）
  egress {
    protocol   = "-1"
    rule_no    = 32766
    action     = "deny"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  tags = merge(local.tags, {
    Name = "nacl-monitoring-critical"
  })
}
```

### 1.3 暗号化・キー管理設定（Azure）

#### Azure Key Vault設定

```bash
#!/bin/bash
# カスタマー管理キー設定

KEY_VAULT_NAME="kv-systemboard-security"

# Key Vault作成
az keyvault create \
  --resource-group $RESOURCE_GROUP \
  --name $KEY_VAULT_NAME \
  --location $LOCATION \
  --enabled-for-disk-encryption true \
  --enabled-for-deployment false \
  --enabled-for-template-deployment false \
  --enable-soft-delete true \
  --soft-delete-retention-days 90 \
  --enable-purge-protection true \
  --sku premium

# 暗号化キー作成
az keyvault key create \
  --vault-name $KEY_VAULT_NAME \
  --name "systemboard-data-encryption-key" \
  --protection software \
  --kty RSA \
  --size 4096 \
  --ops decrypt encrypt sign unwrapKey verify wrapKey

# ログデータ専用キー
az keyvault key create \
  --vault-name $KEY_VAULT_NAME \
  --name "systemboard-logs-encryption-key" \
  --protection software \
  --kty RSA \
  --size 4096

# バックアップ専用キー
az keyvault key create \
  --vault-name $KEY_VAULT_NAME \
  --name "systemboard-backup-encryption-key" \
  --protection software \
  --kty RSA \
  --size 4096
```

#### Key Vault アクセスポリシー設定

```bash
#!/bin/bash
# Key Vault アクセス制御設定

# System Board 監視アプリケーションの Managed Identity に権限付与
MONITORING_APP_IDENTITY="id-systemboard-monitoring"

az keyvault set-policy \
  --name $KEY_VAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --object-id $(az identity show --name $MONITORING_APP_IDENTITY --resource-group $RESOURCE_GROUP --query principalId -o tsv) \
  --key-permissions decrypt encrypt get list \
  --secret-permissions get list \
  --certificate-permissions get list

# セキュリティチーム管理者権限
az keyvault set-policy \
  --name $KEY_VAULT_NAME \
  --upn "security-admin@company.local" \
  --key-permissions backup create decrypt delete encrypt get import list purge recover restore sign unwrapKey update verify wrapKey \
  --secret-permissions all \
  --certificate-permissions all
```

---

## 2. Grafana Loki セキュリティ設定

### 2.1 Loki基本設定（セキュリティ強化）

#### loki.yaml設定ファイル

```yaml
# /etc/loki/loki.yaml
# Grafana Loki セキュリティ強化設定

auth_enabled: true

server:
  http_listen_port: 3100
  grpc_listen_port: 9095

  # TLS設定
  http_tls_config:
    cert_file: /etc/loki/certs/loki.crt
    key_file: /etc/loki/certs/loki.key
    min_version: VersionTLS13
    cipher_suites:
      - TLS_AES_256_GCM_SHA384
      - TLS_CHACHA20_POLY1305_SHA256

  grpc_tls_config:
    cert_file: /etc/loki/certs/loki.crt
    key_file: /etc/loki/certs/loki.key
    min_version: VersionTLS13

# 認証設定
auth:
  type: "enterprise"  # Grafana Enterprise機能利用

# 共通設定
common:
  path_prefix: /loki
  storage:
    # Azure Storage設定
    azure:
      account_name: ${AZURE_STORAGE_ACCOUNT}
      account_key: ${AZURE_STORAGE_KEY}
      container_name: loki-chunks
      use_managed_identity: true
      # カスタマー管理キーによる暗号化
      encryption:
        type: "CustomerManagedKey"
        key_vault_key_id: "https://kv-systemboard-security.vault.azure.net/keys/systemboard-logs-encryption-key"

# インジェスト制限
ingester:
  lifecycler:
    ring:
      kvstore:
        store: consul
        consul:
          host: localhost:8500
      replication_factor: 3
    num_tokens: 512
    heartbeat_period: 5s
    observe_period: 10s
    join_after: 30s
    min_ready_duration: 15s
    interface_names:
      - eth0

# クエリ制限
limits_config:
  # レート制限
  ingestion_rate_mb: 10
  ingestion_burst_size_mb: 20
  max_query_parallelism: 32
  max_query_series: 500

  # セキュリティ制限
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  creation_grace_period: 10m

  # 保存期間制限
  retention_period: 2160h  # 90日間

# インデックス設定
schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb-shipper
      object_store: azure
      schema: v11
      # 機密度別インデックス分離
      index:
        prefix: loki_
        period: 24h

# ストレージ設定
storage_config:
  azure:
    account_name: ${AZURE_STORAGE_ACCOUNT}
    account_key: ${AZURE_STORAGE_KEY}
    container_name: loki-chunks
    use_managed_identity: true

  boltdb_shipper:
    active_index_directory: /loki/index
    shared_store: azure
    cache_location: /loki/index_cache

# 圧縮・保存期間管理
compactor:
  working_directory: /loki/compactor
  shared_store: azure
  compaction_interval: 10m
  retention_enabled: true
  retention_delete_delay: 2h
  retention_delete_worker_count: 150

# トレーシング設定
tracing:
  enabled: true
  jaeger:
    agent:
      host: jaeger-agent.monitoring.svc.cluster.local
      port: 6831
```

### 2.2 機密データマスキング設定

#### Promtail設定（データサニタイゼーション）

```yaml
# /etc/promtail/promtail.yaml
# 機密データ自動マスキング設定

server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: https://loki.systemboard-monitoring.local:3100/loki/api/v1/push
    tls_config:
      cert_file: /etc/promtail/certs/promtail.crt
      key_file: /etc/promtail/certs/promtail.key
      ca_file: /etc/promtail/certs/ca.crt
      server_name: loki.systemboard-monitoring.local

scrape_configs:
  # System Board アプリケーションログ
  - job_name: systemboard_app
    static_configs:
      - targets:
          - localhost
        labels:
          job: systemboard
          __path__: /var/log/systemboard/*.log

    pipeline_stages:
      # ログパース
      - regex:
          expression: '(?P<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\s+(?P<level>\w+)\s+(?P<message>.*)'

      # 機密情報パターンマスキング
      - replace:
          expression: '(?i)(password|passwd|pwd|token|key|secret|api[_-]?key)\s*[:=]\s*[\w\-\.]+'
          replace: '${1}=***CREDENTIALS_REDACTED***'

      - replace:
          expression: '(?i)(bearer|authorization)\s*:\s*[\w\-\.]+.*'
          replace: '${1}: ***AUTH_TOKEN_REDACTED***'

      - replace:
          expression: '(host-[\w-]+\.(internal|local|corp)|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})'
          replace: '***INTERNAL_HOST_REDACTED***'

      - replace:
          expression: '(?i)(database|db)[_-]?(url|string|connection)\s*[:=]\s*[^\s]+'
          replace: '${1}_${2}=***DB_CONNECTION_REDACTED***'

      # 製造業固有の機密情報マスキング
      - replace:
          expression: '(?i)(製造ライン|production[_-]?line|manufacturing[_-]?unit)\s*[:=]\s*[^\s,]+'
          replace: '***MANUFACTURING_INFO_REDACTED***'

      - replace:
          expression: '(?i)(品質管理|quality[_-]?control|qc)[_-]?(データ|data|info)\s*[:=]\s*[^\s,]+'
          replace: '***QUALITY_DATA_REDACTED***'

      # ログレベル・分類設定
      - labels:
          level: ''
          app: 'systemboard'
          confidentiality: |
            {{ if regexMatch "(?i)(confidential|manufacturing|quality|production)" .message }}high{{ else }}standard{{ end }}

      # 高機密ログの特別処理
      - match:
          selector: '{confidentiality="high"}'
          stages:
            - output:
                source: high_confidential
            # 高機密ログは分離ストレージに保存
            - labels:
                storage_tier: 'confidential'

  # 監査ログ専用設定
  - job_name: audit_logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: audit
          __path__: /var/log/systemboard/audit/*.log

    pipeline_stages:
      # 監査ログは改ざん防止のためハッシュ値計算
      - regex:
          expression: '(?P<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\s+(?P<event_type>\w+)\s+(?P<user_id>\w+)\s+(?P<details>.*)'

      # ハッシュ値追加（改ざん検知用）
      - template:
          source: log_hash
          template: '{{ .Entry | sha256sum }}'

      - labels:
          event_type: ''
          user_id: ''
          log_hash: ''
          retention: 'permanent'  # 監査ログは永続保存
```

---

## 3. 認証・認可システム設定

### 3.1 Active Directory統合

#### Grafana Azure Active Directory設定

**Azure Active Directory OAuth2.0統合** (推奨)

```ini
# /etc/grafana/grafana.ini
# Azure AD OAuth2.0設定

[auth.azuread]
enabled = true
name = Azure AD
allow_sign_up = true
client_id = ${AZURE_AD_CLIENT_ID}
client_secret = ${AZURE_AD_CLIENT_SECRET}
scopes = openid email profile
auth_url = https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize
token_url = https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token
api_url = https://graph.microsoft.com/v1.0/me
allowed_domains = company.local company.com
allowed_groups =
team_ids =
allowed_organizations =
role_attribute_path =
role_attribute_strict = false
allow_assign_grafana_admin = true

# ユーザー自動作成設定
[users]
auto_assign_org = true
auto_assign_org_id = 1
auto_assign_org_role = Viewer

# セキュリティ設定
[security]
disable_initial_admin_creation = true
admin_user =
admin_password =
secret_key = ${GRAFANA_SECRET_KEY}
disable_gravatar = true

# ログイン設定
[auth]
oauth_auto_login = false
disable_login_form = false
disable_signout_menu = false
```

**Azure AD アプリケーション登録設定**

```bash
#!/bin/bash
# Azure AD アプリケーション登録スクリプト

TENANT_ID="your-tenant-id"
APP_NAME="SystemBoard-Monitoring"
GRAFANA_URL="https://grafana.systemboard-monitoring.local"

# アプリケーション登録
az ad app create \
  --display-name $APP_NAME \
  --web-redirect-uris "${GRAFANA_URL}/login/azuread" \
  --required-resource-accesses '[
    {
      "resourceAppId": "00000003-0000-0000-c000-000000000000",
      "resourceAccess": [
        {
          "id": "e1fe6dd8-ba31-4d61-89e7-88639da4683d",
          "type": "Scope"
        },
        {
          "id": "37f7f235-527c-4136-accd-4a02d197296e",
          "type": "Scope"
        },
        {
          "id": "14dad69e-099b-42c9-810b-d002981feec1",
          "type": "Scope"
        }
      ]
    }
  ]'

# クライアントシークレット作成
az ad app credential reset \
  --id $(az ad app list --display-name $APP_NAME --query "[0].appId" -o tsv) \
  --password-display-name "Grafana-Secret" \
  --years 2
```

**Azure AD条件付きアクセス設定**

```powershell
# PowerShell - 条件付きアクセスポリシー設定

# 必要なモジュールのインポート
Import-Module AzureAD

# Azure AD接続
Connect-AzureAD -TenantId "your-tenant-id"

# System Board監視システム用条件付きアクセスポリシー
$conditions = @{
    Applications = @{
        IncludeApplications = @("your-app-id")  # Grafanaアプリケーション
    }
    Users = @{
        IncludeGroups = @("monitoring-users-group-id", "security-team-group-id")
        ExcludeUsers = @("emergency-break-glass-account-id")
    }
    Locations = @{
        IncludeLocations = @("office-location-id", "japan-location-id")
    }
    Platforms = @{
        IncludePlatforms = @("Windows", "macOS")
        ExcludePlatforms = @("iOS", "Android")  # モバイルデバイス制限
    }
    ClientApps = @{
        IncludeClientApps = @("Browser")
    }
}

$grantControls = @{
    BuiltInControls = @("MFA", "CompliantDevice")
    Operator = "AND"  # MFA AND 準拠デバイス必須
}

$sessionControls = @{
    ApplicationEnforcedRestrictions = @{
        IsEnabled = $true
    }
    SignInFrequency = @{
        IsEnabled = $true
        Type = "Hours"
        Value = 4  # 4時間ごとに再認証
    }
    PersistentBrowser = @{
        IsEnabled = $true
        Mode = "Never"  # ブラウザでの認証情報保持禁止
    }
}

# ポリシー作成
New-AzureADMSConditionalAccessPolicy `
    -DisplayName "System Board Monitoring - High Security Access" `
    -State "Enabled" `
    -Conditions $conditions `
    -GrantControls $grantControls `
    -SessionControls $sessionControls
```

#### Grafana 従来LDAP設定（オンプレミス AD）

**注意**: オンプレミスActive DirectoryでLDAPSを使用する場合の設定例

```ini
# /etc/grafana/ldap.toml
# オンプレミス Active Directory統合設定

[[servers]]
host = "ad.company.local"
port = 636
use_ssl = true
start_tls = false
ssl_skip_verify = false
root_ca_cert = "/etc/grafana/certs/company-ca.pem"

# バインド認証情報
bind_dn = "CN=grafana-svc,OU=Service Accounts,DC=company,DC=local"
bind_password = "${LDAP_BIND_PASSWORD}"

# ユーザー検索設定
search_filter = "(sAMAccountName=%s)"
search_base_dns = ["DC=company,DC=local"]

# ユーザー属性マッピング
[servers.attributes]
name = "displayName"
surname = "sn"
username = "sAMAccountName"
member_of = "memberOf"
email = "mail"

# グループマッピング
[[servers.group_mappings]]
group_dn = "CN=Monitoring-Admins,OU=Security Groups,DC=company,DC=local"
org_role = "Admin"
org_id = 1

[[servers.group_mappings]]
group_dn = "CN=Security-Team,OU=Security Groups,DC=company,DC=local"
org_role = "Admin"
org_id = 1

[[servers.group_mappings]]
group_dn = "CN=Monitoring-Users,OU=Security Groups,DC=company,DC=local"
org_role = "Editor"
org_id = 1

[[servers.group_mappings]]
group_dn = "CN=Development-Team,OU=Security Groups,DC=company,DC=local"
org_role = "Viewer"
org_id = 1
```

#### Grafana設定（認証強化）

```ini
# /etc/grafana/grafana.ini
# Grafana セキュリティ強化設定

[server]
protocol = https
http_port = 3000
cert_file = /etc/grafana/certs/grafana.crt
cert_key = /etc/grafana/certs/grafana.key
min_tls_version = "TLS1.3"

# セキュリティ設定
[security]
admin_user = admin
admin_password = ${GF_SECURITY_ADMIN_PASSWORD}
secret_key = ${GF_SECURITY_SECRET_KEY}
login_remember_days = 1
cookie_secure = true
cookie_samesite = strict
strict_transport_security = true
strict_transport_security_max_age_seconds = 86400
strict_transport_security_preload = true
content_type_protection = true
x_content_type_options = nosniff
x_xss_protection = true

# セッション設定
[session]
provider = redis
provider_config = addr=redis.monitoring.svc.cluster.local:6379,pool_size=100,prefix=grafana-session
cookie_name = grafana_sess
cookie_secure = true
session_life_time = 28800  # 8時間

# 認証設定
[auth]
login_maximum_inactive_lifetime_duration = 15m
login_maximum_lifetime_duration = 8h
oauth_auto_login = false
disable_login_form = false
disable_signout_menu = false

# LDAP認証
[auth.ldap]
enabled = true
config_file = /etc/grafana/ldap.toml
allow_sign_up = false

# 多要素認証（外部プロバイダー連携）
[auth.generic_oauth]
enabled = true
name = Company SSO
allow_sign_up = true
client_id = ${OAUTH_CLIENT_ID}
client_secret = ${OAUTH_CLIENT_SECRET}
scopes = openid email profile
auth_url = https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize
token_url = https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token
api_url = https://graph.microsoft.com/v1.0/me
role_attribute_path = contains(groups[*], 'Monitoring-Admins') && 'Admin' || contains(groups[*], 'Security-Team') && 'Admin' || contains(groups[*], 'Monitoring-Users') && 'Editor' || 'Viewer'

# ログ設定
[log]
mode = console file
level = info
format = json

[log.console]
level = info
format = json

[log.file]
level = info
format = json
log_rotate = true
max_lines = 1000000
max_size_shift = 28
daily_rotate = true
max_days = 90
```

### 3.2 RBAC設定詳細

#### Grafana データソース権限設定

```json
{
  "datasourcePermissions": {
    "loki_confidential": {
      "roles": ["Security-Team", "Monitoring-Admins"],
      "permissions": ["read"],
      "conditions": {
        "mfa_required": true,
        "location_restricted": true,
        "allowed_countries": ["JP"]
      }
    },
    "loki_standard": {
      "roles": ["Monitoring-Users", "Development-Team"],
      "permissions": ["read"],
      "conditions": {
        "corporate_network": true
      }
    },
    "prometheus_metrics": {
      "roles": ["Monitoring-Users", "Monitoring-Admins"],
      "permissions": ["read"],
      "query_restrictions": {
        "max_query_range": "7d",
        "rate_limit": "100/hour"
      }
    }
  }
}
```

---

## 4. 監視・アラート設定

### 4.1 Prometheus監視ルール

#### セキュリティアラートルール

```yaml
# /etc/prometheus/rules/security-alerts.yml
groups:
  - name: security.rules
    rules:
      # 不正アクセス検知
      - alert: UnauthorizedAccessAttempt
        expr: increase(grafana_api_response_status_total{code=~"401|403"}[5m]) > 5
        for: 1m
        labels:
          severity: critical
          category: security
          team: security
        annotations:
          summary: "不正アクセス試行を検出"
          description: "過去5分間で{{ $value }}回の認証失敗が発生しました"
          runbook_url: "https://wiki.company.local/security/unauthorized-access"

      # 異常なデータ量エクスポート
      - alert: MassiveDataExport
        expr: rate(loki_ingester_bytes_received_total[5m]) > 104857600  # 100MB/5min
        for: 2m
        labels:
          severity: high
          category: data_protection
          team: security
        annotations:
          summary: "大量データエクスポートを検出"
          description: "短時間で{{ $value | humanizeBytes }}のデータエクスポートを検出"

      # 機密データアクセス監視
      - alert: ConfidentialDataAccess
        expr: increase(loki_request_duration_seconds_count{job="loki",handler=~".*confidential.*"}[15m]) > 0
        labels:
          severity: medium
          category: data_access
          team: security
        annotations:
          summary: "機密データへのアクセスを記録"
          description: "機密データへのアクセスが発生しました。監査ログを確認してください"

      # システム設定変更検知
      - alert: SecurityConfigurationChange
        expr: increase(grafana_api_admin_response_status_total[5m]) > 0
        labels:
          severity: high
          category: configuration
          team: security
        annotations:
          summary: "セキュリティ設定の変更を検出"
          description: "システムセキュリティ設定が変更されました"

  - name: operational.rules
    rules:
      # サービス可用性監視
      - alert: ServiceDown
        expr: up{job=~"loki|grafana|prometheus"} == 0
        for: 30s
        labels:
          severity: critical
          category: availability
          team: operations
        annotations:
          summary: "{{ $labels.job }} サービスダウン"
          description: "{{ $labels.instance }} の {{ $labels.job }} サービスが停止しています"

      # 高CPU使用率
      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
          category: performance
          team: operations
        annotations:
          summary: "高CPU使用率を検出"
          description: "{{ $labels.instance }} のCPU使用率が {{ $value }}% です"

      # 高メモリ使用率
      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100 > 85
        for: 5m
        labels:
          severity: warning
          category: performance
          team: operations
        annotations:
          summary: "高メモリ使用率を検出"
          description: "{{ $labels.instance }} のメモリ使用率が {{ $value }}% です"
```

### 4.2 AlertManager設定

#### Microsoft Teams統合設定

```yaml
# /etc/alertmanager/alertmanager.yml
global:
  smtp_smarthost: 'smtp.company.local:587'
  smtp_from: 'monitoring@company.local'

# テンプレート設定
templates:
  - '/etc/alertmanager/templates/*.tmpl'

# ルーティング設定
route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
  receiver: 'default-receiver'
  routes:
    # セキュリティアラートは即座通知
    - match:
        category: security
      receiver: 'security-team'
      group_wait: 0s
      repeat_interval: 1h

    # データ保護アラート
    - match:
        category: data_protection
      receiver: 'security-team'
      group_wait: 10s
      repeat_interval: 2h

    # 運用アラート
    - match:
        category: availability
      receiver: 'operations-team'
      group_wait: 1m
      repeat_interval: 6h

# 受信者設定
receivers:
  - name: 'default-receiver'
    webhook_configs:
      - url: 'https://company.webhook.office.com/webhookb2/default'

  - name: 'security-team'
    webhook_configs:
      - url: '${TEAMS_SECURITY_WEBHOOK}'
        title: '🚨 セキュリティアラート'
        text: |
          **重要度**: {{ .GroupLabels.severity }}
          **カテゴリ**: {{ .GroupLabels.category }}
          **時刻**: {{ range .Alerts }}{{ .StartsAt.Format "2006-01-02 15:04:05" }}{{ end }}

          {{ range .Alerts }}
          **{{ .Annotations.summary }}**
          {{ .Annotations.description }}

          対応手順: {{ .Annotations.runbook_url }}
          {{ end }}

  - name: 'operations-team'
    webhook_configs:
      - url: '${TEAMS_OPERATIONS_WEBHOOK}'
        title: '⚠️ 運用アラート'

# 抑制ルール
inhibit_rules:
  # 同一インスタンスの重複アラート抑制
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['instance']
```

#### Teams通知テンプレート

```go
<!-- /etc/alertmanager/templates/teams.tmpl -->
{{ define "teams.title" }}
{{ if eq .Status "firing" }}🚨{{ else }}✅{{ end }}
{{ .GroupLabels.alertname }}
{{ end }}

{{ define "teams.text" }}
{{ if eq .Status "firing" }}
**🔥 アラート発生**
{{ else }}
**✅ アラート解決**
{{ end }}

**詳細情報:**
{{ range .Alerts }}
- **アラート**: {{ .Annotations.summary }}
- **説明**: {{ .Annotations.description }}
- **重要度**: {{ .Labels.severity }}
- **カテゴリ**: {{ .Labels.category }}
- **発生時刻**: {{ .StartsAt.Format "2006-01-02 15:04:05 JST" }}
{{ if .Annotations.runbook_url }}
- **対応手順**: [こちら]({{ .Annotations.runbook_url }})
{{ end }}

{{ end }}

{{ if eq .Status "firing" }}
**即座に対応が必要です！**
{{ else }}
**問題が解決されました。**
{{ end }}
{{ end }}
```

---

## 5. バックアップ・災害復旧設定

### 5.1 自動バックアップ設定

#### Azure Backup設定スクリプト

```bash
#!/bin/bash
# System Board 監視システム自動バックアップ設定

BACKUP_VAULT="rsv-systemboard-backup"
BACKUP_POLICY="policy-systemboard-daily"

# Recovery Services Vault作成
az backup vault create \
  --resource-group "${RESOURCE_GROUP}-backup" \
  --name $BACKUP_VAULT \
  --location $BACKUP_LOCATION

# バックアップポリシー作成
az backup policy create \
  --resource-group "${RESOURCE_GROUP}-backup" \
  --vault-name $BACKUP_VAULT \
  --name $BACKUP_POLICY \
  --policy '{
    "schedulePolicy": {
      "schedulePolicyType": "SimpleSchedulePolicy",
      "scheduleRunFrequency": "Daily",
      "scheduleRunTimes": ["2025-01-01T02:00:00.000Z"],
      "scheduleWeeklyFrequency": 0
    },
    "retentionPolicy": {
      "retentionPolicyType": "LongTermRetentionPolicy",
      "dailySchedule": {
        "retentionTimes": ["2025-01-01T02:00:00.000Z"],
        "retentionDuration": {
          "count": 90,
          "durationType": "Days"
        }
      },
      "weeklySchedule": {
        "retentionTimes": ["2025-01-01T02:00:00.000Z"],
        "retentionDuration": {
          "count": 52,
          "durationType": "Weeks"
        },
        "daysOfTheWeek": ["Sunday"]
      },
      "monthlySchedule": {
        "retentionTimes": ["2025-01-01T02:00:00.000Z"],
        "retentionDuration": {
          "count": 84,
          "durationType": "Months"
        },
        "retentionScheduleFormatType": "Weekly",
        "retentionScheduleWeekly": {
          "daysOfTheWeek": ["Sunday"],
          "weeksOfTheMonth": ["First"]
        }
      }
    }
  }'

# VM自動バックアップ有効化
az backup protection enable-for-vm \
  --resource-group $RESOURCE_GROUP \
  --vault-name $BACKUP_VAULT \
  --vm "vm-systemboard-monitoring" \
  --policy-name $BACKUP_POLICY
```

### 5.2 災害復旧テストスクリプト

#### DR環境自動構築

```bash
#!/bin/bash
# 災害復旧環境自動構築・テストスクリプト

DR_RESOURCE_GROUP="rg-systemboard-dr-test"
DR_LOCATION="japanwest"
TEST_DATE=$(date +%Y%m%d)

echo "災害復旧テスト開始: $TEST_DATE"

# DR環境リソースグループ作成
az group create \
  --name $DR_RESOURCE_GROUP \
  --location $DR_LOCATION \
  --tags \
    Environment=DisasterRecoveryTest \
    Project=SystemBoard \
    TestDate=$TEST_DATE

# 本番環境からのリストア実行
echo "本番バックアップからのリストア実行..."
LATEST_RECOVERY_POINT=$(az backup recoverypoint list \
  --resource-group "${RESOURCE_GROUP}-backup" \
  --vault-name $BACKUP_VAULT \
  --container-name "vm-systemboard-monitoring" \
  --item-name "vm-systemboard-monitoring" \
  --query "[0].name" -o tsv)

az backup restore restore-disks \
  --resource-group $DR_RESOURCE_GROUP \
  --vault-name $BACKUP_VAULT \
  --container-name "vm-systemboard-monitoring" \
  --item-name "vm-systemboard-monitoring" \
  --rp-name $LATEST_RECOVERY_POINT \
  --storage-account "sadrsystemboard$TEST_DATE" \
  --restore-to-staging-storage-account

# サービス可用性テスト
echo "サービス可用性テスト実行..."
SERVICES=("loki" "grafana" "prometheus" "alertmanager")
for service in "${SERVICES[@]}"; do
  echo "Testing $service..."
  if curl -f -k https://$service.dr-test.systemboard.local/api/v1/status; then
    echo "✅ $service: OK"
  else
    echo "❌ $service: FAILED"
  fi
done

# データ整合性テスト
echo "データ整合性テスト実行..."
# Loki データ整合性チェック
LOKI_QUERY_RESULT=$(curl -s -G https://loki.dr-test.systemboard.local/loki/api/v1/query \
  --data-urlencode 'query={job="systemboard"}' \
  --data-urlencode 'time=2025-09-14T12:00:00Z' | jq '.data.result | length')

if [ "$LOKI_QUERY_RESULT" -gt 0 ]; then
  echo "✅ Loki データ整合性: OK ($LOKI_QUERY_RESULT entries)"
else
  echo "❌ Loki データ整合性: FAILED"
fi

# RTO/RPO達成度チェック
RTO_TARGET=14400  # 4時間（秒）
RPO_TARGET=900    # 15分（秒）

RECOVERY_START_TIME=$(date -d "2025-09-14T12:00:00Z" +%s)
RECOVERY_END_TIME=$(date +%s)
ACTUAL_RTO=$((RECOVERY_END_TIME - RECOVERY_START_TIME))

echo "災害復旧テスト結果:"
echo "- RTO目標: $RTO_TARGET秒 (4時間)"
echo "- 実際のRTO: $ACTUAL_RTO秒"
echo "- RTO達成: $( [ $ACTUAL_RTO -le $RTO_TARGET ] && echo "✅ YES" || echo "❌ NO" )"

# DR環境クリーンアップ
echo "DR環境クリーンアップ実行..."
az group delete --name $DR_RESOURCE_GROUP --yes --no-wait

echo "災害復旧テスト完了: $TEST_DATE"
```

---

## 6. 継続的セキュリティ監視設定

### 6.1 セキュリティスキャン自動化

#### 脆弱性スキャン設定

```bash
#!/bin/bash
# 定期脆弱性スキャン設定（cronで実行）

SCAN_REPORT_DIR="/var/log/security-scans"
DATE=$(date +%Y%m%d)

mkdir -p $SCAN_REPORT_DIR

# Docker コンテナ脆弱性スキャン
echo "Docker脆弱性スキャン実行中..."
docker images --format "table {{.Repository}}:{{.Tag}}" | tail -n +2 | while read image; do
  echo "Scanning $image..."
  trivy image --format json --output "$SCAN_REPORT_DIR/trivy-$image-$DATE.json" $image
done

# ネットワークセキュリティスキャン
echo "ネットワークセキュリティスキャン実行中..."
nmap -sS -O -v --script vuln loki.systemboard-monitoring.local > "$SCAN_REPORT_DIR/nmap-loki-$DATE.txt"
nmap -sS -O -v --script vuln grafana.systemboard-monitoring.local > "$SCAN_REPORT_DIR/nmap-grafana-$DATE.txt"

# 設定ファイルセキュリティチェック
echo "設定ファイルセキュリティチェック実行中..."
lynis audit system --quiet --log-file "$SCAN_REPORT_DIR/lynis-$DATE.log"

# SSL/TLS設定チェック
echo "SSL/TLS設定チェック実行中..."
testssl.sh --jsonfile-pretty "$SCAN_REPORT_DIR/testssl-loki-$DATE.json" loki.systemboard-monitoring.local:3100
testssl.sh --jsonfile-pretty "$SCAN_REPORT_DIR/testssl-grafana-$DATE.json" grafana.systemboard-monitoring.local:3000

# レポート生成・Teams通知
python3 /opt/security-tools/generate_security_report.py --scan-date $DATE --report-dir $SCAN_REPORT_DIR
```

### 6.2 コンプライアンス監査自動化

#### 自動コンプライアンスチェック

```python
#!/usr/bin/env python3
# /opt/security-tools/compliance_checker.py
# 自動コンプライアンスチェックスクリプト

import json
import yaml
import requests
import subprocess
from datetime import datetime
from typing import Dict, List, Any

class ComplianceChecker:
    def __init__(self):
        self.compliance_results = {
            "iso27001": {},
            "nist_csf": {},
            "industry40": {}
        }

    def check_iso27001_controls(self):
        """ISO 27001統制項目チェック"""

        # A.9.1.1 アクセス制御方針
        rbac_config = self.check_grafana_rbac()
        self.compliance_results["iso27001"]["A.9.1.1"] = {
            "control_name": "Access control policy",
            "status": "COMPLIANT" if rbac_config else "NON_COMPLIANT",
            "evidence": rbac_config,
            "check_date": datetime.now().isoformat()
        }

        # A.10.1.1 暗号化統制
        encryption_status = self.check_encryption_compliance()
        self.compliance_results["iso27001"]["A.10.1.1"] = {
            "control_name": "Policy on cryptographic controls",
            "status": "COMPLIANT" if encryption_status else "NON_COMPLIANT",
            "evidence": encryption_status,
            "check_date": datetime.now().isoformat()
        }

        # A.12.4.1 ログ記録
        logging_compliance = self.check_audit_logging()
        self.compliance_results["iso27001"]["A.12.4.1"] = {
            "control_name": "Event logging",
            "status": "COMPLIANT" if logging_compliance else "NON_COMPLIANT",
            "evidence": logging_compliance,
            "check_date": datetime.now().isoformat()
        }

    def check_grafana_rbac(self) -> Dict[str, Any]:
        """Grafana RBAC設定チェック"""
        try:
            response = requests.get(
                "https://grafana.systemboard-monitoring.local/api/orgs/1/users",
                headers={"Authorization": f"Bearer {self.get_grafana_token()}"},
                verify=True
            )
            users = response.json()

            rbac_status = {
                "total_users": len(users),
                "admin_users": len([u for u in users if u["role"] == "Admin"]),
                "editor_users": len([u for u in users if u["role"] == "Editor"]),
                "viewer_users": len([u for u in users if u["role"] == "Viewer"]),
                "ldap_integration": self.check_ldap_integration()
            }

            return rbac_status
        except Exception as e:
            return {"error": str(e)}

    def check_encryption_compliance(self) -> Dict[str, Any]:
        """暗号化統制コンプライアンスチェック"""
        encryption_checks = {}

        # TLS設定チェック
        encryption_checks["tls_version"] = self.check_tls_compliance()

        # データベース暗号化チェック
        encryption_checks["database_encryption"] = self.check_db_encryption()

        # ストレージ暗号化チェック
        encryption_checks["storage_encryption"] = self.check_storage_encryption()

        return encryption_checks

    def check_audit_logging(self) -> Dict[str, Any]:
        """監査ログ記録チェック"""
        audit_checks = {}

        # Loki ログ収集状況
        loki_query = '{job="audit"}'
        audit_logs = self.query_loki(loki_query)
        audit_checks["audit_logs_present"] = len(audit_logs) > 0

        # ログ保存期間チェック
        audit_checks["retention_policy"] = self.check_log_retention()

        # ログ整合性チェック
        audit_checks["log_integrity"] = self.verify_log_integrity()

        return audit_checks

    def generate_compliance_report(self) -> str:
        """コンプライアンスレポート生成"""
        report = {
            "report_date": datetime.now().isoformat(),
            "compliance_status": self.compliance_results,
            "overall_score": self.calculate_compliance_score(),
            "recommendations": self.generate_recommendations()
        }

        report_file = f"/var/log/compliance/compliance-report-{datetime.now().strftime('%Y%m%d')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        # Teams通知
        self.notify_compliance_status(report)

        return report_file

if __name__ == "__main__":
    checker = ComplianceChecker()
    checker.check_iso27001_controls()
    report_file = checker.generate_compliance_report()
    print(f"コンプライアンスレポートを生成しました: {report_file}")
```

---

## 7. 運用手順・トラブルシューティング

### 7.1 インシデント対応手順

#### セキュリティインシデント対応スクリプト

```bash
#!/bin/bash
# /opt/incident-response/security_incident_handler.sh
# セキュリティインシデント自動対応スクリプト

INCIDENT_TYPE=$1
SEVERITY=$2
AFFECTED_SYSTEM=$3
INCIDENT_ID=$(date +%Y%m%d%H%M%S)

LOG_DIR="/var/log/incidents"
EVIDENCE_DIR="/var/log/incidents/evidence/$INCIDENT_ID"

mkdir -p $LOG_DIR $EVIDENCE_DIR

echo "=== セキュリティインシデント対応開始 ===" | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"
echo "インシデントタイプ: $INCIDENT_TYPE" | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"
echo "重要度: $SEVERITY" | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"
echo "影響システム: $AFFECTED_SYSTEM" | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"
echo "開始時刻: $(date)" | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"

# 即座対応（自動化）
case $INCIDENT_TYPE in
  "unauthorized_access")
    echo "不正アクセス対応実行中..." | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"

    # 証拠保全
    cp /var/log/auth.log "$EVIDENCE_DIR/auth.log.$(date +%H%M%S)"
    cp /var/log/nginx/access.log "$EVIDENCE_DIR/nginx-access.log.$(date +%H%M%S)"

    # 疑わしいセッション強制終了
    if [ "$SEVERITY" == "critical" ]; then
      echo "クリティカル: 全セッション強制終了" | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"
      curl -X POST https://grafana.systemboard-monitoring.local/api/admin/logout-all \
        -H "Authorization: Bearer ${GRAFANA_ADMIN_TOKEN}"
    fi

    # Teams緊急通知
    curl -X POST "${TEAMS_SECURITY_WEBHOOK}" \
      -H "Content-Type: application/json" \
      -d "{\"text\": \"🚨 緊急: 不正アクセスを検知しました\\n重要度: $SEVERITY\\nインシデントID: $INCIDENT_ID\\n対応状況: 初期対応完了\"}"
    ;;

  "data_exfiltration")
    echo "データ流出対応実行中..." | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"

    # ネットワーク分析
    netstat -an > "$EVIDENCE_DIR/netstat.$(date +%H%M%S).txt"
    ss -tuln > "$EVIDENCE_DIR/ss.$(date +%H%M%S).txt"

    # 大量データ転送の監視強化
    iptables -A OUTPUT -p tcp --dport 443 -m connbytes --connbytes 100000000: --connbytes-dir both -j LOG --log-prefix "LARGE_TRANSFER: "

    # 緊急通知（最高優先度）
    curl -X POST "${TEAMS_SECURITY_WEBHOOK}" \
      -H "Content-Type: application/json" \
      -d "{\"text\": \"🔴 最高緊急: データ流出疑い\\nインシデントID: $INCIDENT_ID\\n即座に対応チーム召集してください\"}"
    ;;

  "service_disruption")
    echo "サービス中断対応実行中..." | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"

    # サービス状態確認
    systemctl status loki grafana prometheus > "$EVIDENCE_DIR/service-status.$(date +%H%M%S).txt"

    # 自動復旧試行
    if [ "$AFFECTED_SYSTEM" == "loki" ]; then
      systemctl restart loki
      sleep 30
      if systemctl is-active --quiet loki; then
        echo "Loki自動復旧成功" | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"
      else
        echo "Loki自動復旧失敗" | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"
      fi
    fi
    ;;
esac

# フォレンジック証拠収集
echo "証拠収集実行中..." | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"

# システム状態スナップショット
ps aux > "$EVIDENCE_DIR/processes.$(date +%H%M%S).txt"
who > "$EVIDENCE_DIR/logged_users.$(date +%H%M%S).txt"
last -n 50 > "$EVIDENCE_DIR/login_history.$(date +%H%M%S).txt"

# ネットワーク状態
ip route > "$EVIDENCE_DIR/routes.$(date +%H%M%S).txt"
arp -a > "$EVIDENCE_DIR/arp_table.$(date +%H%M%S).txt"

# ログファイル保全
find /var/log -name "*.log" -newer /tmp/incident_start_time -exec cp {} "$EVIDENCE_DIR/" \;

# インシデント対応完了通知
echo "=== セキュリティインシデント初期対応完了 ===" | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"
echo "証拠保全先: $EVIDENCE_DIR" | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"
echo "完了時刻: $(date)" | tee -a "$LOG_DIR/incident-$INCIDENT_ID.log"

# 対応状況をTeamsに報告
curl -X POST "${TEAMS_SECURITY_WEBHOOK}" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"✅ インシデント初期対応完了\\nID: $INCIDENT_ID\\nタイプ: $INCIDENT_TYPE\\n証拠保全完了: $EVIDENCE_DIR\\n次: 詳細調査・根本原因分析\"}"
```

### 7.2 定期メンテナンス手順

#### 週次セキュリティメンテナンス

```bash
#!/bin/bash
# /opt/maintenance/weekly_security_maintenance.sh
# 週次セキュリティメンテナンス自動実行

MAINTENANCE_LOG="/var/log/maintenance/weekly-$(date +%Y%W).log"
mkdir -p $(dirname $MAINTENANCE_LOG)

echo "=== 週次セキュリティメンテナンス開始 ===" | tee -a $MAINTENANCE_LOG
echo "実行日時: $(date)" | tee -a $MAINTENANCE_LOG

# 1. システム更新チェック
echo "1. システム更新チェック..." | tee -a $MAINTENANCE_LOG
apt update && apt list --upgradable | tee -a $MAINTENANCE_LOG

# 2. セキュリティパッチ適用
echo "2. セキュリティパッチ適用..." | tee -a $MAINTENANCE_LOG
unattended-upgrade -d 2>&1 | tee -a $MAINTENANCE_LOG

# 3. 証明書有効期限チェック
echo "3. 証明書有効期限チェック..." | tee -a $MAINTENANCE_LOG
find /etc/ssl/certs -name "*.crt" -exec openssl x509 -in {} -noout -dates -subject \; | tee -a $MAINTENANCE_LOG

# 4. ログローテーション
echo "4. ログローテーション実行..." | tee -a $MAINTENANCE_LOG
logrotate -f /etc/logrotate.conf 2>&1 | tee -a $MAINTENANCE_LOG

# 5. アクセス権限監査
echo "5. アクセス権限監査..." | tee -a $MAINTENANCE_LOG
find /opt/systemboard -type f -perm /o+w -ls | tee -a $MAINTENANCE_LOG

# 6. 不要ファイル・プロセス清理
echo "6. システム清理..." | tee -a $MAINTENANCE_LOG
systemctl --failed | tee -a $MAINTENANCE_LOG
docker system prune -f 2>&1 | tee -a $MAINTENANCE_LOG

# 7. バックアップ整合性確認
echo "7. バックアップ整合性確認..." | tee -a $MAINTENANCE_LOG
az backup job list --resource-group "${RESOURCE_GROUP}-backup" --vault-name $BACKUP_VAULT --status Completed --query "[?contains(name, '$(date -d '7 days ago' +%Y-%m-%d)')].{Name:name, Status:status}" -o table | tee -a $MAINTENANCE_LOG

echo "=== 週次セキュリティメンテナンス完了 ===" | tee -a $MAINTENANCE_LOG
echo "完了時刻: $(date)" | tee -a $MAINTENANCE_LOG

# メンテナンス結果をTeamsに報告
curl -X POST "${TEAMS_OPERATIONS_WEBHOOK}" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"✅ 週次セキュリティメンテナンス完了\\n日時: $(date)\\n詳細ログ: $MAINTENANCE_LOG\"}"
```

---

**文書承認者**: セキュリティエンジニア
**レビュー実施者**: DevOpsエンジニア、システムアーキテクト
**最終更新**: 2025-09-14
**次回レビュー予定**: 2025-10-14

**重要**: 本設定ガイドの各コンフィギュレーションは、実装前に必ずテスト環境での動作確認を実施すること。本番環境適用前にセキュリティエンジニアの承認を得ること。
