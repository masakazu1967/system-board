# System Board 情報アーキテクチャ設計

**バージョン**: 1.0
**作成日**: 2025年9月19日
**作成者**: UX/UI デザイナー
**基盤**: イベントストーミング Phase1-4 成果物、ユーザーストーリー分析

---

## 1. 情報アーキテクチャ概要

### 1.1 設計原則

#### ユーザー中心設計

- **タスクベース**: 日常業務フローに沿った情報配置
- **緊急度優先**: CVSS 9.0以上の緊急事項を最優先表示
- **認知負荷軽減**: 一画面あたりの情報密度を適切に制御

#### 製造業セキュリティ特性

- **情報漏洩防止**: 機密度に応じたアクセス制御設計
- **監査証跡**: 全操作の追跡可能性を確保
- **信頼性重視**: エラー防止を優先した保守的な設計

#### スケーラビリティ

- **段階的開示**: 詳細情報は必要時のみ表示
- **柔軟な拡張**: 新機能追加に対応できる構造
- **パフォーマンス**: 5-10ユーザーでの快適な操作性

---

## 2. サイトマップ・画面階層

### 2.1 メイン階層構造

```text
System Board
├── 📊 ダッシュボード (/)
│   ├── システム状況概要
│   ├── 緊急対応要項目
│   ├── 週間サマリー
│   └── 重要通知
│
├── 🖥️ システム管理 (/systems)
│   ├── システム一覧 (/systems)
│   ├── システム詳細 (/systems/:id)
│   ├── システム登録 (/systems/new)
│   ├── システム編集 (/systems/:id/edit)
│   ├── ホスト管理 (/systems/hosts)
│   └── パッケージ管理 (/systems/packages)
│
├── 🛡️ 脆弱性管理 (/vulnerabilities)
│   ├── 脆弱性一覧 (/vulnerabilities)
│   ├── 脆弱性詳細 (/vulnerabilities/:id)
│   ├── リスク評価 (/vulnerabilities/risk-assessment)
│   ├── 緩和計画 (/vulnerabilities/mitigation)
│   └── 脆弱性スキャン (/vulnerabilities/scan)
│
├── ✅ タスク管理 (/tasks)
│   ├── マイタスク (/tasks/my)
│   ├── チームタスク (/tasks/team)
│   ├── タスク詳細 (/tasks/:id)
│   ├── ワークフロー (/tasks/workflows)
│   └── エスカレーション (/tasks/escalations)
│
├── 🔗 依存関係管理 (/relationships)
│   ├── 依存関係グラフ (/relationships/graph)
│   ├── 影響分析 (/relationships/impact-analysis)
│   ├── 依存関係一覧 (/relationships/list)
│   └── システムマップ (/relationships/system-map)
│
├── 📈 レポート・分析 (/reports)
│   ├── セキュリティレポート (/reports/security)
│   ├── システム状況レポート (/reports/systems)
│   ├── タスク実績レポート (/reports/tasks)
│   └── カスタムレポート (/reports/custom)
│
└── ⚙️ 設定・管理 (/admin)
    ├── ユーザー管理 (/admin/users)
    ├── 権限設定 (/admin/permissions)
    ├── 通知設定 (/admin/notifications)
    ├── システム設定 (/admin/system)
    └── 監査ログ (/admin/audit)
```

### 2.2 アクセス権限マトリックス

| 画面/機能 | システム担当者 | 情報システム管理者 | 経営陣 | 監査担当者 |
|---|---|---|---|---|
| ダッシュボード | ✅ 全表示 | ✅ 全表示 | ✅ サマリーのみ | ✅ 監査項目のみ |
| システム管理 | ✅ 読取・編集 | ✅ 全権限 | ❌ | ✅ 読取のみ |
| 脆弱性管理 | ✅ 読取・編集 | ✅ 全権限 | ✅ 読取のみ | ✅ 読取のみ |
| タスク管理 | ✅ 自分のタスク | ✅ 全タスク | ✅ サマリーのみ | ✅ 読取のみ |
| 依存関係管理 | ✅ 読取・編集 | ✅ 全権限 | ✅ 読取のみ | ✅ 読取のみ |
| レポート・分析 | ✅ 標準レポート | ✅ 全レポート | ✅ 経営レポート | ✅ 監査レポート |
| 設定・管理 | ❌ | ✅ 全権限 | ❌ | ✅ 監査ログのみ |

