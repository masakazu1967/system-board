/**
 * Security Classification Enumeration
 * セキュリティ分類
 */
export enum SecurityClassification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
}

/**
 * SecurityClassification ヘルパー関数
 */
export class SecurityClassificationHelper {
  /**
   * 文字列からSecurityClassificationへ変換
   */
  public static fromString(value: string): SecurityClassification {
    const upperValue = value.toUpperCase();
    if (
      !Object.values(SecurityClassification).includes(
        upperValue as SecurityClassification,
      )
    ) {
      throw new Error(`Invalid SecurityClassification: ${value}`);
    }
    return upperValue as SecurityClassification;
  }

  /**
   * 有効性チェック
   */
  public static isValid(value: string): boolean {
    const upperValue = value.toUpperCase();
    return Object.values(SecurityClassification).includes(
      upperValue as SecurityClassification,
    );
  }

  /**
   * セキュリティレベル取得（数値）
   */
  public static getLevel(classification: SecurityClassification): number {
    const levels = {
      [SecurityClassification.PUBLIC]: 1,
      [SecurityClassification.INTERNAL]: 2,
      [SecurityClassification.CONFIDENTIAL]: 3,
      [SecurityClassification.RESTRICTED]: 4,
    };
    return levels[classification];
  }

  /**
   * 高セキュリティ判定
   */
  public static isHighSecurity(
    classification: SecurityClassification,
  ): boolean {
    return (
      classification === SecurityClassification.CONFIDENTIAL ||
      classification === SecurityClassification.RESTRICTED
    );
  }
}
