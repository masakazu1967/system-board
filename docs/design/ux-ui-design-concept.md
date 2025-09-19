# System Board UX/UI デザインコンセプト

**バージョン**: 1.0
**作成日**: 2025年9月19日
**作成者**: UX/UI デザイナー
**承認者**: プロダクトマネージャー

---

## 1. プロジェクト概要

### 1.1 デザインビジョン

**「セキュリティを見える化し、安心を届けるインターフェース」**:

製造業の情報システム担当者が、複雑なセキュリティリスクを直感的に理解し、迅速かつ確実に対応できるユーザーエクスペリエンスを提供する。

### 1.2 デザイン理念

#### 信頼性優先

- 製造業における情報漏洩防止を最優先とした保守的で安全なデザイン
- エラーを起こしにくい明確なUI設計
- 一貫性のある操作体験による学習コスト削減

#### 情報の階層化

- 重要度に応じた情報の優先順位付け
- CVSS 9.0以上の緊急事項を最優先で表示
- ノイズを排除したクリーンな情報設計

#### 効率性重視

- 日常業務での使いやすさを重視
- 5-10名の小規模チームでの効率的な情報共有
- ワンクリックでの重要な情報アクセス

---

## 2. ブランドアイデンティティ

### 2.1 キーワード

| カテゴリ | キーワード |
|---|---|
| **感情** | 安心、信頼、安定、効率 |
| **機能** | 明確、直感的、迅速、正確 |
| **視覚** | クリーン、構造化、プロフェッショナル、モダン |

### 2.2 デザインペルソナ

**メインペルソナ**: 製造業IT部門担当者（30-50代）

- **スキルレベル**: 中級（ITリテラシーはあるが、UIデザインに関する専門知識は限定的）
- **利用環境**: オフィス内の固定PC、1920x1080以上の解像度
- **利用目的**: 日常的なセキュリティリスク監視、緊急時の迅速な対応
- **心理的ニーズ**: 見落としへの不安、責任感、効率性の追求

---

## 3. カラーパレット

### 3.1 プライマリカラー

**Tailwind CSS クラス対応**:

```typescript
// design-tokens.ts - Tailwind CSS設定
export const colors = {
  primary: {
    50: '#eff6ff',   // blue-50
    100: '#dbeafe',  // blue-100
    500: '#3b82f6',  // blue-500 (ライトブルー：アクセント)
    600: '#2563eb',  // blue-600
    700: '#1d4ed8',  // blue-700
    800: '#1e40af',  // blue-800 (ダークブルー：強調)
    900: '#1e3a8a',  // blue-900 (深い青：信頼性と安定性)
  },
  secondary: {
    400: '#94a3b8',  // slate-400
    500: '#64748b',  // slate-500 (ライトグレー：補助テキスト)
    600: '#475569',  // slate-600 (グレイッシュブルー：テキスト)
    700: '#334155',  // slate-700 (ダークグレー：見出し)
  }
};

// CSS Variables (Tailwind互換)
:root {
  --primary-blue: #1E3A8A;        /* blue-900 */
  --primary-blue-light: #3B82F6;  /* blue-500 */
  --primary-blue-dark: #1E40AF;   /* blue-800 */

  --secondary-slate: #475569;     /* slate-600 */
  --secondary-slate-light: #64748B; /* slate-500 */
  --secondary-slate-dark: #334155;  /* slate-700 */
}
```

### 3.2 ステータスカラー

**Tailwind CSS クラス対応**:

```typescript
// ステータスカラー (Tailwind CSS)
export const statusColors = {
  danger: {
    50: '#fef2f2',   // red-50
    100: '#fee2e2',  // red-100
    500: '#ef4444',  // red-500
    600: '#dc2626',  // red-600 (CVSS 9.0以上、緊急タスク)
    700: '#b91c1c',  // red-700
  },
  warning: {
    50: '#fffbeb',   // amber-50
    100: '#fef3c7',  // amber-100
    500: '#f59e0b',  // amber-500
    600: '#d97706',  // amber-600 (CVSS 7.0-8.9、注意事項)
    700: '#b45309',  // amber-700
  },
  caution: {
    50: '#fefce8',   // yellow-50
    100: '#fef9c3',  // yellow-100
    500: '#eab308',  // yellow-500 (EOL 30日前警告)
    600: '#ca8a04',  // yellow-600
  },
  success: {
    50: '#f0fdf4',   // green-50
    100: '#dcfce7',  // green-100
    500: '#22c55e',  // green-500
    600: '#16a34a',  // green-600 (完了、正常状態)
    700: '#15803d',  // green-700
  },
  info: {
    50: '#f0f9ff',   // sky-50
    100: '#e0f2fe',  // sky-100
    500: '#0ea5e9',  // sky-500
    600: '#0284c7',  // sky-600 (情報通知)
    700: '#0369a1',  // sky-700
  },
  neutral: {
    50: '#f8fafc',   // slate-50 (背景)
    100: '#f1f5f9',  // slate-100 (カード背景)
    200: '#e2e8f0',  // slate-200 (境界線)
    300: '#cbd5e1',  // slate-300 (無効状態)
  }
};

// CSS Variables (Tailwind互換)
:root {
  --danger-red: #DC2626;          /* red-600 */
  --warning-amber: #D97706;       /* amber-600 */
  --warning-yellow: #EAB308;      /* yellow-500 */
  --success-green: #16A34A;       /* green-600 */
  --success-emerald: #059669;     /* emerald-600 */
  --info-sky: #0284C7;            /* sky-600 */
  --info-indigo: #4338CA;         /* indigo-600 */
  --neutral-gray-50: #F8FAFC;     /* slate-50 */
  --neutral-gray-100: #F1F5F9;    /* slate-100 */
  --neutral-gray-200: #E2E8F0;    /* slate-200 */
  --neutral-gray-300: #CBD5E1;    /* slate-300 */
}
```

### 3.3 カラー使用原則

#### 緊急度による色分け (Tailwind CSS クラス)

```typescript
// CVSSスコア別カラーマッピング
export const getCVSSColorClass = (score: number): string => {
  if (score >= 9.0) return 'text-red-600 bg-red-50 border-red-200';      // CVSS 9.0-10.0
  if (score >= 7.0) return 'text-amber-600 bg-amber-50 border-amber-200'; // CVSS 7.0-8.9
  if (score >= 4.0) return 'text-yellow-600 bg-yellow-50 border-yellow-200'; // CVSS 4.0-6.9
  return 'text-sky-600 bg-sky-50 border-sky-200';                        // CVSS 0.1-3.9
};

// CSS形式
CVSS Score 9.0-10.0 → red-600 (--danger-red)
CVSS Score 7.0-8.9  → amber-600 (--warning-amber)
CVSS Score 4.0-6.9  → yellow-500 (--warning-yellow)
CVSS Score 0.1-3.9  → sky-600 (--info-sky)
```

#### システム状態表示 (Tailwind CSS クラス)

```typescript
// システム状態別カラーマッピング
export const getSystemStatusClass = (status: string): string => {
  switch (status) {
    case 'active':     return 'text-green-600 bg-green-50';    // アクティブ
    case 'inactive':   return 'text-slate-400 bg-slate-50';    // 非アクティブ
    case 'eol-warning': return 'text-yellow-600 bg-yellow-50'; // EOL近接
    case 'deprecated': return 'text-red-600 bg-red-50';        // 廃止予定
    default:           return 'text-slate-600 bg-slate-50';
  }
};

// CSS形式
アクティブ   → green-600 (--success-green)
非アクティブ → slate-400 (--neutral-gray-300)
EOL近接     → yellow-500 (--warning-yellow)
廃止予定     → red-600 (--danger-red)
```

---

## 4. タイポグラフィ

### 4.1 フォントファミリー

```css
/* プライマリフォント：可読性重視 */
--font-primary: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', sans-serif;

/* モノスペースフォント：システムID、コード表示 */
--font-mono: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;

/* 数値フォント：スコア、メトリクス表示 */
--font-numeric: 'Inter', 'Roboto', sans-serif;
```

### 4.2 フォントサイズスケール

**Tailwind CSS クラス対応**:

```typescript
// フォントサイズマッピング (Tailwind CSS)
export const fontSizes = {
  // ヘッダー
  'display-xl': 'text-4xl',     // 36px: h1 ページタイトル
  'display-lg': 'text-3xl',     // 30px: h2 セクションタイトル
  'display-md': 'text-2xl',     // 24px: h3 サブセクション
  'display-sm': 'text-xl',      // 20px: h4 カードタイトル

  // ボディ
  'body-lg': 'text-lg',         // 18px: 大きめボディテキスト
  'body-base': 'text-base',     // 16px: 標準ボディテキスト
  'body-sm': 'text-sm',         // 14px: 小さめテキスト
  'caption': 'text-xs',         // 12px: キャプション、ラベル

  // 特殊用途
  'score-xl': 'text-5xl',       // 48px: CVSSスコア大表示
  'metric-lg': 'text-3xl',      // 32px: メトリクス表示
};

// 使用例
export const Typography = {
  pageTitle: 'text-4xl font-bold text-slate-900',        // h1
  sectionTitle: 'text-3xl font-semibold text-slate-800', // h2
  cardTitle: 'text-xl font-medium text-slate-700',       // h4
  bodyText: 'text-base text-slate-600',                  // 標準
  caption: 'text-xs text-slate-500',                     // キャプション
  cvssScore: 'text-5xl font-bold font-mono',             // スコア表示
};

// CSS Variables (Tailwind互換)
:root {
  --text-4xl: 2.25rem;    /* text-4xl: h1 ページタイトル (36px) */
  --text-3xl: 1.875rem;   /* text-3xl: h2 セクションタイトル (30px) */
  --text-2xl: 1.5rem;     /* text-2xl: h3 サブセクション (24px) */
  --text-xl: 1.25rem;     /* text-xl: h4 カードタイトル (20px) */
  --text-lg: 1.125rem;    /* text-lg: 大きめボディテキスト (18px) */
  --text-base: 1rem;      /* text-base: 標準ボディテキスト (16px) */
  --text-sm: 0.875rem;    /* text-sm: 小さめテキスト (14px) */
  --text-xs: 0.75rem;     /* text-xs: キャプション、ラベル (12px) */
  --text-5xl: 3rem;       /* text-5xl: CVSSスコア大表示 (48px) */
}
```

### 4.3 行間・文字間隔

**Tailwind CSS クラス対応**:

```typescript
// 行間・文字間隔マッピング (Tailwind CSS)
export const textSpacing = {
  // 行間 (line-height)
  tight: 'leading-tight',      // 1.25: 見出し用
  normal: 'leading-normal',    // 1.5: ボディテキスト用
  relaxed: 'leading-relaxed',  // 1.625: 読みやすさ重視
  loose: 'leading-loose',      // 1.75: ゆったり

  // 文字間隔 (letter-spacing)
  tighter: 'tracking-tighter', // -0.05em: 大きな見出し用
  tight: 'tracking-tight',     // -0.025em: 見出し用
  normal: 'tracking-normal',   // 0: 標準
  wide: 'tracking-wide',       // 0.025em: キャプション用
  wider: 'tracking-wider',     // 0.05em: 大文字用
};

// 使用例
export const TextStyles = {
  heading: 'leading-tight tracking-tight',     // 見出し
  body: 'leading-normal tracking-normal',      // ボディ
  caption: 'leading-relaxed tracking-wide',    // キャプション
  code: 'leading-normal tracking-normal',      // コード
};

// CSS Variables (Tailwind互換)
:root {
  --leading-tight: 1.25;        /* leading-tight: 見出し用 */
  --leading-normal: 1.5;        /* leading-normal: ボディテキスト用 */
  --leading-relaxed: 1.625;     /* leading-relaxed: 読みやすさ重視 */
  --leading-loose: 1.75;        /* leading-loose: ゆったり */

  --tracking-tighter: -0.05em;  /* tracking-tighter: 大きな見出し用 */
  --tracking-tight: -0.025em;   /* tracking-tight: 見出し用 */
  --tracking-normal: 0;         /* tracking-normal: 標準 */
  --tracking-wide: 0.025em;     /* tracking-wide: キャプション用 */
  --tracking-wider: 0.05em;     /* tracking-wider: 大文字用 */
}
```

---

## 5. レイアウト・グリッドシステム

### 5.1 ブレイクポイント

**Tailwind CSS ブレイクポイント対応**:

```typescript
// レスポンシブブレイクポイント (Tailwind CSS標準)
export const breakpoints = {
  sm: '640px',    // sm: タブレット縦
  md: '768px',    // md: タブレット横
  lg: '1024px',   // lg: デスクトップ小
  xl: '1280px',   // xl: デスクトップ標準
  '2xl': '1536px' // 2xl: デスクトップ大
};

// レスポンシブ使用例
export const ResponsiveClasses = {
  container: 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  grid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6',
  sidebar: 'hidden lg:block lg:w-64 xl:w-80',
  navigation: 'block md:hidden', // モバイルナビ
};

// CSS Variables (Tailwind互換)
:root {
  --breakpoint-sm: 640px;   /* sm: タブレット縦 */
  --breakpoint-md: 768px;   /* md: タブレット横 */
  --breakpoint-lg: 1024px;  /* lg: デスクトップ小 */
  --breakpoint-xl: 1280px;  /* xl: デスクトップ標準 */
  --breakpoint-2xl: 1536px; /* 2xl: デスクトップ大 */
}
```

### 5.2 グリッドシステム

#### 12カラムグリッド (Tailwind CSS)

```typescript
// グリッドシステム (Tailwind CSS)
export const GridSystem = {
  // コンテナ
  container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',

  // 基本グリッド
  grid: 'grid grid-cols-12 gap-4 lg:gap-6',

  // カラムスパン
  col1: 'col-span-1',     // 1カラム
  col2: 'col-span-2',     // 2カラム
  col3: 'col-span-3',     // 3カラム
  col4: 'col-span-4',     // 4カラム
  col6: 'col-span-6',     // 6カラム (半分)
  col8: 'col-span-8',     // 8カラム
  col9: 'col-span-9',     // 9カラム
  col12: 'col-span-12',   // 12カラム (全幅)

  // レスポンシブカラム
  responsive: {
    sidebar: 'col-span-12 lg:col-span-3',      // サイドバー
    main: 'col-span-12 lg:col-span-9',         // メインコンテンツ
    card: 'col-span-12 md:col-span-6 lg:col-span-4', // カード
  }
};

// 使用例
export const LayoutExamples = {
  dashboard: 'grid grid-cols-12 gap-6',
  twoColumn: 'grid grid-cols-1 lg:grid-cols-2 gap-6',
  threeColumn: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
  cardGrid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',
};

// CSS Variables (Tailwind互換)
:root {
  --max-width-7xl: 80rem;    /* max-w-7xl: 1280px */
  --spacing-4: 1rem;         /* gap-4: 16px */
  --spacing-6: 1.5rem;       /* gap-6: 24px */
}
```

### 5.3 間隔システム

**Tailwind CSS スペーシング対応**:

```typescript
// スペーシングシステム (Tailwind CSS)
export const spacing = {
  // パディング・マージン
  xs: 'p-1',      // 4px: 要素間の最小間隔
  sm: 'p-2',      // 8px: 関連要素間
  md: 'p-4',      // 16px: 標準間隔
  lg: 'p-6',      // 24px: セクション間
  xl: 'p-8',      // 32px: 大きなセクション間
  '2xl': 'p-12',  // 48px: ページセクション間
  '3xl': 'p-16',  // 64px: ページ間

  // ギャップ (gap)
  gapXs: 'gap-1',    // 4px
  gapSm: 'gap-2',    // 8px
  gapMd: 'gap-4',    // 16px
  gapLg: 'gap-6',    // 24px
  gapXl: 'gap-8',    // 32px
  gap2xl: 'gap-12',  // 48px
};

// コンポーネント別スペーシング
export const ComponentSpacing = {
  button: 'px-4 py-2',              // ボタン
  card: 'p-6',                      // カード
  modal: 'p-8',                     // モーダル
  section: 'py-12',                 // セクション
  container: 'px-4 sm:px-6 lg:px-8', // コンテナ
  stack: 'space-y-4',               // 縦積み
  cluster: 'space-x-2',             // 横並び
};

// CSS Variables (Tailwind互換)
:root {
  --space-1: 0.25rem;   /* 4px: 要素間の最小間隔 */
  --space-2: 0.5rem;    /* 8px: 関連要素間 */
  --space-4: 1rem;      /* 16px: 標準間隔 */
  --space-6: 1.5rem;    /* 24px: セクション間 */
  --space-8: 2rem;      /* 32px: 大きなセクション間 */
  --space-12: 3rem;     /* 48px: ページセクション間 */
  --space-16: 4rem;     /* 64px: ページ間 */
}
```

---

## 6. コンポーネントデザインシステム

### 6.1 基本コンポーネント

#### ボタン (Tailwind CSS)