---

## 3. ナビゲーション設計

### 3.1 プライマリナビゲーション

#### グローバルナビゲーション（ヘッダー）

```typescript
interface GlobalNavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
  children?: NavItem[];
}

const globalNavigation: GlobalNavItem[] = [
  {
    id: 'dashboard',
    label: 'ダッシュボード',
    path: '/',
    icon: '📊',
  },
  {
    id: 'systems',
    label: 'システム管理',
    path: '/systems',
    icon: '🖥️',
    children: [
      { label: 'システム一覧', path: '/systems' },
      { label: 'ホスト管理', path: '/systems/hosts' },
      { label: 'パッケージ管理', path: '/systems/packages' },
    ],
  },
  {
    id: 'vulnerabilities',
    label: '脆弱性管理',
    path: '/vulnerabilities',
    icon: '🛡️',
    badge: 3, // 緊急対応要項目数
    children: [
      { label: '脆弱性一覧', path: '/vulnerabilities' },
      { label: 'リスク評価', path: '/vulnerabilities/risk-assessment' },
      { label: '緩和計画', path: '/vulnerabilities/mitigation' },
    ],
  },
  {
    id: 'tasks',
    label: 'タスク管理',
    path: '/tasks',
    icon: '✅',
    badge: 7, // 担当タスク数
    children: [
      { label: 'マイタスク', path: '/tasks/my' },
      { label: 'チームタスク', path: '/tasks/team' },
      { label: 'ワークフロー', path: '/tasks/workflows' },
    ],
  },
  {
    id: 'relationships',
    label: '依存関係',
    path: '/relationships',
    icon: '🔗',
    children: [
      { label: '依存関係グラフ', path: '/relationships/graph' },
      { label: '影響分析', path: '/relationships/impact-analysis' },
    ],
  },
  {
    id: 'reports',
    label: 'レポート',
    path: '/reports',
    icon: '📈',
    children: [
      { label: 'セキュリティレポート', path: '/reports/security' },
      { label: 'システム状況レポート', path: '/reports/systems' },
      { label: 'タスク実績レポート', path: '/reports/tasks' },
    ],
  },
];
```

#### サイドナビゲーション（コンテキスト別）

```typescript
// システム管理用サイドナビ
const systemsNavigation = [
  {
    section: 'システム管理',
    items: [
      { label: 'システム一覧', path: '/systems', icon: '📋' },
      { label: '新規登録', path: '/systems/new', icon: '➕' },
      { label: 'インポート', path: '/systems/import', icon: '📥' },
    ],
  },
  {
    section: 'インフラ管理',
    items: [
      { label: 'ホスト管理', path: '/systems/hosts', icon: '🖥️' },
      { label: 'パッケージ管理', path: '/systems/packages', icon: '📦' },
      { label: 'ネットワーク', path: '/systems/network', icon: '🌐' },
    ],
  },
  {
    section: '監視・検証',
    items: [
      { label: 'ヘルスチェック', path: '/systems/health', icon: '💚' },
      { label: 'EOL 監視', path: '/systems/eol', icon: '⏰' },
      { label: 'コンプライアンス', path: '/systems/compliance', icon: '✔️' },
    ],
  },
];

// 脆弱性管理用サイドナビ
const vulnerabilitiesNavigation = [
  {
    section: '脆弱性管理',
    items: [
      { label: '緊急対応要', path: '/vulnerabilities/critical', icon: '🚨', badge: 3 },
      { label: 'すべての脆弱性', path: '/vulnerabilities', icon: '📋' },
      { label: 'スキャン実行', path: '/vulnerabilities/scan', icon: '🔍' },
    ],
  },
  {
    section: '評価・対応',
    items: [
      { label: 'リスク評価', path: '/vulnerabilities/risk-assessment', icon: '⚖️' },
      { label: '緩和計画', path: '/vulnerabilities/mitigation', icon: '🛠️' },
      { label: 'パッチ管理', path: '/vulnerabilities/patches', icon: '🩹' },
    ],
  },
  {
    section: 'データ管理',
    items: [
      { label: 'CVE 更新', path: '/vulnerabilities/cve-update', icon: '🔄' },
      { label: 'データソース', path: '/vulnerabilities/sources', icon: '📡' },
      { label: '外部連携', path: '/vulnerabilities/integrations', icon: '🔗' },
    ],
  },
];
```

