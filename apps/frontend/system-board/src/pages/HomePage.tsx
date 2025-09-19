import { motion } from 'framer-motion'
import { ChartBarIcon, ShieldCheckIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'

export default function HomePage() {
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <motion.main
        className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <motion.div
          className="flex items-center gap-4 mb-8"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <ShieldCheckIcon className="w-12 h-12 text-blue-600" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            System Board
          </h1>
        </motion.div>

        <motion.div
          className="text-center sm:text-left max-w-2xl"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
            セキュリティリスク管理システム
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            製造業向けITシステムの脆弱性とライフサイクル管理を効率的に行うプラットフォーム
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <motion.div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <ComputerDesktopIcon className="w-8 h-8 text-blue-500 mb-4" />
            <h3 className="font-semibold text-lg mb-2">システム管理</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Host → OS → Middleware → Framework → Package の階層構造でIT資産を管理
            </p>
          </motion.div>

          <motion.div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <ShieldCheckIcon className="w-8 h-8 text-green-500 mb-4" />
            <h3 className="font-semibold text-lg mb-2">脆弱性管理</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              CVE脆弱性情報とEndOfLifeデータの統合管理でセキュリティリスクを可視化
            </p>
          </motion.div>

          <motion.div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <ChartBarIcon className="w-8 h-8 text-purple-500 mb-4" />
            <h3 className="font-semibold text-lg mb-2">分析・レポート</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              依存関係の可視化と包括的なセキュリティ状況の分析レポート機能
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          className="flex gap-4 items-center flex-col sm:flex-row mt-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <motion.button
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ShieldCheckIcon className="w-5 h-5" />
            システム開始
          </motion.button>
          <motion.button
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            ドキュメント
          </motion.button>
        </motion.div>
      </motion.main>

      <motion.footer
        className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center text-sm text-gray-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <span>© 2025 System Board. All rights reserved.</span>
      </motion.footer>
    </div>
  )
}