import { PrimitiveValueObject } from 'shared';
import { z } from 'zod';

/**
 * System Name Constants
 */
const MIN_LENGTH = 1;
const MAX_LENGTH = 255;

/**
 * System Name Zod Schema
 * システム名（1-255文字、一意制約）のバリデーションスキーマ
 */
export const SystemNameSchema = z
  .string()
  .min(MIN_LENGTH, `System name must be at least ${MIN_LENGTH} character`)
  .max(MAX_LENGTH, `System name must not exceed ${MAX_LENGTH} characters`)
  .trim();

/**
 * System Name Value Object
 * システム名（1-255文字、一意制約）
 */
export class SystemName extends PrimitiveValueObject<string> {
  public static readonly MIN_LENGTH = MIN_LENGTH;
  public static readonly MAX_LENGTH = MAX_LENGTH;

  private constructor(value: string) {
    super(value);
  }

  /**
   * ファクトリーメソッド: バリデーション付き作成
   */
  public static create(value: string): SystemName {
    const validatedValue = SystemNameSchema.parse(value);
    return new SystemName(validatedValue);
  }

  /**
   * ファクトリーメソッド: バリデーションなし作成（内部使用のみ）
   */
  public static createUnsafe(value: string): SystemName {
    return new SystemName(value);
  }

  /**
   * バリデーションのみ実行
   */
  public static validate(value: string): void {
    SystemNameSchema.parse(value);
  }

  /**
   * 有効性チェック
   */
  public static isValid(value: string): boolean {
    return SystemNameSchema.safeParse(value).success;
  }

  public toString(): string {
    return this.getValue();
  }
}
