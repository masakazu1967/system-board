import { randomUUID } from 'crypto';
import { AggregateId } from 'shared';

/**
 * System ID Value Object
 * システムの一意識別子
 */
export class SystemId extends AggregateId {
  private constructor(value: string) {
    super(value);
    SystemId.validate(value);
  }

  /**
   * 新しいSystemIdを生成
   */
  public static generate(): SystemId {
    return new SystemId(randomUUID());
  }

  /**
   * 文字列からSystemIdを作成
   */
  public static fromString(value: string): SystemId {
    return new SystemId(value);
  }

  /**
   * EventStoreのストリーム名に変換
   */
  public toStreamName(): string {
    return `System-${this.getValue()}`;
  }

  /**
   * バリデーション
   */
  public static validate(value: string): void {
    if (!SystemId.isValid(value)) {
      throw new Error(`Invalid SystemId: ${value}`);
    }
  }

  /**
   * 有効性チェック
   */
  public static isValid(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }
    // UUID形式チェック
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  public toString(): string {
    return this.getValue();
  }
}
