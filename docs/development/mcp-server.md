# MCP Server候補

## 概要

Model Context Protocol (MCP) は、AIシステムと外部データソース・ツール間の標準化されたセキュアな接続を可能にするオープンスタンダードです。2024年11月にAnthropic社によって導入され、2025年には業界全体で急速に採用が進んでいます。

## 開発・運用でのMCP Server候補

### 1. コード開発・バージョン管理

#### GitHub MCP Server

- **用途**: リポジトリ管理、プルリクエスト、イシュー管理
- **対象ロール**: 全開発チーム、プロダクトマネージャー
- **使用場面**: コードレビュー、リリース管理、バックログ管理

#### GitLab MCP Server  

- **用途**: DevOpsワークフロー、CI/CD統合
- **対象ロール**: DevOpsエンジニア、バックエンドエンジニア
- **使用場面**: パイプライン管理、デプロイ自動化

#### CircleCI MCP Server

- **用途**: ビルド失敗の自動修正、CI/CDパイプライン管理
- **対象ロール**: DevOpsエンジニア、全開発チーム
- **使用場面**: ビルドエラー解決、テスト自動化

#### CodeLogic MCP Server

- **用途**: コード依存関係分析、アーキテクチャリスク評価
- **対象ロール**: アーキテクト、バックエンドエンジニア
- **使用場面**: リファクタリング、技術的負債管理

#### Context7 MCP Server

- **用途**: リアルタイム最新ドキュメント・コード例取得
- **対象ロール**: 全開発チーム
- **使用場面**: ライブラリ学習、APIドキュメント参照、コード生成
- **特徴**: バージョン固有のドキュメント、ハルシネーション防止
- **要件**: Node.js v18.0.0+
- **提供**: Upstash（無料・オープンソース）

#### Serena MCP Server

- **用途**: セマンティックコード検索・編集、IDE機能提供
- **対象ロール**: 全開発チーム
- **使用場面**: コードナビゲーション、リファクタリング、コード分析
- **特徴**: 20以上の言語対応、LSP統合、ローカル実行
- **要件**: Python環境、言語サーバー
- **提供**: Oraios AI（無料・オープンソース・MIT）

### 2. インフラストラクチャ・コンテナ管理

#### Docker MCP Server

- **用途**: コンテナ、イメージ、ボリューム、ネットワーク管理
- **対象ロール**: DevOpsエンジニア、バックエンドエンジニア
- **使用場面**: 開発環境構築、デプロイメント

#### Kubernetes MCP Server (k8m/kom)

- **用途**: マルチクラスター管理、DevOps運用
- **対象ロール**: DevOpsエンジニア
- **使用場面**: スケーリング、モニタリング、運用自動化
- **特徴**: 50以上の組み込みツール提供

#### AWS Lambda/ECS/EKS MCP Server

- **用途**: AWSサーバーレス・コンテナサービス管理
- **対象ロール**: DevOpsエンジニア、アーキテクト
- **使用場面**: クラウドインフラ管理、コスト最適化

### 3. データベース・データ管理

#### Prisma Postgres MCP Server

- **用途**: データベース管理、マイグレーション、クエリ実行
- **対象ロール**: データベースエンジニア、バックエンドエンジニア
- **使用場面**: スキーマ変更、データ分析、パフォーマンス最適化

#### Supabase MCP Server

- **用途**: リアルタイムデータベース操作、ユーザー管理
- **対象ロール**: バックエンドエンジニア、データベースエンジニア
- **使用場面**: SQLクエリ作成、スキーマ探索、データ操作

#### Redis MCP Server

- **用途**: キャッシュ管理、セッション管理
- **対象ロール**: バックエンドエンジニア
- **使用場面**: パフォーマンス最適化、データキャッシュ戦略

### 4. テスト・品質管理

#### Playwright MCP Server

- **用途**: ブラウザ自動化・テスト、UI/UXリサーチ
- **対象ロール**: テストエンジニア、UX/UIデザイナー、フロントエンドエンジニア
- **使用場面**: ユーザビリティテストの自動化、A/Bテスト実行、レスポンシブデザインテスト、アクセシビリティチェック
- **特徴**: Chrome、Firefox、Safari、Edge対応、AIエージェントによる構造化ブラウザ操作

#### Node.js Code Sandbox MCP Server

- **用途**: 隔離されたJavaScript実行環境、テスト環境
- **対象ロール**: テストエンジニア、フロントエンドエンジニア
- **使用場面**: コードスニペットテスト、プロトタイピング

#### Terminal Access MCP Server

- **用途**: セキュアなローカルターミナルアクセス、ログ検査
- **対象ロール**: DevOpsエンジニア、全開発チーム
- **使用場面**: デバッグ、システム監視、ログ分析

### 5. セキュリティ・認証

#### Auth0 MCP Server

- **用途**: ID管理、認証・認可システム統合
- **対象ロール**: セキュリティエンジニア、バックエンドエンジニア
- **使用場面**: ユーザー認証、アクセス制御、セキュリティ監査

#### Burp Suite MCP Server

- **用途**: ウェブアプリケーション脆弱性テスト
- **対象ロール**: セキュリティエンジニア
- **使用場面**: ペネトレーションテスト、セキュリティ監査

### 6. 設計・ドキュメント

#### Mermaid MCP Server

- **用途**: 動的な図表・チャート生成
- **対象ロール**: アーキテクト、UX/UIデザイナー
- **使用場面**: システム設計図、フローチャート作成

#### Unity MCP Server

