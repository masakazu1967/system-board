import * as winston from 'winston';
import LokiTransport from 'winston-loki';
import { v4 as uuidv4 } from 'uuid';

import {
  StructuredLogEntry,
  LogConfig,
  LogLevel,
  ServiceType,
  Environment,
  ContextType,
  ErrorCategory,
  VulnerabilityLogEntry,
  AuditLogEntry,
  PerformanceMetrics,
} from './types';
import { ErrorIdGenerator } from './error-id-generator';
import { DataMasker } from './data-masker';

/**
 * Structured logger for System Board with Grafana Loki integration
 */
export class StructuredLogger {
  private logger: winston.Logger;
  private config: LogConfig;
  private errorIdGenerator: ErrorIdGenerator;
  private dataMasker: DataMasker;

  constructor(config: LogConfig) {
    this.config = config;
    this.errorIdGenerator = new ErrorIdGenerator();
    this.dataMasker = new DataMasker({
      enablePiiMasking: config.maskSensitiveData,
      preserveVulnerabilityData: true,
    });

    this.setupLogger();
  }

  /**
   * Setup Winston logger with appropriate transports
   */
  private setupLogger(): void {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          ),
        })
      );
    }

    // File transport
    if (this.config.enableFile && this.config.filePath) {
      transports.push(
        new winston.transports.File({
          filename: this.config.filePath,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    // Loki transport
    if (this.config.enableLoki && this.config.lokiUrl) {
      transports.push(
        new LokiTransport({
          host: this.config.lokiUrl,
          labels: {
            job: 'system-board',
            service: this.config.service,
            environment: this.config.environment,
            ...this.config.labels,
          },
          format: winston.format.json(),
          replaceTimestamp: true,
          onConnectionError: (err) => {
            console.error('Loki connection error:', err);
          },
        })
      );
    }

    this.logger = winston.createLogger({
      level: this.config.level,
      transports,
      defaultMeta: {
        service: this.config.service,
        environment: this.config.environment,
      },
    });
  }

  /**
   * Create a structured log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata: Partial<StructuredLogEntry> = {}
  ): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.config.maskSensitiveData ? this.dataMasker.maskString(message) : message,
      error_id: '',
      service: this.config.service,
      environment: this.config.environment,
      request_id: metadata.request_id || this.generateRequestId(),
      ...metadata,
    };

    // Generate error ID for error and warning levels
    if (level === 'error' || level === 'warn') {
      entry.error_id = this.errorIdGenerator.generateErrorId(entry);
    }

    // Mask sensitive data in metadata
    if (this.config.maskSensitiveData && entry.metadata) {
      entry.metadata = this.dataMasker.maskSensitiveData(entry.metadata);
    }

    // Mask stack trace
    if (entry.stack_trace && this.config.maskSensitiveData) {
      entry.stack_trace = this.dataMasker.maskStackTrace(entry.stack_trace);
    }

    // Mask URL path
    if (entry.url_path && this.config.maskSensitiveData) {
      entry.url_path = this.dataMasker.maskUrl(entry.url_path);
    }

    return entry;
  }

  /**
   * Generate a request ID if not provided
   */
  private generateRequestId(): string {
    return `req_${uuidv4().substring(0, 8)}`;
  }

  /**
   * Log an error
   */
  error(
    message: string,
    error?: Error,
    metadata: Partial<StructuredLogEntry> = {}
  ): void {
    const entry = this.createLogEntry('error', message, {
      ...metadata,
      stack_trace: error?.stack,
      error_category: metadata.error_category || 'unknown',
    });

    this.logger.error(entry);
  }

  /**
   * Log a warning
   */
  warn(
    message: string,
    metadata: Partial<StructuredLogEntry> = {}
  ): void {
    const entry = this.createLogEntry('warn', message, metadata);
    this.logger.warn(entry);
  }

  /**
   * Log an info message
   */
  info(
    message: string,
    metadata: Partial<StructuredLogEntry> = {}
  ): void {
    const entry = this.createLogEntry('info', message, metadata);
    this.logger.info(entry);
  }

  /**
   * Log a debug message
   */
  debug(
    message: string,
    metadata: Partial<StructuredLogEntry> = {}
  ): void {
    const entry = this.createLogEntry('debug', message, metadata);
    this.logger.debug(entry);
  }

  /**
   * Log a verbose message
   */
  verbose(
    message: string,
    metadata: Partial<StructuredLogEntry> = {}
  ): void {
    const entry = this.createLogEntry('verbose', message, metadata);
    this.logger.verbose(entry);
  }

  /**
   * Log a vulnerability finding
   */
  vulnerability(
    cveId: string,
    packageName: string,
    packageVersion: string,
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
    cvssScore: number,
    metadata: Partial<VulnerabilityLogEntry> = {}
  ): void {
    const entry: VulnerabilityLogEntry = {
      ...this.createLogEntry('error', `Vulnerability detected: ${cveId}`, {
        error_category: 'security-violation',
        context: 'vulnerability-scan',
        ...metadata,
      }),
      cve_id: cveId,
      package_name: packageName,
      package_version: packageVersion,
      severity,
      cvss_score: cvssScore,
      remediation_status: metadata.remediation_status || 'open',
      discovered_at: metadata.discovered_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Generate vulnerability-specific error ID
    entry.error_id = this.errorIdGenerator.generateVulnerabilityErrorId(
      cveId,
      packageName,
      severity
    );

    this.logger.error(entry);
  }

  /**
   * Log an audit event
   */
  audit(
    actor: string,
    action: string,
    resource: string,
    resourceId: string,
    result: 'success' | 'failure' | 'partial',
    metadata: Partial<AuditLogEntry> = {}
  ): void {
    const entry: AuditLogEntry = {
      ...this.createLogEntry('info', `Audit: ${actor} ${action} ${resource}`, {
        context: 'security',
        ...metadata,
      }),
      actor: this.config.maskSensitiveData ? this.dataMasker.maskString(actor) : actor,
      action,
      resource,
      resource_id: resourceId,
      result,
      audit_metadata: this.config.maskSensitiveData
        ? this.dataMasker.maskSensitiveData(metadata.audit_metadata)
        : metadata.audit_metadata,
    };

    this.logger.info(entry);
  }

  /**
   * Log performance metrics
   */
  performance(
    operation: string,
    metrics: PerformanceMetrics,
    threshold?: number
  ): void {
    const isSlowOperation = threshold ? metrics.duration > threshold : false;
    const level: LogLevel = isSlowOperation ? 'warn' : 'info';

    const entry = this.createLogEntry(
      level,
      `Performance: ${operation} took ${metrics.duration}ms`,
      {
        context: 'performance',
        response_time_ms: metrics.duration,
        metadata: {
          operation,
          success: metrics.success,
          threshold,
          ...metrics.metrics,
        },
      }
    );

    // Generate performance error ID for slow operations
    if (isSlowOperation && threshold) {
      entry.error_id = this.errorIdGenerator.generatePerformanceErrorId(
        operation,
        threshold,
        metrics.duration
      );
    }

    this.logger[level](entry);
  }

  /**
   * Log HTTP request/response
   */
  http(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    metadata: Partial<StructuredLogEntry> = {}
  ): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    const entry = this.createLogEntry(
      level,
      `HTTP ${method} ${path} ${statusCode} - ${responseTime}ms`,
      {
        http_method: method as any,
        http_status: statusCode,
        url_path: path,
        response_time_ms: responseTime,
        context: 'authentication',
        ...metadata,
      }
    );

    this.logger[level](entry);
  }

  /**
   * Log security events
   */
  security(
    event: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    resource: string,
    metadata: Partial<StructuredLogEntry> = {}
  ): void {
    const level: LogLevel = severity === 'critical' ? 'error' : 'warn';

    const entry = this.createLogEntry(
      level,
      `Security event: ${event}`,
      {
        context: 'security',
        error_category: 'security-violation',
        metadata: {
          security_event: event,
          severity,
          resource,
        },
        ...metadata,
      }
    );

    // Generate security-specific error ID
    entry.error_id = this.errorIdGenerator.generateSecurityErrorId(
      event,
      resource,
      severity
    );

    this.logger[level](entry);
  }

  /**
   * Create a child logger with additional context
   */
  child(
    context: ContextType,
    additionalMetadata: Record<string, any> = {}
  ): StructuredLogger {
    const childConfig: LogConfig = {
      ...this.config,
      labels: {
        ...this.config.labels,
        context,
        ...additionalMetadata,
      },
    };

    return new StructuredLogger(childConfig);
  }

  /**
   * Update logger configuration
   */
  updateConfig(newConfig: Partial<LogConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.setupLogger();
  }

  /**
   * Gracefully close the logger
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      // Winston logger close method doesn't accept callback in newer versions
      this.logger.close();
      resolve();
    });
  }
}