```typescript
// ボタンコンポーネント (Tailwind CSS)
export const ButtonStyles = {
  // ベースボタン
  base: 'inline-flex items-center justify-center px-4 py-2 border font-medium rounded-md shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',

  // プライマリボタン
  primary: 'bg-blue-900 text-white border-transparent hover:bg-blue-800 focus:ring-blue-500 transform hover:-translate-y-0.5 hover:shadow-lg',

  // セカンダリボタン
  secondary: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 focus:ring-slate-500',

  // 緊急アクションボタン
  danger: 'bg-red-600 text-white border-transparent hover:bg-red-700 focus:ring-red-500 animate-pulse',

  // 成功ボタン
  success: 'bg-green-600 text-white border-transparent hover:bg-green-700 focus:ring-green-500',

  // サイズバリエーション
  sizes: {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl',
  },

  // 状態
  disabled: 'opacity-50 cursor-not-allowed hover:transform-none',
  loading: 'opacity-75 cursor-wait',
};

// React コンポーネント例
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  onClick
}) => {
  const classes = [
    ButtonStyles.base,
    ButtonStyles[variant],
    ButtonStyles.sizes[size],
    disabled && ButtonStyles.disabled,
    loading && ButtonStyles.loading,
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && <Spinner className="w-4 h-4 mr-2" />}
      {children}
    </button>
  );
};
```

#### カード (Tailwind CSS)

```typescript
// カードコンポーネント (Tailwind CSS)
export const CardStyles = {
  // ベースカード
  base: 'bg-white rounded-xl p-6 shadow-sm border border-slate-200 transition-all duration-200',

  // インタラクティブカード
  interactive: 'hover:shadow-md hover:-translate-y-1 cursor-pointer',

  // 緊急度別カード
  critical: 'border-l-4 border-l-red-600 bg-gradient-to-r from-red-50 to-white',
  warning: 'border-l-4 border-l-amber-600 bg-gradient-to-r from-amber-50 to-white',
  success: 'border-l-4 border-l-green-600 bg-gradient-to-r from-green-50 to-white',
  info: 'border-l-4 border-l-sky-600 bg-gradient-to-r from-sky-50 to-white',

  // サイズバリエーション
  sizes: {
    sm: 'p-4 rounded-lg',
    md: 'p-6 rounded-xl',
    lg: 'p-8 rounded-2xl',
  },

  // エレベーション
  elevated: 'shadow-lg',
  floating: 'shadow-xl',
};

// React コンポーネント例
interface CardProps {
  variant?: 'default' | 'critical' | 'warning' | 'success' | 'info';
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  elevated?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  size = 'md',
  interactive = false,
  elevated = false,
  children,
  onClick
}) => {
  const classes = [
    CardStyles.base,
    CardStyles.sizes[size],
    variant !== 'default' && CardStyles[variant],
    interactive && CardStyles.interactive,
    elevated && CardStyles.elevated,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
};

// カードヘッダー・コンテンツコンポーネント
export const CardHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-4 pb-4 border-b border-slate-200">{children}</div>
);

export const CardTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xl font-semibold text-slate-900">{children}</h3>
);

export const CardContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="space-y-4">{children}</div>
);
```

#### ステータスバッジ (Tailwind CSS)

```typescript
// バッジコンポーネント (Tailwind CSS)
export const BadgeStyles = {
  // ベースバッジ
  base: 'inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold uppercase tracking-wide',

  // バリエーション
  critical: 'bg-red-100 text-red-800 border border-red-200',
  warning: 'bg-amber-100 text-amber-800 border border-amber-200',
  success: 'bg-green-100 text-green-800 border border-green-200',
  info: 'bg-sky-100 text-sky-800 border border-sky-200',
  neutral: 'bg-slate-100 text-slate-800 border border-slate-200',

  // サイズ
  sizes: {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  },

  // 特殊バッジ
  pulse: 'animate-pulse',
  withDot: 'pl-2',
};

// React コンポーネント例
interface BadgeProps {
  variant?: 'critical' | 'warning' | 'success' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  dot?: boolean;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  pulse = false,
  dot = false,
  children
}) => {
  const classes = [
    BadgeStyles.base,
    BadgeStyles[variant],
    BadgeStyles.sizes[size],
    pulse && BadgeStyles.pulse,
    dot && BadgeStyles.withDot,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      {dot && (
        <span className={`w-2 h-2 rounded-full mr-2 bg-current`} />
      )}
      {children}
    </span>
  );
};

// CVSSスコア専用バッジ
export const CVSSBadge: React.FC<{ score: number }> = ({ score }) => {
  const getVariant = (score: number) => {
    if (score >= 9.0) return 'critical';
    if (score >= 7.0) return 'warning';
    if (score >= 4.0) return 'info';
    return 'neutral';
  };

  return (
    <Badge variant={getVariant(score)} pulse={score >= 9.0}>
      CVSS {score.toFixed(1)}
    </Badge>
  );
};
```

