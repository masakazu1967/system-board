import { createHash } from 'crypto';
import { StructuredLogEntry, ErrorGroupingConfig } from './types';

/**
 * Generates consistent error IDs for grouping similar errors
 * This enables effective error tracking and analysis in Grafana Loki
 */
export class ErrorIdGenerator {
  private config: ErrorGroupingConfig;

  constructor(config: Partial<ErrorGroupingConfig> = {}) {
    this.config = {
      includeStackTrace: false, // Don't include stack trace by default to group similar errors
      includeService: true,
      includeContext: true,
      ...config,
    };
  }

  /**
   * Generates a consistent error ID based on error characteristics
   */
  generateErrorId(entry: StructuredLogEntry): string {
    if (this.config.customIdGenerator) {
      return this.config.customIdGenerator(entry);
    }

    const components: string[] = [];

    // Always include the core error message (normalized)
    const normalizedMessage = this.normalizeMessage(entry.message);
    components.push(normalizedMessage);

    // Include service if configured
    if (this.config.includeService && entry.service) {
      components.push(entry.service);
    }

    // Include context if configured
    if (this.config.includeContext && entry.context) {
      components.push(entry.context);
    }

    // Include error category if available
    if (entry.error_category) {
      components.push(entry.error_category);
    }

    // Include stack trace signature if configured
    if (this.config.includeStackTrace && entry.stack_trace) {
      const stackSignature = this.extractStackSignature(entry.stack_trace);
      components.push(stackSignature);
    }

    // Include HTTP status if it's an HTTP error
    if (entry.http_status && entry.http_status >= 400) {
      components.push(`http_${entry.http_status}`);
    }

    // Special handling for vulnerability-related errors
    if (entry.cve_id) {
      components.push(`cve_${entry.cve_id}`);
    }

    // Create hash from components
    const signature = components.join('|');
    const hash = createHash('sha256').update(signature).digest('hex');

    // Return first 16 characters for readability
    return `err_${hash.substring(0, 16)}`;
  }

  /**
   * Normalize error message to group similar errors
   */
  private normalizeMessage(message: string): string {
    let normalized = message.toLowerCase();

    // Remove dynamic content patterns
    const patterns = [
      // UUIDs
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      // Timestamps
      /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/g,
      // Numbers (but preserve version numbers)
      /(?<![\d.])(\d{4,}|\d+\.\d{3,})(?![\d.])/g,
      // File paths
      /\/[\w/.-]+\.(js|ts|json|log)/g,
      // IP addresses
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      // Database IDs
      /\bid\s*[=:]\s*\d+/gi,
      // Request IDs
      /request[_-]id\s*[=:]\s*[\w-]+/gi,
    ];

    patterns.forEach((pattern) => {
      normalized = normalized.replace(pattern, '[DYNAMIC]');
    });

    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Extract a consistent signature from stack trace
   */
  private extractStackSignature(stackTrace: string): string {
    const lines = stackTrace.split('\n');
    const relevantLines: string[] = [];

    for (const line of lines.slice(0, 5)) {
      // Take first 5 lines
      const trimmed = line.trim();

      // Skip generic error lines
      if (
        trimmed.startsWith('Error:') ||
        trimmed.startsWith('at new ') ||
        trimmed.includes('node_modules') ||
        trimmed.includes('internal/')
      ) {
        continue;
      }

      // Extract function and file info
      const match = RegExp(/at\s+([^(]+)\s*\([^)]*\/([^/)]+):\d+:\d+\)/).exec(
        trimmed,
      );
      if (match) {
        relevantLines.push(`${match[1]}@${match[2]}`);
      } else if (trimmed.startsWith('at ')) {
        // Fallback for different stack trace formats
        const parts = trimmed.substring(3).split(' ')[0];
        relevantLines.push(parts);
      }

      if (relevantLines.length >= 3) break; // Limit to 3 entries
    }

    return relevantLines.join('->') || 'unknown_stack';
  }

  /**
   * Generate a vulnerability-specific error ID
   */
  generateVulnerabilityErrorId(
    cveId: string,
    packageName: string,
    severity: string,
  ): string {
    const components = ['vulnerability', cveId, packageName, severity];
    const signature = components.join('|');
    const hash = createHash('sha256').update(signature).digest('hex');
    return `vuln_${hash.substring(0, 16)}`;
  }

  /**
   * Generate a performance-related error ID
   */
  generatePerformanceErrorId(
    operation: string,
    threshold: number,
    actual: number,
  ): string {
    const components = [
      'performance',
      operation,
      `threshold_${threshold}`,
      `level_${Math.floor(actual / threshold)}`,
    ];
    const signature = components.join('|');
    const hash = createHash('sha256').update(signature).digest('hex');
    return `perf_${hash.substring(0, 16)}`;
  }

  /**
   * Generate a security-related error ID
   */
  generateSecurityErrorId(
    securityEvent: string,
    resource: string,
    severity: string,
  ): string {
    const components = ['security', securityEvent, resource, severity];
    const signature = components.join('|');
    const hash = createHash('sha256').update(signature).digest('hex');
    return `sec_${hash.substring(0, 16)}`;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorGroupingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
