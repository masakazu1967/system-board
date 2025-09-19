# System Board 統一デザインシステム

**バージョン**: 1.0
**作成日**: 2025年9月19日
**作成者**: UX/UI デザイナー
**依存**: ux-ui-design-concept.md

---

## 1. デザインシステム概要

### 1.1 目的

System Board のすべてのユーザーインターフェースで一貫性を保ち、開発効率を向上させるためのコンポーネントライブラリとガイドラインを提供する。

### 1.2 デザイントークン

```typescript
// design-tokens.ts
export const DesignTokens = {
  // カラーパレット
  colors: {
    primary: {
      blue: '#1E3A8A',
      blueLight: '#3B82F6',
      blueDark: '#1E40AF',
    },
    status: {
      danger: '#DC2626',
      warning: '#D97706',
      warningYellow: '#EAB308',
      success: '#16A34A',
      info: '#0284C7',
    },
    neutral: {
      gray50: '#F8FAFC',
      gray100: '#F1F5F9',
      gray200: '#E2E8F0',
      gray300: '#CBD5E1',
      gray500: '#64748B',
      gray700: '#334155',
      gray900: '#0F172A',
    },
    text: {
      primary: '#334155',
      secondary: '#64748B',
      muted: '#94A3B8',
    }
  },

  // タイポグラフィ
  typography: {
    fontFamily: {
      primary: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif",
      mono: "'JetBrains Mono', 'Consolas', monospace",
      numeric: "'Inter', 'Roboto', sans-serif",
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      scoreXl: '3rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      loose: 1.75,
    }
  },

  // スペーシング
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },

  // ボーダー半径
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },

  // シャドウ
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },

  // Z-index
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1040,
    popover: 1050,
    tooltip: 1060,
  }
} as const;
```

---

## 2. 基本コンポーネント

### 2.1 Button コンポーネント

```typescript
// Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  children,
  onClick,
  type = 'button',
}) => {
  const baseClasses = [
    'inline-flex',
    'items-center',
    'justify-center',
    'font-semibold',
    'transition-all',
    'duration-200',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2',
  ];

  const variantClasses = {
    primary: [
      'bg-primary-blue',
      'text-white',
      'hover:bg-primary-blue-dark',
      'focus:ring-primary-blue',
      'active:bg-primary-blue-dark',
    ],
    secondary: [
      'bg-neutral-gray-200',
      'text-text-primary',
      'hover:bg-neutral-gray-300',
      'focus:ring-neutral-gray-300',
    ],
    danger: [
      'bg-status-danger',
      'text-white',
      'hover:bg-red-700',
      'focus:ring-status-danger',
      'animate-pulse-subtle',
    ],
    warning: [
      'bg-status-warning',
      'text-white',
      'hover:bg-amber-700',
      'focus:ring-status-warning',
    ],
    ghost: [
      'bg-transparent',
      'text-text-primary',
      'hover:bg-neutral-gray-100',
      'focus:ring-neutral-gray-200',
    ],
  };

  const sizeClasses = {
    sm: ['text-sm', 'px-3', 'py-1.5', 'rounded-md'],
    md: ['text-base', 'px-4', 'py-2', 'rounded-lg'],
    lg: ['text-lg', 'px-6', 'py-3', 'rounded-lg'],
  };

  const disabledClasses = disabled ? [
    'opacity-50',
    'cursor-not-allowed',
    'pointer-events-none',
  ] : [];

  const className = [
    ...baseClasses,
    ...variantClasses[variant],
    ...sizeClasses[size],
    ...disabledClasses,
  ].join(' ');

  return (
    <button
      type={type}
      className={className}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}

      {icon && iconPosition === 'left' && !loading && (
        <span className="mr-2">{icon}</span>
      )}

      {children}

      {icon && iconPosition === 'right' && !loading && (
        <span className="ml-2">{icon}</span>
      )}
    </button>
  );
};
```

### 2.2 Card コンポーネント