### 3.2 セカンダリナビゲーション

#### ブレッドクラム

```typescript
interface BreadcrumbConfig {
  [key: string]: {
    label: string;
    parent?: string;
    dynamic?: boolean;
  };
}

const breadcrumbConfig: BreadcrumbConfig = {
  '/': { label: 'ダッシュボード' },
  '/systems': { label: 'システム管理' },
  '/systems/new': { label: '新規登録', parent: '/systems' },
  '/systems/:id': { label: 'システム詳細', parent: '/systems', dynamic: true },
  '/systems/:id/edit': { label: '編集', parent: '/systems/:id', dynamic: true },
  '/vulnerabilities': { label: '脆弱性管理' },
  '/vulnerabilities/:id': { label: '脆弱性詳細', parent: '/vulnerabilities', dynamic: true },
  '/tasks': { label: 'タスク管理' },
  '/tasks/my': { label: 'マイタスク', parent: '/tasks' },
  '/tasks/:id': { label: 'タスク詳細', parent: '/tasks', dynamic: true },
};
```

#### タブナビゲーション（詳細画面）

```typescript
// システム詳細画面のタブ
const systemDetailTabs = [
  { id: 'overview', label: '概要', count: null },
  { id: 'packages', label: 'パッケージ', count: 24 },
  { id: 'vulnerabilities', label: '脆弱性', count: 3 },
  { id: 'tasks', label: 'タスク', count: 5 },
  { id: 'dependencies', label: '依存関係', count: 8 },
  { id: 'history', label: '履歴', count: null },
];

// 脆弱性詳細画面のタブ
const vulnerabilityDetailTabs = [
  { id: 'overview', label: '概要', count: null },
  { id: 'assessment', label: 'リスク評価', count: null },
  { id: 'affected-systems', label: '影響システム', count: 12 },
  { id: 'mitigation', label: '緩和計画', count: 2 },
  { id: 'timeline', label: '対応履歴', count: null },
];
```

---

## 4. 画面レイアウトパターン

### 4.1 レイアウトテンプレート

#### マスターレイアウト

```css
.master-layout {
  display: grid;
  grid-template-areas:
    "header header header"
    "sidebar main aside"
    "footer footer footer";
  grid-template-columns: 280px 1fr 320px;
  grid-template-rows: 64px 1fr 48px;
  min-height: 100vh;
}

.header { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main { grid-area: main; }
.aside { grid-area: aside; }
.footer { grid-area: footer; }
```

#### ダッシュボードレイアウト

```css
.dashboard-layout {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: auto;
  gap: 24px;
  padding: 24px;
}

.hero-section { grid-column: 1 / -1; }
.primary-metrics { grid-column: 1 / 9; }
.secondary-info { grid-column: 9 / -1; }
.urgent-alerts { grid-column: 1 / 5; }
.recent-activity { grid-column: 5 / 9; }
.quick-actions { grid-column: 9 / -1; }
```

#### 一覧・詳細レイアウト

```css
.list-detail-layout {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 24px;
  height: calc(100vh - 64px);
}

.list-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-panel {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

### 4.2 コンテンツパターン

#### カードグリッドパターン

```typescript
interface CardGridProps {
  items: any[];
  columns: 2 | 3 | 4;
  cardComponent: React.ComponentType<any>;
  loading?: boolean;
  empty?: React.ReactNode;
}

const CardGrid: React.FC<CardGridProps> = ({
  items,
  columns,
  cardComponent: CardComponent,
  loading,
  empty,
}) => {
  if (loading) return <LoadingGrid columns={columns} />;
  if (items.length === 0) return empty || <EmptyState />;

  return (
    <div className={`grid grid-cols-${columns} gap-6`}>
      {items.map((item, index) => (
        <CardComponent key={item.id || index} {...item} />
      ))}
    </div>
  );
};
```

#### データテーブルパターン

```typescript
interface DataTablePattern {
  data: any[];
  columns: ColumnDefinition[];
  filters: FilterConfig[];
  actions: ActionConfig[];
  pagination: PaginationConfig;
}

