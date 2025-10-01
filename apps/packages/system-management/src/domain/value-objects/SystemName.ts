import { PrimitiveValueObject } from 'shared';

/**
 * System Name Value Object
 * システム名（1-255文字、一意制約）
 */
export class SystemName extends PrimitiveValueObject<string> {
  private static readonly MIN_LENGTH = 1;
  private static readonly MAX_LENGTH = 255;

  constructor(value: string) {
    SystemName.validate(value);
    super(value);
  }

  /**
   * バリデーション
   */
  public static validate(value: string): void {
    if (!SystemName.isValid(value)) {
      throw new Error(
        `Invalid SystemName: must be between ${SystemName.MIN_LENGTH} and ${SystemName.MAX_LENGTH} characters`,
      );
    }
  }

  /**
   * 有効性チェック
   */
  public static isValid(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }
    const trimmedValue = value.trim();
    return (
      trimmedValue.length >= SystemName.MIN_LENGTH &&
      trimmedValue.length <= SystemName.MAX_LENGTH
    );
  }

  public toString(): string {
    return this.getValue();
  }
}
