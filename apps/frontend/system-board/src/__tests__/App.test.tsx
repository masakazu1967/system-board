import React from 'react'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '../App'

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const {
        whileHover, whileTap, initial, animate, transition, exit,
        layout, layoutId, drag, dragConstraints, dragElastic,
        ...htmlProps
      } = props
      return <div {...htmlProps}>{children}</div>
    },
    main: ({ children, ...props }: any) => {
      const {
        whileHover, whileTap, initial, animate, transition, exit,
        layout, layoutId, drag, dragConstraints, dragElastic,
        ...htmlProps
      } = props
      return <main {...htmlProps}>{children}</main>
    },
    footer: ({ children, ...props }: any) => {
      const {
        whileHover, whileTap, initial, animate, transition, exit,
        layout, layoutId, drag, dragConstraints, dragElastic,
        ...htmlProps
      } = props
      return <footer {...htmlProps}>{children}</footer>
    },
    button: ({ children, ...props }: any) => {
      const {
        whileHover, whileTap, initial, animate, transition, exit,
        layout, layoutId, drag, dragConstraints, dragElastic,
        ...htmlProps
      } = props
      return <button {...htmlProps}>{children}</button>
    },
  },
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('App', () => {
  it('renders System Board title', () => {
    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    )

    expect(screen.getByText('System Board')).toBeInTheDocument()
  })

  it('renders the main description', () => {
    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    )

    expect(screen.getByText('セキュリティリスク管理システム')).toBeInTheDocument()
  })

  it('renders feature cards', () => {
    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    )

    expect(screen.getByText('システム管理')).toBeInTheDocument()
    expect(screen.getByText('脆弱性管理')).toBeInTheDocument()
    expect(screen.getByText('分析・レポート')).toBeInTheDocument()
  })
})