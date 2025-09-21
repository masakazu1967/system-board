---
allowed-tools:
  - Bash(git add:*)
  - Bash(git status:*)
  - Bash(git commit:*)
  - Bash(git checkout:*)
  - Bash(git branch:*)
  - Bash(git push:*)
  - Bash(git pull:*)
  - Bash(gh pr create:*)
  - Bash(gh issue:*)
  - Bash(gh issue edit:*)
description: Issue $1 タスクを実行する
---

# Context

Issue $1 はSystem Board プロジェクトにあります。
ドキュメント類は @docs にあります。
ドキュメントを作成する場合は以下の方針に従います。

- 仕様書を作成する場合は、 @docs/spec をベースフォルダとする。
- Issueのラベルからフォルダを限定(system managementの場合はsystem-management)します。
- 親IssueのID(自分のIssueのIDがUS-SM-001-001の場合はUS-SM-001)のファイル名。
- 作業内容の作業は担当で指定されているサブエージェントが行ってください。

1. Issue $1 の状態を In Progress に移動します。
2. 受け入れ条件を満たすように作業内容の作業を行います。
3. 作業が完了したら Issue $1 の変更内容でPRします。
4. Issue $1 の状態を In Review に移動します。
