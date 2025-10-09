import { EventSerializer } from './EventSerializer';

export class EventSerializerRegistry {
  private static readonly serializers = new Map<string, EventSerializer>();
  private static strictMode = true;

  static register(eventType: string, serializer: EventSerializer): void {
    this.serializers.set(eventType, serializer);
  }

  static getSerializer(eventType: string): EventSerializer | undefined {
    return this.serializers.get(eventType);
  }

  static serializeEventData(
    eventType: string,
    data: unknown,
  ): Record<string, any> {
    const serializer = this.getSerializer(eventType);

    if (!serializer) {
      if (this.strictMode) {
        throw new Error(
          `No serializer registered for event type: ${eventType}. ` +
            `Please register a serializer in your context module.`,
        );
      }
      console.warn(`Using default serialization for ${eventType}`);
      return data as Record<string, any>;
    }

    return serializer.serialize(data);
  }

  static deserializeEventData(
    eventType: string,
    data: Record<string, any>,
  ): unknown {
    const serializer = this.getSerializer(eventType);

    if (!serializer) {
      return data;
    }

    return serializer.deserialize(data);
  }

  static setStrictMode(enabled: boolean): void {
    this.strictMode = enabled;
  }

  static getRegisteredEventTypes(): string[] {
    return Array.from(this.serializers.keys());
  }

  static isRegistered(eventType: string): boolean {
    return this.serializers.has(eventType);
  }
}
