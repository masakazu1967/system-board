import { PrimitiveValueObject } from './ValueObject';

/**
 * Entity ID Base Class
 * エンティティIDの基底クラス
 */
export abstract class EntityId extends PrimitiveValueObject<string> {
  constructor(value: string) {
    super(value);
  }
}

/**
 * Abstract Entity Base Class
 * エンティティの基底抽象クラス
 * 同一性による等価性を保証
 */
export abstract class AbstractEntity<T extends EntityId> {
  protected readonly _id: T;

  constructor(id: T) {
    this._id = id;
  }

  /**
   * エンティティIDを取得
   */
  public getId(): T {
    return this._id;
  }

  /**
   * エンティティの等価性比較（同一性ベース）
   */
  public equals(entity?: AbstractEntity<T>): boolean {
    if (entity === null || entity === undefined) {
      return false;
    }
    if (this === entity) {
      return true;
    }
    return this._id.equals(entity._id);
  }
}

/**
 * Generic Entity Class
 * 汎用エンティティクラス
 */
export abstract class Entity<T extends EntityId> extends AbstractEntity<T> {
  constructor(id: T) {
    super(id);
  }
}
