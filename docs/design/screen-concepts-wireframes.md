# System Board 主要画面コンセプト・ワイヤーフレーム

**バージョン**: 1.0
**作成日**: 2025年9月19日
**作成者**: UX/UI デザイナー
**基盤**: イベントストーミング成果物、ユーザーストーリー、情報アーキテクチャ

---

## 1. 画面設計概要

### 1.1 設計方針

#### ユーザー中心設計

- **日常業務最適化**: システム担当者の日々のワークフローに沿った画面設計
- **緊急対応重視**: CVSS 9.0以上の緊急事項を即座に認識できる視覚設計
- **認知負荷軽減**: 一度に処理する情報量を適切にコントロール

#### 製造業特性対応

- **情報漏洩防止**: 権限に応じた段階的情報開示
- **監査対応**: 全操作の追跡可能性を担保
- **安定性重視**: 誤操作を防ぐ保守的なUI設計

#### Modern Business Application

- **おしゃれで動きがある**: サブトルなアニメーションと洗練されたビジュアル
- **シンプル**: 機能美を追求したミニマルデザイン
- **スケーラブル**: 将来の機能拡張に対応できる柔軟な構造

---

## 2. ダッシュボード画面

### 2.1 画面構成

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header Navigation                                                           │
├─────────┬───────────────────────────────────────────────────┬─────────────────┤
│         │                                                   │                 │
│ Side    │                Main Dashboard                      │ Activity        │
│ Nav     │                                                   │ Panel           │
│         │ ┌─ Hero Alert (CVSS 9.0+) ──────────────────────┐ │                 │
│ ■ Home  │ │ 🚨 緊急: 3件の重大な脆弱性が検出されました      │ │ ■ Recent       │
│ ■ Sys   │ │    [詳細を確認] [Teams通知]                    │ │   Updates       │
│ ■ Vuln  │ └─────────────────────────────────────────────── │ │                 │
│ ■ Task  │                                                   │ ■ Quick         │
│ ■ Rel   │ ┌─ Primary Metrics ──────────┬─ Status Cards ──┐ │   Actions       │
│ ■ Rep   │ │                            │                 │ │                 │
│         │ │ ┌─ Systems ─┐ ┌─ Vulns ──┐ │ ┌─ EOL Soon ──┐ │ ■ Team Status   │
│         │ │ │    24     │ │    88    │ │ │      5      │ │                 │
│         │ │ │ Total     │ │ Active   │ │ │ Systems     │ │ ■ Notifications │
│         │ │ └───────────┘ └──────────┘ │ └─────────────┘ │                 │
│         │ │                            │                 │                 │
│         │ │ ┌─ Tasks ───┐ ┌─ Risk ───┐ │ ┌─ Pending ───┐ │                 │
│         │ │ │     7     │ │   High   │ │ │     12      │ │                 │
│         │ │ │ My Tasks  │ │ Systems  │ │ │ Approvals   │ │                 │
│         │ │ └───────────┘ └──────────┘ │ └─────────────┘ │                 │
│         │ └────────────────────────────┴─────────────────┘ │                 │
│         │                                                   │                 │
│         │ ┌─ Priority Tasks ────────────────────────────────┐ │                 │
│         │ │ ✅ Critical Patch for DB Server (Due: Today)   │ │                 │
│         │ │ ⚠️  Risk Assessment for Web App (Due: 2 days)  │ │                 │
│         │ │ 📋 Monthly Security Review (Due: 5 days)       │ │                 │
│         │ └─────────────────────────────────────────────── │ │                 │
│         │                                                   │                 │
│         │ ┌─ System Health Overview ───────────────────────┐ │                 │
│         │ │ [Chart: Vulnerability Trend]                   │ │                 │
│         │ │ [Chart: System Status Distribution]            │ │                 │
│         │ └─────────────────────────────────────────────── │ │                 │
├─────────┴───────────────────────────────────────────────────┴─────────────────┤
│ Footer: Last Updated: 2025-09-19 09:15 | Status: All Systems Operational    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Hero Alert エリア（緊急対応）

```typescript
interface HeroAlertProps {
  alerts: CriticalAlert[];
  visible: boolean;
}

const HeroAlert: React.FC<HeroAlertProps> = ({ alerts, visible }) => {
  if (!visible || alerts.length === 0) return null;

  return (
    <Alert
      variant="danger"
      className="mb-6 animate-alert-pulse"
      dismissible={false}
      icon={<ExclamationTriangleIcon className="h-6 w-6" />}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold mb-2">
            🚨 緊急対応が必要です
          </h3>
          <p className="text-sm">
            {alerts.length}件の重大な脆弱性（CVSS 9.0以上）が検出されました
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="danger" size="sm">
            詳細を確認
          </Button>
          <Button variant="secondary" size="sm">
            Teams通知
          </Button>
        </div>
      </div>
    </Alert>
  );
};
```

