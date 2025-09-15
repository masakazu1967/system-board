/**
 * Structured logging interfaces for System Board
 * Implements the requirements for Grafana Loki error tracking
 */

/**
 * Log levels supported by the system
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/**
 * Service identifiers in the System Board architecture
 */
export type ServiceType =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'eventstore'
  | 'kafka'
  | 'redis'
  | 'external-api'
  | 'auth'
  | 'system';

/**
 * Environment types
 */
export type Environment = 'development' | 'test' | 'staging' | 'production';

/**
 * Context types for different areas of the application
 */
export type ContextType =
  | 'authentication'
  | 'authorization'
  | 'vulnerability-scan'
  | 'system-inventory'
  | 'task-management'
  | 'dependency-analysis'
  | 'external-integration'
  | 'data-persistence'
  | 'event-processing'
  | 'security'
  | 'performance'
  | 'system';

/**
 * Error categories for manufacturing security compliance
 */
export type ErrorCategory =
  | 'security-violation'
  | 'data-integrity'
  | 'external-service'
  | 'authentication-failure'
  | 'authorization-failure'
  | 'validation-error'
  | 'business-logic'
  | 'infrastructure'
  | 'performance'
  | 'unknown';

/**
 * Core error log entry interface as specified in requirements
 */
export interface ErrorLogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;

  /** Log level */
  level: LogLevel;

  /** Human-readable error message */
  message: string;

  /** Unique error ID for grouping similar errors */
  error_id: string;

  /** Stack trace (if available) */
  stack_trace?: string;

  /** Service that generated the log */
  service: ServiceType;

  /** Environment where error occurred */
  environment: Environment;
}

/**
 * Extended structured log entry with additional metadata
 */
export interface StructuredLogEntry extends ErrorLogEntry {
  /** Request correlation ID */
  request_id?: string;

  /** User ID (masked for security) */
  user_id?: string;

  /** Application context */
  context?: ContextType;

  /** Error category for compliance reporting */
  error_category?: ErrorCategory;

  /** Additional structured metadata */
  metadata?: Record<string, unknown>;

  /** HTTP method (if applicable) */
  http_method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  /** HTTP status code (if applicable) */
  http_status?: number;

  /** Request URL path (sensitive data masked) */
  url_path?: string;

  /** Response time in milliseconds */
  response_time_ms?: number;

  /** Database query execution time (if applicable) */
  db_query_time_ms?: number;

  /** Memory usage in bytes */
  memory_usage_bytes?: number;

  /** CVE or vulnerability identifier (if applicable) */
  cve_id?: string;

  /** CVSS score for vulnerabilities */
  cvss_score?: number;

  /** Affected system component */
  component?: string;

  /** IP address (masked for security) */
  ip_address?: string;
}

/**
 * Log configuration interface
 */
export interface LogConfig {
  /** Service name */
  service: ServiceType;

  /** Environment */
  environment: Environment;

  /** Minimum log level to output */
  level: LogLevel;

  /** Loki push URL */
  lokiUrl?: string;

  /** Enable console output */
  enableConsole: boolean;

  /** Enable file output */
  enableFile: boolean;

  /** Log file path */
  filePath?: string;

  /** Enable Loki transport */
  enableLoki: boolean;

  /** Additional labels for Loki */
  labels?: Record<string, string>;

  /** Mask sensitive data */
  maskSensitiveData: boolean;

  /** Custom data masking patterns */
  maskingPatterns?: RegExp[];
}

/**
 * Error grouping configuration
 */
export interface ErrorGroupingConfig {
  /** Include stack trace in error ID generation */
  includeStackTrace: boolean;

  /** Include service name in error ID generation */
  includeService: boolean;

  /** Include context in error ID generation */
  includeContext: boolean;

  /** Custom error ID generation function */
  customIdGenerator?: (entry: StructuredLogEntry) => string;
}

/**
 * Security compliance configuration
 */
export interface SecurityConfig {
  /** Enable PII masking */
  enablePiiMasking: boolean;

  /** Enable IP address masking */
  enableIpMasking: boolean;

  /** Enable email masking */
  enableEmailMasking: boolean;

  /** Custom masking patterns for manufacturing data */
  customMaskingPatterns: Array<{
    pattern: RegExp;
    replacement: string;
  }>;

  /** Preserve vulnerability data */
  preserveVulnerabilityData: boolean;

  /** Enable audit logging */
  enableAuditLogging: boolean;
}

/**
 * Performance tracking interface
 */
export interface PerformanceMetrics {
  /** Operation name */
  operation: string;

  /** Start timestamp */
  startTime: number;

  /** End timestamp */
  endTime: number;

  /** Duration in milliseconds */
  duration: number;

  /** Success status */
  success: boolean;

  /** Additional metrics */
  metrics?: Record<string, number>;
}

/**
 * Vulnerability scanning log entry
 */
export interface VulnerabilityLogEntry extends StructuredLogEntry {
  /** CVE identifier */
  cve_id: string;

  /** CVSS base score */
  cvss_score: number;

  /** Affected package name */
  package_name: string;

  /** Package version */
  package_version: string;

  /** Vulnerability severity */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';

  /** Remediation status */
  remediation_status: 'open' | 'in-progress' | 'resolved' | 'accepted-risk';

  /** Discovery timestamp */
  discovered_at: string;

  /** Last updated timestamp */
  updated_at: string;
}

/**
 * Audit log entry for compliance
 */
export interface AuditLogEntry extends StructuredLogEntry {
  /** Actor who performed the action */
  actor: string;

  /** Action performed */
  action: string;

  /** Resource affected */
  resource: string;

  /** Resource ID */
  resource_id: string;

  /** Action result */
  result: 'success' | 'failure' | 'partial';

  /** Additional audit metadata */
  audit_metadata?: Record<string, unknown>;
}