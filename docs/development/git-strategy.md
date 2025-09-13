# Git戦略

## 概要

本プロジェクトでは、シンプルで効率的な開発フローを実現するため、**GitHub Flow**を採用します。

## GitHub Flow

### 基本原則

1. **main ブランチは常にデプロイ可能な状態を保つ**
2. **機能開発は feature ブランチで行う**
3. **Pull Request を通じてコードレビューを実施する**
4. **CI/CD パイプラインによる自動テスト・デプロイを活用する**

### ブランチ構成

#### main ブランチ

- **役割**: プロダクション環境にデプロイされる安定版コード
- **保護**: 直接的な push は禁止、Pull Request経由でのみマージ可能
- **品質基準**:
  - 全テストが通過済み
  - コードレビュー完了済み
  - セキュリティチェック完了済み

#### feature ブランチ

- **命名規則**: `feature/issue-番号-簡潔な説明`
- **例**: `feature/123-user-authentication`
- **作成元**: main ブランチから分岐
- **ライフサイクル**: 機能開発完了後に削除

### ワークフロー

#### 1. 新機能開発開始

```bash
# 最新のmainブランチをpull
git checkout main
git pull origin main

# feature ブランチ作成
git checkout -b feature/123-user-authentication
```

#### 2. 開発・コミット

```bash
# 変更をステージング
git add .

# コミット（コミットメッセージはConventional Commitsに従う）
git commit -m "feat: add user authentication logic"

# リモートにpush
git push origin feature/123-user-authentication
```

#### 3. Pull Request 作成

**Pull Request要件**:

- **タイトル**: 簡潔で分かりやすい変更内容
- **説明**:
  - 変更内容の詳細
  - 関連するIssue番号
  - テスト実行結果
  - スクリーンショット（UI変更がある場合）

**テンプレート例**:

```markdown
## 概要
ユーザー認証機能を実装

## 変更内容
- [ ] ログイン機能の実装
- [ ] JWT トークン生成・検証
- [ ] パスワードハッシュ化

## 関連Issue
Closes #123

## テスト
- [ ] 単体テスト実行済み
- [ ] 結合テスト実行済み
- [ ] 手動テスト実行済み

## チェックリスト
- [ ] コードレビュー準備完了
- [ ] ドキュメント更新済み
- [ ] セキュリティチェック完了
```

#### 4. コードレビュー

**レビュー観点**:

- **機能性**: 要件を満たしているか
- **保守性**: コードの可読性・拡張性
- **性能**: パフォーマンスへの影響
- **セキュリティ**: 脆弱性の有無
- **テスト**: テストカバレッジ・品質

**レビュー基準**:

- 最低2名のレビュー承認が必要
- アーキテクト承認が必要（アーキテクチャ変更がある場合）
- **セキュリティエンジニア承認が必要**（全PR対象、セキュリティ観点でのレビュー）
- **テストエンジニア承認が必要**（開発エンジニアが作成したテストの品質・カバレッジレビュー）

#### 5. CI/CD実行

**自動実行項目**:

- 静的コード解析
- 単体テスト・結合テスト
- **OWASP Top 10セキュリティチェック**
  - 静的セキュリティ分析（SonarQube、ESLintセキュリティプラグイン、Bandit）
  - 依存関係脆弱性チェック（Snyk、npm audit、pip audit）
  - 動的セキュリティテスト（OWASP ZAP）
  - APIセキュリティテスト（Postman Security Tests、REST Assured）
  - 認証・認可テスト（JWT検証、アクセス制御）
- ビルド検証
- デプロイテスト（ステージング環境）

#### 6. マージ・デプロイ

**マージ権限**:

- **プロダクトマネージャー**が最終的なマージ権限を持つ
- マージ実行条件:
  - 全てのレビュアーからの承認完了
  - CI/CDパイプライン全工程成功
  - 品質ゲート条件すべてクリア
  - セキュリティエンジニア承認済み
  - テストエンジニア承認済み

**マージ手順**:

```bash
# Pull Request
# 開発環境に反映

# mainブランチにマージ
# GitHub上でSquash and Mergeを実行
# ステージング環境に反映

# mainブランチにtagをプッシュ
# プロダクション環境に反映
```

#### 7. ブランチクリーンアップ

```bash
# マージ後のfeature ブランチ削除
git branch -d feature/123-user-authentication
git push origin --delete feature/123-user-authentication
```

### コミットメッセージ規約

**Conventional Commits**を採用:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Type一覧**:

- `feat`: 新機能追加
- `fix`: バグ修正
- `docs`: ドキュメント更新
- `style`: コードフォーマット変更
- `refactor`: リファクタリング
- `perf`: パフォーマンス改善
- `test`: テスト追加・修正
- `chore`: ビルド・補助ツール変更

**例**:

```text
feat(auth): add JWT token validation
fix(api): resolve user data serialization issue
docs: update API documentation for user endpoints
```

### 緊急対応（Hotfix）

**緊急バグ修正の場合**:

```bash
# mainブランチから直接hotfixブランチ作成
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-fix

# 修正実装・テスト
# 省略可能な工程: 
# - 詳細な設計レビュー
# - 複数人でのコードレビュー（緊急時は1名でも可）

# Pull Request作成（緊急フラグ付与）
# マージ後即座にプロダクションデプロイ
```

### 品質ゲート

**マージ前必須チェック**:

- [ ] CI/CDパイプライン全工程成功
- [ ] コードレビュー承認済み
- [ ] テストカバレッジ80%以上維持
- [ ] **OWASP Top 10セキュリティチェック通過**
- [ ] セキュリティエンジニア承認済み（全PR必須）
- [ ] テストエンジニア承認済み（開発エンジニア作成テストの品質確認）
- [ ] パフォーマンス基準クリア

**自動ブロック条件**:

- テスト失敗
- 静的解析エラー
- **OWASP Top 10脆弱性検出**
- セキュリティ脆弱性検出
- ビルド失敗

### ツール連携

**GitHub機能活用**:

- **Branch Protection Rules**: mainブランチ保護設定
- **Required Status Checks**: CI/CD必須チェック
- **CODEOWNERS**: 自動レビュアー指定（セキュリティエンジニア、テストエンジニアを必須レビュアーに設定）
- **GitHub Actions**: CI/CDパイプライン自動実行

**外部ツール連携**:

- **Discord**: Pull Request通知・レビュー依頼
- **SonarQube**: コード品質分析
- **Snyk**: セキュリティ脆弱性検査

### メトリクス・KPI

**追跡指標**:

- **Lead Time**: Issue作成からデプロイまでの時間
- **Deployment Frequency**: デプロイ頻度
- **Change Failure Rate**: 変更による障害率
- **Mean Time to Recovery**: 障害復旧時間

**目標値**:

- Lead Time: 平均3日以内
- Deployment Frequency: 週1回以上
- Change Failure Rate: 5%以下
- MTTR: 2時間以内

## 運用ルール

### チーム運用

1. **feature ブランチは小さく保つ**（300行以下推奨）
2. **Pull Requestは24時間以内にレビュー開始**
3. **マージ後は即座にfeature ブランチ削除**
4. **定期的なmainブランチ同期**（週1回以上）

### 例外対応

- **緊急リリース**: hotfixブランチ使用
- **実験的機能**: feature flagを活用したトランクベース開発
- **長期機能開発**: 定期的なmainブランチマージで同期維持