```typescript
// Card.tsx
interface CardProps {
  variant?: 'default' | 'critical' | 'warning' | 'success' | 'elevated';
  padding?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  children,
  className = '',
  onClick,
  interactive = false,
}) => {
  const baseClasses = [
    'bg-white',
    'border',
    'rounded-lg',
    'transition-all',
    'duration-200',
  ];

  const variantClasses = {
    default: [
      'border-neutral-gray-200',
      'shadow-sm',
    ],
    critical: [
      'border-l-4',
      'border-l-status-danger',
      'border-t-neutral-gray-200',
      'border-r-neutral-gray-200',
      'border-b-neutral-gray-200',
      'bg-gradient-to-r',
      'from-red-50',
      'to-white',
      'shadow-md',
    ],
    warning: [
      'border-l-4',
      'border-l-status-warning',
      'border-t-neutral-gray-200',
      'border-r-neutral-gray-200',
      'border-b-neutral-gray-200',
      'bg-gradient-to-r',
      'from-amber-50',
      'to-white',
      'shadow-md',
    ],
    success: [
      'border-l-4',
      'border-l-status-success',
      'border-t-neutral-gray-200',
      'border-r-neutral-gray-200',
      'border-b-neutral-gray-200',
      'bg-gradient-to-r',
      'from-green-50',
      'to-white',
      'shadow-md',
    ],
    elevated: [
      'border-neutral-gray-200',
      'shadow-lg',
    ],
  };

  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const interactiveClasses = interactive || onClick ? [
    'hover:shadow-md',
    'hover:-translate-y-1',
    'cursor-pointer',
    'hover:border-primary-blue-light',
  ] : [];

  const className_ = [
    ...baseClasses,
    ...variantClasses[variant],
    paddingClasses[padding],
    ...interactiveClasses,
    className,
  ].join(' ');

  const CardComponent = onClick ? 'button' : 'div';

  return (
    <CardComponent
      className={className_}
      onClick={onClick}
    >
      {children}
    </CardComponent>
  );
};
```

### 2.3 Badge/Status コンポーネント

```typescript
// Badge.tsx
interface BadgeProps {
  variant: 'critical' | 'warning' | 'success' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  icon?: React.ReactNode;
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant,
  size = 'md',
  children,
  icon,
  pulse = false,
}) => {
  const baseClasses = [
    'inline-flex',
    'items-center',
    'font-semibold',
    'rounded-full',
    'border',
  ];

  const variantClasses = {
    critical: [
      'bg-red-100',
      'text-status-danger',
      'border-red-200',
    ],
    warning: [
      'bg-amber-100',
      'text-status-warning',
      'border-amber-200',
    ],
    success: [
      'bg-green-100',
      'text-status-success',
      'border-green-200',
    ],
    info: [
      'bg-blue-100',
      'text-status-info',
      'border-blue-200',
    ],
    neutral: [
      'bg-neutral-gray-100',
      'text-text-secondary',
      'border-neutral-gray-200',
    ],
  };

  const sizeClasses = {
    sm: ['text-xs', 'px-2', 'py-1'],
    md: ['text-sm', 'px-3', 'py-1'],
  };

  const pulseClasses = pulse ? ['animate-pulse'] : [];

  const className = [
    ...baseClasses,
    ...variantClasses[variant],
    ...sizeClasses[size],
    ...pulseClasses,
  ].join(' ');

  return (
    <span className={className}>
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </span>
  );
};
```

### 2.4 Input/Form コンポーネント

```typescript
// Input.tsx
interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'search';
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Input: React.FC<InputProps> = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled = false,
  error,
  label,
  required = false,
  size = 'md',
  icon,
  iconPosition = 'left',
}) => {
  const inputId = React.useId();

  const baseClasses = [
    'block',
    'w-full',
    'border',
    'rounded-lg',
    'transition-colors',
    'duration-200',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2',
  ];

  const sizeClasses = {
    sm: ['text-sm', 'px-3', 'py-2'],
    md: ['text-base', 'px-4', 'py-2.5'],
    lg: ['text-lg', 'px-5', 'py-3'],
  };

  const stateClasses = error
    ? [
        'border-status-danger',
        'focus:ring-status-danger',
        'focus:border-status-danger',
      ]
    : [
        'border-neutral-gray-300',
        'focus:ring-primary-blue',
        'focus:border-primary-blue',
      ];

  const disabledClasses = disabled
    ? ['bg-neutral-gray-100', 'cursor-not-allowed', 'opacity-75']
    : ['bg-white'];

  const iconClasses = icon
    ? iconPosition === 'left'
      ? ['pl-10']
      : ['pr-10']
    : [];

  const inputClassName = [
    ...baseClasses,
    ...sizeClasses[size],
    ...stateClasses,
    ...disabledClasses,
    ...iconClasses,
  ].join(' ');

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-text-primary"
        >
          {label}
          {required && <span className="text-status-danger ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div
            className={`absolute inset-y-0 ${
              iconPosition === 'left' ? 'left-0 pl-3' : 'right-0 pr-3'
            } flex items-center pointer-events-none`}
          >
            <span className="text-text-secondary">{icon}</span>
          </div>
        )}

        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={inputClassName}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
      </div>

      {error && (
        <p
          id={`${inputId}-error`}
          className="text-sm text-status-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};
```