const EnhancedDataTable: React.FC<DataTablePattern> = ({
  data,
  columns,
  filters,
  actions,
  pagination,
}) => {
  return (
    <div className="space-y-4">
      <TableToolbar filters={filters} actions={actions} />
      <DataTable
        data={data}
        columns={columns}
        sortable
        selectable
        hover
      />
      <TablePagination {...pagination} />
    </div>
  );
};
```

---

## 5. 情報優先度とヒエラルキー

### 5.1 情報優先度マトリックス

| 優先度 | 情報カテゴリ | 表示位置 | 表示方式 |
|---|---|---|---|
| **最高** | CVSS 9.0以上の脆弱性 | ヘッダーアラート | 赤色、パルスアニメーション |
| **高** | 緊急タスク、EOL 30日前 | ダッシュボード上部 | オレンジ色、アイコン |
| **中** | 一般的な脆弱性、通常タスク | メインコンテンツエリア | 標準色、バッジ |
| **低** | システム情報、履歴データ | サイドパネル、詳細タブ | グレー色 |

### 5.2 視覚的ヒエラルキー

#### 色による優先度表現

```css
/* 緊急度別カラーコーディング */
.priority-critical {
  border-left: 4px solid var(--color-status-danger);
  background: linear-gradient(90deg, rgba(220, 38, 38, 0.05), white);
}

.priority-high {
  border-left: 4px solid var(--color-status-warning);
  background: linear-gradient(90deg, rgba(217, 119, 6, 0.05), white);
}

.priority-medium {
  border-left: 4px solid var(--color-status-warning-yellow);
  background: linear-gradient(90deg, rgba(234, 179, 8, 0.05), white);
}

.priority-low {
  border-left: 4px solid var(--color-status-info);
  background: linear-gradient(90deg, rgba(2, 132, 199, 0.05), white);
}
```

#### サイズによる重要度表現

```css
/* タイポグラフィスケール */
.text-critical { font-size: 2.25rem; font-weight: 700; }
.text-important { font-size: 1.5rem; font-weight: 600; }
.text-normal { font-size: 1rem; font-weight: 400; }
.text-secondary { font-size: 0.875rem; font-weight: 400; }
.text-caption { font-size: 0.75rem; font-weight: 400; }
```

---

## 6. 検索・フィルタリング機能

### 6.1 グローバル検索

```typescript
interface GlobalSearchConfig {
  placeholder: string;
  scopes: SearchScope[];
  filters: SearchFilter[];
  shortcuts: SearchShortcut[];
}