### 2.3 Primary Metrics エリア

```typescript
const MetricsCard: React.FC<{
  title: string;
  value: number;
  trend?: 'up' | 'down' | 'stable';
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  onClick?: () => void;
}> = ({ title, value, trend, subtitle, color = 'blue', onClick }) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50 border-blue-200',
    green: 'text-green-600 bg-green-50 border-green-200',
    yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    red: 'text-red-600 bg-red-50 border-red-200',
  };

  return (
    <Card
      className={`${colorClasses[color]} cursor-pointer transition-all duration-200 hover:scale-105`}
      onClick={onClick}
    >
      <div className="text-center">
        <div className="text-3xl font-bold mb-1">
          {value.toLocaleString()}
        </div>
        <div className="text-sm font-medium mb-2">
          {title}
        </div>
        {subtitle && (
          <div className="text-xs opacity-75">
            {subtitle}
          </div>
        )}
        {trend && (
          <div className="mt-2 flex justify-center">
            <TrendIndicator trend={trend} />
          </div>
        )}
      </div>
    </Card>
  );
};

const DashboardMetrics: React.FC = () => {
  return (
    <Grid cols={4} gap="md">
      <MetricsCard
        title="総システム数"
        value={24}
        trend="stable"
        color="blue"
        onClick={() => navigate('/systems')}
      />
      <MetricsCard
        title="アクティブ脆弱性"
        value={88}
        trend="down"
        subtitle="前週比 -12"
        color={88 > 50 ? 'red' : 'yellow'}
        onClick={() => navigate('/vulnerabilities')}
      />
      <MetricsCard
        title="担当タスク"
        value={7}
        trend="up"
        subtitle="期限内: 5件"
        color="green"
        onClick={() => navigate('/tasks/my')}
      />
      <MetricsCard
        title="リスク高システム"
        value={3}
        trend="stable"
        subtitle="要即時対応"
        color="red"
        onClick={() => navigate('/systems?filter=high-risk')}
      />
    </Grid>
  );
};
```

### 2.4 Activity Panel（右サイドバー）

```typescript
const ActivityPanel: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Recent Updates */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">最新の更新</h3>
        <div className="space-y-3">
          <ActivityItem
            icon="🔄"
            title="CVE-2025-1234 が検出されました"
            subtitle="Production Server"
            time="5分前"
            severity="high"
          />
          <ActivityItem
            icon="✅"
            title="パッチ適用が完了しました"
            subtitle="Web Application Server"
            time="1時間前"
            severity="success"
          />
          <ActivityItem
            icon="⚠️"
            title="EOL警告: Ubuntu 18.04"
            subtitle="Database Server"
            time="3時間前"
            severity="warning"
          />
        </div>
      </Card>

      {/* Quick Actions */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">クイックアクション</h3>
        <div className="space-y-2">
          <Button variant="primary" size="sm" className="w-full">
            システム登録
          </Button>
          <Button variant="secondary" size="sm" className="w-full">
            脆弱性スキャン実行
          </Button>
          <Button variant="ghost" size="sm" className="w-full">
            レポート生成
          </Button>
        </div>
      </Card>

      {/* Team Status */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">チーム状況</h3>
        <div className="space-y-3">
          <TeamMemberStatus
            name="田中太郎"
            avatar="/avatars/tanaka.jpg"
            status="active"
            currentTask="CVE-2025-1234 対応中"
          />
          <TeamMemberStatus
            name="佐藤花子"
            avatar="/avatars/sato.jpg"
            status="busy"
            currentTask="リスク評価作成中"
          />
          <TeamMemberStatus
            name="山田次郎"
            avatar="/avatars/yamada.jpg"
            status="available"
            currentTask="待機中"
          />
        </div>
      </Card>
    </div>
  );
};
```

---

## 3. システム管理画面