### 6.2 データ表示コンポーネント

#### CVSSスコア表示

```css
.cvss-score {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cvss-number {
  font-size: var(--text-score-xl);
  font-weight: 700;
  font-family: var(--font-numeric);
  line-height: 1;
}

.cvss-critical { color: var(--danger-red); }
.cvss-high { color: var(--warning-amber); }
.cvss-medium { color: var(--warning-yellow); }
.cvss-low { color: var(--info-sky); }

.cvss-bar {
  flex: 1;
  height: 8px;
  background: var(--neutral-gray-200);
  border-radius: 4px;
  overflow: hidden;
}

.cvss-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}
```

#### プログレスインジケーター

```css
.progress {
  width: 100%;
  height: 12px;
  background: var(--neutral-gray-200);
  border-radius: 6px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: 6px;
  transition: width 0.5s ease;
  position: relative;
}

.progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

---

## 7. アニメーション・インタラクション

### 7.1 アニメーション原則

#### 自然な動き

- イージング関数：`cubic-bezier(0.4, 0, 0.2, 1)` を基本とする
- デュレーション：短時間（100-300ms）で素早い反応
- 緊急時の注意喚起には適度なアニメーションを使用

#### パフォーマンス重視

- GPU加速を活用（transform, opacity のみ）
- 60fps の滑らかなアニメーション
- 冗長なアニメーションは避ける

### 7.2 ミクロインタラクション

```css
/* ホバーエフェクト */
.interactive {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.interactive:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* フォーカスエフェクト */
.focusable:focus {
  outline: 2px solid var(--primary-blue);
  outline-offset: 2px;
}

/* ローディングアニメーション */
.loading {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 緊急アラートパルス */
.alert-pulse {
  animation: alert-pulse 1.5s ease-in-out infinite;
}

@keyframes alert-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(220, 38, 38, 0);
  }
}
```

### 7.3 ページ遷移

```css
/* フェードイン */
.page-enter {
  opacity: 0;
  transform: translateY(20px);
}

.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.page-exit {
  opacity: 1;
  transform: translateY(0);
}

.page-exit-active {
  opacity: 0;
  transform: translateY(-20px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}
```

---

## 8. アクセシビリティ

### 8.1 カラーアクセシビリティ

#### コントラスト比

- 通常テキスト：4.5:1 以上
- 大きなテキスト：3:1 以上
- UI要素：3:1 以上

#### カラーブラインド対応

```css
/* カラーブラインド対応パターン */
.pattern-critical {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 3px,
    rgba(220, 38, 38, 0.3) 3px,
    rgba(220, 38, 38, 0.3) 6px
  );
}

.pattern-warning {
  background-image: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 2px,
    rgba(217, 119, 6, 0.3) 2px,
    rgba(217, 119, 6, 0.3) 4px
  );
}
```

### 8.2 キーボードナビゲーション

```css
/* フォーカス表示 */
.keyboard-navigable:focus-visible {
  outline: 2px solid var(--primary-blue);
  outline-offset: 2px;
  border-radius: 4px;
}

/* スキップリンク */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--primary-blue);
  color: white;
  padding: 8px;
  text-decoration: none;
  border-radius: 4px;
  z-index: 1000;
}

.skip-link:focus {
  top: 6px;
}
```

### 8.3 スクリーンリーダー対応

```html
<!-- ARIAラベルの使用例 -->
<div role="alert" aria-live="assertive" class="alert-critical">
  <span aria-label="重要度: 緊急">🚨</span>
  CVSS 9.5の脆弱性が検出されました
</div>

<table role="table" aria-label="システム一覧">
  <thead>
    <tr>
      <th scope="col">システム名</th>
      <th scope="col">CVSS スコア</th>
      <th scope="col">状態</th>
    </tr>
  </thead>
</table>
```

---

## 9. レスポンシブデザイン

### 9.1 デバイス対応

#### デスクトップ優先設計

- プライマリターゲット：1920x1080 以上
- 最小サポート：1280x720
- モバイル対応：限定的（閲覧のみ）

#### ブレイクポイント戦略

```css
/* デスクトップファースト */
.dashboard-grid {
  display: grid;
  grid-template-columns: 300px 1fr 280px;
  gap: 24px;
}