---

## 3. 特殊コンポーネント

### 3.1 CVSSScore コンポーネント

```typescript
// CVSSScore.tsx
interface CVSSScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showBar?: boolean;
  showLabel?: boolean;
}

export const CVSSScore: React.FC<CVSSScoreProps> = ({
  score,
  size = 'md',
  showBar = true,
  showLabel = true,
}) => {
  const getSeverity = (score: number) => {
    if (score >= 9.0) return { level: 'critical', color: 'text-status-danger', bgColor: 'bg-status-danger' };
    if (score >= 7.0) return { level: 'high', color: 'text-status-warning', bgColor: 'bg-status-warning' };
    if (score >= 4.0) return { level: 'medium', color: 'text-status-warningYellow', bgColor: 'bg-status-warningYellow' };
    return { level: 'low', color: 'text-status-info', bgColor: 'bg-status-info' };
  };

  const severity = getSeverity(score);

  const sizeClasses = {
    sm: {
      score: 'text-xl',
      label: 'text-xs',
      bar: 'h-2',
    },
    md: {
      score: 'text-2xl',
      label: 'text-sm',
      bar: 'h-3',
    },
    lg: {
      score: 'text-scoreXl',
      label: 'text-base',
      bar: 'h-4',
    },
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-center">
        <span
          className={`font-bold font-numeric ${sizeClasses[size].score} ${severity.color}`}
        >
          {score.toFixed(1)}
        </span>
        {showLabel && (
          <span className={`${sizeClasses[size].label} text-text-secondary uppercase tracking-wide`}>
            CVSS
          </span>
        )}
      </div>

      {showBar && (
        <div className="flex-1 min-w-0">
          <div className={`w-full bg-neutral-gray-200 rounded-full ${sizeClasses[size].bar}`}>
            <div
              className={`${sizeClasses[size].bar} rounded-full transition-all duration-500 ${severity.bgColor}`}
              style={{ width: `${(score / 10) * 100}%` }}
            />
          </div>
          {showLabel && (
            <div className="flex justify-between text-xs text-text-secondary mt-1">
              <span>0.0</span>
              <span className="capitalize">{severity.level}</span>
              <span>10.0</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### 3.2 SystemStatusIndicator コンポーネント

```typescript
// SystemStatusIndicator.tsx
interface SystemStatusIndicatorProps {
  status: 'active' | 'inactive' | 'deprecated' | 'eol';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  pulseWhenCritical?: boolean;
}