### 3.1 システム一覧画面

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Systems Management                                                          │
├─────────┬───────────────────────────────────────────────────────────────────┤
│ Filters │ ┌─ Toolbar ─────────────────────────────────────────────────────┐ │
│         │ │ [🔍 Search] [📁 Filter] [↻ Refresh] [➕ New System]           │ │
│ Status  │ └───────────────────────────────────────────────────────────────┘ │
│ ☑ Active│                                                                   │
│ ☐ Inact │ ┌─ Systems Table ──────────────────────────────────────────────┐ │
│ ☐ EOL   │ │ Name          │ Type    │ Status │ CVSS │ Tasks │ Last Check │ │
│         │ ├───────────────┼─────────┼────────┼──────┼───────┼────────────┤ │
│ Type    │ │ Prod Server   │ Web     │ 🟢     │ 2.3  │ 1     │ 2h ago     │ │
│ ☑ Web   │ │ DB Primary    │ DB      │ 🟡     │ 7.8  │ 3     │ 5h ago     │ │
│ ☑ DB    │ │ Mail Server   │ Mail    │ 🔴     │ 9.1  │ 5     │ 1d ago     │ │
│ ☐ App   │ │ File Server   │ Storage │ 🟢     │ 0.0  │ 0     │ 30m ago    │ │
│         │ │ Dev Server    │ Web     │ 🟢     │ 4.2  │ 2     │ 1h ago     │ │
│ CVSS    │ └───────────────────────────────────────────────────────────────┘ │
│ ☐ 9.0+  │                                                                   │
│ ☑ 7.0+  │ ┌─ Pagination ──────────────────────────────────────────────────┐ │
│ ☐ 4.0+  │ │ Showing 1-10 of 24 systems    [←] [1] 2 3 [→]                │ │
│ ☐ <4.0  │ └───────────────────────────────────────────────────────────────┘ │
└─────────┴───────────────────────────────────────────────────────────────────┘
```

### 3.2 システム詳細画面

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Production Web Server                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─ System Header ───────────────────────────────────────────────────────────┐ │
│ │ 🖥️ Production Web Server                    [Edit] [Validate] [Archive]   │ │
│ │ Type: Web Server | Criticality: 5/5 | Status: 🟢 Active                  │ │
│ │ Host: prod-web-01.company.local | Last Validated: 2 hours ago             │ │
│ └─────────────────────────────────────────────────────────────────────────── │ │
│                                                                               │
│ ┌─ Tab Navigation ──────────────────────────────────────────────────────────┐ │
│ │ [Overview] [Packages(24)] [Vulnerabilities(3)] [Tasks(5)] [Dependencies]  │ │
│ └─────────────────────────────────────────────────────────────────────────── │ │
│                                                                               │
│ ┌─ Overview Tab Content ────────────────────────────────────────────────────┐ │
│ │ ┌─ Quick Stats ─────────┬─ Recent Activity ──────────────────────────────┐ │ │
│ │ │ CPU: 45% (Good)       │ • CVE-2025-1234 detected (3h ago)             │ │ │
│ │ │ Memory: 62% (OK)      │ • Security patch applied (1d ago)             │ │ │
│ │ │ Disk: 78% (Warning)   │ • System validation completed (2d ago)        │ │ │
│ │ │ Network: Normal       │ • Package updated: nginx 1.20.1 (3d ago)      │ │ │
│ │ └───────────────────────┴─────────────────────────────────────────────── │ │ │
│ │                                                                            │ │
│ │ ┌─ Current Vulnerabilities ─────────────────────────────────────────────┐ │ │
│ │ │ 🔴 CVE-2025-1234 | CVSS: 9.1 | Critical | nginx 1.20.1               │ │ │
│ │ │ 🟡 CVE-2025-5678 | CVSS: 6.8 | Medium   | openssl 1.1.1f             │ │ │
│ │ │ 🟡 CVE-2025-9012 | CVSS: 5.4 | Medium   | php 7.4.3                  │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ │                                                                            │ │
│ │ ┌─ Assigned Tasks ──────────────────────────────────────────────────────┐ │ │
│ │ │ ✅ Apply critical patch for CVE-2025-1234 (Due: Today, Assigned: You) │ │ │
│ │ │ 📋 Conduct risk assessment (Due: 2 days, Assigned: Tanaka-san)        │ │ │
│ │ │ 🔍 Verify patch installation (Due: 3 days, Assigned: Sato-san)        │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ └─────────────────────────────────────────────────────────────────────────── │ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 脆弱性管理画面

### 4.1 脆弱性一覧画面

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Vulnerability Management                                                     │
├─────────┬───────────────────────────────────────────────────────────────────┤
│ Filters │ ┌─ Critical Alert Bar ──────────────────────────────────────────┐ │
│         │ │ 🚨 3 Critical Vulnerabilities Require Immediate Attention     │ │
│ Severity│ └───────────────────────────────────────────────────────────────┘ │
│ ☑ Crit  │                                                                   │
│ ☑ High  │ ┌─ Vulnerability Cards ────────────────────────────────────────┐ │
│ ☐ Med   │ │ ┌─ CVE-2025-1234 ──────────────────────────────────────────┐ │ │
│ ☐ Low   │ │ │ 🔴 CVSS: 9.1 | Critical | nginx Remote Code Execution    │ │ │
│         │ │ │ Affected: 3 systems | First Detected: 3 hours ago        │ │ │
│ Status  │ │ │ ⏰ Response Due: 21 hours remaining                       │ │ │
│ ☑ New   │ │ │ [View Details] [Create Task] [Risk Assessment]           │ │ │
│ ☑ Assess│ │ └───────────────────────────────────────────────────────────┘ │ │
│ ☐ Mitig │ │                                                               │ │
│ ☐ Resolv│ │ ┌─ CVE-2025-5678 ──────────────────────────────────────────┐ │ │
│         │ │ │ 🟡 CVSS: 7.8 | High | openssl Denial of Service          │ │ │
│ Systems │ │ │ Affected: 8 systems | First Detected: 1 day ago          │ │ │
│ ☑ Prod  │ │ │ 📋 Status: Risk Assessment In Progress                    │ │ │
│ ☑ Stage │ │ │ [View Details] [Update Status] [Assign Reviewer]         │ │ │
│ ☐ Dev   │ │ └───────────────────────────────────────────────────────────┘ │ │
│         │ │                                                               │ │
│ Date    │ │ ┌─ CVE-2025-9012 ──────────────────────────────────────────┐ │ │
│ [7 days]│ │ │ 🟡 CVSS: 6.8 | Medium | php Information Disclosure       │ │ │
│         │ │ │ Affected: 5 systems | First Detected: 2 days ago         │ │ │
│         │ │ │ 🛠️ Status: Mitigation Plan Created                        │ │ │
│         │ │ │ [View Details] [Execute Plan] [Track Progress]            │ │ │
│         │ │ └───────────────────────────────────────────────────────────┘ │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
└─────────┴───────────────────────────────────────────────────────────────────┘
```

