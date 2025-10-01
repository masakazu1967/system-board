/**
 * System Status Enumeration
 * システム状態
 */
export enum SystemStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  DECOMMISSIONED = 'DECOMMISSIONED',
}

/**
 * SystemStatus ヘルパー関数
 */
export class SystemStatusHelper {
  /**
   * 文字列からSystemStatusへ変換
   */
  public static fromString(value: string): SystemStatus {
    const upperValue = value.toUpperCase();
    if (!Object.values(SystemStatus).includes(upperValue as SystemStatus)) {
      throw new Error(`Invalid SystemStatus: ${value}`);
    }
    return upperValue as SystemStatus;
  }

  /**
   * 有効性チェック
   */
  public static isValid(value: string): boolean {
    const upperValue = value.toUpperCase();
    return Object.values(SystemStatus).includes(upperValue as SystemStatus);
  }

  /**
   * アクティブ状態判定
   */
  public static isActive(status: SystemStatus): boolean {
    return status === SystemStatus.ACTIVE;
  }

  /**
   * 廃止済み判定
   */
  public static isDecommissioned(status: SystemStatus): boolean {
    return status === SystemStatus.DECOMMISSIONED;
  }
}
