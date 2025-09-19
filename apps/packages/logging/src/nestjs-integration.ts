import { Injectable, Inject, LoggerService, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
// Using generic request interface instead of express
interface Request {
  headers: Record<string, string | string[]>;
  method?: string;
  url?: string;
  ip?: string;
  connection?: { remoteAddress?: string };
  socket?: { remoteAddress?: string };
}

import { StructuredLogger } from './structured-logger';
import { LogConfig, ContextType, ServiceType, Environment } from './types';

/**
 * NestJS service for structured logging
 */
@Injectable({ scope: Scope.REQUEST })
export class SystemBoardLoggerService implements LoggerService {
  private readonly logger: StructuredLogger;
  private readonly requestId: string;

  constructor(@Inject(REQUEST) private readonly request?: Request) {
    // Extract request ID from headers or generate one
    this.requestId =
      (request?.headers?.['x-request-id'] as string) ||
      (request as Request & { id?: string })?.id ||
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Get service configuration from environment
    const config: LogConfig = {
      service: (process.env.SERVICE_NAME as ServiceType) || 'backend',
      environment: (process.env.NODE_ENV as Environment) || 'development',
      level:
        (process.env.LOG_LEVEL as
          | 'error'
          | 'warn'
          | 'info'
          | 'debug'
          | 'verbose') || 'info',
      lokiUrl: process.env.LOKI_URL || 'http://localhost:3100',
      enableConsole: process.env.ENABLE_CONSOLE_LOGS !== 'false',
      enableFile: process.env.ENABLE_FILE_LOGS === 'true',
      enableLoki: process.env.ENABLE_LOKI_LOGS !== 'false',
      filePath:
        process.env.LOG_FILE_PATH || '/var/log/system-board/nestjs-app.log',
      maskSensitiveData: process.env.MASK_SENSITIVE_DATA !== 'false',
      labels: {
        requestId: this.requestId,
        userAgent: this.getUserAgent(request),
      },
    };

    this.logger = new StructuredLogger(config);
  }

  /**
   * LoggerService interface implementation
   */
  log(message: string, context?: string): void {
    this.info(message, { context: context as ContextType });
  }

  error(message: string, trace?: string, context?: string): void {
    const error = trace ? new Error(message) : undefined;
    if (error && trace) {
      error.stack = trace;
    }

    this.logger.error(
      typeof message === 'string' ? message : JSON.stringify(message),
      error,
      {
        context: context as ContextType,
        request_id: this.requestId,
      },
    );
  }

  warn(message: string, context?: string): void {
    this.logger.warn(
      typeof message === 'string' ? message : JSON.stringify(message),
      {
        context: context as ContextType,
        request_id: this.requestId,
      },
    );
  }

  debug(message: string, context?: string): void {
    this.logger.debug(
      typeof message === 'string' ? message : JSON.stringify(message),
      {
        context: context as ContextType,
        request_id: this.requestId,
      },
    );
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(
      typeof message === 'string' ? message : JSON.stringify(message),
      {
        context: context as ContextType,
        request_id: this.requestId,
      },
    );
  }

  /**
   * Extended logging methods specific to System Board
   */
  info(
    message: string,
    metadata: { context?: ContextType; [key: string]: unknown } = {},
  ): void {
    this.logger.info(message, {
      ...metadata,
      request_id: this.requestId,
    });
  }

  /**
   * Log HTTP requests
   */
  logHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
  ): void {
    this.logger.http(method, path, statusCode, responseTime, {
      request_id: this.requestId,
      user_id: userId,
      ip_address: this.getClientIp(),
    });
  }

  /**
   * Log vulnerability findings
   */
  logVulnerability(
    cveId: string,
    packageName: string,
    packageVersion: string,
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
    cvssScore: number,
  ): void {
    this.logger.vulnerability(
      cveId,
      packageName,
      packageVersion,
      severity,
      cvssScore,
      {
        request_id: this.requestId,
      },
    );
  }

  /**
   * Log audit events
   */
  logAudit(
    actor: string,
    action: string,
    resource: string,
    resourceId: string,
    result: 'success' | 'failure' | 'partial',
    metadata?: Record<string, unknown>,
  ): void {
    this.logger.audit(actor, action, resource, resourceId, result, {
      request_id: this.requestId,
      ip_address: this.getClientIp(),
      audit_metadata: metadata,
    });
  }

  /**
   * Log security events
   */
  logSecurity(
    event: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    resource: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.logger.security(event, severity, resource, {
      request_id: this.requestId,
      ip_address: this.getClientIp(),
      metadata,
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string,
    duration: number,
    success: boolean,
    threshold?: number,
    additionalMetrics?: Record<string, number>,
  ): void {
    this.logger.performance(
      operation,
      {
        operation,
        startTime: Date.now() - duration,
        endTime: Date.now(),
        duration,
        success,
        metrics: additionalMetrics,
      },
      threshold,
    );
  }

  /**
   * Log database operations
   */
  logDatabaseQuery(
    query: string,
    duration: number,
    success: boolean,
    error?: Error,
  ): void {
    const message = `Database query ${success ? 'completed' : 'failed'} in ${duration}ms`;

    if (success) {
      this.logger.debug(message, {
        context: 'data-persistence',
        db_query_time_ms: duration,
        request_id: this.requestId,
        metadata: {
          query: query.substring(0, 200), // Truncate long queries
        },
      });
    } else {
      this.logger.error(message, error, {
        context: 'data-persistence',
        error_category: 'infrastructure',
        db_query_time_ms: duration,
        request_id: this.requestId,
        metadata: {
          query: query.substring(0, 200),
        },
      });
    }
  }

  /**
   * Log external API calls
   */
  logExternalApiCall(
    service: string,
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    error?: Error,
  ): void {
    const success = statusCode >= 200 && statusCode < 400;

    const message = `External API call to ${service} ${method} ${endpoint} - ${statusCode} (${duration}ms)`;

    if (success) {
      this.logger.info(message, {
        context: 'external-integration',
        http_method: method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        http_status: statusCode,
        response_time_ms: duration,
        request_id: this.requestId,
        metadata: {
          external_service: service,
          endpoint,
        },
      });
    } else {
      this.logger.error(message, error, {
        context: 'external-integration',
        error_category: 'external-service',
        http_method: method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        http_status: statusCode,
        response_time_ms: duration,
        request_id: this.requestId,
        metadata: {
          external_service: service,
          endpoint,
        },
      });
    }
  }

  /**
   * Create a child logger with additional context
   */
  createChildLogger(
    context: ContextType,
    metadata: Record<string, unknown> = {},
  ): StructuredLogger {
    return this.logger.child(context, {
      ...metadata,
      request_id: this.requestId,
    });
  }

  /**
   * Get user agent from request headers
   */
  private getUserAgent(request?: Request): string {
    if (!request?.headers?.['user-agent']) {
      return 'unknown';
    }

    const userAgent = request.headers['user-agent'];
    if (Array.isArray(userAgent)) {
      return userAgent[0];
    }
    return userAgent;
  }

  /**
   * Get client IP address from request
   */
  private getClientIp(): string {
    if (!this.request) return 'unknown';

    return (
      this.request.ip ||
      this.request.connection?.remoteAddress ||
      this.request.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Get the underlying structured logger
   */
  getStructuredLogger(): StructuredLogger {
    return this.logger;
  }
}

/**
 * NestJS module configuration
 */
@Injectable()
export class LoggingModule {
  static forRoot(config?: Partial<LogConfig>) {
    return {
      module: LoggingModule,
      providers: [
        {
          provide: 'LOGGING_CONFIG',
          useValue: config,
        },
        SystemBoardLoggerService,
      ],
      exports: [SystemBoardLoggerService],
      global: true,
    };
  }
}

/**
 * Decorator for automatic performance logging
 */
export function LogPerformance(operation?: string) {
  return function (
    target: object,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      const operationName =
        operation ||
        `${(target as { constructor: { name: string } }).constructor.name}.${propertyName}`;

      // Try to get logger from this context, or create simple logger
      let logger: SystemBoardLoggerService;
      try {
        logger =
          (this as { logger?: SystemBoardLoggerService }).logger ||
          new SystemBoardLoggerService(undefined);
      } catch {
        // Fallback to console logging if NestJS context is not available
        console.log(`Performance: ${operationName}`);
        return await method.apply(this, args);
      }
      const startTime = Date.now();

      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;

        logger.logPerformance(operationName, duration, true);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.logPerformance(operationName, duration, false);
        logger.error(
          `Performance logging failed for ${operationName}`,
          error as string,
        );
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator for automatic audit logging
 */
export function LogAudit(action: string, resource: string) {
  return function (
    target: object,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      let logger: SystemBoardLoggerService;
      try {
        logger =
          (this as { logger?: SystemBoardLoggerService }).logger ||
          new SystemBoardLoggerService(undefined);
      } catch {
        // Fallback to console logging if NestJS context is not available
        console.log(`Audit: ${action} ${resource}`);
        return await method.apply(this, args);
      }

      try {
        const result = await method.apply(this, args);

        // Extract actor and resource ID from context or args
        const actor =
          (this as { currentUser?: { id: string } }).currentUser?.id ||
          'system';
        const resourceId = (args[0] as { id?: string })?.id || 'unknown';

        logger.logAudit(actor, action, resource, resourceId, 'success');
        return result;
      } catch (error) {
        const actor =
          (this as { currentUser?: { id: string } }).currentUser?.id ||
          'system';
        const resourceId = (args[0] as { id?: string })?.id || 'unknown';

        logger.logAudit(actor, action, resource, resourceId, 'failure', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };

    return descriptor;
  };
}