### 4.2 脆弱性詳細画面

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ CVE-2025-1234: nginx Remote Code Execution                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─ Vulnerability Header ────────────────────────────────────────────────────┐ │
│ │ 🔴 CVE-2025-1234                          [Create Task] [Risk Assessment] │ │
│ │ CVSS: 9.1 (Critical) | Vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H │ │
│ │ First Detected: 3 hours ago | Source: NVD API | Status: New              │ │
│ └─────────────────────────────────────────────────────────────────────────── │ │
│                                                                               │
│ ┌─ Tab Navigation ──────────────────────────────────────────────────────────┐ │
│ │ [Overview] [Risk Assessment] [Affected Systems(3)] [Mitigation] [Timeline]│ │
│ └─────────────────────────────────────────────────────────────────────────── │ │
│                                                                               │
│ ┌─ Overview Tab Content ────────────────────────────────────────────────────┐ │
│ │ ┌─ Description ─────────────────────────────────────────────────────────┐ │ │
│ │ │ A remote code execution vulnerability exists in nginx versions       │ │ │
│ │ │ 1.20.0 to 1.20.1 when processing malformed HTTP headers.             │ │ │
│ │ │ An attacker could exploit this vulnerability to execute arbitrary     │ │ │
│ │ │ code on the affected system.                                          │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ │                                                                            │ │
│ │ ┌─ Technical Details ───────────────────────────────────────────────────┐ │ │
│ │ │ • Attack Vector: Network                                               │ │ │
│ │ │ • Attack Complexity: Low                                               │ │ │
│ │ │ • Privileges Required: None                                            │ │ │
│ │ │ • User Interaction: None                                               │ │ │
│ │ │ • Scope: Unchanged                                                     │ │ │
│ │ │ • Confidentiality Impact: High                                         │ │ │
│ │ │ • Integrity Impact: High                                               │ │ │
│ │ │ • Availability Impact: High                                            │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ │                                                                            │ │
│ │ ┌─ Affected Systems ────────────────────────────────────────────────────┐ │ │
│ │ │ 🖥️ Production Web Server (prod-web-01) | nginx 1.20.1 | Critical     │ │ │
│ │ │ 🖥️ Staging Web Server (stage-web-01) | nginx 1.20.1 | High           │ │ │
│ │ │ 🖥️ Load Balancer (lb-01) | nginx 1.20.0 | Critical                   │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ │                                                                            │ │
│ │ ┌─ Recommended Actions ─────────────────────────────────────────────────┐ │ │
│ │ │ 1. Immediately isolate affected systems from external access          │ │ │
│ │ │ 2. Apply emergency patch to nginx version 1.20.2                      │ │ │
│ │ │ 3. Verify WAF rules are blocking malformed HTTP headers               │ │ │
│ │ │ 4. Monitor system logs for exploitation attempts                       │ │ │
│ │ │ 5. Schedule post-patch validation testing                             │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ └─────────────────────────────────────────────────────────────────────────── │ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. タスク管理画面

