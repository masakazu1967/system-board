/**
 * Abstract Value Object Base Class
 * 値オブジェクトの基底抽象クラス
 * 不変性と等価性を保証
 */
export abstract class AbstractValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
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
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}

/**
 * Primitive Value Object
 * プリミティブ型の値オブジェクト基底クラス
 */
export abstract class PrimitiveValueObject<T> extends AbstractValueObject<{
  value: T;
}> {
  constructor(value: T) {
    super({ value });
  }

  public getValue(): T {
    return this.props.value;
  }
}

/**
 * Generic Value Object
 * 複数プロパティを持つ値オブジェクト基底クラス
 */
export abstract class ValueObject<T> extends AbstractValueObject<T> {
  /**
   * プロパティ取得メソッド
   * 具象クラスで必要に応じてゲッターを実装
   */
  protected getProps(): Readonly<T> {
    return this.props;
  }
}