export const SystemStatusIndicator: React.FC<SystemStatusIndicatorProps> = ({
  status,
  size = 'md',
  showLabel = true,
  pulseWhenCritical = true,
}) => {
  const statusConfig = {
    active: {
      color: 'bg-status-success',
      label: 'アクティブ',
      textColor: 'text-status-success',
      pulse: false,
    },
    inactive: {
      color: 'bg-neutral-gray-400',
      label: '非アクティブ',
      textColor: 'text-neutral-gray-400',
      pulse: false,
    },
    deprecated: {
      color: 'bg-status-warning',
      label: '廃止予定',
      textColor: 'text-status-warning',
      pulse: false,
    },
    eol: {
      color: 'bg-status-danger',
      label: 'EOL',
      textColor: 'text-status-danger',
      pulse: true,
    },
  };

  const config = statusConfig[status];

  const sizeClasses = {
    sm: {
      indicator: 'w-2 h-2',
      text: 'text-xs',
    },
    md: {
      indicator: 'w-3 h-3',
      text: 'text-sm',
    },
    lg: {
      indicator: 'w-4 h-4',
      text: 'text-base',
    },
  };

  const pulseClass = config.pulse && pulseWhenCritical ? 'animate-pulse' : '';

  return (
    <div className="flex items-center gap-2">
      <span
        className={`
          ${sizeClasses[size].indicator}
          ${config.color}
          rounded-full
          ${pulseClass}
        `}
      />
      {showLabel && (
        <span className={`${sizeClasses[size].text} ${config.textColor} font-medium`}>
          {config.label}
        </span>
      )}
    </div>
  );
};
```

### 3.3 ProgressIndicator コンポーネント

```typescript
// ProgressIndicator.tsx
interface ProgressIndicatorProps {
  value: number; // 0-100
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  value,
  max = 100,
  variant = 'default',
  size = 'md',
  showValue = true,
  showLabel = false,
  label,
  animated = true,
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  const variantClasses = {
    default: 'bg-primary-blue',
    success: 'bg-status-success',
    warning: 'bg-status-warning',
    danger: 'bg-status-danger',
  };

  const sizeClasses = {
    sm: {
      bar: 'h-2',
      text: 'text-xs',
    },
    md: {
      bar: 'h-3',
      text: 'text-sm',
    },
    lg: {
      bar: 'h-4',
      text: 'text-base',
    },
  };

  return (
    <div className="w-full">
      {(showLabel && label) && (
        <div className="flex justify-between items-center mb-2">
          <span className={`${sizeClasses[size].text} text-text-primary font-medium`}>
            {label}
          </span>
          {showValue && (
            <span className={`${sizeClasses[size].text} text-text-secondary`}>
              {value}/{max}
            </span>
          )}
        </div>
      )}

      <div className={`w-full bg-neutral-gray-200 rounded-full ${sizeClasses[size].bar} overflow-hidden`}>
        <div
          className={`
            ${sizeClasses[size].bar}
            ${variantClasses[variant]}
            rounded-full
            ${animated ? 'transition-all duration-500 ease-out' : ''}
            relative
            overflow-hidden
          `}
          style={{ width: `${percentage}%` }}
        >
          {animated && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
              style={{
                animation: 'shimmer 2s infinite',
                backgroundSize: '200% 100%',
              }}
            />
          )}
        </div>
      </div>

      {showValue && (!showLabel || !label) && (
        <div className="flex justify-between items-center mt-1">
          <span className={`${sizeClasses[size].text} text-text-secondary`}>
            0
          </span>
          <span className={`${sizeClasses[size].text} text-text-secondary`}>
            {percentage.toFixed(1)}%
          </span>
          <span className={`${sizeClasses[size].text} text-text-secondary`}>
            {max}
          </span>
        </div>
      )}
    </div>
  );
};
```

---

## 4. レイアウトコンポーネント

### 4.1 Container コンポーネント

```typescript
// Container.tsx
interface ContainerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Container: React.FC<ContainerProps> = ({
  size = 'xl',
  padding = true,
  children,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full',
  };

  const paddingClasses = padding ? 'px-4 sm:px-6 lg:px-8' : '';

  const containerClassName = [
    'mx-auto',
    sizeClasses[size],
    paddingClasses,
    className,
  ].join(' ');

  return (
    <div className={containerClassName}>
      {children}
    </div>
  );
};
```

### 4.2 Grid コンポーネント

```typescript
// Grid.tsx
interface GridProps {
  cols?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  responsive?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Grid: React.FC<GridProps> = ({
  cols = 12,
  gap = 'md',
  responsive = true,
  children,
  className = '',
}) => {
  const colClasses = responsive
    ? {
        1: 'grid-cols-1',
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
        12: 'grid-cols-4 md:grid-cols-6 lg:grid-cols-12',
      }
    : {
        1: 'grid-cols-1',
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
        6: 'grid-cols-6',
        12: 'grid-cols-12',
      };

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  };

  const gridClassName = [
    'grid',
    colClasses[cols],
    gapClasses[gap],
    className,
  ].join(' ');