@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 250px 1fr;
    gap: 16px;
  }

  .sidebar-secondary {
    display: none;
  }
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .sidebar-primary {
    position: fixed;
    top: 0;
    left: -100%;
    height: 100vh;
    transition: left 0.3s ease;
  }

  .sidebar-primary.open {
    left: 0;
  }
}
```

### 9.2 可変レイアウト

```css
/* Fluid Grid System */
.fluid-container {
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 clamp(16px, 4vw, 48px);
}

.fluid-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: clamp(16px, 3vw, 32px);
}

/* 可変フォントサイズ */
.title {
  font-size: clamp(1.5rem, 4vw, 2.25rem);
}

.body-text {
  font-size: clamp(0.875rem, 2vw, 1rem);
}
```

---

## 10. 「おしゃれで動きがある」と「シンプル」の両立戦略

### 10.1 Modern Minimalism アプローチ

#### 洗練された最小主義

- **クリーンな空白**: 十分な余白による情報の呼吸感
- **精密なタイポグラフィ**: フォントサイズとウェイトの計算された階層
- **意図的な色使い**: 機能的で美しいカラーパレット

#### 目的のあるアニメーション

```css
/* 情報更新時のサブトルなアニメーション */
.data-update {
  animation: gentle-highlight 0.8s ease-out;
}

@keyframes gentle-highlight {
  0% { background-color: rgba(59, 130, 246, 0.1); }
  100% { background-color: transparent; }
}

/* カードのモダンなホバーエフェクト */
.modern-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--neutral-gray-200);
}

.modern-card:hover {
  border-color: var(--primary-blue-light);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}
```

### 10.2 Progressive Enhancement

#### 基本機能は完全にシンプル

- データ表示：テーブル、カード、リストの基本形
- ナビゲーション：明確な階層とラベル
- フォーム：分かりやすい入力フィールド

#### 強化要素で魅力を追加

```css
/* ベースの単純なプログレスバー */
.progress-basic {
  width: 100%;
  height: 8px;
  background: var(--neutral-gray-200);
  border-radius: 4px;
}

.progress-fill {
  height: 100%;
  background: var(--success-green);
  border-radius: 4px;
}

/* 強化版：グラデーションとアニメーション */
.progress-enhanced .progress-fill {
  background: linear-gradient(90deg,
    var(--success-green) 0%,
    #22C55E 50%,
    var(--success-green) 100%);
  position: relative;
  overflow: hidden;
}

.progress-enhanced .progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%);
  animation: progress-shine 2s infinite;
}

