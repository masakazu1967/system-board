import { ValueObject } from '@system-board/shared';
import { z } from 'zod';

/**
 * Package Constants
 */
const HIGH_SEVERITY_THRESHOLD = 7.0;
const CRITICAL_SEVERITY_THRESHOLD = 9.0;
const MIN_CVSS_SCORE = 0.0;
const MAX_CVSS_SCORE = 10.0;

/**
 * Vulnerability Info Zod Schema
 * 脆弱性情報のバリデーションスキーマ
 */
export const VulnerabilityInfoSchema = z.object({
  cveId: z
    .string()
    .min(1, 'CVE ID is required')
    .regex(/^CVE-\d{4}-\d{4,}$/, 'CVE ID must match format CVE-YYYY-NNNN'),
  severity: z.string().min(1, 'Severity is required'),
  cvssScore: z
    .number()
    .min(MIN_CVSS_SCORE, `CVSS score must be at least ${MIN_CVSS_SCORE}`)
    .max(MAX_CVSS_SCORE, `CVSS score must not exceed ${MAX_CVSS_SCORE}`),
});

/**
 * Vulnerability Info
 * 脆弱性情報
 */
export type VulnerabilityInfo = z.infer<typeof VulnerabilityInfoSchema>;

/**
 * Package Zod Schema
 * パッケージ情報のバリデーションスキーマ
 */
export const PackageSchema = z.object({
  name: z.string().min(1, 'Package name is required'),
  version: z.string().min(1, 'Package version is required'),
  dependencies: z.array(z.string()).default([]),
  vulnerabilities: z.array(VulnerabilityInfoSchema).default([]),
});

/**
 * Package Value Object
 * パッケージ情報
 */
export type PackageProps = z.infer<typeof PackageSchema>;

export class Package extends ValueObject<PackageProps> {
  public static readonly HIGH_SEVERITY_THRESHOLD = HIGH_SEVERITY_THRESHOLD;
  public static readonly CRITICAL_SEVERITY_THRESHOLD =
    CRITICAL_SEVERITY_THRESHOLD;

  private constructor(props: PackageProps) {
    super(props);
  }

  /**
   * ファクトリーメソッド: バリデーション付き作成
   */
  public static create(props: PackageProps): Package {
    const validatedProps = PackageSchema.parse(props);
    return new Package(validatedProps);
  }

  /**
   * ファクトリーメソッド: バリデーションなし作成（内部使用のみ）
   */
  public static createUnsafe(props: PackageProps): Package {
    return new Package(props);
  }

  /**
   * バリデーションのみ実行
   */
  public static validate(props: PackageProps): void {
    PackageSchema.parse(props);
  }

  /**
   * 有効性チェック
   */
  public static isValid(props: PackageProps): boolean {
    return PackageSchema.safeParse(props).success;
  }

  /**
   * パッケージ名取得
   */
  public getName(): string {
    return this.props.name;
  }

  /**
   * バージョン取得
   */
  public getVersion(): string {
    return this.props.version;
  }

  /**
   * 依存関係取得
   */
  public getDependencies(): string[] {
    return [...this.props.dependencies];
  }

  /**
   * 脆弱性情報取得
   */
  public getVulnerabilities(): VulnerabilityInfo[] {
    return [...this.props.vulnerabilities];
  }

  /**
   * 既知の脆弱性を持つか
   */
  public hasKnownVulnerabilities(): boolean {
    return this.props.vulnerabilities.length > 0;
  }

  /**
   * 高深刻度の脆弱性を持つか
   */
  public hasHighSeverityVulnerabilities(): boolean {
    return this.props.vulnerabilities.some(
      (v) => v.cvssScore >= Package.HIGH_SEVERITY_THRESHOLD,
    );
  }

  /**
   * クリティカルな脆弱性を持つか
   */
  public hasCriticalVulnerabilities(): boolean {
    return this.props.vulnerabilities.some(
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
