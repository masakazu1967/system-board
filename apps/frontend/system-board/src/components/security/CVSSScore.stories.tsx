import type { Meta, StoryObj } from '@storybook/react'
import { CVSSScore } from './CVSSScore'

const meta: Meta<typeof CVSSScore> = {
  title: 'Security/CVSSScore',
  component: CVSSScore,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'CVSS (Common Vulnerability Scoring System) スコアを表示するコンポーネント。スコアに応じて色とアニメーションが変化します。'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    score: {
      control: { type: 'range', min: 0, max: 10, step: 0.1 },
      description: 'CVSSスコア (0.0 - 10.0)',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'コンポーネントのサイズ'
    },
    showLabel: {
      control: { type: 'boolean' },
      description: '重要度ラベルの表示/非表示'
    },
    vector: {
      control: { type: 'text' },
      description: 'CVSSベクター文字列（ツールチップとして表示）'
    }
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Critical: Story = {
  args: {
    score: 9.8,
    vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'
  },
}

export const High: Story = {
  args: {
    score: 7.5,
    vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N'
  },
}

export const Medium: Story = {
  args: {
    score: 5.3,
    vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:N/A:N'
  },
}

export const Low: Story = {
  args: {
    score: 2.6,
    vector: 'CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N'
  },
}

export const None: Story = {
  args: {
    score: 0.0,
  },
}

export const Small: Story = {
  args: {
    score: 7.8,
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    score: 9.1,
    size: 'lg',
  },
}

export const WithoutLabel: Story = {
  args: {
    score: 8.5,
    showLabel: false,
  },
}

export const AllSeverityLevels: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <CVSSScore score={9.8} />
      <CVSSScore score={7.5} />
      <CVSSScore score={5.3} />
      <CVSSScore score={2.6} />
      <CVSSScore score={0.0} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'すべての重要度レベルの表示例'
      }
    }
  }
}

export const SizeComparison: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <CVSSScore score={9.2} size="sm" />
      <CVSSScore score={9.2} size="md" />
      <CVSSScore score={9.2} size="lg" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'サイズバリエーションの比較'
      }
    }
  }
}

export const SecurityDashboard: Story = {
  render: () => (
    <div className="p-6 bg-gray-50 rounded-lg space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">脆弱性ダッシュボード</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="text-sm font-medium text-gray-600 mb-2">最高重要度</h4>
          <CVSSScore score={9.8} size="lg" />
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="text-sm font-medium text-gray-600 mb-2">平均スコア</h4>
          <CVSSScore score={6.4} size="lg" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h4 className="text-sm font-medium text-gray-600 mb-3">検出された脆弱性</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">CVE-2023-12345</span>
            <CVSSScore score={9.8} size="sm" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">CVE-2023-67890</span>
            <CVSSScore score={7.2} size="sm" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">CVE-2023-54321</span>
            <CVSSScore score={4.8} size="sm" />
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'セキュリティダッシュボードでの使用例'
      }
    }
  }
}