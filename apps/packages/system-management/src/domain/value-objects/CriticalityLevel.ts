import { PrimitiveValueObject } from '@system-board/shared';
import { z } from 'zod';

/**
 * Criticality Level Constants
 */
const MIN_LEVEL = 1;
const MAX_LEVEL = 5;
const HIGH_CRITICALITY_THRESHOLD = 4;

/**
 * Criticality Level Zod Schema
 * 重要度レベル（1-5）のバリデーションスキーマ
 */
export const CriticalityLevelSchema = z
  .number()
  .int({ message: 'Criticality level must be an integer' })
  .min(MIN_LEVEL, `Criticality level must be at least ${MIN_LEVEL}`)
  .max(MAX_LEVEL, `Criticality level must not exceed ${MAX_LEVEL}`);

/**
 * Criticality Level Value Object
 * 重要度レベル（1-5）
 */
export class CriticalityLevel extends PrimitiveValueObject<number> {
  public static readonly MIN_LEVEL = MIN_LEVEL;
  public static readonly MAX_LEVEL = MAX_LEVEL;
  public static readonly HIGH_CRITICALITY_THRESHOLD =
    HIGH_CRITICALITY_THRESHOLD;

  private constructor(value: number) {
    super(value);
  }

  /**
   * ファクトリーメソッド: バリデーション付き作成
   */
  public static create(value: number): CriticalityLevel {
    const validatedValue = CriticalityLevelSchema.parse(value);
    return new CriticalityLevel(validatedValue);
  }

  /**
   * ファクトリーメソッド: バリデーションなし作成（内部使用のみ）
   */
  public static createUnsafe(value: number): CriticalityLevel {
    return new CriticalityLevel(value);
  }

  /**
   * バリデーションのみ実行
   */
  public static validate(value: number): void {
    CriticalityLevelSchema.parse(value);
  }

  /**
   * 有効性チェック
   */
  public static isValid(value: number): boolean {
    return CriticalityLevelSchema.safeParse(value).success;
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