const globalSearchConfig: GlobalSearchConfig = {
  placeholder: 'システム、脆弱性、タスクを検索...',
  scopes: [
    { id: 'all', label: 'すべて', icon: '🔍' },
    { id: 'systems', label: 'システム', icon: '🖥️' },
    { id: 'vulnerabilities', label: '脆弱性', icon: '🛡️' },
    { id: 'tasks', label: 'タスク', icon: '✅' },
  ],
  filters: [
    { id: 'status', label: 'ステータス', type: 'select', options: ['active', 'inactive'] },
    { id: 'criticality', label: '重要度', type: 'range', min: 1, max: 5 },
    { id: 'dateRange', label: '期間', type: 'date-range' },
  ],
  shortcuts: [
    { key: 'Ctrl+K', action: 'open-search' },
    { key: 'Ctrl+Shift+S', action: 'search-systems' },
    { key: 'Ctrl+Shift+V', action: 'search-vulnerabilities' },
  ],
};
```

### 6.2 コンテキスト別フィルタ

#### システム管理フィルタ

```typescript
const systemsFilters = [
  {
    id: 'status',
    label: 'ステータス',
    type: 'checkbox',
    options: [
      { value: 'active', label: 'アクティブ', count: 18 },
      { value: 'inactive', label: '非アクティブ', count: 4 },
      { value: 'deprecated', label: '廃止予定', count: 2 },
    ],
  },
  {
    id: 'systemType',
    label: 'システム種別',
    type: 'checkbox',
    options: [
      { value: 'web-server', label: 'Webサーバー', count: 8 },
      { value: 'database', label: 'データベース', count: 6 },
      { value: 'application', label: 'アプリケーション', count: 10 },
    ],
  },
  {
    id: 'criticality',
    label: '重要度',
    type: 'range',
    min: 1,
    max: 5,
    step: 1,
  },
  {
    id: 'lastValidated',
    label: '最終検証日',
    type: 'date-range',
    presets: [
      { label: '過去1週間', value: { from: '-7d', to: 'now' } },
      { label: '過去1ヶ月', value: { from: '-30d', to: 'now' } },
      { label: '過去3ヶ月', value: { from: '-90d', to: 'now' } },
    ],
  },
];
```

#### 脆弱性管理フィルタ

```typescript
const vulnerabilitiesFilters = [
  {
    id: 'severity',
    label: '深刻度',
    type: 'checkbox',
    options: [
      { value: 'critical', label: 'Critical (9.0-10.0)', count: 3, color: 'red' },
      { value: 'high', label: 'High (7.0-8.9)', count: 12, color: 'orange' },
      { value: 'medium', label: 'Medium (4.0-6.9)', count: 28, color: 'yellow' },
      { value: 'low', label: 'Low (0.1-3.9)', count: 45, color: 'blue' },
    ],
  },
  {
    id: 'status',
    label: 'ステータス',
    type: 'checkbox',
    options: [
      { value: 'detected', label: '検出済み', count: 15 },
      { value: 'assessment', label: '評価中', count: 8 },
      { value: 'mitigation', label: '対応中', count: 12 },
      { value: 'resolved', label: '解決済み', count: 53 },
    ],
  },
  {
    id: 'affectedSystems',
    label: '影響システム数',
    type: 'range',
    min: 1,
    max: 50,
    step: 1,
  },
];
```

---

## 7. レスポンシブ対応

### 7.1 ブレイクポイント戦略

```css
/* Mobile First アプローチ */
.responsive-layout {
  /* Mobile (320px~) */
  display: flex;
  flex-direction: column;
}

@media (min-width: 768px) {
  /* Tablet */
  .responsive-layout {
    display: grid;
    grid-template-columns: 250px 1fr;
  }

  .sidebar {
    position: relative;
    transform: translateX(0);
  }
}

@media (min-width: 1024px) {
  /* Desktop */
  .responsive-layout {
    grid-template-columns: 280px 1fr 320px;
  }

  .aside {
    display: block;
  }
}

