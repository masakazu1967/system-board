import deepEqual from 'deep-equal';

/**
 * Abstract Value Object Base Class
 * 値オブジェクトの基底抽象クラス
 * 不変性と等価性を保証
 */
export abstract class AbstractValueObject<T> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = Object.freeze(props);
  }

  /**
   * 値オブジェクトの等価性比較
   */
  public equals(vo?: AbstractValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (vo.props === undefined) {
      return false;
    }
    return deepEqual(this.props, vo.props);
  }
}

/**
 * Primitive Value Object
 * プリミティブ型の値オブジェクト基底クラス
 */
export abstract class PrimitiveValueObject<
  T extends string | number | boolean | bigint,
> extends AbstractValueObject<T> {
  protected constructor(value: T) {
    super(value);
  }

  public getValue(): T {
    return this.props;
  }
}

interface Props {
  [key: string]: any;
}

/**
 * Generic Value Object
 * 複数プロパティを持つ値オブジェクト基底クラス
 */
export abstract class ValueObject<
  PROPS extends Props,
> extends AbstractValueObject<PROPS> {
  protected constructor(props: PROPS) {
    super(props);
  }
}
