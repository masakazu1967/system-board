/**
 * System Board Structured Logging Package
 *
 * Provides comprehensive logging capabilities with Grafana Loki integration
 * for the System Board manufacturing security application.
 */

// Core types and interfaces
export * from './types';

// Main logger class
export { StructuredLogger } from './structured-logger';

// Utility classes
export { ErrorIdGenerator } from './error-id-generator';
export { DataMasker } from './data-masker';

// NestJS integration
export {
  SystemBoardLoggerService,
  LoggingModule,
  LogPerformance,
  LogAudit,
} from './nestjs-integration';

// Factory function for easy logger creation
import { StructuredLogger } from './structured-logger';
import { LogConfig, ServiceType, Environment } from './types';

/**
 * Create a logger with default configuration
 */
export function createLogger(
  service: ServiceType,
  environment: Environment = 'development',
  overrides: Partial<LogConfig> = {}
): StructuredLogger {
  const defaultConfig: LogConfig = {
    service,
    environment,
    level: (process.env.LOG_LEVEL as any) || 'info',
    lokiUrl: process.env.LOKI_URL || 'http://localhost:3100',
    enableConsole: process.env.NODE_ENV !== 'production',
    enableFile: process.env.ENABLE_FILE_LOGS === 'true',
    enableLoki: process.env.ENABLE_LOKI_LOGS !== 'false',
    filePath: process.env.LOG_FILE_PATH || `/var/log/system-board/${service}.log`,
    maskSensitiveData: process.env.MASK_SENSITIVE_DATA !== 'false',
    labels: {
      version: process.env.APP_VERSION || '0.1.0',
      ...overrides.labels,
    },
  };

  const config = { ...defaultConfig, ...overrides };
  return new StructuredLogger(config);
}

/**
 * Pre-configured loggers for common services
 */
export const loggers = {
  backend: () => createLogger('backend'),
  frontend: () => createLogger('frontend'),
  database: () => createLogger('database'),
  eventstore: () => createLogger('eventstore'),
  kafka: () => createLogger('kafka'),
  redis: () => createLogger('redis'),
  auth: () => createLogger('auth'),
  system: () => createLogger('system'),
};

// Default export
export default StructuredLogger;