@media (min-width: 1536px) {
  /* Large Desktop */
  .responsive-layout {
    grid-template-columns: 320px 1fr 360px;
  }
}
```

### 7.2 モバイル対応ナビゲーション

```typescript
const MobileNavigation: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">System Board</h1>
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`
          lg:hidden fixed inset-0 z-50 flex
          ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}
        `}
      >
        <div
          className={`
            fixed inset-0 bg-black transition-opacity duration-300
            ${isOpen ? 'opacity-50' : 'opacity-0'}
          `}
          onClick={() => setIsOpen(false)}
        />

        <div
          className={`
            relative flex-1 flex flex-col max-w-xs w-full bg-white
            transform transition-transform duration-300 ease-in-out
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <SidebarContent onNavigate={() => setIsOpen(false)} />
        </div>
      </div>
    </>
  );
};
```

---

## 8. アクセシビリティ考慮事項

### 8.1 キーボードナビゲーション

```typescript
const useKeyboardNavigation = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // グローバルショートカット
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'k':
            event.preventDefault();
            openGlobalSearch();
            break;
          case '/':
            event.preventDefault();
            focusSearchInput();
            break;
          case '1':
            event.preventDefault();
            navigateTo('/');
            break;
          case '2':
            event.preventDefault();
            navigateTo('/systems');
            break;
          case '3':
            event.preventDefault();
            navigateTo('/vulnerabilities');
            break;
        }
      }

      // エスケープキー
      if (event.key === 'Escape') {
        closeModals();
        clearSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
};
```

### 8.2 ARIAラベルとロール

```html
<!-- ナビゲーション -->
<nav role="navigation" aria-label="メインナビゲーション">
  <ul role="menubar">
    <li role="none">
      <a
        role="menuitem"
        href="/systems"
        aria-current="page"
        aria-describedby="systems-description"
      >
        システム管理
      </a>
      <div id="systems-description" class="sr-only">
        システムの登録、編集、管理を行います
      </div>
    </li>
  </ul>
</nav>

<!-- データテーブル -->
<table role="table" aria-label="システム一覧">
  <thead>
    <tr role="row">
      <th role="columnheader" aria-sort="ascending">
        システム名
      </th>
      <th role="columnheader" aria-sort="none">
        ステータス
      </th>
    </tr>
  </thead>
  <tbody>
    <tr role="row">
      <td role="gridcell">Production Server</td>
      <td role="gridcell">
        <span aria-label="ステータス: アクティブ">🟢</span>
      </td>
    </tr>
  </tbody>
</table>

<!-- アラート -->
<div
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
  class="alert alert-critical"
>
  緊急: CVSS 9.5の脆弱性が検出されました
</div>
```

---

## 9. パフォーマンス最適化

### 9.1 レイジーローディング

```typescript
// ページレベルのレイジーローディング
const SystemsPage = lazy(() => import('./pages/SystemsPage'));
const VulnerabilitiesPage = lazy(() => import('./pages/VulnerabilitiesPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));

// コンポーネントレベルのレイジーローディング
const DependencyGraph = lazy(() => import('./components/DependencyGraph'));
const DetailedReport = lazy(() => import('./components/DetailedReport'));

// 使用例
<Suspense fallback={<LoadingSpinner />}>
  <Route path="/systems" component={SystemsPage} />
</Suspense>
```

### 9.2 データ仮想化

```typescript
// 大量データ用の仮想化テーブル
const VirtualizedTable: React.FC<{
  data: any[];
  columns: Column[];
  rowHeight: number;
}> = ({ data, columns, rowHeight }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const visibleStart = Math.floor(scrollTop / rowHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / rowHeight) + 1,
    data.length
  );

  const visibleData = data.slice(visibleStart, visibleEnd);

  return (
    <div
      ref={containerRef}
      className="overflow-auto"
      style={{ height: '400px' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: data.length * rowHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${visibleStart * rowHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleData.map((row, index) => (
            <TableRow
              key={visibleStart + index}
              data={row}
              columns={columns}
              style={{ height: rowHeight }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
```

---

## 10. エラーハンドリングとフィードバック

### 10.1 エラー状態デザイン

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

const ErrorFallback: React.FC<{ error: Error; resetError: () => void }> = ({
  error,
  resetError,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <XCircleIcon className="h-8 w-8 text-red-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">
              エラーが発生しました
            </h3>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-2">
            申し訳ございません。予期しないエラーが発生しました。
          </p>
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer">技術的詳細</summary>
            <pre className="mt-2 whitespace-pre-wrap">{error.message}</pre>
          </details>
        </div>

        <div className="flex space-x-3">
          <Button onClick={resetError} variant="primary">
            再試行
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="secondary"
          >
            ホームに戻る
          </Button>
        </div>
      </div>
    </div>
  );
};
```

### 10.2 ロード状態とスケルトン

```typescript
const SkeletonCard: React.FC = () => (
  <div className="bg-white rounded-lg border border-gray-200 p-6">
    <div className="animate-pulse">
      <div className="flex items-center space-x-4 mb-4">
        <div className="rounded-full bg-gray-300 h-10 w-10"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          <div className="h-3 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 bg-gray-300 rounded"></div>
        <div className="h-3 bg-gray-300 rounded w-5/6"></div>
        <div className="h-3 bg-gray-300 rounded w-4/6"></div>
      </div>
    </div>
  </div>
);

const SkeletonTable: React.FC<{ rows: number; columns: number }> = ({
  rows,
  columns,
}) => (
  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div className="divide-y divide-gray-200">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex p-4 space-x-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="flex-1 h-4 bg-gray-300 rounded animate-pulse"
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);
```

---

この情報アーキテクチャ設計により、System Board の全体的なユーザー体験を統一し、効率的で使いやすいインターフェースを実現します。特に製造業のセキュリティ要件と日常業務フローを考慮した設計となっています。
