import { ValueObject } from 'shared';
import { z } from 'zod';

/**
 * Host Configuration Zod Schema
 * ホスト構成情報のバリデーションスキーマ
 */
export const HostConfigurationSchema = z.object({
  cpu: z
    .number()
    .int({ message: 'CPU cores must be an integer' })
    .min(1, 'CPU cores must be at least 1')
    .max(256, 'CPU cores must not exceed 256'),
  memory: z
    .number()
    .int({ message: 'Memory must be an integer (GB)' })
    .min(1, 'Memory must be at least 1GB')
    .max(2048, 'Memory must not exceed 2048GB'),
  storage: z
    .number()
    .int({ message: 'Storage must be an integer (GB)' })
    .min(1, 'Storage must be at least 1GB')
    .max(100000, 'Storage must not exceed 100000GB'),
  encryptionEnabled: z.boolean(),
});

/**
 * Host Configuration Value Object
 * ホスト構成情報
 */
export type HostConfigurationProps = z.infer<typeof HostConfigurationSchema>;

export class HostConfiguration extends ValueObject<HostConfigurationProps> {
  private constructor(props: HostConfigurationProps) {
    super(props);
  }

  /**
   * ファクトリーメソッド: バリデーション付き作成
   */
  public static create(props: HostConfigurationProps): HostConfiguration {
    const validatedProps = HostConfigurationSchema.parse(props);
    return new HostConfiguration(validatedProps);
  }

  /**
   * ファクトリーメソッド: バリデーションなし作成（内部使用のみ）
   */
  public static createUnsafe(props: HostConfigurationProps): HostConfiguration {
    return new HostConfiguration(props);
  }

  /**
   * バリデーションのみ実行
   */
  public static validate(props: HostConfigurationProps): void {
    HostConfigurationSchema.parse(props);
  }

  /**
   * バリデーション結果確認
   */
  public static isValid(props: HostConfigurationProps): boolean {
    return HostConfigurationSchema.safeParse(props).success;
  }

  /**
   * 暗号化有効判定
   */
  public isEncryptionEnabled(): boolean {
    return this.props.encryptionEnabled;
  }

  /**
   * CPU取得
   */
  public getCpu(): number {
    return this.props.cpu;
  }

  /**
   * メモリ取得
   */
  public getMemory(): number {
    return this.props.memory;
  }

  /**
   * ストレージ取得
   */
  public getStorage(): number {
    return this.props.storage;
  }
}