### 5.1 マイタスク画面

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ My Tasks                                                                     │
├─────────┬───────────────────────────────────────────────────────────────────┤
│ Filters │ ┌─ Task Overview ───────────────────────────────────────────────┐ │
│         │ │ Total: 7 tasks | Due Today: 2 | Overdue: 0 | In Progress: 3  │ │
│ Status  │ └───────────────────────────────────────────────────────────────┘ │
│ ☑ Todo  │                                                                   │
│ ☑ InProg│ ┌─ Priority Tasks ──────────────────────────────────────────────┐ │
│ ☐ Review│ │ ┌─ URGENT ─────────────────────────────────────────────────── │ │ │
│ ☐ Done  │ │ │ 🚨 Apply Critical Patch - CVE-2025-1234                  │ │ │
│         │ │ │ System: Production Web Server | Due: Today 17:00         │ │ │
│ Priority│ │ │ Created: 3 hours ago | Assigned by: System                │ │ │
│ ☑ Urgent│ │ │ [Start Task] [Get Help] [Mark as Blocked]                 │ │ │
│ ☑ High  │ │ └───────────────────────────────────────────────────────── │ │ │
│ ☐ Normal│ │                                                               │ │
│ ☐ Low   │ │ ┌─ HIGH ───────────────────────────────────────────────────── │ │ │
│         │ │ │ ⚠️ Risk Assessment for nginx vulnerability                 │ │ │
│ System  │ │ │ CVE: CVE-2025-1234 | Due: Tomorrow 12:00                 │ │ │
│ ☑ Prod  │ │ │ Created: 4 hours ago | Assigned by: Tanaka-san           │ │ │
│ ☑ Stage │ │ │ [Continue] [Request Extension] [Add Comments]             │ │ │
│ ☐ Dev   │ │ └───────────────────────────────────────────────────────── │ │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
│ Due Date│                                                                   │
│ ☑ Today │ ┌─ Regular Tasks ───────────────────────────────────────────────┐ │
│ ☑ Week  │ │ 📋 Monthly Security Review                                    │ │
│ ☐ Month │ │ Status: In Progress | Due: In 5 days | Progress: 60%         │ │
│         │ │ [Continue] [Update Progress] [View Details]                   │ │
│         │ │                                                               │ │
│         │ │ 🔍 Vulnerability Scan - Development Environment               │ │
│         │ │ Status: Scheduled | Due: In 1 week | Estimated: 2 hours      │ │
│         │ │ [Start Early] [Reschedule] [View Requirements]                │ │
│         │ │                                                               │ │
│         │ │ 📊 Generate Q3 Security Report                                │ │
│         │ │ Status: Todo | Due: In 2 weeks | Assigned: Team              │ │
│         │ │ [Claim Task] [View Template] [Set Reminder]                   │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
└─────────┴───────────────────────────────────────────────────────────────────┘
```

### 5.2 タスク詳細画面

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Apply Critical Patch - CVE-2025-1234                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─ Task Header ─────────────────────────────────────────────────────────────┐ │
│ │ 🚨 Apply Critical Patch - CVE-2025-1234     [Start] [Block] [Escalate]   │ │
│ │ Priority: URGENT | Status: Todo | Assigned: You                          │ │
│ │ Created: 3 hours ago | Due: Today 17:00 (6 hours remaining)              │ │
│ │ Estimated Time: 2 hours | Approval Required: Yes                         │ │
│ └─────────────────────────────────────────────────────────────────────────── │ │
│                                                                               │
│ ┌─ Tab Navigation ──────────────────────────────────────────────────────────┐ │
│ │ [Overview] [Checklist] [Systems(1)] [Approvals] [Comments] [History]     │ │
│ └─────────────────────────────────────────────────────────────────────────── │ │
│                                                                               │
│ ┌─ Overview Tab Content ────────────────────────────────────────────────────┐ │
│ │ ┌─ Description ─────────────────────────────────────────────────────────┐ │ │
│ │ │ Critical security patch must be applied to nginx on Production Web    │ │ │
│ │ │ Server to address CVE-2025-1234 (CVSS: 9.1). This vulnerability      │ │ │
│ │ │ allows remote code execution and must be patched within 24 hours      │ │ │
│ │ │ of detection per security policy.                                     │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ │                                                                            │ │
│ │ ┌─ Pre-requisites ──────────────────────────────────────────────────────┐ │ │
│ │ │ ✅ Backup verification completed                                       │ │ │
│ │ │ ✅ Maintenance window approved (16:00-18:00)                           │ │ │
│ │ │ ⏳ WAF rules deployed (in progress)                                    │ │ │
│ │ │ ❌ Rollback plan reviewed by security team                             │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ │                                                                            │ │
│ │ ┌─ Step-by-Step Instructions ──────────────────────────────────────────┐ │ │
│ │ │ 1. Verify current nginx version (nginx -v)                            │ │ │
│ │ │ 2. Download patch package from repository                             │ │ │
│ │ │ 3. Test patch in staging environment                                  │ │ │
│ │ │ 4. Apply maintenance page during downtime                             │ │ │
│ │ │ 5. Install patch on production server                                 │ │ │
│ │ │ 6. Restart nginx service and verify functionality                     │ │ │
│ │ │ 7. Run post-patch vulnerability scan                                  │ │ │
│ │ │ 8. Update task status and notify security team                        │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ │                                                                            │ │
│ │ ┌─ Related Information ─────────────────────────────────────────────────┐ │ │
│ │ │ • Vulnerability: CVE-2025-1234 [View Details]                         │ │ │
│ │ │ • System: Production Web Server [View System]                         │ │ │
│ │ │ • Patch Notes: nginx 1.20.2 Release Notes [External Link]            │ │ │
│ │ │ • Emergency Contacts: Security Team [Contact Info]                    │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ └─────────────────────────────────────────────────────────────────────────── │ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. 依存関係管理画面

### 6.1 依存関係グラフ画面

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ System Dependency Graph                                                      │
├─────────┬───────────────────────────────────────────────────────────────────┤
│ Controls│ ┌─ Graph Controls ──────────────────────────────────────────────┐ │
│         │ │ [🔍 Zoom In] [🔍 Zoom Out] [📐 Fit to Screen] [💾 Export]    │ │
│ Layout  │ │ Layout: [Force] [Hierarchical] [Circular]                     │ │
│ ● Force │ │ Filter: [All] [Critical Path] [Vulnerabilities Only]         │ │
│ ○ Hier  │ └───────────────────────────────────────────────────────────────┘ │
│ ○ Circle│                                                                   │
│         │ ┌─ Interactive Graph ───────────────────────────────────────────┐ │
│ Filter  │ │                    ┌─[LB-01]─┐                                │ │
│ ☑ All   │ │                    │Load     │                                │ │
│ ☐ Crit  │ │                    │Balancer │                                │ │
│ ☐ Vuln  │ │                    └────┬────┘                                │ │
│         │ │                         │                                     │ │
│ Legend  │ │    ┌─[WEB-01]─┐         │         ┌─[WEB-02]─┐                │ │
│ 🟢 Good │ │    │Prod Web  │◄────────┼────────►│Backup Web│                │ │
│🟡 Warning│ │    │Server    │         │         │Server    │                │ │
│ 🔴 Critical│ │   └─────┬────┘         │         └─────┬────┘                │ │
│         │ │           │              │               │                     │ │
│ Nodes   │ │           ▼              ▼               ▼                     │ │
│ Systems │ │    ┌─[DB-01]──┐   ┌─[CACHE-01]─┐ ┌─[FILE-01]─┐               │ │
│ Services│ │    │Database  │   │Redis Cache │ │File Server│               │ │
│ Data    │ │    │Primary   │   │            │ │           │               │ │
│         │ │    └─────┬────┘   └────────────┘ └───────────┘               │ │
│ Selected│ │           │                                                   │ │
│ WEB-01  │ │           ▼                                                   │ │
│         │ │    ┌─[DB-02]──┐                                               │ │
│ Details │ │    │Database  │                                               │ │
│ Name: Prod│ │   │Backup    │                                               │ │
│ Type: Web│ │    └──────────┘                                               │ │
│ Status:🟡│ │                                                               │ │
│ Vulns: 3 │ │                                                               │ │
│ Depends: 2│ │                                                               │ │
│ Tasks: 1 │ │                                                               │ │
└─────────┴───────────────────────────────────────────────────────────────────┘
```

