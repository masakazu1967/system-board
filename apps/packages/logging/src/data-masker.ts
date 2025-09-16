import { SecurityConfig } from './types';

/**
 * Data masker for sensitive information in logs
 * Implements manufacturing security compliance requirements
 */
export class DataMasker {
  private config: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enablePiiMasking: true,
      enableIpMasking: true,
      enableEmailMasking: true,
      customMaskingPatterns: [],
      preserveVulnerabilityData: true,
      enableAuditLogging: true,
      ...config,
    };
  }

  /**
   * Mask sensitive data in log messages and metadata
   */
  maskSensitiveData(data: unknown): unknown {
    if (typeof data === 'string') {
      return this.maskString(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.maskSensitiveData(item));
    }

    if (data && typeof data === 'object') {
      return this.maskObject(data as Record<string, unknown>);
    }

    return data;
  }

  /**
   * Mask sensitive patterns in strings
   */
  public maskString(input: string): string {
    let masked = input;

    // Password patterns
    if (this.config.enablePiiMasking) {
      masked = masked.replace(
        /(password|passwd|pwd|secret|token|key|api_key|access_token|refresh_token|jwt)["\s]*[:=]["\s]*([^\s"]+)/gi,
        '$1="[REDACTED]"',
      );
    }

    // Email addresses
    if (this.config.enableEmailMasking) {
      masked = masked.replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        '[EMAIL_REDACTED]',
      );
    }

    // IP addresses (preserve internal IPs)
    if (this.config.enableIpMasking) {
      masked = masked.replace(
        /(?:(?!10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)(?:\d{1,3}\.){3}\d{1,3})/g,
        '[IP_REDACTED]',
      );
    }

    // Database connection strings
    if (this.config.enablePiiMasking) {
      masked = masked.replace(
        /(postgresql|mysql|mongodb):\/\/([^:]+):([^@]+)@/g,
        '$1://[USER]:[REDACTED]@',
      );
    }

    // Credit card numbers (manufacturing companies might process payments)
    if (this.config.enablePiiMasking) {
      masked = masked.replace(
        /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        '[CARD_REDACTED]',
      );
    }

    // Social Security Numbers
    if (this.config.enablePiiMasking) {
      masked = masked.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN_REDACTED]');
    }

    // Phone numbers
    if (this.config.enablePiiMasking) {
      masked = masked.replace(
        /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
        '[PHONE_REDACTED]',
      );
    }

    // Manufacturing-specific confidential patterns
    masked = masked.replace(
      /(internal|confidential|proprietary|classified|trade[-_]?secret)/gi,
      '[CONFIDENTIAL_REDACTED]',
    );

    // Custom masking patterns
    this.config.customMaskingPatterns.forEach(({ pattern, replacement }) => {
      masked = masked.replace(pattern, replacement);
    });

    // Preserve vulnerability data if configured
    if (this.config.preserveVulnerabilityData) {
      // Don't mask CVE IDs, CVSS scores, or vulnerability-related terms
      const vulnerabilityTerms = [
        'cve-\\d{4}-\\d+',
        'cvss[\\s:]*[0-9.]+',
        '(?i)(vulnerability|exploit|security[_-]?advisory)',
      ];

      vulnerabilityTerms.forEach((term) => {
        const regex = new RegExp(term, 'gi');
        const matches = RegExp(regex).exec(input);
        if (matches) {
          matches.forEach((match) => {
            masked = masked.replace('[REDACTED]', match);
          });
        }
      });
    }

    return masked;
  }

  /**
   * Mask sensitive data in objects
   */
  private maskObject(obj: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Check if key indicates sensitive data
      if (this.isSensitiveKey(lowerKey)) {
        masked[key] = '[REDACTED]';
      } else if (lowerKey.includes('user_id') && this.config.enablePiiMasking) {
        // Mask user IDs but preserve format for debugging
        masked[key] =
          typeof value === 'string'
            ? `[USER_${value.substring(0, 4)}...]`
            : '[USER_ID_REDACTED]';
      } else {
        // Recursively mask nested data
        masked[key] = this.maskSensitiveData(value);
      }
    }

    return masked;
  }

  /**
   * Check if a key indicates sensitive data
   */
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password',
      'passwd',
      'pwd',
      'secret',
      'token',
      'key',
      'api_key',
      'apikey',
      'access_token',
      'refresh_token',
      'jwt',
      'authorization',
      'auth',
      'cookie',
      'session',
      'ssn',
      'social_security',
      'credit_card',
      'card_number',
      'cvv',
      'pin',
      'bank_account',
      'routing_number',
    ];

    return sensitiveKeys.some(
      (sensitiveKey) =>
        key.includes(sensitiveKey) ||
        key.includes(sensitiveKey.replace('_', '')),
    );
  }

  /**
   * Mask URLs to remove sensitive query parameters
   */
  maskUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const sensitiveParams = [
        'token',
        'key',
        'secret',
        'password',
        'auth',
        'api_key',
        'access_token',
        'refresh_token',
        'jwt',
      ];

      sensitiveParams.forEach((param) => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]');
        }
      });

      return urlObj.toString();
    } catch {
      // If URL parsing fails, apply string masking
      return this.maskString(url);
    }
  }

  /**
   * Generate masked version of stack trace
   */
  maskStackTrace(stackTrace: string): string {
    let masked = stackTrace;

    // Remove file paths that might contain sensitive information
    masked = masked.replace(
      /\/[^\s]+\/(?:config|secrets|private|confidential)[^\s]*/g,
      '/[SENSITIVE_PATH_REDACTED]',
    );

    // Mask any embedded credentials in file paths
    masked = this.maskString(masked);

    return masked;
  }

  /**
   * Update masking configuration
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Add custom masking pattern
   */
  addCustomPattern(pattern: RegExp, replacement: string): void {
    this.config.customMaskingPatterns.push({ pattern, replacement });
  }

  /**
   * Check if data contains potentially sensitive information
   */
  containsSensitiveData(data: string): boolean {
    const sensitivePatterns = [
      /(password|secret|token|key)/i,
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      /\b(?:\d{4}[-\s]?){3}\d{4}\b/,
      /\b\d{3}-?\d{2}-?\d{4}\b/,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(data));
  }
}