  return (
    <div className={gridClassName}>
      {children}
    </div>
  );
};

// GridItem.tsx
interface GridItemProps {
  colSpan?: 1 | 2 | 3 | 4 | 6 | 12;
  children: React.ReactNode;
  className?: string;
}

export const GridItem: React.FC<GridItemProps> = ({
  colSpan = 1,
  children,
  className = '',
}) => {
  const spanClasses = {
    1: 'col-span-1',
    2: 'col-span-2',
    3: 'col-span-3',
    4: 'col-span-4',
    6: 'col-span-6',
    12: 'col-span-12',
  };

  const itemClassName = [
    spanClasses[colSpan],
    className,
  ].join(' ');

  return (
    <div className={itemClassName}>
      {children}
    </div>
  );
};
```

### 4.3 Stack コンポーネント

```typescript
// Stack.tsx
interface StackProps {
  direction?: 'horizontal' | 'vertical';
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  wrap?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Stack: React.FC<StackProps> = ({
  direction = 'vertical',
  gap = 'md',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  children,
  className = '',
}) => {
  const baseClasses = ['flex'];

  const directionClasses = {
    horizontal: 'flex-row',
    vertical: 'flex-col',
  };

  const gapClasses = {
    xs: direction === 'horizontal' ? 'space-x-1' : 'space-y-1',
    sm: direction === 'horizontal' ? 'space-x-2' : 'space-y-2',
    md: direction === 'horizontal' ? 'space-x-4' : 'space-y-4',
    lg: direction === 'horizontal' ? 'space-x-6' : 'space-y-6',
    xl: direction === 'horizontal' ? 'space-x-8' : 'space-y-8',
  };

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  };

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
  };

  const wrapClasses = wrap ? ['flex-wrap'] : [];

  const stackClassName = [
    ...baseClasses,
    directionClasses[direction],
    gapClasses[gap],
    alignClasses[align],
    justifyClasses[justify],
    ...wrapClasses,
    className,
  ].join(' ');

  return (
    <div className={stackClassName}>
      {children}
    </div>
  );
};
```

---

## 5. フィードバックコンポーネント

### 5.1 Alert コンポーネント

```typescript
// Alert.tsx
interface AlertProps {
  variant: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  variant,
  title,
  children,
  dismissible = false,
  onDismiss,
  icon,
  actions,
}) => {
  const variantClasses = {
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: 'text-blue-400',
      title: 'text-blue-800',
    },
    success: {
      container: 'bg-green-50 border-green-200 text-green-800',
      icon: 'text-green-400',
      title: 'text-green-800',
    },
    warning: {
      container: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: 'text-amber-400',
      title: 'text-amber-800',
    },
    danger: {
      container: 'bg-red-50 border-red-200 text-red-800',
      icon: 'text-red-400',
      title: 'text-red-800',
    },
  };

  const config = variantClasses[variant];

  return (
    <div className={`border rounded-lg p-4 ${config.container}`}>
      <div className="flex items-start">
        {icon && (
          <div className={`flex-shrink-0 mr-3 ${config.icon}`}>
            {icon}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={`text-sm font-medium ${config.title} mb-1`}>
              {title}
            </h3>
          )}
          <div className="text-sm">
            {children}
          </div>
          {actions && (
            <div className="mt-3">
              {actions}
            </div>
          )}
        </div>

        {dismissible && (
          <div className="flex-shrink-0 ml-3">
            <button
              type="button"
              className={`inline-flex rounded-md p-1.5 ${config.icon} hover:bg-black hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-50 focus:ring-blue-600`}
              onClick={onDismiss}
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
```

### 5.2 Loading/Spinner コンポーネント

```typescript
// LoadingSpinner.tsx
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary';
  label?: string;
  centered?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  label,
  centered = false,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const variantClasses = {
    primary: 'text-primary-blue',
    secondary: 'text-text-secondary',
  };

  const spinner = (
    <div className="flex flex-col items-center gap-2">
      <svg
        className={`animate-spin ${sizeClasses[size]} ${variantClasses[variant]}`}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label && (
        <span className="text-sm text-text-secondary animate-pulse">
          {label}
        </span>
      )}
    </div>
  );

  if (centered) {
    return (
      <div className="flex items-center justify-center min-h-32">
        {spinner}
      </div>
    );
  }

  return spinner;
};

// LoadingOverlay.tsx
interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  children: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = '読み込み中...',
  children,
}) => {
  return (
    <div className="relative">
      {children}
      {visible && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <LoadingSpinner size="lg" label={message} />
        </div>
      )}
    </div>
  );
};
```

---

## 6. ナビゲーションコンポーネント

### 6.1 Breadcrumb コンポーネント

```typescript
// Breadcrumb.tsx
interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = (
    <svg className="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  ),
}) => {
  return (
    <nav className="flex" aria-label="パンくずリスト">
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && separator}
            {item.href && !item.current ? (
              <a
                href={item.href}
                className="ml-2 text-sm font-medium text-text-secondary hover:text-primary-blue transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <span
                className={`ml-2 text-sm font-medium ${
                  item.current ? 'text-text-primary' : 'text-text-secondary'
                }`}
                aria-current={item.current ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};
```

### 6.2 Tabs コンポーネント

```typescript
// Tabs.tsx
interface TabItem {
  id: string;
  label: string;
  badge?: number;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills';
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeTab,
  onChange,
  variant = 'default',
}) => {
  const baseTabClasses = [
    'px-4',
    'py-2',
    'text-sm',
    'font-medium',
    'transition-all',
    'duration-200',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2',
    'focus:ring-primary-blue',
  ];

  const variantClasses = {
    default: {
      container: 'border-b border-neutral-gray-200',
      tab: 'border-b-2 border-transparent hover:border-neutral-gray-300',
      active: 'border-primary-blue text-primary-blue',
      inactive: 'text-text-secondary hover:text-text-primary',
      disabled: 'text-neutral-gray-400 cursor-not-allowed',
    },
    pills: {
      container: 'space-x-1',
      tab: 'rounded-lg',
      active: 'bg-primary-blue text-white',
      inactive: 'text-text-secondary hover:bg-neutral-gray-100',
      disabled: 'text-neutral-gray-400 cursor-not-allowed',
    },
  };

  const config = variantClasses[variant];

  return (
    <div className={config.container}>
      <nav className="flex space-x-8" aria-label="タブ">
        {items.map((item) => {
          const isActive = item.id === activeTab;
          const isDisabled = item.disabled;

          const tabClasses = [
            ...baseTabClasses,
            config.tab,
            isActive ? config.active : isDisabled ? config.disabled : config.inactive,
          ].join(' ');

          return (
            <button
              key={item.id}
              type="button"
              className={tabClasses}
              onClick={() => !isDisabled && onChange(item.id)}
              disabled={isDisabled}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="flex items-center gap-2">
                {item.label}
                {item.badge !== undefined && (
                  <Badge variant="neutral" size="sm">
                    {item.badge}
                  </Badge>
                )}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
```

---

## 7. テーブルコンポーネント

### 7.1 DataTable コンポーネント

```typescript
// DataTable.tsx
interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  sortBy?: keyof T;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: keyof T, direction: 'asc' | 'desc') => void;
  loading?: boolean;
  emptyMessage?: string;
  striped?: boolean;
  hover?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  sortBy,
  sortDirection,
  onSort,
  loading = false,
  emptyMessage = 'データがありません',
  striped = true,
  hover = true,
}: DataTableProps<T>) {
  const handleSort = (key: keyof T) => {
    if (!onSort) return;

    const newDirection = sortBy === key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(key, newDirection);
  };

  const getSortIcon = (key: keyof T) => {
    if (sortBy !== key) {
      return (
        <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-primary-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-primary-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
      </svg>
    );
  };

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-neutral-gray-200">
        <LoadingSpinner centered label="データを読み込んでいます..." />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-neutral-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-gray-200">
          <thead className="bg-neutral-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  scope="col"
                  className={`
                    px-6 py-3 text-xs font-medium text-text-secondary uppercase tracking-wider
                    ${alignClasses[column.align || 'left']}
                    ${column.sortable ? 'cursor-pointer hover:bg-neutral-gray-100' : ''}
                  `}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {column.sortable && getSortIcon(column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`bg-white divide-y divide-neutral-gray-200 ${striped ? 'divide-y' : ''}`}>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-text-secondary">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={`
                    ${striped && rowIndex % 2 === 1 ? 'bg-neutral-gray-50' : 'bg-white'}
                    ${hover ? 'hover:bg-neutral-gray-100' : ''}
                    transition-colors duration-150
                  `}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={`
                        px-6 py-4 whitespace-nowrap text-sm
                        ${alignClasses[column.align || 'left']}
                      `}
                    >
                      {column.render
                        ? column.render(row[column.key], row)
                        : String(row[column.key] || '-')
                      }
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 8. CSS カスタムプロパティ

```css
/* design-system.css */
:root {
  /* カラーパレット */
  --color-primary-blue: #1E3A8A;
  --color-primary-blue-light: #3B82F6;
  --color-primary-blue-dark: #1E40AF;

  --color-status-danger: #DC2626;
  --color-status-warning: #D97706;
  --color-status-warning-yellow: #EAB308;
  --color-status-success: #16A34A;
  --color-status-info: #0284C7;

  --color-neutral-gray-50: #F8FAFC;
  --color-neutral-gray-100: #F1F5F9;
  --color-neutral-gray-200: #E2E8F0;
  --color-neutral-gray-300: #CBD5E1;
  --color-neutral-gray-500: #64748B;
  --color-neutral-gray-700: #334155;
  --color-neutral-gray-900: #0F172A;

  --color-text-primary: #334155;
  --color-text-secondary: #64748B;
  --color-text-muted: #94A3B8;

  /* タイポグラフィ */
  --font-family-primary: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif;
  --font-family-mono: 'JetBrains Mono', 'Consolas', monospace;
  --font-family-numeric: 'Inter', 'Roboto', sans-serif;

  /* スペーシング */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;

  /* ボーダー半径 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* シャドウ */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

  /* Z-index */
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-fixed: 1030;
  --z-modal: 1040;
  --z-popover: 1050;
  --z-tooltip: 1060;

  /* アニメーション */
  --transition-fast: 0.15s ease;
  --transition-base: 0.2s ease;
  --transition-slow: 0.3s ease;

  /* ブレイクポイント (CSS Container Queriesで使用) */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}

/* アニメーション定義 */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes pulse-subtle {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

@keyframes alert-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(220, 38, 38, 0);
  }
}

/* ユーティリティクラス */
.animate-shimmer {
  animation: shimmer 2s infinite;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  background-size: 200% 100%;
}

.animate-pulse-subtle {
  animation: pulse-subtle 2s infinite;
}

.animate-alert-pulse {
  animation: alert-pulse 1.5s ease-in-out infinite;
}

/* レスポンシブ対応のためのコンテナクエリ */
@container (min-width: 768px) {
  .container-md\:grid-cols-2 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@container (min-width: 1024px) {
  .container-lg\:grid-cols-3 {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## 9. 実装ガイド

### 9.1 コンポーネント使用例

```typescript
// ダッシュボードカードの実装例
const SystemOverviewCard: React.FC = () => {
  return (
    <Card variant="elevated" padding="lg">
      <Stack gap="lg">
        <Stack direction="horizontal" justify="between" align="center">
          <h2 className="text-xl font-semibold text-text-primary">
            システム概要
          </h2>
          <Badge variant="info" size="sm">
            24システム
          </Badge>
        </Stack>

        <Grid cols={2} gap="md">
          <div className="text-center">
            <div className="text-3xl font-bold text-status-danger mb-1">
              3
            </div>
            <div className="text-sm text-text-secondary">
              緊急対応要
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-status-warning mb-1">
              7
            </div>
            <div className="text-sm text-text-secondary">
              注意事項あり
            </div>
          </div>
        </Grid>

        <Button variant="primary" size="md">
          詳細を確認
        </Button>
      </Stack>
    </Card>
  );
};
```

### 9.2 テーマカスタマイゼーション

```typescript
// theme-provider.tsx
interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
```

---

この統一デザインシステムにより、System Board プロジェクト全体で一貫性のあるユーザーインターフェースを実現し、開発効率の向上とユーザー体験の最適化を図ります。