### 6.2 影響分析画面

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Impact Analysis: Production Web Server Maintenance                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─ Analysis Header ─────────────────────────────────────────────────────────┐ │
│ │ Analyzing Impact: Production Web Server (WEB-01) Maintenance             │ │
│ │ Change Type: Security Patch | Estimated Downtime: 30 minutes             │ │
│ │ Scheduled: Today 16:00-16:30 | Impact Level: High                        │ │
│ └─────────────────────────────────────────────────────────────────────────── │ │
│                                                                               │
│ ┌─ Direct Impact ───────────────────────────────────────────────────────────┐ │
│ │ ┌─ Immediately Affected Systems ───────────────────────────────────────┐ │ │
│ │ │ 🔴 Load Balancer (LB-01)                                             │ │ │
│ │ │    Impact: Service interruption during patch window                  │ │ │
│ │ │    Mitigation: Redirect traffic to backup web server                 │ │ │
│ │ │                                                                       │ │ │
│ │ │ 🟡 Application Services (APP-01, APP-02)                             │ │ │
│ │ │    Impact: Temporary session loss for active users                   │ │ │
│ │ │    Mitigation: Enable session persistence on backup server           │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ └─────────────────────────────────────────────────────────────────────────── │ │
│                                                                               │
│ ┌─ Cascade Impact ──────────────────────────────────────────────────────────┐ │
│ │ ┌─ Secondary Effects ───────────────────────────────────────────────────┐ │ │
│ │ │ 🟡 Database Connections (DB-01)                                      │ │ │
│ │ │    Impact: Reduced connection pool during failover                   │ │ │
│ │ │    Risk Level: Medium | Estimated Duration: 5 minutes                │ │ │
│ │ │                                                                       │ │ │
│ │ │ 🟡 Monitoring Systems (MON-01)                                       │ │ │
│ │ │    Impact: Alert notifications during planned maintenance            │ │ │
│ │ │    Risk Level: Low | Action: Suppress alerts 15:50-16:40            │ │ │
│ │ │                                                                       │ │ │
│ │ │ 🟢 Backup Systems                                                    │ │ │
│ │ │    Impact: Increased load but within capacity                        │ │ │
│ │ │    Risk Level: Low | No action required                              │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ └─────────────────────────────────────────────────────────────────────────── │ │
│                                                                               │
│ ┌─ Business Impact ─────────────────────────────────────────────────────────┐ │
│ │ ┌─ Affected Services ───────────────────────────────────────────────────┐ │ │
│ │ │ • Customer Portal: Partial availability (backup server)              │ │ │
│ │ │ • API Services: Full availability (load balancer failover)           │ │ │
│ │ │ • Internal Tools: Temporary access interruption                      │ │ │
│ │ │ • Reporting System: No impact (scheduled maintenance window)         │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ │                                                                            │ │
│ │ ┌─ Recommended Actions ─────────────────────────────────────────────────┐ │ │
│ │ │ 1. ✅ Notify customer service team (completed)                        │ │ │
│ │ │ 2. ⏳ Update status page with maintenance notice                       │ │ │
│ │ │ 3. ❌ Configure load balancer for automatic failover                  │ │ │
│ │ │ 4. ❌ Verify backup web server capacity and functionality             │ │ │
│ │ │ 5. ❌ Prepare rollback plan in case of issues                         │ │ │
│ │ └─────────────────────────────────────────────────────────────────────── │ │ │
│ └─────────────────────────────────────────────────────────────────────────── │ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. レポート・分析画面

