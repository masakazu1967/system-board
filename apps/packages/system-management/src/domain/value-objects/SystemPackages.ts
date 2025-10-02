import { ValueObject } from 'shared';
import { Package } from './Package';

/**
 * System Packages First-Class Collection
 * パッケージコレクションの整合性管理
 */
interface SystemPackagesProps {
  packages: Package[];
}

export class SystemPackages extends ValueObject<SystemPackagesProps> {
  private constructor(props: SystemPackagesProps) {
    SystemPackages.validate(props);
    super(props);
  }

  /**
   * バリデーション
   */
  private static validate(props: SystemPackagesProps): void {
    // パッケージ名の重複チェック
    const names = props.packages.map((p) => p.getName());
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      throw new Error('Duplicate package names are not allowed');
    }

    // クリティカル脆弱性チェック
    const hasCriticalVulnerabilities = props.packages.some((p) =>
      p.hasCriticalVulnerabilities(),
    );
    if (hasCriticalVulnerabilities) {
      throw new Error(
        'Packages with critical vulnerabilities cannot be added',
      );
    }
  }

  /**
   * 空のコレクション作成
   */
  public static empty(): SystemPackages {
    return new SystemPackages({ packages: [] });
  }

  /**
   * 配列からコレクション作成
   */
  public static fromArray(packages: Package[]): SystemPackages {
    return new SystemPackages({ packages: [...packages] });
  }

  /**
   * パッケージ追加
   */
  public add(pkg: Package): SystemPackages {
    if (this.contains(pkg)) {
      throw new Error(`Package ${pkg.getName()} already exists`);
    }
    if (pkg.hasCriticalVulnerabilities()) {
      throw new Error(
        `Package ${pkg.getName()} has critical vulnerabilities and cannot be added`,
      );
    }
    const newPackages = [...this.props.packages, pkg];
    return new SystemPackages({ packages: newPackages });
  }

  /**
   * パッケージ削除
   */
  public remove(packageName: string): SystemPackages {
    const newPackages = this.props.packages.filter(
      (p) => p.getName() !== packageName,
    );
    if (newPackages.length === this.props.packages.length) {
      throw new Error(`Package ${packageName} not found`);
    }
    return new SystemPackages({ packages: newPackages });
  }

  /**
   * パッケージ更新
   */
  public update(updatedPackage: Package): SystemPackages {
    const index = this.props.packages.findIndex(
      (p) => p.getName() === updatedPackage.getName(),
    );
    if (index === -1) {
      throw new Error(`Package ${updatedPackage.getName()} not found`);
    }
    const newPackages = [...this.props.packages];
    newPackages[index] = updatedPackage;
    return new SystemPackages({ packages: newPackages });
  }

  /**
   * パッケージ存在確認
   */
  public contains(pkg: Package): boolean {
    return this.props.packages.some(
      (p) => p.getName() === pkg.getName(),
    );
  }

  /**
   * 空判定
   */
  public isEmpty(): boolean {
    return this.props.packages.length === 0;
  }

  /**
   * パッケージ数
   */
  public count(): number {
    return this.props.packages.length;
  }

  /**
   * 全パッケージ取得
   */
  public getAll(): Package[] {
    return [...this.props.packages];
  }

  /**
   * 名前でパッケージ検索
   */
  public getByName(name: string): Package | null {
    return this.props.packages.find((p) => p.getName() === name) || null;
  }

  /**
   * 脆弱性存在確認
   */
  public hasVulnerabilities(): boolean {
    return this.props.packages.some((p) => p.hasKnownVulnerabilities());
  }

  /**
   * 脆弱性パッケージ取得
   */
  public getVulnerablePackages(): Package[] {
    return this.props.packages.filter((p) => p.hasKnownVulnerabilities());
  }

  /**
   * 全パッケージセキュリティ準拠判定
   */
  public areAllSecurityCompliant(): boolean {
    return this.props.packages.every((p) => p.hasSecurityCompliance());
  }
}
