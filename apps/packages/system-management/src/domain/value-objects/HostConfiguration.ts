import { ValueObject } from '@system-board/shared';
import { z } from 'zod';

/**
 * ホスト構成の制約定数
 */
const CPU_CORES = {
  MIN: 1,
  MAX: 256,
} as const;

const MEMORY_GB = {
  MIN: 1,
  MAX: 2048,
} as const;

const STORAGE_GB = {
  MIN: 1,
  MAX: 100000,
} as const;

/**
 * Host Configuration Zod Schema
 * ホスト構成情報のバリデーションスキーマ
 */
export const HostConfigurationSchema = z.object({
  cpu: z
    .number()
    .int({ message: 'CPU cores must be an integer' })
    .min(CPU_CORES.MIN, `CPU cores must be at least ${CPU_CORES.MIN}`)
    .max(CPU_CORES.MAX, `CPU cores must not exceed ${CPU_CORES.MAX}`),
  memory: z
    .number()
    .int({ message: 'Memory must be an integer (GB)' })
    .min(MEMORY_GB.MIN, `Memory must be at least ${MEMORY_GB.MIN}GB`)
    .max(MEMORY_GB.MAX, `Memory must not exceed ${MEMORY_GB.MAX}GB`),
  storage: z
    .number()
    .int({ message: 'Storage must be an integer (GB)' })
    .min(STORAGE_GB.MIN, `Storage must be at least ${STORAGE_GB.MIN}GB`)
    .max(STORAGE_GB.MAX, `Storage must not exceed ${STORAGE_GB.MAX}GB`),
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