@keyframes progress-shine {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

### 10.3 レイヤード・デザイン

#### 視覚的階層の構築

```css
/* レイヤー1: 基本背景 */
.layer-background {
  background: linear-gradient(135deg,
    var(--neutral-gray-50) 0%,
    #FEFEFE 100%);
}

/* レイヤー2: カードコンテナ */
.layer-container {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
}

/* レイヤー3: アクティブ要素 */
.layer-active {
  background: white;
  box-shadow:
    0 10px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border-radius: 12px;
}
```

### 10.4 情報デザインの工夫

#### データビジュアライゼーション

```css
/* エレガントなメトリクス表示 */
.metric-card {
  padding: 32px;
  background: white;
  border-radius: 16px;
  border: 1px solid var(--neutral-gray-200);
  position: relative;
  overflow: hidden;
}

.metric-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg,
    var(--primary-blue) 0%,
    var(--primary-blue-light) 100%);
}

.metric-number {
  font-size: 3rem;
  font-weight: 700;
  color: var(--secondary-slate-dark);
  line-height: 1;
  font-family: var(--font-numeric);
}

.metric-label {
  font-size: 0.875rem;
  color: var(--secondary-slate);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 8px;
}

.metric-trend {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.metric-trend.up {
  color: var(--success-green);
}

.metric-trend.down {
  color: var(--danger-red);
}
```

---

## 11. 実装ガイドライン

### 11.1 CSS Variables の活用

```css
:root {
  /* Design Tokens */
  --design-system-version: 1.0;

  /* Spacing Scale */
  --space-unit: 8px;
  --space-xs: calc(var(--space-unit) * 0.5);
  --space-sm: var(--space-unit);
  --space-md: calc(var(--space-unit) * 2);
  --space-lg: calc(var(--space-unit) * 3);
  --space-xl: calc(var(--space-unit) * 4);

  /* Shadow Scale */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

  /* Border Radius Scale */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

### 11.2 コンポーネント構造

```typescript
// React Component Example
interface SystemCardProps {
  system: SystemEntity;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  onSelect?: (system: SystemEntity) => void;
}

export const SystemCard: React.FC<SystemCardProps> = ({
  system,
  riskLevel,
  onSelect
}) => {
  return (
    <div
      className={`
        system-card
        system-card--${riskLevel}
        ${onSelect ? 'system-card--interactive' : ''}
      `}
      onClick={() => onSelect?.(system)}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className="system-card__header">
        <h3 className="system-card__title">{system.name}</h3>
        <StatusBadge status={system.status} />
      </div>

      <div className="system-card__metrics">
        <CVSSScore score={system.maxCVSSScore} />
        <div className="system-card__meta">
          <span>最終チェック: {system.lastValidated}</span>
        </div>
      </div>
    </div>
  );
};
```

### 11.3 パフォーマンス最適化

```css
/* GPU加速の活用 */
.gpu-accelerated {
  transform: translateZ(0);
  will-change: transform;
}

/* 不要なレイアウト計算を避ける */
.efficient-animation {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

/* メディアクエリの最適化 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 12. ブラウザサポート

### 12.1 対象ブラウザ

| ブラウザ | バージョン | サポートレベル |
|---|---|---|
| Chrome | 90+ | 完全サポート |
| Firefox | 88+ | 完全サポート |
| Safari | 14+ | 完全サポート |
| Edge | 90+ | 完全サポート |
| IE | - | サポート外 |

### 12.2 Progressive Enhancement

```css
/* モダンブラウザ向け拡張 */
@supports (backdrop-filter: blur(10px)) {
  .glass-card {
    backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, 0.8);
  }
}

@supports (display: grid) {
  .modern-layout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
}

/* フォールバック */
.legacy-layout {
  display: flex;
  flex-wrap: wrap;
}
```

---

## 13. 品質保証

### 13.1 デザインレビューチェックリスト

#### 視覚的一貫性

- [ ] カラーパレットの適切な使用
- [ ] タイポグラフィスケールの遵守
- [ ] スペーシングシステムの適用
- [ ] アニメーションのタイミング統一

#### ユーザビリティ

- [ ] 4.5:1以上のコントラスト比
- [ ] キーボードナビゲーション対応
- [ ] 明確なフォーカス表示
- [ ] エラー状態の分かりやすい表示

#### パフォーマンス

- [ ] 60fps のアニメーション
- [ ] 適切な画像最適化
- [ ] CSS ファイルサイズの最適化
- [ ] ロード時間の短縮

### 13.2 テスト環境

```css
/* デザインシステムテスト用のユーティリティ */
.design-test-grid {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    linear-gradient(rgba(255, 0, 0, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 0, 0, 0.1) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
  z-index: 9999;
  opacity: 0;
}

.design-test-grid.active {
  opacity: 1;
}
```

---

## 14. 今後の展開

### 14.1 デザインシステムの進化

#### Phase 1: 基本実装（2025年10月-12月）

- コア コンポーネントライブラリ
- 基本的なレイアウトシステム
- プライマリカラーパレット

#### Phase 2: 拡張（2026年1月-3月）

- 高度なアニメーション
- データビジュアライゼーション
- カスタマイゼーション機能

#### Phase 3: 最適化（2026年4月-6月）

- パフォーマンス改善
- アクセシビリティ強化
- A/Bテストによる改善

### 14.2 測定指標

```typescript
// UXメトリクス定義
interface UXMetrics {
  taskCompletionRate: number;     // タスク完了率
  errorRate: number;              // エラー発生率
  timeToFirstAction: number;      // 初回アクション時間
  userSatisfactionScore: number;  // ユーザー満足度
  accessibilityScore: number;     // アクセシビリティスコア
}
```

---

このデザインコンセプトは、System Board プロジェクトの「おしゃれで動きがあるシンプル」なユーザーインターフェースを実現するための包括的なガイドラインです。製造業の厳格なセキュリティ要件を満たしながら、現代的で使いやすいデザインを提供することで、ユーザーの業務効率向上と満足度向上を目指します。
