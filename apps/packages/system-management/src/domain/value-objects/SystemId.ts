import { randomUUID } from 'crypto';
import { AggregateId } from '@system-board/shared';
import { z } from 'zod';

/**
 * System ID Zod Schema
 * UUID v4形式のバリデーション
 */
const SystemIdSchema = z.uuid({
  message: 'Invalid SystemId: must be a valid UUID',
});

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
    SystemIdSchema.parse(value);
  }

  /**
   * 有効性チェック
   */
  public static isValid(value: string): boolean {
    return SystemIdSchema.safeParse(value).success;
  }

  public toString(): string {
    return this.getValue();
  }
}