### 7.1 セキュリティレポート画面

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Security Report - September 2025                                            │
├─────────┬───────────────────────────────────────────────────────────────────┤
│ Filters │ ┌─ Report Header ───────────────────────────────────────────────┐ │
│         │ │ Period: Sep 1-19, 2025 | Generated: 2025-09-19 09:30         │ │
│ Period  │ │ [📊 Export PDF] [📈 Excel] [📧 Email] [🔄 Refresh]            │ │
│ ● Month │ └───────────────────────────────────────────────────────────────┘ │
│ ○ Week  │                                                                   │
│ ○ Custom│ ┌─ Executive Summary ────────────────────────────────────────────┐ │
│         │ │ ┌─ Key Metrics ─────────────────────────────────────────────┐ │ │
│ Systems │ │ │ Total Systems: 24  │ Total Vulnerabilities: 88            │ │ │
│ ☑ All   │ │ │ High Risk: 3       │ Patched This Month: 156             │ │ │
│ ☐ Prod  │ │ │ EOL Warning: 5     │ Average Response: 2.1 days          │ │ │
│ ☐ Stage │ │ └───────────────────────────────────────────────────────────┘ │ │
│         │ │                                                               │ │
│ Sections│ │ ┌─ Trend Charts ────────────────────────────────────────────┐ │ │
│ ☑ Summary│ │ │ [Chart: Vulnerability Discovery Trend]                   │ │ │
│ ☑ Trends │ │ │ [Chart: Response Time Metrics]                           │ │ │
│ ☑ Systems│ │ │ [Chart: System Risk Distribution]                        │ │ │
│ ☑ Vulns │ │ └───────────────────────────────────────────────────────────┘ │ │
│ ☑ Tasks │ └───────────────────────────────────────────────────────────────┘ │
│ ☐ Risks │                                                                   │
│         │ ┌─ Critical Issues ──────────────────────────────────────────────┐ │
│ Export  │ │ 🚨 Issues Requiring Immediate Attention                       │ │
│ ● PDF   │ │                                                               │ │
│ ○ Excel │ │ • CVE-2025-1234: nginx RCE (3 systems affected)              │ │
│ ○ CSV   │ │   Status: Patch available, deployment in progress            │ │
│         │ │   ETA: Today 17:00                                           │ │
│         │ │                                                               │ │
│         │ │ • Ubuntu 18.04 EOL Warning (5 systems)                       │ │
│         │ │   Status: Migration plan under review                        │ │
│         │ │   Target: Q4 2025                                            │ │
│         │ │                                                               │ │
│         │ │ • Database Server High CPU Usage (DB-01)                     │ │
│         │ │   Status: Performance optimization scheduled                 │ │
│         │ │   Target: Next maintenance window                            │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
│         │                                                                   │
│         │ ┌─ Compliance Status ────────────────────────────────────────────┐ │
│         │ │ ✅ OWASP Top 10: Compliant (Last Review: Sep 15)              │ │
│         │ │ ✅ ISO 27001: Compliant (Next Audit: Dec 2025)               │ │
│         │ │ ⚠️  PCI DSS: Minor findings (Remediation: Oct 31)             │ │
│         │ │ ✅ Internal Security Policy: Compliant                        │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
└─────────┴───────────────────────────────────────────────────────────────────┘
```

---

## 8. モバイル・レスポンシブ対応

### 8.1 モバイルダッシュボード

```text
┌─────────────────────┐
│ ☰ System Board     │
├─────────────────────┤
│ 🚨 Critical Alert   │
│ 3 urgent vulns      │
│ [View All]          │
├─────────────────────┤
│ ┌─ Quick Stats ───┐ │
│ │ 24    88    7   │ │
│ │ Sys   Vul  Task │ │
│ └─────────────────┘ │
├─────────────────────┤
│ Today's Tasks       │
│ ✅ Patch DB Server  │
│ ⏰ Risk Assessment  │
│ 📋 Security Review  │
│ [View All Tasks]    │
├─────────────────────┤
│ Recent Activity     │
│ • CVE detected (3h) │
│ • Patch applied (1d)│
│ • Scan completed    │
│ [View All Updates]  │
├─────────────────────┤
│ [🖥️] [🛡️] [✅] [📊] │
│ Sys   Vul  Task Rep│
└─────────────────────┘
```

### 8.2 モバイルナビゲーション

```typescript
const MobileBottomNav: React.FC = () => {
  const { pathname } = useLocation();

  const navItems = [
    { path: '/', icon: '📊', label: 'ホーム' },
    { path: '/systems', icon: '🖥️', label: 'システム' },
    { path: '/vulnerabilities', icon: '🛡️', label: '脆弱性', badge: 3 },
    { path: '/tasks', icon: '✅', label: 'タスク', badge: 7 },
    { path: '/reports', icon: '📈', label: 'レポート' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden">
      <div className="flex justify-around py-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`
              flex flex-col items-center px-3 py-1 text-xs
              ${pathname === item.path
                ? 'text-primary-blue'
                : 'text-gray-500'
              }
            `}
          >
            <div className="relative">
              <span className="text-lg">{item.icon}</span>
              {item.badge && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="mt-1">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};
```

---

## 9. アニメーション・インタラクション仕様

### 9.1 ページ遷移アニメーション

```css
/* ページ間遷移 */
.page-transition-enter {
  opacity: 0;
  transform: translateX(20px);
}

.page-transition-enter-active {
  opacity: 1;
  transform: translateX(0);
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.page-transition-exit {
  opacity: 1;
  transform: translateX(0);
}

.page-transition-exit-active {
  opacity: 0;
  transform: translateX(-20px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}
```

### 9.2 コンポーネントアニメーション

```typescript
// カードホバーエフェクト
const AnimatedCard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="group">
      <Card className="transition-all duration-200 group-hover:shadow-lg group-hover:-translate-y-1">
        {children}
      </Card>
    </div>
  );
};

// データ更新時のハイライト
const useDataHighlight = (data: any) => {
  const [isHighlighted, setIsHighlighted] = useState(false);

  useEffect(() => {
    setIsHighlighted(true);
    const timer = setTimeout(() => setIsHighlighted(false), 1000);
    return () => clearTimeout(timer);
  }, [data]);

  return isHighlighted;
};

// ローディング状態のスケルトン
const SkeletonLoader: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`animate-pulse bg-gray-300 rounded ${className}`}>
      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
    </div>
  );
};
```

---

## 10. アクセシビリティ配慮

### 10.1 キーボードナビゲーション

```typescript
// ショートカットキー定義
const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'k':
            event.preventDefault();
            openGlobalSearch();
            break;
          case '1':
            event.preventDefault();
            navigateTo('/');
            break;
          case '2':
            event.preventDefault();
            navigateTo('/systems');
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
};
```

### 10.2 スクリーンリーダー対応

```html
<!-- 状態変更の通知 -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
  <!-- 動的に更新される状態通知 -->
</div>

<!-- 緊急アラートの通知 -->
<div aria-live="assertive" aria-atomic="true" class="sr-only">
  <!-- 緊急事項の通知 -->
</div>

<!-- データテーブルの説明 -->
<table aria-describedby="table-description">
  <caption id="table-description">
    システム一覧。各行にはシステム名、状態、脆弱性スコアが含まれます。
  </caption>
</table>
```

---

この画面コンセプト・ワイヤーフレームにより、System Board の全画面で統一感のある「おしゃれで動きがあるシンプル」なユーザーインターフェースを実現します。製造業のセキュリティ要件を満たしながら、現代的で使いやすいビジネスアプリケーションとしての品質を確保しています。