- **用途**: Unity3dゲームエンジン統合（該当する場合）
- **対象ロール**: フロントエンドエンジニア（ゲーム開発時）
- **使用場面**: ゲーム開発、3Dビジュアライゼーション

### 7. UX/UI開発

#### Figma MCP Server

- **用途**: Figma設計からReactコンポーネント変換、デザインシステム統合
- **対象ロール**: UX/UIデザイナー、フロントエンドエンジニア
- **使用場面**: デザインtoコード変換、コンポーネントライブラリ維持、プロトタイピング高速化
- **特徴**: 自然言語によるFigma操作、Design Mode連携

#### Magic UI MCP Server

- **用途**: AI駆動UI コンポーネント生成、自然言語によるUI開発
- **対象ロール**: UX/UIデザイナー、フロントエンドエンジニア
- **使用場面**: モダンUIコンポーネント即座生成、IDE統合開発ワークフロー
- **特徴**: 最小エラーでのコード生成、IDE シームレス統合

#### Material UI MCP Server

- **用途**: Material UI公式ドキュメント・コード例直接参照
- **対象ロール**: フロントエンドエンジニア、UX/UIデザイナー  
- **使用場面**: Material UIコンポーネント実装、最新ドキュメント参照
- **特徴**: 公式ドキュメント正確性、リアルタイム更新

### 8. コミュニケーション・プロジェクト管理

#### Slack MCP Server

- **用途**: チーム内コミュニケーション自動化
- **対象ロール**: 全チーム
- **使用場面**: 進捗報告自動化、アラート通知

#### Email MCP Server

- **用途**: Gmail、Outlook等での自動メール送信
- **対象ロール**: 全チーム
- **使用場面**: ステークホルダー報告、リリース通知

#### Zapier MCP Server

- **用途**: 8,000以上のアプリケーション連携
- **対象ロール**: 全チーム
- **使用場面**: ワークフロー自動化、データ連携

## 導入優先度

### 高優先度（即座に導入検討）

1. **Context7 MCP Server** - 全チーム向け最新ドキュメント参照
2. **Serena MCP Server** - IDE機能とコード分析
3. **GitHub MCP Server** - 既存のGit戦略との統合
4. **Docker MCP Server** - コンテナ化開発環境
5. **Prisma Postgres MCP Server** - データベース管理
6. **CircleCI MCP Server** - CI/CD自動化

### 中優先度（プロジェクト進行に合わせて導入）

1. **Playwright MCP Server** - UX/UI テスト自動化時
2. **Figma MCP Server** - デザインシステム実装時
3. **Kubernetes MCP Server** - 本番環境スケーリング時
4. **Auth0 MCP Server** - 認証機能実装時
5. **Mermaid MCP Server** - ドキュメント自動生成
6. **Terminal Access MCP Server** - デバッグ・運用時

### 低優先度（必要に応じて導入）

1. **Magic UI MCP Server** - UIコンポーネント生成強化時
2. **Material UI MCP Server** - Material UI採用時
3. **Slack MCP Server** - チーム規模拡大時
4. **Zapier MCP Server** - 外部サービス連携時
5. **Burp Suite MCP Server** - セキュリティテスト強化時

## セキュリティ考慮事項

2025年6月の最新アップデートにより、MCP ServerのAuthorization処理とResource Indicatorsの実装が強化されました。以下の点に注意：

- プロンプトインジェクション対策
- ツール権限の適切な管理
- 信頼できるツールの識別
- アクセストークンの安全な管理

## Context7の導入・使用方法

### 前提条件

- Node.js v18.0.0以上
- npm または pnpm
- Upstash無料アカウント（API Key取得のため）

### API Key取得

1. [Upstash](https://upstash.com) にアクセスしてアカウント作成
2. Context7サービスでAPI Keyを取得（無料利用可能）

### インストール

```bash
claude mcp add context7 -s project -- npx -y @upstash/context7-mcp
```

#### 環境変数設定（オプション）

API Keyを環境変数で管理する場合：

```bash
# .envファイルまたはシェル設定に追加
export CONTEXT7_API_KEY=your_api_key_here
```

設定ファイルでは環境変数を参照：

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp", "--api-key", "${CONTEXT7_API_KEY}"],
      "env": {
        "CONTEXT7_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### 使用方法

プロンプトに `use context7` を含めるだけで、最新のライブラリドキュメントが自動的にコンテキストに注入されます。

### 利用可能なツール

- `resolve-library-id`: ライブラリ名をContext7互換IDに変換
- `get-library-docs`: 特定のライブラリのドキュメントを取得

## Serenaの導入・使用方法

### 前提条件(Serena)

- Python 3.8以上
- uv（Python パッケージインストーラー）

### uvインストール

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Serenaインストール

```bash
claude mcp add serena -s project -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project $(pwd)
```

### 機能

- **セマンティック検索**: コードベース全体の意味的検索
- **シンボルレベル編集**: 関数・クラス単位での精密な編集
- **マルチ言語対応**: Python, TypeScript, Java, Ruby, Go, C#など20以上
- **LSP統合**: Language Server Protocolによる正確な解析
- **プライバシー重視**: ローカル実行、サードパーティサーバー不要

## 次のステップ

1. **Context7 & Serena MCP Server**から導入開始（無料・即時利用可能）
2. 高優先度のMCP Serverから段階的に導入
3. 各Serverの設定・認証情報管理
4. チーム向けの利用ガイドライン策定
5. セキュリティポリシーとの整合性確認
