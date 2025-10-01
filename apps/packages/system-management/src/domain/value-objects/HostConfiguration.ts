import { ValueObject } from 'shared';

/**
 * Host Configuration Value Object
 * ホスト構成情報
 */
interface HostConfigurationProps {
  cpu: number;
  memory: number;
  storage: number;
  encryptionEnabled: boolean;
}

export class HostConfiguration extends ValueObject<HostConfigurationProps> {
  constructor(props: HostConfigurationProps) {
    HostConfiguration.validate(props);
    super(props);
  }

  /**
   * バリデーション
   */
  private static validate(props: HostConfigurationProps): void {
    if (props.cpu <= 0) {
      throw new Error('CPU must be greater than 0');
    }
    if (props.memory <= 0) {
      throw new Error('Memory must be greater than 0');
    }
    if (props.storage <= 0) {
      throw new Error('Storage must be greater than 0');
    }
  }

  /**
   * 暗号化有効判定
   */
  public isEncryptionEnabled(): boolean {
    return this.getProps().encryptionEnabled;
  }

  /**
   * CPU取得
   */
  public getCpu(): number {
    return this.getProps().cpu;
  }

  /**
   * メモリ取得
   */
  public getMemory(): number {
    return this.getProps().memory;
  }

  /**
   * ストレージ取得
   */
  public getStorage(): number {
    return this.getProps().storage;
  }
}
