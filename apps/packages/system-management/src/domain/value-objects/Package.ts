import { ValueObject } from 'shared';

/**
 * Vulnerability Info
 * 脆弱性情報
 */
export interface VulnerabilityInfo {
  cveId: string;
  severity: string;
  cvssScore: number;
}

/**
 * Package Value Object
 * パッケージ情報
 */
interface PackageProps {
  name: string;
  version: string;
  dependencies: string[];
  vulnerabilities: VulnerabilityInfo[];
}

export class Package extends ValueObject<PackageProps> {
  private static readonly HIGH_SEVERITY_THRESHOLD = 7.0;
  private static readonly CRITICAL_SEVERITY_THRESHOLD = 9.0;

  constructor(props: PackageProps) {
    Package.validate(props);
    super(props);
  }

  /**
   * バリデーション
   */
  private static validate(props: PackageProps): void {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Package name is required');
    }
    if (!props.version || props.version.trim().length === 0) {
      throw new Error('Package version is required');
    }
  }

  /**
   * パッケージ名取得
   */
  public getName(): string {
    return this.getProps().name;
  }

  /**
   * バージョン取得
   */
  public getVersion(): string {
    return this.getProps().version;
  }

  /**
   * 依存関係取得
   */
  public getDependencies(): string[] {
    return [...this.getProps().dependencies];
  }

  /**
   * 脆弱性情報取得
   */
  public getVulnerabilities(): VulnerabilityInfo[] {
    return [...this.getProps().vulnerabilities];
  }

  /**
   * 既知の脆弱性を持つか
   */
  public hasKnownVulnerabilities(): boolean {
    return this.getProps().vulnerabilities.length > 0;
  }

  /**
   * 高深刻度の脆弱性を持つか
   */
  public hasHighSeverityVulnerabilities(): boolean {
    return this.getProps().vulnerabilities.some(
      (v) => v.cvssScore >= Package.HIGH_SEVERITY_THRESHOLD,
    );
  }

  /**
   * クリティカルな脆弱性を持つか
   */
  public hasCriticalVulnerabilities(): boolean {
    return this.getProps().vulnerabilities.some(
      (v) => v.cvssScore >= Package.CRITICAL_SEVERITY_THRESHOLD,
    );
  }

  /**
   * セキュリティ準拠判定
   */
  public hasSecurityCompliance(): boolean {
    return !this.hasCriticalVulnerabilities();
  }
}
