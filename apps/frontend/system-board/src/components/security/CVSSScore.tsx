import React from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'

export interface CVSSScoreProps {
  score: number
  vector?: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const getSeverityInfo = (score: number) => {
  if (score >= 9.0) {
    return {
      level: 'Critical',
      color: 'bg-red-600 text-white',
      borderColor: 'border-red-600',
      glowColor: 'shadow-red-500/50'
    }
  } else if (score >= 7.0) {
    return {
      level: 'High',
      color: 'bg-orange-500 text-white',
      borderColor: 'border-orange-500',
      glowColor: 'shadow-orange-500/50'
    }
  } else if (score >= 4.0) {
    return {
      level: 'Medium',
      color: 'bg-yellow-500 text-black',
      borderColor: 'border-yellow-500',
      glowColor: 'shadow-yellow-500/50'
    }
  } else if (score > 0.0) {
    return {
      level: 'Low',
      color: 'bg-green-500 text-white',
      borderColor: 'border-green-500',
      glowColor: 'shadow-green-500/50'
    }
  } else {
    return {
      level: 'None',
      color: 'bg-gray-400 text-white',
      borderColor: 'border-gray-400',
      glowColor: 'shadow-gray-500/50'
    }
  }
}

const sizeClasses = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-3 py-1.5',
  lg: 'text-base px-4 py-2'
}

export const CVSSScore: React.FC<CVSSScoreProps> = ({
  score,
  vector,
  size = 'md',
  showLabel = true,
  className
}) => {
  const severityInfo = getSeverityInfo(score)
  const isCritical = score >= 9.0

  return (
    <motion.div
      className={clsx(
        'inline-flex items-center gap-2 rounded-lg font-semibold',
        severityInfo.color,
        sizeClasses[size],
        isCritical && 'animate-pulse',
        className
      )}
      whileHover={{ scale: 1.05 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      title={vector || `CVSS Score: ${score}`}
    >
      <motion.div
        className={clsx(
          'flex items-center gap-1',
          isCritical && 'animate-bounce'
        )}
      >
        {isCritical && (
          <span className="text-red-200" role="img" aria-label="Critical warning">
            🚨
          </span>
        )}
        <span className="font-bold">{score.toFixed(1)}</span>
      </motion.div>

      {showLabel && (
        <span className="text-xs opacity-90">
          {severityInfo.level}
        </span>
      )}
    </motion.div>
  )
}

export default CVSSScore