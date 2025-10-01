/**
 * System Type Enumeration
 * システム種別
 */
export enum SystemType {
  WEB = 'WEB',
  API = 'API',
  DATABASE = 'DATABASE',
  BATCH = 'BATCH',
  MIDDLEWARE = 'MIDDLEWARE',
  MONITORING = 'MONITORING',
}

/**
 * SystemType ヘルパー関数
 */
export class SystemTypeHelper {
  /**
   * 文字列からSystemTypeへ変換
   */
  public static fromString(value: string): SystemType {
    const upperValue = value.toUpperCase();
    if (!Object.values(SystemType).includes(upperValue as SystemType)) {
      throw new Error(`Invalid SystemType: ${value}`);
    }
    return upperValue as SystemType;
  }

  /**
   * 有効性チェック
   */
  public static isValid(value: string): boolean {
    const upperValue = value.toUpperCase();
    return Object.values(SystemType).includes(upperValue as SystemType);
  }
}
