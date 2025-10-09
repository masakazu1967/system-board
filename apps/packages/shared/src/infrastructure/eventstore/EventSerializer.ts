export interface EventSerializer<T = any> {
  serialize(data: T): Record<string, any>;
  deserialize(data: Record<string, any>): T;
}
