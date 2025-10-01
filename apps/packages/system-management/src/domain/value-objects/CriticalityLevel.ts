import { PrimitiveValueObject } from 'shared';

/**
 * Criticality Level Value Object
 * 重要度レベル（1-5）
 */
export class CriticalityLevel extends PrimitiveValueObject<number> {
  private static readonly MIN_LEVEL = 1;
  private static readonly MAX_LEVEL = 5;
  private static readonly HIGH_CRITICALITY_THRESHOLD = 4;

  constructor(value: number) {
    CriticalityLevel.validate(value);
    super(value);
  }

  /**
   * バリデーション
   */
  public static validate(value: number): void {
    if (!CriticalityLevel.isValid(value)) {
      throw new Error(
        `Invalid CriticalityLevel: must be between ${CriticalityLevel.MIN_LEVEL} and ${CriticalityLevel.MAX_LEVEL}`,
      );
    }
  }

  /**
   * 有効性チェック
   */
  public static isValid(value: number): boolean {
    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= CriticalityLevel.MIN_LEVEL &&
      value <= CriticalityLevel.MAX_LEVEL
    );
  }

  /**
   * 高重要度判定
   */
  public isHighCriticality(): boolean {
    return this.getValue() >= CriticalityLevel.HIGH_CRITICALITY_THRESHOLD;
  }

  public toString(): string {
    return this.getValue().toString();
  }
}
